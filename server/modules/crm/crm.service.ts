import { Inject, Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, like, or, desc, count, sql, inArray } from 'drizzle-orm';

import type {
  Customer,
  CustomerStage,
  AiCustomerAnalysis,
  FollowUpRecord,
  FollowUpType,
  CreateCustomerRequest,
  UpdateCustomerRequest,
  CreateFollowUpRequest,
} from '@shared/api.interface';
import { customer, customerFollowUp } from '../../database/schema';
import { AiService } from '../ai/ai.service';

interface ListQuery {
  stage?: string;
  industry?: string;
  search?: string;
  page: number;
  pageSize: number;
  userId: string;
}

interface ListResult {
  items: Customer[];
  total: number;
}

@Injectable()
export class CrmService {
  private readonly logger = new Logger(CrmService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly aiService: AiService,
  ) {}

  async getCustomers(query: ListQuery): Promise<ListResult> {
    const { stage, industry, search, page, pageSize, userId } = query;
    const conditions = [eq(customer.createdBy, userId)];

    if (stage && stage !== 'ALL') {
      conditions.push(eq(customer.stage, stage));
    }
    if (industry) {
      conditions.push(eq(customer.industry, industry));
    }
    if (search) {
      const searchTerm = `%${search}%`;
      conditions.push(
        or(
          like(customer.company, searchTerm),
          like(customer.contactName, searchTerm),
        ),
      );
    }

    const whereClause = and(...conditions);
    const offset = (page - 1) * pageSize;

    const [countResult, rows] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(customer)
        .where(whereClause),
      this.db
        .select()
        .from(customer)
        .where(whereClause)
        .orderBy(desc(customer.updatedAt))
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    if (rows.length === 0) {
      return { items: [], total };
    }

    const customerIds = rows.map((row) => row.id);
    const latestFollowUps = await this.db
      .select({
        customerId: customerFollowUp.customerId,
        maxCreatedAt: sql<Date>`MAX(${customerFollowUp.createdAt})`.as('max_created_at'),
      })
      .from(customerFollowUp)
      .where(inArray(customerFollowUp.customerId, customerIds))
      .groupBy(customerFollowUp.customerId);

    const followUpMap = new Map<string, string>();
    for (const fu of latestFollowUps) {
      followUpMap.set(fu.customerId, new Date(fu.maxCreatedAt).toISOString());
    }

    const items: Customer[] = rows.map((row) => ({
      id: row.id,
      company: row.company,
      contactName: row.contactName,
      contactInfo: row.contactInfo,
      industry: row.industry ?? null,
      stage: row.stage as CustomerStage,
      notes: row.notes ?? null,
      aiAnalysis: (row.aiAnalysis as AiCustomerAnalysis | null) ?? null,
      lastFollowUpAt: followUpMap.get(row.id) ?? null,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    }));

    return { items, total };
  }

  async getCustomerById(id: string, userId: string): Promise<Customer> {
    const rows = await this.db
      .select()
      .from(customer)
      .where(eq(customer.id, id));

    if (rows.length === 0) {
      throw new NotFoundException('客户不存在');
    }

    const row = rows[0];
    if (row.createdBy !== userId) {
      throw new ForbiddenException('无权限访问该客户');
    }

    const followUpRows = await this.db
      .select({ createdAt: customerFollowUp.createdAt })
      .from(customerFollowUp)
      .where(eq(customerFollowUp.customerId, id))
      .orderBy(desc(customerFollowUp.createdAt))
      .limit(1);

    const lastFollowUpAt = followUpRows.length > 0
      ? new Date(followUpRows[0].createdAt).toISOString()
      : null;

    return {
      id: row.id,
      company: row.company,
      contactName: row.contactName,
      contactInfo: row.contactInfo,
      industry: row.industry ?? null,
      stage: row.stage as CustomerStage,
      notes: row.notes ?? null,
      aiAnalysis: (row.aiAnalysis as AiCustomerAnalysis | null) ?? null,
      lastFollowUpAt,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    };
  }

  /**
   * 组装结构化备注：将法人/更多电话/邮箱/官网等字段存入notes
   */
  private assembleNotes(dto: {
    legalRep?: string;
    morePhones?: string[];
    emails?: string[];
    website?: string;
    notes?: string;
  }): string | null {
    const parts: string[] = [];
    if (dto.legalRep?.trim()) parts.push(`【法人】${dto.legalRep.trim()}`);
    if (dto.morePhones && dto.morePhones.filter(Boolean).length > 0) {
      parts.push(`【更多电话】${dto.morePhones.filter(Boolean).join(', ')}`);
    }
    if (dto.emails && dto.emails.filter(Boolean).length > 0) {
      parts.push(`【邮箱】${dto.emails.filter(Boolean).join(', ')}`);
    }
    if (dto.website?.trim()) parts.push(`【官网】${dto.website.trim()}`);
    if (dto.notes?.trim()) parts.push(`【备注】${dto.notes.trim()}`);
    return parts.length > 0 ? parts.join('\n') : null;
  }

  /**
   * 解析结构化备注，提取各字段
   */
  parseStructuredNotes(notes: string | null): {
    legalRep: string;
    morePhones: string[];
    emails: string[];
    website: string;
    rawNotes: string;
  } {
    const result = { legalRep: '', morePhones: [] as string[], emails: [] as string[], website: '', rawNotes: '' };
    if (!notes) return result;
    const lines = notes.split('\n');
    for (const line of lines) {
      // 新格式：【字段名】值
      let match = line.match(/^【(.+?)】(.*)$/);
      let key = '';
      let value = '';
      if (match) {
        key = match[1];
        value = match[2].trim();
      } else {
        // 旧格式：字段名：值 或 字段名:值
        match = line.match(/^([^：:]+)[：:](.*)$/);
        if (match) {
          key = match[1].trim();
          value = match[2].trim();
        }
      }
      if (key) {
        if (key === '法人' || key === '法定代表人') result.legalRep = value;
        else if (key === '更多电话' || key === '其他电话' || key === '备用电话') result.morePhones = value.split(/[,，、]/).map(s => s.trim()).filter(Boolean);
        else if (key === '邮箱' || key === '电子邮箱') result.emails = value.split(/[,，、]/).map(s => s.trim()).filter(Boolean);
        else if (key === '官网' || key === '官网网址' || key === '网站') result.website = value;
        else if (key === '备注' || key === '说明') result.rawNotes = value;
      } else if (line.trim()) {
        result.rawNotes = result.rawNotes ? `${result.rawNotes}\n${line}` : line;
      }
    }
    return result;
  }

  async createCustomer(dto: CreateCustomerRequest, userId: string): Promise<Customer> {
    const phones = (dto.phones || []).filter(Boolean);
    const primaryPhone = phones[0] || dto.contactInfo || '';
    const structuredNotes = this.assembleNotes({
      legalRep: dto.legalRep,
      morePhones: [...(phones.slice(1) || []), ...(dto.morePhones || [])],
      emails: dto.emails,
      website: dto.website,
      notes: dto.notes,
    });

    const inserted = await this.db
      .insert(customer)
      .values({
        company: dto.company,
        contactName: dto.contactName || '未知',
        contactInfo: primaryPhone || '未提供',
        industry: dto.industry ?? null,
        stage: dto.stage || 'UNCONTACTED',
        notes: structuredNotes,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    const row = inserted[0];
    return {
      id: row.id,
      company: row.company,
      contactName: row.contactName,
      contactInfo: row.contactInfo,
      industry: row.industry ?? null,
      stage: row.stage as CustomerStage,
      notes: row.notes ?? null,
      aiAnalysis: null,
      lastFollowUpAt: null,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    };
  }

  async updateCustomer(
    id: string,
    dto: UpdateCustomerRequest,
    userId: string,
  ): Promise<Customer> {
    const existing = await this.db
      .select()
      .from(customer)
      .where(eq(customer.id, id));

    if (existing.length === 0) {
      throw new NotFoundException('客户不存在');
    }
    if (existing[0].createdBy !== userId) {
      throw new ForbiddenException('无权限修改该客户');
    }

    const patch: Record<string, unknown> = {};
    if (dto.company !== undefined) patch.company = dto.company;
    if (dto.contactName !== undefined) patch.contactName = dto.contactName || '未知';
    if (dto.industry !== undefined) patch.industry = dto.industry;
    if (dto.stage !== undefined) patch.stage = dto.stage;

    // 处理新字段：电话/邮箱/法人/官网
    const hasNewFields = dto.phones !== undefined || dto.morePhones !== undefined ||
      dto.emails !== undefined || dto.website !== undefined || dto.legalRep !== undefined ||
      dto.notes !== undefined || dto.contactInfo !== undefined;

    if (hasNewFields) {
      const parsed = this.parseStructuredNotes(existing[0].notes);
      const phones = dto.phones !== undefined ? dto.phones.filter(Boolean) : [existing[0].contactInfo].filter(Boolean);
      const primaryPhone = phones[0] || '';
      if (dto.contactInfo !== undefined) patch.contactInfo = dto.contactInfo || primaryPhone || '未提供';
      else if (phones.length > 0) patch.contactInfo = primaryPhone;

      const structuredNotes = this.assembleNotes({
        legalRep: dto.legalRep !== undefined ? dto.legalRep : parsed.legalRep,
        morePhones: dto.morePhones !== undefined
          ? [...(phones.slice(1) || []), ...dto.morePhones.filter(Boolean)]
          : [...(phones.slice(1) || []), ...parsed.morePhones],
        emails: dto.emails !== undefined ? dto.emails.filter(Boolean) : parsed.emails,
        website: dto.website !== undefined ? dto.website : parsed.website,
        notes: dto.notes !== undefined ? dto.notes : parsed.rawNotes,
      });
      patch.notes = structuredNotes;
    }

    if (Object.keys(patch).length === 0) {
      return this.getCustomerById(id, userId);
    }

    patch.updatedBy = userId;

    const updated = await this.db
      .update(customer)
      .set(patch)
      .where(eq(customer.id, id))
      .returning();

    const row = updated[0];
    const followUpRows = await this.db
      .select({ createdAt: customerFollowUp.createdAt })
      .from(customerFollowUp)
      .where(eq(customerFollowUp.customerId, id))
      .orderBy(desc(customerFollowUp.createdAt))
      .limit(1);

    const lastFollowUpAt = followUpRows.length > 0
      ? new Date(followUpRows[0].createdAt).toISOString()
      : null;

    return {
      id: row.id,
      company: row.company,
      contactName: row.contactName,
      contactInfo: row.contactInfo,
      industry: row.industry ?? null,
      stage: row.stage as CustomerStage,
      notes: row.notes ?? null,
      aiAnalysis: (row.aiAnalysis as AiCustomerAnalysis | null) ?? null,
      lastFollowUpAt,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    };
  }

  async deleteCustomer(id: string, userId: string): Promise<{ success: boolean }> {
    const existing = await this.db
      .select()
      .from(customer)
      .where(eq(customer.id, id));

    if (existing.length === 0) {
      throw new NotFoundException('客户不存在');
    }
    if (existing[0].createdBy !== userId) {
      throw new ForbiddenException('无权限删除该客户');
    }

    await this.db
      .delete(customerFollowUp)
      .where(eq(customerFollowUp.customerId, id));

    const deleted = await this.db
      .delete(customer)
      .where(eq(customer.id, id))
      .returning({ id: customer.id });

    return { success: deleted.length > 0 };
  }

  async getFollowUps(customerId: string, userId: string): Promise<FollowUpRecord[]> {
    const customerRow = await this.db
      .select()
      .from(customer)
      .where(eq(customer.id, customerId));

    if (customerRow.length === 0) {
      throw new NotFoundException('客户不存在');
    }
    if (customerRow[0].createdBy !== userId) {
      throw new ForbiddenException('无权限访问该客户');
    }

    const rows = await this.db
      .select()
      .from(customerFollowUp)
      .where(eq(customerFollowUp.customerId, customerId))
      .orderBy(desc(customerFollowUp.createdAt));

    return rows.map((row) => ({
      id: row.id,
      customerId: row.customerId,
      content: row.content,
      followType: row.followType as FollowUpType,
      aiSuggestion: row.aiSuggestion ?? null,
      createdAt: new Date(row.createdAt).toISOString(),
    }));
  }

  async createFollowUp(
    customerId: string,
    dto: CreateFollowUpRequest,
    userId: string,
  ): Promise<FollowUpRecord> {
    const customerRow = await this.db
      .select()
      .from(customer)
      .where(eq(customer.id, customerId));

    if (customerRow.length === 0) {
      throw new NotFoundException('客户不存在');
    }
    if (customerRow[0].createdBy !== userId) {
      throw new ForbiddenException('无权限操作该客户');
    }

    const cust = customerRow[0];

    const existingFollowUps = await this.db
      .select()
      .from(customerFollowUp)
      .where(eq(customerFollowUp.customerId, customerId))
      .orderBy(customerFollowUp.createdAt);

    const existingTexts = existingFollowUps
      .map((f, i) => `【跟进${i + 1} - ${f.followType}】${f.content}`)
      .join('\n');

    const customerContext = `客户信息：\n公司：${cust.company}\n联系人：${cust.contactName}\n联系方式：${cust.contactInfo}\n行业：${cust.industry ?? '未填写'}\n当前阶段：${cust.stage}\n备注：${cust.notes ?? '无'}\n\n历史跟进记录：\n${existingTexts}\n\n【最新跟进 - ${dto.followType}】${dto.content}`;

    // 保存跟进记录时不自动调用AI，AI分析由用户主动触发
    const inserted = await this.db
      .insert(customerFollowUp)
      .values({
        customerId,
        content: dto.content,
        followType: dto.followType,
        aiSuggestion: null,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    const row = inserted[0];
    return {
      id: row.id,
      customerId: row.customerId,
      content: row.content,
      followType: row.followType as FollowUpType,
      aiSuggestion: row.aiSuggestion ?? null,
      createdAt: new Date(row.createdAt).toISOString(),
    };
  }

  /**
   * 主动触发客户AI分析（读取客户资料+历史跟进记录）
   */
  async analyzeCustomerFollowUps(
    customerId: string,
    userId: string,
  ): Promise<AiCustomerAnalysis> {
    const cust = await this.db
      .select()
      .from(customer)
      .where(and(eq(customer.id, customerId), eq(customer.createdBy, userId)));

    if (cust.length === 0) {
      throw new NotFoundException('客户不存在或无权操作');
    }

    const followUps = await this.db
      .select()
      .from(customerFollowUp)
      .where(eq(customerFollowUp.customerId, customerId))
      .orderBy(customerFollowUp.createdAt);

    const existingTexts = followUps
      .map((f, i) => `【跟进${i + 1} - ${f.followType}】${f.content}`)
      .join('\n');

    const customerContext = `客户信息：\n公司：${cust[0].company}\n行业：${cust[0].industry ?? '未填写'}\n当前阶段：${cust[0].stage}\n备注：${cust[0].notes ?? '无'}\n\n历史跟进记录：\n${existingTexts || '暂无跟进记录'}`;

    const analysis = await this.aiService.analyzeCustomer(customerContext);

    // 更新客户的AI分析
    await this.db
      .update(customer)
      .set({
        aiAnalysis: analysis as unknown as Record<string, unknown>,
        updatedBy: userId,
      })
      .where(eq(customer.id, customerId));

    return analysis;
  }

  // ==================== Excel 批量导入 ====================

  /** 列名智能匹配映射 */
  private readonly columnMappings: Record<string, string[]> = {
    company: ['公司名称', '企业名称', '公司', '企业', '客户名称', '单位名称', 'company', 'company name', '企业名'],
    legalRep: ['法人', '法人代表', '法定代表人', '负责人', 'legal', 'legal representative'],
    phone: ['有效电话', '联系电话', '电话', '手机号', '手机', '联系方式', 'phone', 'tel', 'mobile', '电话号码', '电话1', '联系电话1'],
    morePhone: ['更多电话', '备用电话', '其他电话', '座机', '固话', 'more phone', '电话2', '电话3', '电话4', '联系电话2', '联系电话3'],
    email: ['邮箱', '电子邮件', 'email', 'e-mail', 'mail', '邮箱1', '邮箱2', '邮箱3'],
    website: ['官网', '官网网址', '网址', '网站', 'website', 'url', 'web', '官方网站', '公司网址'],
    contactName: ['联系人', '联系人姓名', '联系姓名', 'contact', 'contact name', '姓名'],
    industry: ['行业', '所属行业', 'industry', '行业分类'],
    notes: ['备注', '说明', 'notes', 'remark', 'comment'],
  };

  /**
   * 解析Excel文件，返回导入预览数据
   */
  async parseExcelForImport(filePath: string): Promise<{
    columns: string[];
    rows: Array<Record<string, string>>;
    fieldMapping: Record<string, string>;
  }> {
    const XLSX = await import('xlsx');
    const workbook = XLSX.readFile(filePath);
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' }) as Array<Record<string, any>>;

    if (jsonData.length === 0) {
      return { columns: [], rows: [], fieldMapping: {} };
    }

    const columns = Object.keys(jsonData[0]);
    const fieldMapping = this.matchColumns(columns);

    // 找出电话相关列
    const phoneCols = columns.filter((col) => fieldMapping[col] === 'phone');
    const morePhoneCols = columns.filter((col) => fieldMapping[col] === 'morePhone');

    const rows = jsonData.map((row) => {
      const result: Record<string, string> = {};
      for (const col of columns) {
        result[col] = String(row[col] ?? '').trim();
      }

      // 收集所有电话值并分类
      const allPhoneValues: string[] = [];
      for (const col of [...phoneCols, ...morePhoneCols]) {
        const val = result[col];
        if (val) {
          // 支持逗号、分号、换行分隔的多个电话
          const parts = val.split(/[,，;；\n、]/).map((s) => s.trim()).filter(Boolean);
          allPhoneValues.push(...parts);
        }
      }

      if (allPhoneValues.length > 0) {
        const { validPhones, morePhones } = this.classifyPhones(allPhoneValues);
        // 回写到行数据
        if (phoneCols.length > 0) {
          result[phoneCols[0]] = validPhones.join(', ');
        }
        if (morePhoneCols.length > 0) {
          result[morePhoneCols[0]] = morePhones.join(', ');
        } else if (morePhones.length > 0) {
          // 没有更多电话列时，添加虚拟字段
          result['__morePhone__'] = morePhones.join(', ');
          fieldMapping['__morePhone__'] = 'morePhone';
        }
      }

      return result;
    });

    return { columns, rows, fieldMapping };
  }

  /** 智能匹配列名到字段 */
  private matchColumns(columns: string[]): Record<string, string> {
    const mapping: Record<string, string> = {};
    for (const col of columns) {
      const colLower = col.toLowerCase().trim();
      for (const [field, aliases] of Object.entries(this.columnMappings)) {
        if (aliases.some((alias) => colLower === alias.toLowerCase() || colLower.includes(alias.toLowerCase()))) {
          mapping[col] = field;
          break;
        }
      }
    }
    return mapping;
  }

  /**
   * 检查重复客户
   */
  async checkDuplicates(companies: string[], userId: string): Promise<Set<string>> {
    if (companies.length === 0) return new Set();
    const existing = await this.db
      .select({ company: customer.company })
      .from(customer)
      .where(eq(customer.createdBy, userId));
    const existingSet = new Set(existing.map((c) => c.company.trim()));
    return new Set(companies.filter((c) => existingSet.has(c.trim())));
  }

  /**
   * 电话号码分类：
   * - 11位纯数字 → 有效电话
   * - 其他（12位、带区号座机、无法识别）→ 更多电话
   */
  private classifyPhones(rawPhones: string[]): { validPhones: string[]; morePhones: string[] } {
    const validPhones: string[] = [];
    const morePhones: string[] = [];
    for (const phone of rawPhones) {
      const cleaned = phone.trim();
      if (!cleaned) continue;
      // 11位纯数字 → 有效电话
      if (/^\d{11}$/.test(cleaned)) {
        validPhones.push(cleaned);
      } else {
        morePhones.push(cleaned);
      }
    }
    return { validPhones, morePhones };
  }

  /**
   * 批量导入客户
   */
  async batchImport(
    customers: Array<{
      company: string;
      contactName?: string;
      phone?: string;
      phones?: string[];
      morePhone?: string;
      morePhones?: string[];
      email?: string;
      emails?: string[];
      website?: string;
      legalRep?: string;
      industry?: string;
      notes?: string;
      stage?: string;
    }>,
    userId: string,
  ): Promise<{ success: number; failed: number; duplicates: number }> {
    let success = 0;
    let failed = 0;
    let duplicates = 0;

    const companies = customers.map((c) => c.company);
    const dupSet = await this.checkDuplicates(companies, userId);

    for (const c of customers) {
      try {
        if (dupSet.has(c.company.trim())) {
          duplicates++;
          continue;
        }

        // 收集所有电话，重新分类
        let allPhones: string[] = [];
        if (c.phones && c.phones.length > 0) {
          allPhones = [...allPhones, ...c.phones.filter(Boolean)];
        } else if (c.phone) {
          allPhones = [...allPhones, ...c.phone.split(/[,，、\n]/).map(s => s.trim()).filter(Boolean)];
        }
        if (c.morePhones && c.morePhones.length > 0) {
          allPhones = [...allPhones, ...c.morePhones.filter(Boolean)];
        } else if (c.morePhone) {
          allPhones = [...allPhones, ...c.morePhone.split(/[,，、\n]/).map(s => s.trim()).filter(Boolean)];
        }
        const { validPhones, morePhones } = this.classifyPhones(allPhones);
        // 邮箱
        let emails: string[] = [];
        if (c.emails && c.emails.length > 0) {
          emails = c.emails.filter(Boolean);
        } else if (c.email) {
          emails = c.email.split(/[,，、\n]/).map(s => s.trim()).filter(Boolean);
        }

        const primaryPhone = validPhones[0] || '';
        const structuredNotes = this.assembleNotes({
          legalRep: c.legalRep,
          morePhones: [...validPhones.slice(1), ...morePhones],
          emails,
          website: c.website,
          notes: c.notes,
        });

        await this.db.insert(customer).values({
          company: c.company,
          contactName: c.contactName || '未知',
          contactInfo: (primaryPhone || emails[0] || '未提供').slice(0, 255),
          industry: c.industry || null,
          stage: (c.stage as any) || 'UNCONTACTED',
          notes: structuredNotes,
          createdBy: userId,
          updatedBy: userId,
        });
        success++;
        dupSet.add(c.company.trim());
      } catch (err) {
        this.logger.error(`导入客户失败: ${c.company}, ${JSON.stringify(err)}`);
        failed++;
      }
    }

    return { success, failed, duplicates };
  }

  /**
   * 删除跟进记录
   */
  async deleteFollowUp(
    customerId: string,
    followUpId: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    // 先验证客户归属
    const cust = await this.db
      .select({ id: customer.id })
      .from(customer)
      .where(and(eq(customer.id, customerId), eq(customer.createdBy, userId)));
    if (cust.length === 0) {
      throw new NotFoundException('客户不存在或无权操作');
    }

    const deleted = await this.db
      .delete(customerFollowUp)
      .where(and(
        eq(customerFollowUp.id, followUpId),
        eq(customerFollowUp.customerId, customerId),
      ))
      .returning({ id: customerFollowUp.id });

    if (deleted.length === 0) {
      throw new NotFoundException('跟进记录不存在');
    }
    return { success: true };
  }

  /**
   * 批量删除客户（同时删除跟进记录）
   */
  async batchDelete(
    ids: string[],
    userId: string,
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;
    for (const id of ids) {
      try {
        const cust = await this.db
          .select({ id: customer.id })
          .from(customer)
          .where(and(eq(customer.id, id), eq(customer.createdBy, userId)));
        if (cust.length === 0) {
          failed++;
          continue;
        }
        // 删除跟进记录
        await this.db
          .delete(customerFollowUp)
          .where(eq(customerFollowUp.customerId, id));
        // 删除客户
        await this.db
          .delete(customer)
          .where(eq(customer.id, id));
        success++;
      } catch (err) {
        this.logger.error(`批量删除客户失败: ${id}, ${JSON.stringify(err)}`);
        failed++;
      }
    }
    return { success, failed };
  }
}
