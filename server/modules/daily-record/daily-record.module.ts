import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module';
import { DailyRecordController } from './daily-record.controller';
import { DailyRecordService } from './daily-record.service';

@Module({
  imports: [AiModule],
  controllers: [DailyRecordController],
  providers: [DailyRecordService],
  exports: [DailyRecordService],
})
export class DailyRecordModule {}
