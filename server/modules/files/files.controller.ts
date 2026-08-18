import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Req,
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import { diskStorage } from 'multer';
import type { Response } from 'express';
import { extname } from 'path';
import { existsSync, unlinkSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';

import { FilesService } from './files.service';
import { TextExtractorService } from './text-extractor.service';
import { createMulterStorage, fileFilter } from './multer.config';

@Controller('api/files')
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
    private readonly textExtractor: TextExtractorService,
  ) {}

  @Post('upload')
  @NeedLogin()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const uploadDir = (req as any).filesService
            ? (req as any).filesService.getUploadDir()
            : './uploads';
          cb(null, uploadDir + '/knowledge');
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `${uuidv4()}${ext}`);
        },
      }),
      fileFilter,
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  async uploadFile(
    @Req() req: { userContext: { userId: string } },
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('未接收到文件');
    }

    const { userId } = req.userContext;

    try {
      const result = await this.filesService.saveUploadedFile(
        file,
        userId,
        'knowledge',
      );
      return result;
    } catch (error) {
      if (file.path && existsSync(file.path)) {
        unlinkSync(file.path);
      }
      throw error;
    }
  }

  @Post('extract')
  @NeedLogin()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          cb(null, './uploads/temp');
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `${uuidv4()}${ext}`);
        },
      }),
      fileFilter,
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  async extractFile(
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('未接收到文件');
    }
    try {
      const result = await this.textExtractor.extract(file.path, file.originalname);
      // 清理临时文件
      if (existsSync(file.path)) {
        unlinkSync(file.path);
      }
      return {
        success: result.success,
        fileName: file.originalname,
        text: result.success ? result.text : '',
        error: result.success ? null : result.error,
      };
    } catch (error) {
      if (file.path && existsSync(file.path)) {
        unlinkSync(file.path);
      }
      throw error;
    }
  }

  @Get(':id')
  @NeedLogin()
  async getFile(
    @Req() req: { userContext: { userId: string } },
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { userId } = req.userContext;
    const file = await this.filesService.getFileStream(id, userId);

    const ext = extname(file.fileName).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx':
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.txt': 'text/plain; charset=utf-8',
      '.md': 'text/markdown; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
    };

    const mimeType = mimeTypes[ext] || 'application/octet-stream';

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', String(file.fileSize));
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
    );

    file.stream.pipe(res);
  }

  @Delete(':id')
  @NeedLogin()
  async deleteFile(
    @Req() req: { userContext: { userId: string } },
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    const { userId } = req.userContext;
    return this.filesService.deleteFile(id, userId);
  }
}
