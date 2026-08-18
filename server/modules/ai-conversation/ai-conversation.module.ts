import { Module } from '@nestjs/common';

import { AiConversationController } from './ai-conversation.controller';
import { AiConversationService } from './ai-conversation.service';
import { AiModule } from '../ai/ai.module';
import { MemoryModule } from '../memory/memory.module';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [AiModule, MemoryModule, FilesModule],
  controllers: [AiConversationController],
  providers: [AiConversationService],
  exports: [AiConversationService],
})
export class AiConversationModule {}
