import { Router } from 'express'
import path from 'path'
import fs from 'fs'
import { requireMemberToken } from '../middleware/member-auth'
import { ensureWorkspaceDirs, mediaUrl, OUTPUT_BUCKET } from '../../toolkit/workspace'

const router = Router()

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp']

// 保存生成件
router.post('/archive', requireMemberToken, async (req, res) => {
  try {
    const { imageData, filename, type } = req.body
    const username = req.user?.username || 'anonymous'

    if (!imageData || !filename) {
      return res.status(400).json({ error: 'Missing imageData or filename' })
    }

    const { outputDir } = ensureWorkspaceDirs(username)
    const filePath = path.join(outputDir, path.basename(filename))

    // 解析 base64 数据
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')

    fs.writeFileSync(filePath, buffer)

    res.json({
      success: true,
      file: {
        filename,
        url: mediaUrl(username, OUTPUT_BUCKET, filename),
        type: type || 'image'
      }
    })
  } catch (error: any) {
    console.error('Save history error:', error)
    res.status(500).json({ error: error.message || 'Failed to save history' })
  }
})

// 获取生成件列表
router.get('/', requireMemberToken, (req, res) => {
  try {
    const username = req.user?.username || 'anonymous'
    const { outputDir } = ensureWorkspaceDirs(username)

    const files = fs.readdirSync(outputDir)
      .filter(file => IMAGE_EXTENSIONS.includes(path.extname(file).toLowerCase()))
      .map(filename => {
        const stats = fs.statSync(path.join(outputDir, filename))
        return {
          id: `${stats.mtimeMs}-${filename}`,
          filename,
          imageUrl: mediaUrl(username, OUTPUT_BUCKET, filename),
          type: 'image',
          timestamp: stats.mtime.getTime()
        }
      })
      .sort((a, b) => b.timestamp - a.timestamp)

    res.json({ success: true, files })
  } catch (error: any) {
    console.error('Get history error:', error)
    res.status(500).json({ error: error.message || 'Failed to get history' })
  }
})

export default router
