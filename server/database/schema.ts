/* eslint-disable */
/** auto generated, do not edit */
import { sql } from 'drizzle-orm';
import { boolean, date, foreignKey, index, integer, jsonb, pgTable, text, uniqueIndex, uuid, varchar, customType } from "drizzle-orm/pg-core"

export const customTimestamptz = customType<{
  data: Date;
  driverData: string;
  config: { precision?: number };
}>({
  dataType(config) {
    const precision = typeof config?.precision !== 'undefined'
      ? ` (${config.precision})`
      : '';
    return `timestamptz${precision}`;
  },
  toDriver(value: Date | string | number) {
    if (value == null) return value as any;
    if (typeof value === 'number') return new Date(value).toISOString();
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    throw new Error('Invalid timestamp value');
  },
  fromDriver(value: string | Date): Date {
    if (value instanceof Date) return value;
    return new Date(value);
  },
});

export const userProfile = customType<{
  data: string;
  driverData: string;
}>({
  dataType() {
    return 'user_profile';
  },
  toDriver(value: string) {
    return sql`ROW(${value})::user_profile`;
  },
  fromDriver(value: string) {
    const [userId] = value.slice(1, -1).split(',');
    return userId.trim();
  },
});

export type FileAttachment = {
  bucket_id: string;
  file_path: string;
};

export const fileAttachment = customType<{
  data: FileAttachment;
  driverData: string;
}>({
  dataType() {
    return 'file_attachment';
  },
  toDriver(value: FileAttachment) {
    return sql`ROW(${value.bucket_id},${value.file_path})::file_attachment`;
  },
  fromDriver(value: string): FileAttachment {
    const [bucketId, filePath] = value.slice(1, -1).split(',');
    return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
  },
});

export function escapeLiteral(str: string): string {
  return "'" + str.replace(/'/g, "''") + "'";
}

export const userProfileArray = customType<{
  data: string[];
  driverData: string;
}>({
  dataType() {
    return 'user_profile[]';
  },
  toDriver(value: string[]) {
    if (!value || value.length === 0) {
      return sql`'{}'::user_profile[]`;
    }
    const elements = value.map(id => `ROW(${escapeLiteral(id)})::user_profile`).join(',');
    return sql.raw(`ARRAY[${elements}]::user_profile[]`);
  },
  fromDriver(value: string): string[] {
    if (!value || value === '{}') return [];
    const inner = value.slice(1, -1);
    const matches = inner.match(/\([^)]*\)/g) || [];
    return matches.map(m => m.slice(1, -1).split(',')[0].trim());
  },
});

export const fileAttachmentArray = customType<{
  data: FileAttachment[];
  driverData: string;
}>({
  dataType() {
    return 'file_attachment[]';
  },
  toDriver(value: FileAttachment[]) {
    if (!value || value.length === 0) {
      return sql`'{}'::file_attachment[]`;
    }
    const elements = value.map(f =>
      `ROW(${escapeLiteral(f.bucket_id)},${escapeLiteral(f.file_path)})::file_attachment`
    ).join(',');
    return sql.raw(`ARRAY[${elements}]::file_attachment[]`);
  },
  fromDriver(value: string): FileAttachment[] {
    if (!value || value === '{}') return [];
    const inner = value.slice(1, -1);
    const matches = inner.match(/\([^)]*\)/g) || [];
    return matches.map(m => {
      const [bucketId, filePath] = m.slice(1, -1).split(',');
      return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
    });
  },
});

export const memory = pgTable("memory", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: varchar("type", { length: 30 }).notNull(),
  content: text("content").notNull(),
  source: varchar("source", { length: 30 }).notNull().default('USER_EXPLICIT'),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_memory_type").on(table.type),
  // Complex index: CREATE INDEX idx_memory_created_by ON memory USING btree (((_created_by).user_id)),
]);

export const report = pgTable("report", {
  id: uuid("id").primaryKey().defaultRandom(),
  reportDate: date("report_date").notNull(),
  type: varchar("type", { length: 20 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  /**
   * @type { completed: string[]; statistics: { label: string; value: string }[]; problems: string[]; aiAnalysis: string; suggestions: string[]; tomorrowGoals: string[] }
   */
  content: jsonb("content").notNull(),
  fullText: text("full_text"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_report_type_date").on(table.type, table.reportDate),
]);

export const knowledgeFile = pgTable("knowledge_file", {
  id: uuid("id").primaryKey().defaultRandom(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileType: varchar("file_type", { length: 20 }).notNull(),
  fileSize: integer("file_size").notNull().default(0),
  filePath: text("file_path").notNull(),
  extractedText: text("extracted_text"),
  // PENDING | PROCESSING | READY | ERROR
  extractStatus: varchar("extract_status", { length: 20 }).notNull().default('PENDING'),
  extractError: text("extract_error"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
});

export const aiMessage = pgTable("ai_message", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull(),
  role: varchar("role", { length: 20 }).notNull(),
  content: text("content").notNull(),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_ai_message_conversation_id").on(table.conversationId),
  foreignKey({
    columns: [table.conversationId],
    foreignColumns: [aiConversation.id],
    name: "ai_message_conversation_id_fkey",
  }).onDelete("cascade"),
]);

export const aiConversation = pgTable("ai_conversation", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 255 }).notNull().default('新对话'),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
});

export const customerFollowUp = pgTable("customer_follow_up", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").notNull(),
  content: text("content").notNull(),
  followType: varchar("follow_type", { length: 20 }).notNull().default('OTHER'),
  aiSuggestion: text("ai_suggestion"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_follow_up_customer_id").on(table.customerId),
  foreignKey({
    columns: [table.customerId],
    foreignColumns: [customer.id],
    name: "customer_follow_up_customer_id_fkey",
  }).onDelete("cascade"),
]);

export const customer = pgTable("customer", {
  id: uuid("id").primaryKey().defaultRandom(),
  company: varchar("company", { length: 255 }).notNull(),
  contactName: varchar("contact_name", { length: 100 }).notNull(),
  contactInfo: varchar("contact_info", { length: 255 }).notNull(),
  industry: varchar("industry", { length: 100 }),
  stage: varchar("stage", { length: 20 }).notNull().default('UNCONTACTED'),
  notes: text("notes"),
  /**
   * @type { intentionLevel: string; dealProbability: number; concerns: string[]; suggestions: string[]; nextStep: string }
   */
  aiAnalysis: jsonb("ai_analysis"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_customer_stage").on(table.stage),
  index("idx_customer_industry").on(table.industry),
]);

export const task = pgTable("task", {
  id: uuid("id").primaryKey().defaultRandom(),
  goalId: uuid("goal_id"),
  dailyRecordId: uuid("daily_record_id"),
  title: varchar("title", { length: 255 }).notNull(),
  priority: varchar("priority", { length: 10 }).notNull().default('MEDIUM'),
  estimatedTime: integer("estimated_time"),
  status: varchar("status", { length: 20 }).notNull().default('TODO'),
  dueDate: date("due_date"),
  isAiSuggested: boolean("is_ai_suggested").notNull().default(false),
  aiReason: text("ai_reason"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_task_goal_id").on(table.goalId),
  index("idx_task_daily_record_id").on(table.dailyRecordId),
  index("idx_task_due_date").on(table.dueDate),
  index("idx_task_status").on(table.status),
  foreignKey({
    columns: [table.goalId],
    foreignColumns: [goal.id],
    name: "task_goal_id_fkey",
  }).onDelete("set null"),
  foreignKey({
    columns: [table.dailyRecordId],
    foreignColumns: [dailyRecord.id],
    name: "task_daily_record_id_fkey",
  }).onDelete("set null"),
]);

export const dailyRecord = pgTable("daily_record", {
  id: uuid("id").primaryKey().defaultRandom(),
  recordDate: date("record_date").notNull().unique(),
  plan: text("plan").notNull(),
  completed: text("completed").notNull(),
  problems: text("problems").notNull(),
  tomorrowIdeas: text("tomorrow_ideas").notNull(),
  /**
   * @type { qualityScore: number; highlights: string[]; problems: string[]; suggestions: string[]; nextActions: string[] }
   */
  aiAnalysis: jsonb("ai_analysis"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("idx_daily_record_date_created_by").on(table.recordDate),
]);

export const goal = pgTable("goal", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: varchar("type", { length: 20 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  status: varchar("status", { length: 20 }).notNull().default('NOT_STARTED'),
  parentId: uuid("parent_id"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  foreignKey({
    columns: [table.parentId],
    foreignColumns: [goal.id],
    name: "goal_parent_id_fkey",
  }).onDelete("set null"),
]);

// table aliases
export const aiConversationTable = aiConversation;
export const aiMessageTable = aiMessage;
export const customerTable = customer;
export const customerFollowUpTable = customerFollowUp;
export const dailyRecordTable = dailyRecord;
export const goalTable = goal;
export const knowledgeFileTable = knowledgeFile;
export const memoryTable = memory;
export const reportTable = report;
export const taskTable = task;
