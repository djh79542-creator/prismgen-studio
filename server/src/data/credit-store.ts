import type { Run } from '../database/pool'
import { runOnPool } from '../database/pool'

const JOURNAL = 'credit_journal'
const MEMBER = 'app_member'
const OPERATOR = 'console_operator'

/** 流水类别的存储编码，与前端展示名解耦 */
export const ENTRY_KIND = {
  recharge: '0',
  deduct: '1',
  image: '2',
  video: '3',
  refund: '4',
} as const

export type EntryKindCode = (typeof ENTRY_KIND)[keyof typeof ENTRY_KIND]

export const kindToName = (code: string): keyof typeof ENTRY_KIND => {
  switch (code) {
    case ENTRY_KIND.recharge: return 'recharge'
    case ENTRY_KIND.image: return 'image'
    case ENTRY_KIND.video: return 'video'
    case ENTRY_KIND.refund: return 'refund'
    default: return 'deduct'
  }
}

export interface NewEntry {
  memberId: number
  operatorId: number
  kind: EntryKindCode
  delta: number
  balanceBefore: number
  balanceAfter: number
}

export const creditStore = {
  async record(entry: NewEntry, run: Run = runOnPool): Promise<void> {
    await run(
      `INSERT INTO ${JOURNAL} (member_id, operator_id, entry_kind, delta, balance_before, balance_after, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [entry.memberId, entry.operatorId, entry.kind, entry.delta, entry.balanceBefore, entry.balanceAfter]
    )
  },

  /** 单个账号的流水，最新在前 */
  async latestForMember(memberId: number, limit = 200, run: Run = runOnPool) {
    const rows = await run(
      `SELECT entry_id, entry_kind, delta, balance_before, balance_after, created_at
       FROM ${JOURNAL}
       WHERE member_id = ?
       ORDER BY created_at DESC, entry_id DESC
       LIMIT ?`,
      [memberId, limit]
    )
    return rows.map((r: any) => ({
      id: r.entry_id,
      kind: String(r.entry_kind),
      delta: Number(r.delta),
      balanceBefore: Number(r.balance_before),
      balanceAfter: Number(r.balance_after),
      createdAt: r.created_at,
    }))
  },

  /** 管理台分页查询，可按账号与类别过滤 */
  async page(filter: { memberId?: number; kinds?: string[]; page: number; pageSize: number }, run: Run = runOnPool) {
    const where: string[] = []
    const params: any[] = []
    if (filter.memberId) {
      where.push(`j.member_id = ?`)
      params.push(filter.memberId)
    }
    if (filter.kinds?.length) {
      where.push(`j.entry_kind IN (${filter.kinds.map(() => '?').join(',')})`)
      params.push(...filter.kinds)
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const offset = (filter.page - 1) * filter.pageSize

    const totalRows = await run(`SELECT COUNT(1) AS total FROM ${JOURNAL} j ${whereSql}`, params)
    const rows = await run(
      `SELECT j.entry_id, j.member_id, j.operator_id, j.entry_kind, j.delta, j.balance_after, j.created_at,
              m.login_name AS member_name, o.login_name AS operator_name
       FROM ${JOURNAL} j
       LEFT JOIN ${MEMBER} m ON m.member_id = j.member_id
       LEFT JOIN ${OPERATOR} o ON o.operator_id = j.operator_id
       ${whereSql}
       ORDER BY j.entry_id DESC
       LIMIT ? OFFSET ?`,
      [...params, filter.pageSize, offset]
    )

    return {
      total: Number(totalRows[0]?.total ?? 0),
      rows: rows.map((r: any) => ({
        id: r.entry_id,
        memberId: r.member_id,
        memberName: r.member_name ?? '',
        operatorName: r.operator_name ?? '',
        type: kindToName(String(r.entry_kind)),
        delta: Number(r.delta),
        balanceAfter: Number(r.balance_after),
        createdAt: new Date(r.created_at).toISOString(),
      })),
    }
  },
}
