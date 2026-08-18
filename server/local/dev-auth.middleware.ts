import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

/**
 * 本地开发模式中间件
 * 注入模拟用户上下文 req.userContext，替代平台身份认证
 */
@Injectable()
export class DevAuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger('DevAuth');

  use(req: Request, res: Response, next: NextFunction) {
    const devUserId = process.env.DEV_USER_ID || 'local-dev-user';

    (req as any).userContext = {
      userId: devUserId,
      name: process.env.DEV_USER_NAME || '本地用户',
      email: process.env.DEV_USER_EMAIL || 'dev@local.com',
      tenantId: 'local',
    };

    next();
  }
}
