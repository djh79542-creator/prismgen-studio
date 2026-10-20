import { Router } from 'express'
import { requireMemberToken } from '../middleware/member-auth'
import { getConnection, runOn, runOnPool, type Run } from '../../database/pool'
import { memberStore } from '../../data/member-store'
import { creditStore, ENTRY_KIND, type EntryKindCode } from '../../data/credit-store'

const router = Router()

/** 可消耗的生成类别：2=静帧 3=动态 */
const CONSUMABLE_KINDS: string[] = [ENTRY_KIND.image, ENTRY_KIND.video]

/**
 * 变更本人额度并记一笔流水。优先在事务里完成，取不到事务连接时退化为连接池直跑。
 * 返回变更后的余额；扣减时余额不足则不做任何写入并返回 null。
 */
async function adjustOwnBalance(
  username: string,
  kind: EntryKindCode,
  delta: number,
  mode: 'consume' | 'restore'
): Promise<number | null> {
  const conn = await getConnection().catch(() => null)
  const run: Run = conn ? runOn(conn) : runOnPool
  const settle = async (action: 'commit' | 'rollback') => {
    if (conn) {
      try { await conn[action]() } catch {}
    }
  }
  try {
    if (conn) await conn.beginTransaction()
    if (mode === 'consume') {
      const debited = await memberStore.debit(username, delta, run)
      if (!debited) {
        await settle('rollback')
        return null
      }
    } else {
      await memberStore.refund(username, delta, run)
    }
    const member = await memberStore.findByLoginName(username, run)
    const balance = member?.creditBalance ?? 0
    const balanceBefore = mode === 'consume' ? balance + delta : balance - delta
    await creditStore.record(
      { memberId: member?.id ?? 0, operatorId: 0, kind, delta, balanceBefore, balanceAfter: balance },
      run
    )
    await settle('commit')
    return balance
  } catch (err) {
    await settle('rollback')
    throw err
  } finally {
    try { conn?.release() } catch {}
  }
}

// 额度余额
router.get('/balance', requireMemberToken, async (req, res) => {
  try {
    const username = req.user?.username
    if (!username) {
      return res.status(401).json({ error: '未认证', code: 'NO_USER' })
    }
    const member = await memberStore.findByLoginName(String(username))
    res.json({ success: true, balance: member?.creditBalance ?? 0 })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || '查询失败' })
  }
})

// 本人的额度流水
router.get('/entries', requireMemberToken, async (req, res) => {
  try {
    const username = req.user?.username
    if (!username) {
      return res.status(401).json({ error: '未认证', code: 'NO_USER' })
    }
    const member = await memberStore.findByLoginName(String(username))
    if (!member) {
      return res.json({ success: true, list: [] })
    }
    const list = await creditStore.latestForMember(member.id)
    res.json({ success: true, list })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || '查询失败' })
  }
})

// 生成任务扣额度
router.post('/consume', requireMemberToken, async (req, res) => {
  const { kind, amount } = req.body || {}
  try {
    const username = req.user?.username
    if (!username) {
      return res.status(401).json({ success: false, error: '未认证', code: 'NO_USER' })
    }
    const entryKind = String(kind)
    const delta = Number(amount)
    if (!CONSUMABLE_KINDS.includes(entryKind) || !Number.isFinite(delta) || delta <= 0) {
      return res.status(400).json({ success: false, error: '参数不合法', code: 'BAD_PARAMS' })
    }

    const balance = await adjustOwnBalance(String(username), entryKind as EntryKindCode, delta, 'consume')
    if (balance === null) {
      return res.status(400).json({ success: false, error: '额度不足', code: 'INSUFFICIENT_CREDITS' })
    }
    res.json({ success: true, balance })
  } catch (err: any) {
    console.error('Credit consume error:', err)
    res.status(500).json({ success: false, error: '扣除失败' })
  }
})

// 生成失败回补额度
router.post('/restore', requireMemberToken, async (req, res) => {
  const { amount } = req.body || {}
  try {
    const username = req.user?.username
    if (!username) {
      return res.status(401).json({ success: false, error: '未认证', code: 'NO_USER' })
    }
    const delta = Number(amount)
    if (!Number.isFinite(delta) || delta <= 0) {
      return res.status(400).json({ success: false, error: '参数不合法', code: 'BAD_PARAMS' })
    }

    const balance = await adjustOwnBalance(String(username), ENTRY_KIND.refund, delta, 'restore')
    res.json({ success: true, balance })
  } catch (err: any) {
    console.error('Credit restore error:', err)
    res.status(500).json({ success: false, error: '返还失败' })
  }
})

export default router
