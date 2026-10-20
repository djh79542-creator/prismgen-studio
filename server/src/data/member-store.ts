import type { Run } from '../database/pool'
import { runOnPool } from '../database/pool'

const TABLE = 'app_member'

/** 可登录且未注销的账号 */
const ACTIVE = `(account_state = '0' OR account_state = 0) AND (deleted_flag IS NULL OR deleted_flag = '0')`

export interface MemberProfile {
  id: number
  username: string
  creditBalance: number
}

export interface MemberCredentialRow {
  member_id: number
  login_name: string
  secret: string
  credit_balance: number
  account_state: string
}

const toProfile = (row: any): MemberProfile => ({
  id: row.member_id,
  username: row.login_name,
  creditBalance: Number(row.credit_balance),
})

export const memberStore = {
  /** 登录校验用：带出明文比对所需的行 */
  async credential(loginName: string, run: Run = runOnPool): Promise<MemberCredentialRow | undefined> {
    const rows = await run(
      `SELECT member_id, login_name, secret, credit_balance, account_state
       FROM ${TABLE}
       WHERE login_name = ? AND (deleted_flag IS NULL OR deleted_flag = '0')
       LIMIT 1`,
      [loginName]
    )
    return rows[0]
  },

  async findByLoginName(loginName: string, run: Run = runOnPool): Promise<MemberProfile | undefined> {
    const rows = await run(
      `SELECT member_id, login_name, credit_balance FROM ${TABLE} WHERE login_name = ? LIMIT 1`,
      [loginName]
    )
    return rows[0] && toProfile(rows[0])
  },

  async findById(id: number, run: Run = runOnPool): Promise<MemberProfile | undefined> {
    const rows = await run(
      `SELECT member_id, login_name, credit_balance FROM ${TABLE} WHERE member_id = ? LIMIT 1`,
      [id]
    )
    return rows[0] && toProfile(rows[0])
  },

  async page(keyword: string | undefined, page: number, pageSize: number, run: Run = runOnPool) {
    const where = `WHERE ${ACTIVE}${keyword ? ' AND login_name LIKE ?' : ''}`
    const params: any[] = keyword ? [`%${keyword}%`] : []
    const offset = (page - 1) * pageSize
    const totalRows = await run(`SELECT COUNT(1) AS total FROM ${TABLE} ${where}`, params)
    const list = await run(
      `SELECT member_id, login_name, credit_balance
       FROM ${TABLE} ${where}
       ORDER BY member_id DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    )
    return { total: Number(totalRows[0]?.total ?? 0), rows: list.map(toProfile) }
  },

  /** 扣减额度，余额不足时不会改动任何行 */
  async debit(loginName: string, amount: number, run: Run = runOnPool): Promise<boolean> {
    const result = await run(
      `UPDATE ${TABLE} SET credit_balance = credit_balance - ?
       WHERE login_name = ? AND credit_balance >= ? AND ${ACTIVE}`,
      [amount, loginName, amount]
    )
    return (result?.affectedRows ?? 0) > 0
  },

  /** 回补额度 */
  async refund(loginName: string, amount: number, run: Run = runOnPool): Promise<void> {
    await run(`UPDATE ${TABLE} SET credit_balance = credit_balance + ? WHERE login_name = ?`, [amount, loginName])
  },
}
