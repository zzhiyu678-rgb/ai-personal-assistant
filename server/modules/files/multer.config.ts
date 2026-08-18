import { extname, join } from 'path';
import { existsSync, mkdirSync, openSync, readSync, closeSync } from 'fs';
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { BadRequestException } from '@nestjs/common';

const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.xls',
  '.xlsx',
  '.txt',
  '.md',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
]);

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/markdown',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);

const FILE_SIGNATURES: Record<string, Buffer[]> = {
  '.pdf': [Buffer.from([0x25, 0x50, 0x44, 0x46])],
  '.png': [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  '.jpg': [Buffer.from([0xff, 0xd8, 0xff])],
  '.jpeg': [Buffer.from([0xff, 0xd8, 0xff])],
  '.gif': [Buffer.from([0x47, 0x49, 0x46, 0x38])],
  '.webp': [Buffer.from([0x52, 0x49, 0x46, 0x46])],
  '.doc': [Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])],
  '.xls': [Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])],
  '.ppt': [Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])],
  '.docx': [
    Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    Buffer.from([0x50, 0x4b, 0x05, 0x06]),
    Buffer.from([0x50, 0x4b, 0x07, 0x08]),
  ],
  '.xlsx': [
    Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    Buffer.from([0x50, 0x4b, 0x05, 0x06]),
    Buffer.from([0x50, 0x4b, 0x07, 0x08]),
  ],
  '.pptx': [
    Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    Buffer.from([0x50, 0x4b, 0x05, 0x06]),
    Buffer.from([0x50, 0x4b, 0x07, 0x08]),
  ],
  '.svg': [Buffer.from('<svg')],
};

export function getUploadDir(baseDir: string, category: string): string {
  const dir = join(baseDir, category);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function createMulterStorage(uploadDir: string) {
  return diskStorage({
    destination: (_req, file, cb) => {
      const category = (_req.params as { category?: string })?.category || 'temp';
      const dir = getUploadDir(uploadDir, category);
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = extname(file.originalname).toLowerCase();
      const safeName = `${uuidv4()}${ext}`;
      cb(null, safeName);
    },
  });
}

export function fileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) {
  const ext = extname(file.originalname).toLowerCase();
  const mimeType = file.mimetype.toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    cb(new BadRequestException(`不支持的文件类型: ${ext}`), false);
    return;
  }

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    cb(new BadRequestException(`不支持的文件 MIME 类型: ${mimeType}`), false);
    return;
  }

  cb(null, true);
}

export function verifyFileSignature(
  filePath: string,
  originalName: string,
): boolean {
  const ext = extname(originalName).toLowerCase();
  const signatures = FILE_SIGNATURES[ext];

  if (!signatures || signatures.length === 0) {
    return true;
  }

  const fd = openSync(filePath, 'r');
  try {
    const maxLen = Math.max(...signatures.map((s: Buffer) => s.length));
    const buffer = Buffer.alloc(maxLen);
    const bytesRead = readSync(fd, buffer, 0, maxLen, 0);

    return signatures.some((sig: Buffer) => {
      if (bytesRead < sig.length) return false;
      return buffer.slice(0, sig.length).equals(sig);
    });
  } finally {
    closeSync(fd);
  }
}

export const multerConfig = {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
};
