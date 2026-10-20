import dotenv from 'dotenv'
import path from 'node:path'

// 从 server 目录加载 .env.local，并回退尝试加载项目根目录的 .env 文件
try {
  const serverRoot = path.resolve(__dirname, '../../')  // server/
  const localEnv = path.join(serverRoot, '.env.local')
  const prodEnv = path.join(serverRoot, '.env.production')
  const defaultEnv = path.join(serverRoot, '.env')
  // 项目根目录（相对 server 的上一级）
  const projectRoot = path.resolve(serverRoot, '..')
  const rootLocalEnv = path.join(projectRoot, '.env.local')
  const rootProdEnv = path.join(projectRoot, '.env.production')
  const rootDefaultEnv = path.join(projectRoot, '.env')

  if (process.env.NODE_ENV === 'production') {
    dotenv.config({ path: prodEnv })
    // 生产环境回退：若 server 下未配置，则尝试读取根目录配置（不覆盖）
    dotenv.config({ path: rootProdEnv })
  } else {
    dotenv.config({ path: localEnv })
    // 开发环境回退：若 server 下未配置，则尝试读取根目录配置（不覆盖）
    dotenv.config({ path: rootLocalEnv })
  }
  // 兜底再尝试加载 .env（如果存在）
  dotenv.config({ path: defaultEnv })
  dotenv.config({ path: rootDefaultEnv })
} catch (err) {
  console.error('[Config] Error loading env:', err)
}

export const HTTP_PORT = Number(process.env.HTTP_PORT || 7008)
export const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'dev_secret_change_me'

/** 上传件与生成件的落盘根目录，按账号分子目录 */
export const MEDIA_ROOT = path.resolve(process.env.MEDIA_ROOT || path.join(process.cwd(), 'media'))
/** 上述目录对外的 URL 前缀 */
export const MEDIA_URL_PREFIX = '/media'
