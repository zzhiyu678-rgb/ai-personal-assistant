import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { join } from 'path';
import { __express as hbsExpressEngine } from 'hbs';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

const isLocalDev = process.env.LOCAL_DEV === 'true';
const devUserId = process.env.DEV_USER_ID || 'local-dev-user';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    abortOnError: process.env.NODE_ENV !== 'development',
  });

  if (isLocalDev) {
    // ===== 本地开发模式：跳过平台身份校验 =====
    const logger = new Logger('LocalDev');
    logger.log('运行在本地开发模式，跳过平台身份认证');

    // 启用 CORS
    app.enableCors({
      origin: true,
      credentials: true,
    });

    // 注入模拟用户上下文（替代平台 req.userContext）
    app.use((req: any, _res: any, next: any) => {
      req.userContext = {
        userId: devUserId,
        name: process.env.DEV_USER_NAME || '本地用户',
        email: process.env.DEV_USER_EMAIL || 'dev@local.com',
        tenantId: 'local',
      };
      next();
    });
  } else {
    // ===== 平台模式：使用平台配置 =====
    const { configureApp } = await import('@lark-apaas/fullstack-nestjs-core');
    await configureApp(app, {
      disableSwagger: true,
    });
  }

  const logger = new Logger('Bootstrap');
  const host = process.env.SERVER_HOST || 'localhost';
  const port = Number(process.env.SERVER_PORT || process.env.PORT || '3000');

  // 注册视图引擎, 渲染 client 目录下的 html 文件
  app.setBaseViewsDir(join(process.cwd(), 'dist/client'));
  app.setViewEngine('html');
  app.engine('html', hbsExpressEngine);

  // 提供前端静态资源（JS/CSS/图片等）
  // index: false 避免 express.static 直接返回 index.html，
  // 让 NestJS 路由通过 Handlebars 渲染 index.html（替换模板变量）
  app.useStaticAssets(join(process.cwd(), 'dist/client'), {
    prefix: '/',
    index: false,
  });

  await app.listen(port, host);
  logger.log(`Server running on http://${host}:${port}`);
  logger.log(`API endpoints ready at http://${host}:${port}/api`);
  if (isLocalDev) {
    logger.log(`本地开发用户ID: ${devUserId}`);
  }
}

bootstrap();
