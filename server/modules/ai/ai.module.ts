import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { OpenAiService } from './openai.service';
import { PlatformAiProvider } from './platform-ai.provider';
import { AI_PROVIDER_TOKEN } from './ai.provider.interface';

const usePlatform = process.env.AI_PROVIDER === 'platform';

const moduleImports = usePlatform ? [ConfigModule] : [ConfigModule];

const providers = usePlatform
  ? [
      AiService,
      OpenAiService,
      PlatformAiProvider,
      {
        provide: AI_PROVIDER_TOKEN,
        useFactory: (
          configService: ConfigService,
          openAiService: OpenAiService,
          platformAiProvider: PlatformAiProvider,
        ) => {
          return configService.get<string>('AI_PROVIDER') === 'platform'
            ? platformAiProvider
            : openAiService;
        },
        inject: [ConfigService, OpenAiService, PlatformAiProvider],
      },
    ]
  : [
      AiService,
      OpenAiService,
      {
        provide: AI_PROVIDER_TOKEN,
        useFactory: (
          _configService: ConfigService,
          openAiService: OpenAiService,
        ) => openAiService,
        inject: [ConfigService, OpenAiService],
      },
    ];

@Module({
  imports: moduleImports,
  controllers: [AiController],
  providers,
  exports: [AiService],
})
export class AiModule {}
