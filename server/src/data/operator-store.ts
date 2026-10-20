import type { Run } from '../database/pool'
import { runOnPool } from '../database/pool'

const TABLE = 'console_operator'

export interface OperatorProfile {
  id: number
  loginName: string
}

export const operatorStore = {
  /** 账号名 + 摘要双重匹配，且账号可用 */
  async authenticate(loginName: string, secretDigest: string, run: Run = runOnPool): Promise<OperatorProfile | undefined> {
    const rows = await run(
      `SELECT operator_id, login_name
       FROM ${TABLE}
       WHERE login_name = ? AND secret_digest = ?
         AND (account_state = '0' OR account_state = 0)
         AND (deleted_flag IS NULL OR deleted_flag = '0')
       LIMIT 1`,
      [loginName, secretDigest]
    )
    const row = rows[0]
    return row && { id: row.operator_id, loginName: row.login_name }
  },
}
