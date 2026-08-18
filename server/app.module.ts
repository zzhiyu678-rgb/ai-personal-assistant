import { APP_FILTER } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PlatformModule } from '@lark-apaas/fullstack-nestjs-core';

import { GlobalExceptionFilter } from './common/filters/exception.filter';
import { ViewModule } from './modules/view/view.module';
import { DevDatabaseModule } from './local/dev-database.module';

import { DashboardModule } from './modules/dashboard/dashboard.module';
import { GoalModule } from './modules/goal/goal.module';
import { DailyRecordModule } from './modules/daily-record/daily-record.module';
import { AiModule } from './modules/ai/ai.module';
import { AiConversationModule } from './modules/ai-conversation/ai-conversation.module';
import { ReportModule } from './modules/report/report.module';
import { TaskModule } from './modules/task/task.module';
import { CrmModule } from './modules/crm/crm.module';
import { ChatAnalysisModule } from './modules/chat-analysis/chat-analysis.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { FilesModule } from './modules/files/files.module';
import { MemoryModule } from './modules/memory/memory.module';

const isLocalDev = process.env.LOCAL_DEV === 'true';

const coreImports = isLocalDev
  ? [DevDatabaseModule]
  : [PlatformModule.forRoot()];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ...coreImports,
    DashboardModule,
    GoalModule,
    DailyRecordModule,
    AiModule,
    AiConversationModule,
    ReportModule,
    TaskModule,
    CrmModule,
    ChatAnalysisModule,
    KnowledgeModule,
    AnalyticsModule,
    FilesModule,
    MemoryModule,
    ViewModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
