import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { TextExtractorService } from './text-extractor.service';

@Module({
  imports: [ConfigModule],
  controllers: [FilesController],
  providers: [FilesService, TextExtractorService],
  exports: [FilesService, TextExtractorService],
})
export class FilesModule {}
