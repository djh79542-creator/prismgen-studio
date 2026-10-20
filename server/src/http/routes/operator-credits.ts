import { Router } from 'express'
import { requireOperatorToken } from '../middleware/operator-auth'
import { CreditService } from '../../services/credit-service'
import { z } from 'zod'

const router = Router()

const adjustSchema = z.object({
  memberId: z.number().int().positive(),
  type: z.enum(['recharge', 'deduct']),
  amount: z.number().int().positive(),
  reason: z.string().optional(),
})

router.post('/', requireOperatorToken, async (req, res, next) => {
  try {
    const parsed = adjustSchema.parse(req.body)
    const operatorId = (req as any).user.id as number
    const result = await CreditService.create({ ...parsed, operatorId })
    res.json({ success: true, ...result })
  } catch (err) {
    next(err)
  }
})

router.get('/entries', requireOperatorToken, async (req, res) => {
  const { memberId, type, types, page = '1', pageSize = '20' } = req.query as any
  const validTypes = new Set(['recharge', 'deduct', 'image', 'video', 'refund'])
  const parsedTypes = typeof types === 'string'
    ? types.split(',').map((t: string) => t.trim()).filter((t: string) => validTypes.has(t))
    : undefined
  const data = await CreditService.list({
    memberId: memberId ? Number(memberId) : undefined,
    type: typeof type === 'string' && validTypes.has(type) ? (type as any) : undefined,
    types: parsedTypes as any,
    page: Number(page),
    pageSize: Number(pageSize),
  })
  res.json(data)
})

export default router