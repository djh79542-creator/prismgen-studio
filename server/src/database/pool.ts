import mysql from 'mysql2/promise'

// 数据库配置：默认使用本地 MySQL（3306）
const host = process.env.MYSQL_HOST || '127.0.0.1'
const port = Number(process.env.MYSQL_PORT || 3306)
const user = process.env.MYSQL_USER || 'root'
const password = process.env.MYSQL_PASSWORD || ''
const database = process.env.MYSQL_DATABASE || 'prismgen'



export const pool = mysql.createPool({
  host,
  port,
  user,
  password,
  database,
  waitForConnections: true,
  connectionLimit: Number(process.env.MYSQL_POOL_SIZE || 10),
  maxIdle: 10,
  idleTimeout: 60000,
})

// 启动时输出数据库连接信息，便于排查是否连接到预期的库
try {
  console.log(`[db] connecting to ${user}@${host}:${port}/${database}`)
} catch {}

export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const [rows] = await pool.query(sql, params)
  return rows as T[]
}

export async function getConnection() {
  return pool.getConnection()
}

/**
 * 统一的语句执行器：只取 mysql2 结果元组的首项。
 * SELECT 得到行数组，UPDATE/INSERT 得到结果头（含 affectedRows）。
 */
export type Run = (sql: string, params?: any[]) => Promise<any>

export const runOnPool: Run = (sql, params = []) => pool.query(sql, params).then(([result]) => result)

/** 把事务连接包装成同样的执行器 */
export const runOn = (conn: mysql.PoolConnection): Run =>
  (sql, params = []) => conn.query(sql, params).then(([result]) => result)

