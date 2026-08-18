import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';

@Module({
  imports: [AiModule],
  controllers: [TaskController],
  providers: [TaskService],
  exports: [TaskService],
})
export class TaskModule {}
