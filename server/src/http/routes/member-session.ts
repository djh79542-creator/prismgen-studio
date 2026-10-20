import { Router } from 'express'
import { issueMemberToken } from '../middleware/member-auth'
import { memberStore } from '../../data/member-store'

const router = Router()

// 连续失败锁定，防止在线爆破
const MAX_FAILED = 5
const LOCK_MS = 24 * 60 * 60 * 1000 // 24 小时

interface AttemptRecord { failures: number; lockedUntil: number; lastTryAt: number }
const failedSignIns: Map<string, AttemptRecord> = new Map()

function registerFailure(username: string): { locked: boolean; attemptsRemaining: number; lockedUntil?: number } {
  const current = failedSignIns.get(username) || { failures: 0, lockedUntil: 0, lastTryAt: 0 }
  current.failures += 1
  current.lastTryAt = Date.now()

  if (current.failures >= MAX_FAILED) {
    current.lockedUntil = Date.now() + LOCK_MS
    failedSignIns.set(username, current)
    return { locked: true, attemptsRemaining: 0, lockedUntil: current.lockedUntil }
  }
  failedSignIns.set(username, current)
  return { locked: false, attemptsRemaining: MAX_FAILED - current.failures }
}

/** 未命中账号或密码不符都记一次失败，并按同一形态回应 */
function reject(res: any, username: string) {
  const outcome = registerFailure(username)
  if (outcome.locked) {
    return res.status(429).json({
      error: '连续失败次数过多，账号已锁定 24 小时。',
      lockedUntil: outcome.lockedUntil
    })
  }
  return res.status(401).json({ error: '账号或密码不正确', attemptsRemaining: outcome.attemptsRemaining })
}

// 使用端登录
router.post('/session/sign-in', async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: '需要账号与密码' })
    }

    const record = failedSignIns.get(username)
    if (record) {
      const now = Date.now()
      if (record.lockedUntil > now) {
        const remainingHours = Math.ceil((record.lockedUntil - now) / (60 * 60 * 1000))
        return res.status(429).json({
          error: `连续失败次数过多，请 ${remainingHours} 小时后再试。`,
          lockedUntil: record.lockedUntil
        })
      }
      failedSignIns.delete(username) // 锁定期已过
    }

    const member = await memberStore.credential(String(username))
    if (!member) return reject(res, username)

    if (member.account_state !== '0') {
      return res.status(403).json({ error: '账号已停用' })
    }

    if (member.secret !== password) return reject(res, username)

    failedSignIns.delete(username)

    const token = issueMemberToken({ id: member.member_id, username: member.login_name, role: 'user' })

    res.json({
      success: true,
      token,
      user: {
        id: member.member_id,
        username: member.login_name,
        credit_balance: member.credit_balance
      }
    })
  } catch (error) {
    console.error('Sign-in error:', error)
    res.status(500).json({ error: '登录处理异常' })
  }
})

export default router
