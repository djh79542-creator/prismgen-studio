import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { requireMemberToken } from '../middleware/member-auth'
import { ensureWorkspaceDirs, mediaUrl, resolveBucketDir, INPUT_BUCKET } from '../../toolkit/workspace'

const router = Router()

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp']

// 配置 multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const username = req.user?.username || 'anonymous'
    const { inputDir } = ensureWorkspaceDirs(username)
    cb(null, inputDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    const ext = path.extname(file.originalname)
    const name = path.basename(file.originalname, ext)
    cb(null, `${name}-${uniqueSuffix}${ext}`)
  }
})

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 80 * 1024 * 1024 // 80MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF and WebP are allowed.'))
    }
  }
})

// 上传文件
router.post('/', requireMemberToken, (req, res) => {
  upload.single('file')(req, res, (err) => {
    try {
      if (err) {
        console.error('Upload error:', err)
        return res.status(400).json({ error: err.message })
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' })
      }

      const username = req.user?.username || 'anonymous'
      const fileUrl = mediaUrl(username, INPUT_BUCKET, req.file.filename)

      res.json({
        success: true,
        file: {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          filename: req.file.filename,
          url: fileUrl,
          size: req.file.size,
          type: path.extname(req.file.filename).substring(1),
          uploadTime: new Date().toISOString()
        }
      })
    } catch (error: any) {
      console.error('Upload processing error:', error)
      res.status(500).json({ error: error.message || 'Upload failed' })
    }
  })
})

// 获取上传文件列表
router.get('/', requireMemberToken, (req, res) => {
  try {
    const username = req.user?.username || 'anonymous'
    const { inputDir } = ensureWorkspaceDirs(username)

    if (!fs.existsSync(inputDir)) {
      return res.json({ success: true, files: [] })
    }

    const files = fs.readdirSync(inputDir)
      .filter(file => {
        const ext = path.extname(file).toLowerCase()
        return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)
      })
      .map(filename => {
        const filePath = path.join(inputDir, filename)
        const stats = fs.statSync(filePath)
        return {
          id: `${stats.mtimeMs}-${filename}`,
          filename,
          url: mediaUrl(username, INPUT_BUCKET, filename),
          size: stats.size,
          type: path.extname(filename).substring(1),
          uploadTime: stats.mtime.toISOString()
        }
      })
      .sort((a, b) => new Date(b.uploadTime).getTime() - new Date(a.uploadTime).getTime())

    res.json({ success: true, files })
  } catch (error: any) {
    console.error('Get uploads error:', error)
    res.status(500).json({ error: error.message || 'Failed to get uploads' })
  }
})

// 删除文件
router.delete('/:bucket/:filename', requireMemberToken, (req, res) => {
  try {
    const { bucket } = req.params
    // 只取纯文件名，防止 ../ 之类的写法越出账号目录
    const filename = path.basename(req.params.filename)
    const username = req.user?.username || 'anonymous'

    const bucketDir = resolveBucketDir(username, bucket)
    if (!bucketDir) {
      return res.status(400).json({ error: 'Invalid directory' })
    }

    const filePath = path.join(bucketDir, filename)

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' })
    }

    fs.unlinkSync(filePath)
    res.json({ success: true, message: 'File deleted successfully' })
  } catch (error: any) {
    console.error('Delete file error:', error)
    res.status(500).json({ error: error.message || 'Failed to delete file' })
  }
})

export default router
