import { Router } from 'express'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import { ACCESS_TOKEN_SECRET } from '../../config'
import { operatorStore } from '../../data/operator-store'

const router = Router()

// 管理台登录：口令按 MD5 摘要比对
router.post('/sign-in', async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string }
  if (!username || !password) return res.status(400).json({ message: '缺少凭据' })

  const secretDigest = crypto.createHash('md5').update(password).digest('hex')
  const operator = await operatorStore.authenticate(String(username), secretDigest)
  if (!operator) return res.status(401).json({ message: '账号或密码错误' })

  const token = jwt.sign({ id: operator.id, username: operator.loginName, role: 'operator' }, ACCESS_TOKEN_SECRET, { expiresIn: '2h' })
  res.json({
    accessToken: token,
    operator: { id: operator.id, loginName: operator.loginName, role: 'operator' },
  })
})

export default router
