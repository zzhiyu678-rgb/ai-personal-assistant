import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';

@Module({
  imports: [AiModule],
  controllers: [ReportController],
  providers: [ReportService],
  exports: [ReportService],
})
export class ReportModule {}
