import { Router } from 'express'
import { requireOperatorToken } from '../middleware/operator-auth'
import { MemberService } from '../../services/member-service'

const router = Router()

// 账号列表（分页 + 关键词）
router.get('/', requireOperatorToken, async (req, res) => {
  const { keyword = '', page = '1', pageSize = '20' } = req.query
  const data = await MemberService.list(String(keyword) || undefined, Number(page), Number(pageSize))
  res.json(data)
})

// 单个账号的额度
router.get('/:id/credits', requireOperatorToken, async (req, res) => {
  const id = Number(req.params.id)
  const member = await MemberService.getById(id)
  if (!member) return res.status(404).json({ message: '账号不存在' })
  res.json({ memberId: member.id, loginName: member.username, creditBalance: member.creditBalance })
})

export default router
