-- AI Work Coach 本地数据库初始化脚本

-- 1. 创建自定义类型（先删除再创建，确保幂等）
DROP TYPE IF EXISTS file_attachment CASCADE;
DROP TYPE IF EXISTS user_profile CASCADE;

CREATE TYPE user_profile AS (
  user_id text
);

CREATE TYPE file_attachment AS (
  bucket_id text,
  file_path text
);

-- 2. 创建表
CREATE TABLE IF NOT EXISTS goal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type varchar(20) NOT NULL,
  title varchar(255) NOT NULL,
  description text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'NOT_STARTED',
  parent_id uuid REFERENCES goal(id) ON DELETE SET NULL,
  _created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile DEFAULT ROW(current_setting('app.user_id'::text, true))::user_profile,
  _updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile DEFAULT ROW(current_setting('app.user_id'::text, true))::user_profile
);

CREATE TABLE IF NOT EXISTS daily_record (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_date date NOT NULL,
  plan text NOT NULL,
  completed text NOT NULL,
  problems text NOT NULL,
  tomorrow_ideas text NOT NULL,
  ai_analysis jsonb,
  _created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile DEFAULT ROW(current_setting('app.user_id'::text, true))::user_profile,
  _updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile DEFAULT ROW(current_setting('app.user_id'::text, true))::user_profile,
  CONSTRAINT idx_daily_record_date UNIQUE (record_date)
);

CREATE TABLE IF NOT EXISTS task (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid REFERENCES goal(id) ON DELETE SET NULL,
  daily_record_id uuid REFERENCES daily_record(id) ON DELETE SET NULL,
  title varchar(255) NOT NULL,
  priority varchar(10) NOT NULL DEFAULT 'MEDIUM',
  estimated_time integer,
  status varchar(20) NOT NULL DEFAULT 'TODO',
  due_date date,
  is_ai_suggested boolean NOT NULL DEFAULT false,
  ai_reason text,
  _created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile DEFAULT ROW(current_setting('app.user_id'::text, true))::user_profile,
  _updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile DEFAULT ROW(current_setting('app.user_id'::text, true))::user_profile
);
CREATE INDEX IF NOT EXISTS idx_task_goal_id ON task(goal_id);
CREATE INDEX IF NOT EXISTS idx_task_daily_record_id ON task(daily_record_id);
CREATE INDEX IF NOT EXISTS idx_task_due_date ON task(due_date);
CREATE INDEX IF NOT EXISTS idx_task_status ON task(status);

CREATE TABLE IF NOT EXISTS customer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company varchar(255) NOT NULL,
  contact_name varchar(100) NOT NULL,
  contact_info varchar(255) NOT NULL,
  industry varchar(100),
  stage varchar(20) NOT NULL DEFAULT 'UNCONTACTED',
  notes text,
  ai_analysis jsonb,
  _created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile DEFAULT ROW(current_setting('app.user_id'::text, true))::user_profile,
  _updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile DEFAULT ROW(current_setting('app.user_id'::text, true))::user_profile
);
CREATE INDEX IF NOT EXISTS idx_customer_stage ON customer(stage);
CREATE INDEX IF NOT EXISTS idx_customer_industry ON customer(industry);

CREATE TABLE IF NOT EXISTS customer_follow_up (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  content text NOT NULL,
  follow_type varchar(20) NOT NULL DEFAULT 'OTHER',
  ai_suggestion text,
  _created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile DEFAULT ROW(current_setting('app.user_id'::text, true))::user_profile,
  _updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile DEFAULT ROW(current_setting('app.user_id'::text, true))::user_profile
);
CREATE INDEX IF NOT EXISTS idx_follow_up_customer_id ON customer_follow_up(customer_id);

CREATE TABLE IF NOT EXISTS ai_conversation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(255) NOT NULL DEFAULT '新对话',
  _created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile DEFAULT ROW(current_setting('app.user_id'::text, true))::user_profile,
  _updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile DEFAULT ROW(current_setting('app.user_id'::text, true))::user_profile
);

CREATE TABLE IF NOT EXISTS ai_message (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES ai_conversation(id) ON DELETE CASCADE,
  role varchar(20) NOT NULL,
  content text NOT NULL,
  _created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile DEFAULT ROW(current_setting('app.user_id'::text, true))::user_profile,
  _updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile DEFAULT ROW(current_setting('app.user_id'::text, true))::user_profile
);
CREATE INDEX IF NOT EXISTS idx_ai_message_conversation_id ON ai_message(conversation_id);

CREATE TABLE IF NOT EXISTS knowledge_file (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name varchar(255) NOT NULL,
  file_type varchar(20) NOT NULL,
  file_size integer NOT NULL DEFAULT 0,
  file_path text NOT NULL,
  extracted_text text,
  extract_status varchar(20) NOT NULL DEFAULT 'PENDING',
  extract_error text,
  _created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile DEFAULT ROW(current_setting('app.user_id'::text, true))::user_profile,
  _updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile DEFAULT ROW(current_setting('app.user_id'::text, true))::user_profile
);

CREATE TABLE IF NOT EXISTS report (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date date NOT NULL,
  type varchar(20) NOT NULL,
  title varchar(255) NOT NULL,
  content jsonb NOT NULL,
  full_text text,
  _created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile DEFAULT ROW(current_setting('app.user_id'::text, true))::user_profile,
  _updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile DEFAULT ROW(current_setting('app.user_id'::text, true))::user_profile
);
CREATE INDEX IF NOT EXISTS idx_report_type_date ON report(type, report_date);

CREATE TABLE IF NOT EXISTS memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type varchar(30) NOT NULL,
  content text NOT NULL,
  source varchar(30) NOT NULL DEFAULT 'USER_EXPLICIT',
  _created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile DEFAULT ROW(current_setting('app.user_id'::text, true))::user_profile,
  _updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile DEFAULT ROW(current_setting('app.user_id'::text, true))::user_profile
);
CREATE INDEX IF NOT EXISTS idx_memory_type ON memory(type);

SELECT 'Database initialized successfully!' AS status;
