import { Router } from 'express'
import { requireMemberToken } from '../middleware/member-auth'
import { submitMotionJob, loadMotionJob, mintMotionToken } from '../../services/motion-engine'
import { runExclusively } from '../../toolkit/exclusive-gate'

const router = Router()

// 视频任务缓存（用于回调）
const motionNotices = new Map<string, any>()

// 轮询时间限制（5分钟）与任务首次轮询时间记录
const POLL_MAX_MS = 5 * 60 * 1000
const pollStartedAt = new Map<string, number>()

// 视频生成
router.post('/jobs', requireMemberToken, async (req, res) => {
  try {
    const { imageDataUrl, prompt, duration, negativePrompt, tailImageDataUrl } = req.body
    console.log('Request body:', req.body)
    if (!imageDataUrl || !prompt || !duration) {
      return res.status(400).json({ error: 'failure.unified' })
    }

    const base64 = (typeof imageDataUrl === 'string' && imageDataUrl.startsWith('data:'))
      ? imageDataUrl.split(',')[1]
      : imageDataUrl
    const tailBase64 = (typeof tailImageDataUrl === 'string' && tailImageDataUrl.startsWith('data:'))
      ? tailImageDataUrl.split(',')[1]
      : tailImageDataUrl

    const result = await runExclusively(async () => {
      const motionBearer = await mintMotionToken()
      await new Promise(resolve => setTimeout(resolve, 5000))
      const response = await submitMotionJob(prompt, base64, Number(duration), motionBearer)
      const taskId = (response as any).task_id || (response as any).data.task_id
      if (!taskId) {
        // Bubble up as error to be handled uniformly
        throw new Error('failure.unified')
      }
      return { task_id: taskId }
    })

    res.json(result)
  } catch (error: any) {
    if (error?.code === 429) {
      const message = error?.name === 'GateOverflowError'
        ? '队列已满，请稍后再试'
        : '视频生成正在进行，请稍后重试'
      return res.status(429).json({ error: message })
    }
    console.error('Video generate error:', error)
    res.status(500).json({ error: (error as Error).message || 'failure.unified' })
  }
})

// 查询视频状态
router.get('/result', requireMemberToken, async (req, res) => {
  try {
    const generationId = (req.query.task_id) as string
    if (!generationId) {
      return res.status(400).json({ error: 'failure.unified' })
    }

    // 设置/检查首次轮询时间，超时则直接返回错误，不再请求上游
    const now = Date.now()
    const started = pollStartedAt.get(String(generationId))
    if (!started) {
      pollStartedAt.set(String(generationId), now)
    } else if (now - started > POLL_MAX_MS) {
      return res.status(408).json({ error: 'Polling timeout exceeded 5 minutes' })
    }
    // 优先使用缓存
    const cached = motionNotices.get(String(generationId))
    if (cached) {
      const isSuccess = (cached.status === 'succeed') || (cached.status === 'completed') || (!!cached.videoUrl)
      if (isSuccess) {
        return res.json({ status: 'succeed', videoUrl: cached.videoUrl, raw: cached.raw })
      }
      if (cached.status === 'failed') {
        return res.status(408).json({ error: 'failed video' })
      }
    }

    // 回退到轮询
    const status = await loadMotionJob(generationId)
    res.json(status)
  } catch (error) {
    console.error('Video status error:', error)
    res.status(500).json({ error: (error as Error).message || 'failure.unified' })
  }
})

// 视频回调处理
const noticeMotionJob = async (req: any, res: any) => {
  try {
    const body = req.body
    console.log('[video callback] received:', JSON.stringify(body, null, 2))

    const taskId = body?.task_id || body?.data?.task_id
    if (!taskId) {
      console.warn('[video callback] missing task_id')
      return res.status(400).json({ error: 'Missing task_id' })
    }

    motionNotices.set(String(taskId), {
      status: body.status || body.data?.status,
      videoUrl: body.video_url || body.data?.video_url,
      raw: body,
      receivedAt: Date.now()
    })

    res.json({ success: true })
  } catch (error) {
    console.error('[video callback] error:', error)
    res.status(500).json({ error: 'Callback processing failed' })
  }
}

// 官方回调路由
router.post('/notice', noticeMotionJob)

export default router
export { noticeMotionJob }
