import { Controller, Get, Render, Req } from '@nestjs/common';
import type { Request } from 'express';

@Controller()
export class ViewController {

  @Get(['/', '*'])
  @Render('index')
  async render(@Req() req: Request): Promise<Record<string, string>> {
    const userContext = (req as any).userContext ?? {};
    const platformData = (req as any).__platform_data__ ?? {};

    return {
      // 平台相关变量（本地开发模式提供默认值）
      csrfToken: '',
      userId: userContext.userId ?? 'local-dev-user',
      tenantId: userContext.tenantId ?? 'local',
      appId: 'ai-work-coach',
      environment: 'development',
      appName: 'AI私人助理',
      appAvatar: '',
      appDescription: 'AI私人助理 - 个人工作与销售助手',
      basename: '/',
      currentUrl: req.originalUrl,
      // 不要删除这行，客户端用来获取平台信息
      __platform__: JSON.stringify(platformData),
    };
  }
}
