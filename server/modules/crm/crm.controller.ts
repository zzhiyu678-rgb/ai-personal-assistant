import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Query,
  Param,
  Body,
  Req,
  Res,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { existsSync, unlinkSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import type { Response } from 'express';

import type {
  CustomerListResponse,
  Customer,
  CreateCustomerRequest,
  UpdateCustomerRequest,
  FollowUpListResponse,
  FollowUpRecord,
  CreateFollowUpRequest,
} from '@shared/api.interface';

import { CrmService } from './crm.service';

interface UserContextRequest {
  userContext: {
    userId: string;
    tenantId: string;
    appId: string;
    env: string;
    userName: string;
    userNameEn: string;
  };
}

@Controller('api/customers')
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @NeedLogin()
  @Get()
  async getCustomers(
    @Req() req: UserContextRequest,
    @Query('stage') stage?: string,
    @Query('industry') industry?: string,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ): Promise<CustomerListResponse> {
    const { userId } = req.userContext;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));

    return this.crmService.getCustomers({
      stage,
      industry,
      search,
      page: pageNum,
      pageSize: pageSizeNum,
      userId,
    });
  }

  @NeedLogin()
  @Get(':id')
  async getCustomer(
    @Req() req: UserContextRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Customer> {
    const { userId } = req.userContext;
    return this.crmService.getCustomerById(id, userId);
  }

  @NeedLogin()
  @Post()
  async createCustomer(
    @Req() req: UserContextRequest,
    @Body() dto: CreateCustomerRequest,
  ): Promise<Customer> {
    const { userId } = req.userContext;
    return this.crmService.createCustomer(dto, userId);
  }

  @NeedLogin()
  @Put(':id')
  async updateCustomer(
    @Req() req: UserContextRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerRequest,
  ): Promise<Customer> {
    const { userId } = req.userContext;
    return this.crmService.updateCustomer(id, dto, userId);
  }

  @NeedLogin()
  @Delete(':id')
  async deleteCustomer(
    @Req() req: UserContextRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: boolean }> {
    const { userId } = req.userContext;
    return this.crmService.deleteCustomer(id, userId);
  }

  @NeedLogin()
  @Get(':id/follow-ups')
  async getFollowUps(
    @Req() req: UserContextRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FollowUpListResponse> {
    const { userId } = req.userContext;
    const items: FollowUpRecord[] = await this.crmService.getFollowUps(id, userId);
    return { items };
  }

  @NeedLogin()
  @Post(':id/follow-ups')
  async createFollowUp(
    @Req() req: UserContextRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateFollowUpRequest,
  ): Promise<FollowUpRecord> {
    const { userId } = req.userContext;
    return this.crmService.createFollowUp(id, dto, userId);
  }

  @NeedLogin()
  @Delete(':id/follow-ups/:followUpId')
  async deleteFollowUp(
    @Req() req: UserContextRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('followUpId', ParseUUIDPipe) followUpId: string,
  ): Promise<{ success: boolean }> {
    const { userId } = req.userContext;
    return this.crmService.deleteFollowUp(id, followUpId, userId);
  }

  @NeedLogin()
  @Post(':id/analyze')
  async analyzeCustomer(
    @Req() req: UserContextRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: boolean; analysis?: any }> {
    const { userId } = req.userContext;
    const analysis = await this.crmService.analyzeCustomerFollowUps(id, userId);
    return { success: true, analysis };
  }

  @NeedLogin()
  @Post('batch-delete')
  async batchDelete(
    @Req() req: UserContextRequest,
    @Body() body: { ids: string[] },
  ): Promise<{ success: number; failed: number }> {
    if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      throw new BadRequestException('请选择要删除的客户');
    }
    const { userId } = req.userContext;
    return this.crmService.batchDelete(body.ids, userId);
  }

  // ==================== Excel 批量导入 ====================

  @Post('import/preview')
  @NeedLogin()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, './uploads/temp'),
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `${uuidv4()}${ext}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (['.xlsx', '.xls'].includes(ext)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('请上传.xlsx或.xls格式文件'), false);
        }
      },
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async importPreview(
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('未接收到文件');
    }
    try {
      const result = await this.crmService.parseExcelForImport(file.path);
      if (existsSync(file.path)) unlinkSync(file.path);
      return result;
    } catch (error) {
      if (file.path && existsSync(file.path)) unlinkSync(file.path);
      throw error;
    }
  }

  @Post('import')
  @NeedLogin()
  async importConfirm(
    @Req() req: UserContextRequest,
    @Body() body: { customers: any[] },
  ) {
    if (!body.customers || !Array.isArray(body.customers) || body.customers.length === 0) {
      throw new BadRequestException('没有可导入的客户数据');
    }
    const { userId } = req.userContext;
    return this.crmService.batchImport(body.customers, userId);
  }

  @Get('import/template')
  @NeedLogin()
  async downloadTemplate(@Res() res: Response) {
    const XLSX = await import('xlsx');
    const headers = ['公司名称', '法人', '有效电话', '更多电话', '邮箱', '官网网址', '行业', '备注'];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '客户导入模板');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename*=UTF-8\'\'客户导入模板.xlsx');
    res.send(buf);
  }
}
