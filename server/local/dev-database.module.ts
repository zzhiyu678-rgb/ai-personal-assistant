import { Module, Global } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../database/schema';

export const DRIZZLE_DATABASE = 'DRIZZLE_DATABASE';
export type PostgresJsDatabase = ReturnType<typeof drizzle<typeof schema>>;

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE_DATABASE,
      useFactory: () => {
        const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ai_work_coach';
        const queryClient = postgres(databaseUrl, { max: 1 });
        const db = drizzle(queryClient, { schema });
        return db;
      },
    },
  ],
  exports: [DRIZZLE_DATABASE],
})
export class DevDatabaseModule {}
