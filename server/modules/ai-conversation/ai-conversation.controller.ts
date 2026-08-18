import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  Res,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import type { Request, Response } from 'express';

import { AiConversationService } from './ai-conversation.service';

@Controller('api/ai-conversations')
export class AiConversationController {
  private readonly logger = new Logger(AiConversationController.name);

  constructor(private readonly aiConversationService: AiConversationService) {}

  @Get()
  @NeedLogin()
  async getConversations(@Req() req: Request) {
    const { userId } = req.userContext;
    return this.aiConversationService.getConversations(userId);
  }

  @Post()
  @NeedLogin()
  async createConversation(
    @Req() req: Request,
    @Body() body: { title?: string },
  ) {
    const { userId } = req.userContext;
    return this.aiConversationService.createConversation(userId, body.title);
  }

  @Delete(':id')
  @NeedLogin()
  async deleteConversation(@Param('id') id: string, @Req() req: Request) {
    const { userId } = req.userContext;
    return this.aiConversationService.deleteConversation(id, userId);
  }

  @Patch(':id')
  @NeedLogin()
  async updateConversation(
    @Param('id') id: string,
    @Body() body: { title?: string },
    @Req() req: Request,
  ) {
    const { userId } = req.userContext;
    if (!body.title || body.title.trim().length === 0) {
      throw new BadRequestException('标题不能为空');
    }
    const result = await this.aiConversationService.updateConversationTitle(
      id,
      body.title,
      userId,
    );
    if (!result) {
      throw new NotFoundException('对话不存在或无权限修改');
    }
    return result;
  }

  @Get(':id/messages')
  @NeedLogin()
  async getMessages(@Param('id') id: string, @Req() req: Request) {
    const { userId } = req.userContext;
    return this.aiConversationService.getMessages(id, userId);
  }

  @Post(':id/messages')
  @NeedLogin()
  async sendMessage(
    @Param('id') id: string,
    @Body() body: { content: string; attachments?: Array<{ type: string; name: string; content: string }> },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const { userId } = req.userContext;
    const content = body.content?.trim() ?? '';
    const attachments = body.attachments ?? [];

    if (!content && attachments.length === 0) {
      res.status(400).json({ message: '消息内容不能为空' });
      return;
    }

    // 校验归属
    await this.aiConversationService.verifyOwnership(id, userId);

    // 处理附件：图片用Vision分析，文件文本直接使用
    let attachmentContext = '';
    for (const att of attachments) {
      if (att.type === 'image' && att.content) {
        try {
          const desc = await this.aiConversationService.analyzeImage(att.content, content || '请描述这张图片');
          attachmentContext += `\n\n【图片：${att.name}】\n${desc}`;
        } catch (err) {
          this.logger.error(`Image analysis failed: ${JSON.stringify(err)}`);
          attachmentContext += `\n\n【图片：${att.name}】\n[图片分析失败]`;
        }
      } else if (att.type === 'file' && att.content) {
        attachmentContext += `\n\n【文件：${att.name}】\n${att.content.slice(0, 8000)}`;
      }
    }

    // 组合最终消息内容
    const finalContent = attachmentContext
      ? `${attachmentContext}\n\n【用户问题】\n${content || '请根据以上附件内容给出建议'}`
      : content;

    // 判断是否第一条消息（需在保存用户消息前判断）
    const isFirst =
      await this.aiConversationService.isFirstMessage(id);

    // 保存用户消息（保存原始内容，不包含附件上下文）
    await this.aiConversationService.saveUserMessage(id, content || '[附件]', userId);

    // 性能计时开始
    const perfStart = Date.now();

    // 组装上下文（传入用户消息用于知识库相关检索）
    const contextStart = Date.now();
    const context = await this.aiConversationService.buildContext(userId, finalContent);
    const contextTime = Date.now() - contextStart;

    // 设置流式响应头
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let aiContent = '';
    let clientDisconnected = false;
    let firstTokenTime = 0;

    // 监听客户端断开
    req.on('close', () => {
      clientDisconnected = true;
    });

    try {
      const stream = this.aiConversationService.streamCoachChat({
        userMessage: content,
        goalSummary: context.goalSummary,
        workRecordSummary: context.workRecordSummary,
        customerDataSummary: context.customerDataSummary,
        knowledgeBaseSummary: context.knowledgeBaseSummary,
        memorySummary: context.memorySummary,
        recentFollowUps: context.recentFollowUps,
      });
      for await (const chunk of stream) {
        if (firstTokenTime === 0) {
          firstTokenTime = Date.now() - perfStart;
        }
        aiContent += chunk;
        // 客户端断开后继续生成，但不再写入响应
        if (!clientDisconnected && !res.writableEnded) {
          try {
            res.write(chunk);
          } catch {
            clientDisconnected = true;
          }
        }
      }
      // 性能日志
      const totalTime = Date.now() - perfStart;
      this.logger.log(`[AI Coach Perf] context=${contextTime}ms firstToken=${firstTokenTime}ms total=${totalTime}ms contentLen=${aiContent.length}`);
    } catch (error) {
      this.logger.error(`Stream chat failed: ${JSON.stringify(error)}`);
      if (!clientDisconnected && !res.writableEnded) {
        const errMsg = error instanceof Error ? error.message : String(error);
        if (errMsg.includes('API Key') || errMsg.includes('豆包')) {
          res.write(`\n\n⚠️ ${errMsg}`);
        } else {
          res.write('\n\n[生成失败，请重试]');
        }
      }
    } finally {
      if (!res.writableEnded) {
        res.end();
      }
      // 保存 AI 消息（即使客户端断开也保存完整内容）
      if (aiContent.trim()) {
        this.aiConversationService
          .saveAssistantMessage(id, aiContent, userId)
          .catch((err: unknown) => {
            this.logger.error(
              `Save assistant message failed: ${JSON.stringify(err)}`,
            );
          });
      }
      // 第一条消息时异步生成标题
      if (isFirst) {
        this.aiConversationService
          .generateTitle(content)
          .then((title: string) => {
            return this.aiConversationService.updateConversationTitle(
              id,
              title,
              userId,
            );
          })
          .catch((err: unknown) => {
            this.logger.error(
              `Update conversation title failed: ${JSON.stringify(err)}`,
            );
          });
      }
    }
  }

  /**
   * 只保存用户消息，不触发AI生成。
   * 用于连续消息合并机制：用户连续发送的每条消息先单独保存，
   * 等待 debounce 窗口结束后再调用 /generate 合并生成一次回复。
   */
  @Post(':id/messages/save')
  @NeedLogin()
  async saveOnly(
    @Param('id') id: string,
    @Body() body: { content: string; attachments?: Array<{ type: string; name: string; content: string }> },
    @Req() req: Request,
  ) {
    const { userId } = req.userContext;
    const content = body.content?.trim() ?? '';
    const attachments = body.attachments ?? [];

    if (!content && attachments.length === 0) {
      throw new BadRequestException('消息内容不能为空');
    }

    await this.aiConversationService.verifyOwnership(id, userId);

    // 处理附件上下文（图片分析/文件文本），拼接到保存的内容中
    let attachmentContext = '';
    for (const att of attachments) {
      if (att.type === 'image' && att.content) {
        try {
          const desc = await this.aiConversationService.analyzeImage(att.content, content || '请描述这张图片');
          attachmentContext += `\n\n【图片：${att.name}】\n${desc}`;
        } catch (err) {
          this.logger.error(`Image analysis failed: ${JSON.stringify(err)}`);
          attachmentContext += `\n\n【图片：${att.name}】\n[图片分析失败]`;
        }
      } else if (att.type === 'file' && att.content) {
        attachmentContext += `\n\n【文件：${att.name}】\n${att.content.slice(0, 8000)}`;
      }
    }

    const finalContent = attachmentContext
      ? `${attachmentContext}\n\n【用户问题】\n${content || '请根据以上附件内容给出建议'}`
      : content;

    const saved = await this.aiConversationService.saveUserMessage(
      id,
      finalContent,
      userId,
    );

    return saved;
  }

  /**
   * 合并当前对话中所有"尚未得到AI回复"的用户消息，生成一次AI回复并流式返回。
   * 连续发送的多条消息会被合并为一次完整表达，AI只回复一次。
   */
  @Post(':id/messages/generate')
  @NeedLogin()
  async generateReply(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const { userId } = req.userContext;

    await this.aiConversationService.verifyOwnership(id, userId);

    // 获取所有未回复的用户消息
    const pendingMessages = await this.aiConversationService.getPendingUserMessages(id, userId);

    if (pendingMessages.length === 0) {
      res.status(400).json({ message: '没有待回复的用户消息' });
      return;
    }

    // 合并多条用户消息为一次完整表达
    const mergedContent = pendingMessages
      .map((m, i) => pendingMessages.length > 1 ? `${i + 1}. ${m.content}` : m.content)
      .join('\n\n');

    // 判断是否第一条消息（对话中还没有任何assistant消息）
    const isFirst = pendingMessages.length > 0 && (
      await this.aiConversationService.getMessages(id, userId)
    ).items.every((m) => m.role === 'user');

    // 性能计时
    const perfStart = Date.now();
    const contextStart = Date.now();
    const context = await this.aiConversationService.buildContext(userId, mergedContent);
    const contextTime = Date.now() - contextStart;

    // 设置流式响应头
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let aiContent = '';
    let clientDisconnected = false;
    let firstTokenTime = 0;

    req.on('close', () => {
      clientDisconnected = true;
    });

    try {
      const stream = this.aiConversationService.streamCoachChat({
        userMessage: mergedContent,
        goalSummary: context.goalSummary,
        workRecordSummary: context.workRecordSummary,
        customerDataSummary: context.customerDataSummary,
        knowledgeBaseSummary: context.knowledgeBaseSummary,
        memorySummary: context.memorySummary,
        recentFollowUps: context.recentFollowUps,
      });

      for await (const chunk of stream) {
        if (firstTokenTime === 0) {
          firstTokenTime = Date.now() - perfStart;
        }
        aiContent += chunk;
        if (!clientDisconnected && !res.writableEnded) {
          try {
            res.write(chunk);
          } catch {
            clientDisconnected = true;
          }
        }
      }

      const totalTime = Date.now() - perfStart;
      this.logger.log(`[AI Coach Generate] pending=${pendingMessages.length} context=${contextTime}ms firstToken=${firstTokenTime}ms total=${totalTime}ms contentLen=${aiContent.length}`);
    } catch (error) {
      this.logger.error(`Generate reply failed: ${JSON.stringify(error)}`);
      // 如果已经生成了部分内容，不写入错误信息到流，直接结束。
      // 部分内容会在 finally 中保存到数据库，前端刷新后可见。
      if (!aiContent.trim() && !clientDisconnected && !res.writableEnded) {
        const errMsg = error instanceof Error ? error.message : String(error);
        if (errMsg.includes('API Key') || errMsg.includes('豆包')) {
          res.write(`⚠️ ${errMsg}`);
        } else {
          res.write('⚠️ AI暂时无法回复，请重试。');
        }
      }
    } finally {
      if (!res.writableEnded) {
        res.end();
      }
      // 保存AI消息（即使客户端断开也保存）
      if (aiContent.trim()) {
        this.aiConversationService
          .saveAssistantMessage(id, aiContent, userId)
          .catch((err: unknown) => {
            this.logger.error(`Save assistant message failed: ${JSON.stringify(err)}`);
          });
      }
      // 第一条消息时异步生成标题
      if (isFirst && pendingMessages.length > 0) {
        const firstUserContent = pendingMessages[0].content;
        this.aiConversationService
          .generateTitle(firstUserContent)
          .then((title: string) => {
            return this.aiConversationService.updateConversationTitle(id, title, userId);
          })
          .catch((err: unknown) => {
            this.logger.error(`Update conversation title failed: ${JSON.stringify(err)}`);
          });
      }
    }
  }
}
