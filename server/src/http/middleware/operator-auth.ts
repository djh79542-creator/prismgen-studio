import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { ACCESS_TOKEN_SECRET } from '../../config'

export interface AuthPayload { id: number; username: string; role: string }

export function requireOperatorToken(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' })
  }
  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, ACCESS_TOKEN_SECRET) as AuthPayload
    ;(req as any).user = payload
    next()
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' })
  }
}