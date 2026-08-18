import { Module } from '@nestjs/common';

import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';

@Module({
  imports: [],
  controllers: [KnowledgeController],
  providers: [KnowledgeService],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
