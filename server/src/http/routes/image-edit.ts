import { Router } from 'express'
import { requireMemberToken } from '../middleware/member-auth'
import { editStill as hubEditDirect } from '../../services/model-hub'
import { submitPaletteEdit as paletteEditDirect, queryPaletteTask } from '../../services/raster-palette'

const router = Router()

// ModelHub 图片编辑
router.post('/studio/image-edit', requireMemberToken, async (req, res) => {
  try {
    const { base64ImageData, mimeType, prompt, maskBase64, secondaryImage } = req.body
    const result = await hubEditDirect(base64ImageData, mimeType, prompt, maskBase64, secondaryImage)
    res.json(result)
  } catch (error: any) {
    console.error('ModelHub edit image error:', error)
    res.status(500).json({ error: error.message || 'Failed to edit image' })
  }
})

// Palette 图片编辑
router.post('/studio/palette-edit', requireMemberToken, async (req, res) => {
  try {
    const { base64ImageData, mimeType, prompt, secondaryImage } = req.body
    const result = await paletteEditDirect(base64ImageData, mimeType, prompt, secondaryImage)
    res.json(result)
  } catch (error: any) {
    console.error('Palette edit image error:', error)
    res.status(500).json({ error: error.message || 'Failed to edit image with Palette' })
  }
})

// Palette 任务状态查询
router.post('/studio/palette-result', requireMemberToken, async (req, res) => {
  try {
    const taskId = String(req.body?.taskId || req.query?.task_id || '')
    if (!taskId) {
      return res.status(400).json({ error: 'Missing taskId' })
    }
    const result = await queryPaletteTask(taskId)
    res.json(result)
  } catch (error: any) {
    console.error('Palette status query error:', error)
    res.status(500).json({ error: error.message || 'Failed to query task status' })
  }
})

export default router
