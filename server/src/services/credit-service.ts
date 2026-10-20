import { getConnection, runOn } from '../database/pool'
import { memberStore } from '../data/member-store'
import { creditStore, ENTRY_KIND } from '../data/credit-store'

export type OperationType = 'recharge' | 'deduct' | 'image' | 'video' | 'refund'

export interface AdjustDto {
  memberId: number
  operatorId: number
  type: OperationType
  amount: number
  reason?: string // 表内无该列，允许前端传入但不入库
}

const KIND_BY_TYPE: Record<OperationType, string> = {
  recharge: ENTRY_KIND.recharge,
  deduct: ENTRY_KIND.deduct,
  image: ENTRY_KIND.image,
  video: ENTRY_KIND.video,
  refund: ENTRY_KIND.refund,
}

export const CreditService = {
  /** 管理台手工调整额度：余额更新与流水写入在同一事务内 */
  async create(dto: AdjustDto) {
    const member = await memberStore.findById(dto.memberId)
    if (!member) throw new Error('Member not found')
    const topUp = dto.type === 'recharge'
    const balanceBefore = member.creditBalance
    const balanceAfter = topUp ? balanceBefore + dto.amount : balanceBefore - dto.amount

    const conn = await getConnection()
    try {
      await conn.beginTransaction()
      const run = runOn(conn)
      await run(`UPDATE app_member SET credit_balance = ? WHERE member_id = ?`, [balanceAfter, member.id])
      await creditStore.record(
        {
          memberId: dto.memberId,
          operatorId: dto.operatorId,
          kind: (topUp ? ENTRY_KIND.recharge : ENTRY_KIND.deduct),
          delta: dto.amount,
          balanceBefore,
          balanceAfter,
        },
        run
      )
      await conn.commit()
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
    return { balanceBefore, balanceAfter }
  },

  async list(params: {
    memberId?: number
    type?: OperationType
    types?: OperationType[]
    page?: number
    pageSize?: number
  }) {
    const { memberId, type, types, page = 1, pageSize = 20 } = params
    const selected = Array.isArray(types) && types.length > 0 ? types : type ? [type] : undefined
    const kinds = selected?.map(t => KIND_BY_TYPE[t])
    return creditStore.page({ memberId, kinds, page, pageSize })
  }
}
