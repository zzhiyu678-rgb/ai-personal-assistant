import { Module } from '@nestjs/common';

import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { AiModule } from '../ai/ai.module';
import { MemoryModule } from '../memory/memory.module';

@Module({
  imports: [AiModule, MemoryModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
