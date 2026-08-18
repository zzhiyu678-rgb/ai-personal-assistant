import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';

@Module({
  imports: [AiModule],
  controllers: [CrmController],
  providers: [CrmService],
  exports: [CrmService],
})
export class CrmModule {}
