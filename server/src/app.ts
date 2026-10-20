import express from 'express'
import cors from 'cors'
import { pool } from './database/pool'
import { MEDIA_ROOT, MEDIA_URL_PREFIX } from './config'

// 管理端
import operatorSessionRoutes from './http/routes/operator-session'
import memberRoutes from './http/routes/members'
import operatorCreditRoutes from './http/routes/operator-credits'

// 使用端
import memberSessionRoutes from './http/routes/member-session'
import memberCreditRoutes from './http/routes/member-credits'
import studioRoutes from './http/routes/image-edit'
import motionRoutes, { noticeMotionJob } from './http/routes/motion-jobs'
import assetRoutes from './http/routes/assets'
import galleryRoutes from './http/routes/gallery'

import { apiErrorHandler } from './http/middleware/error'

export function createApp() {
  const app = express()

  // 跨域白名单：留空表示不限制
  const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true)
        if (allowedOrigins.length === 0) return callback(null, true)
        callback(null, allowedOrigins.includes(origin))
      },
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  )
  app.options('*', cors())

  app.use(express.json({ limit: '80mb' }))
  app.use(express.urlencoded({ limit: '80mb', extended: true }))

  // 上传件与生成件的静态服务
  app.use(MEDIA_URL_PREFIX, express.static(MEDIA_ROOT))

  // 健康检查
  app.get('/api/status', (_req, res) => res.json({ ok: true }))
  app.get('/api/status/database', async (_req, res) => {
    try {
      const conn = await pool.getConnection()
      try {
        const [rows] = await conn.query('SELECT 1 AS ok')
        res.json({ ok: true, result: rows })
      } finally {
        conn.release()
      }
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err?.message || String(err) })
    }
  })

  // 管理端
  app.use('/api/console/session', operatorSessionRoutes)
  app.use('/api/console/members', memberRoutes)
  app.use('/api/console/credits', operatorCreditRoutes)

  // 使用端
  app.use('/api', memberSessionRoutes) // POST /api/session/... 见该路由内部前缀
  app.use('/api/credits', memberCreditRoutes)
  app.use('/api', studioRoutes) // POST /api/studio/*
  app.use('/api/motion', motionRoutes)
  app.post('/api/motion/webhook', noticeMotionJob) // 生成回调的外部别名
  app.use('/api/assets', assetRoutes)
  app.use('/api/gallery', galleryRoutes)

  app.use(apiErrorHandler)

  return app
}
