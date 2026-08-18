import { Injectable, Logger } from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import { extname, join } from 'path';
import * as fs from 'fs';

export interface ExtractResult {
  success: boolean;
  text: string;
  error?: string;
}

@Injectable()
export class TextExtractorService {
  private readonly logger = new Logger(TextExtractorService.name);
  private readonly maxTextLength = 50000;

  async extract(filePath: string, originalName: string): Promise<ExtractResult> {
    const ext = extname(originalName).toLowerCase();

    if (!existsSync(filePath)) {
      return { success: false, text: '', error: '文件不存在' };
    }

    try {
      let text = '';

      switch (ext) {
        case '.pdf':
          text = await this.extractPdf(filePath);
          break;
        case '.docx':
          text = await this.extractDocx(filePath);
          break;
        case '.doc':
          text = await this.extractDoc(filePath);
          break;
        case '.pptx':
          text = await this.extractPptx(filePath);
          break;
        case '.ppt':
          text = await this.extractPpt(filePath);
          break;
        case '.xlsx':
        case '.xls':
          text = await this.extractXlsx(filePath);
          break;
        case '.txt':
        case '.md':
          text = this.extractTxt(filePath);
          break;
        default:
          return {
            success: false,
            text: '',
            error: `不支持的文件类型: ${ext}`,
          };
      }

      const trimmed = text.trim();
      if (!trimmed) {
        return {
          success: false,
          text: '',
          error: '未能从文件中提取到任何文本内容',
        };
      }

      // 限制最大长度，避免数据库过大
      const finalText =
        trimmed.length > this.maxTextLength
          ? trimmed.slice(0, this.maxTextLength) + '\n...[内容过长已截断]'
          : trimmed;

      return { success: true, text: finalText };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`提取文本失败 [${originalName}]: ${msg}`);
      return { success: false, text: '', error: msg };
    }
  }

  private async extractPdf(filePath: string): Promise<string> {
    const pdfModule = await import('pdf-parse');
    const pdfParse = (pdfModule as any).default || pdfModule;
    const dataBuffer = readFileSync(filePath);
    const result = await pdfParse(dataBuffer);
    return result.text || '';
  }

  private async extractDocx(filePath: string): Promise<string> {
    const mammothModule = await import('mammoth');
    const mammoth = (mammothModule as any).default || mammothModule;
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value || '';
  }

  private async extractDoc(_filePath: string): Promise<string> {
    // .doc 是旧版二进制格式，mammoth 不支持
    // 提示用户转换为 .docx
    return '';
  }

  private async extractPptx(filePath: string): Promise<string> {
    const jszipModule = await import('jszip');
    const JSZip = (jszipModule as any).default || jszipModule;
    const data = readFileSync(filePath);
    const zip = await JSZip.loadAsync(data);

    // PPTX 的幻灯片在 ppt/slides/slideN.xml
    const slideFiles = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .sort((a, b) => {
        const numA = parseInt(a.match(/slide(\d+)/)?.[1] || '0', 10);
        const numB = parseInt(b.match(/slide(\d+)/)?.[1] || '0', 10);
        return numA - numB;
      });

    const slides: string[] = [];

    for (const slideFile of slideFiles) {
      const content = await zip.file(slideFile)?.async('string');
      if (!content) continue;

      // 提取 <a:t> 标签中的文本
      const textMatches = content.match(/<a:t>([^<]*)<\/a:t>/g);
      if (textMatches) {
        const slideText = textMatches
          .map((m) => m.replace(/<\/?a:t>/g, ''))
          .filter((t) => t.trim())
          .join(' ');
        if (slideText.trim()) {
          slides.push(slideText.trim());
        }
      }
    }

    return slides.map((s, i) => `[幻灯片${i + 1}]\n${s}`).join('\n\n');
  }

  private async extractPpt(_filePath: string): Promise<string> {
    // .ppt 是旧版二进制格式，不支持
    return '';
  }

  private async extractXlsx(filePath: string): Promise<string> {
    const xlsxModule = await import('xlsx');
    const XLSX = (xlsxModule as any).default || xlsxModule;
    const workbook = XLSX.readFile(filePath);
    const sheets: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      // 转换为JSON数组，第一行作为表头
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        defval: '',
        raw: false,
      });

      if (jsonData.length === 0) {
        // 尝试CSV格式作为后备
        const csv = XLSX.utils.sheet_to_csv(worksheet, { blankrows: false });
        if (csv.trim()) {
          sheets.push(`【Sheet：${sheetName}】\n${csv}`);
        }
        continue;
      }

      const lines: string[] = [];
      for (const row of jsonData) {
        const rowEntries = Object.entries(row as Record<string, unknown>);
        if (rowEntries.length === 0) continue;
        const rowLines = rowEntries
          .filter(([, v]) => String(v).trim() !== '')
          .map(([k, v]) => `${k}：${String(v).trim()}`);
        if (rowLines.length > 0) {
          lines.push(rowLines.join('\n'));
        }
      }

      if (lines.length > 0) {
        sheets.push(`【Sheet：${sheetName}】\n${lines.join('\n\n')}`);
      }
    }

    return sheets.join('\n\n');
  }

  private extractTxt(filePath: string): string {
    // 尝试 UTF-8，失败则尝试 GBK
    try {
      const buf = readFileSync(filePath);
      // 检测 BOM
      if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
        return buf.toString('utf8', 3);
      }
      return buf.toString('utf8');
    } catch {
      return readFileSync(filePath, 'utf8');
    }
  }
}
