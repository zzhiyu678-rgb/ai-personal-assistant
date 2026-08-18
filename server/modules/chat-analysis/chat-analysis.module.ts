import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module';
import { MemoryModule } from '../memory/memory.module';
import { FilesModule } from '../files/files.module';
import { ChatAnalysisController } from './chat-analysis.controller';
import { ChatAnalysisService } from './chat-analysis.service';

@Module({
  imports: [AiModule, MemoryModule, FilesModule],
  controllers: [ChatAnalysisController],
  providers: [ChatAnalysisService],
  exports: [ChatAnalysisService],
})
export class ChatAnalysisModule {}
