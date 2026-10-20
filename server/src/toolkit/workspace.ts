import fs from 'node:fs'
import path from 'node:path'
import { MEDIA_ROOT, MEDIA_URL_PREFIX } from '../config'

/** 落盘的两个桶：上传件与生成件 */
export const INPUT_BUCKET = 'inputs'
export const OUTPUT_BUCKET = 'outputs'

/** 由 URL/请求参数里的桶名换取所在目录，非法桶名返回 null */
export function resolveBucketDir(account: string, bucket: string): string | null {
  if (bucket !== INPUT_BUCKET && bucket !== OUTPUT_BUCKET) return null
  return path.join(MEDIA_ROOT, account, bucket)
}

/** 返回并创建某个账号的两个目录 */
export function ensureWorkspaceDirs(account: string): { inputDir: string; outputDir: string } {
  const inputDir = resolveBucketDir(account, INPUT_BUCKET)!
  const outputDir = resolveBucketDir(account, OUTPUT_BUCKET)!
  for (const dir of [inputDir, outputDir]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  }
  return { inputDir, outputDir }
}

/** 磁盘位置 -> 对外 URL */
export function mediaUrl(account: string, bucket: string, filename: string): string {
  return `${MEDIA_URL_PREFIX}/${account}/${bucket}/${filename}`
}
