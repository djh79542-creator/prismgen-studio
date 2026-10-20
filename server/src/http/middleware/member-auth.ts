import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

// 扩展Request接口以包含用户信息
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// JWT密钥，在生产环境中应该从环境变量获取
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'your-secret-key-change-in-production';


// 生成JWT token
export const issueMemberToken = (payload: any): string => {
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: '72h' });
};

// 验证JWT token的中间件
export const requireMemberToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      error: '访问被拒绝，需要提供认证token',
      code: 'NO_TOKEN'
    });
  }

  jwt.verify(token, ACCESS_TOKEN_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({
        error: 'Token无效或已过期',
        code: 'INVALID_TOKEN'
      });
    }

    req.user = user;
    next();
  });
};

// 可选的token验证中间件（用于某些不强制要求登录的接口）
export const readMemberToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    jwt.verify(token, ACCESS_TOKEN_SECRET, (err: any, user: any) => {
      if (!err) {
        req.user = user;
      }
    });
  }

  next();
};
