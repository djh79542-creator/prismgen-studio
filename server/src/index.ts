import { createApp } from './app'
import { HTTP_PORT } from './config'

createApp().listen(HTTP_PORT, () => {
  console.log(`[api] listening on http://localhost:${HTTP_PORT}`)
  console.log('[api] 管理端: /api/console/session, /api/console/members, /api/console/credits')
  console.log('[api] 使用端: /api/session/sign-in, /api/studio, /api/motion, /api/assets, /api/gallery')
})
