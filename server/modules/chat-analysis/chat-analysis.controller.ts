import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import type { Request } from 'express';

import type { ChatAnalysisResult } from '@shared/api.interface';
import { ChatAnalysisService } from './chat-analysis.service';

interface AnalyzeChatBody {
  chatText: string;
}

@Controller('api/chat-analysis')
export class ChatAnalysisController {
  constructor(private readonly chatAnalysisService: ChatAnalysisService) {}

  @Post()
  @NeedLogin()
  @HttpCode(HttpStatus.OK)
  async analyzeChat(
    @Body() body: AnalyzeChatBody,
    @Req() req: Request,
  ): Promise<ChatAnalysisResult> {
    const chatText: string = body?.chatText ?? '';
    if (!chatText || chatText.trim().length < 10) {
      throw new BadRequestException('聊天内容不能为空且至少10个字符');
    }
    const { userId } = req.userContext;
    return this.chatAnalysisService.analyze(chatText.trim(), userId);
  }
}
