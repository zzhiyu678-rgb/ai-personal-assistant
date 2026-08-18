import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module';
import { GoalController } from './goal.controller';
import { GoalService } from './goal.service';

@Module({
  imports: [AiModule],
  controllers: [GoalController],
  providers: [GoalService],
  exports: [GoalService],
})
export class GoalModule {}
