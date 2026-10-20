/** 额度流水的操作类别 */
export type CreditKind = 'recharge' | 'deduct' | 'image' | 'video' | 'refund'

/** 运营台选择器里的账号 */
export interface MemberOption {
  id: string
  loginName: string
  creditBalance: number
}

/** 一条额度流水，字段与 /api/console/credits/entries 的返回一致 */
export interface LedgerEntry {
  id: string
  timestamp: number
  memberId: string
  memberName: string
  operatorName: string
  type: CreditKind
  delta: number
  balanceAfter: number
}
