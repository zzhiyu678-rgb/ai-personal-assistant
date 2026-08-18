export type GoalType = 'YEAR' | 'MONTH' | 'WEEK';
export type GoalStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE';

export interface Goal {
  id: string;
  type: GoalType;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  status: GoalStatus;
  parentId: string | null;
  progress: number;
  createdAt: string;
  updatedAt: string;
}

export interface GoalWithChildren extends Goal {
  children: Goal[];
}

export interface DecomposedGoal {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
}

export interface TomorrowPlanTask {
  title: string;
  priority: TaskPriority;
  estimatedTime: number;
  reason: string;
}

export interface GoalListResponse {
  items: Goal[];
  total: number;
}

export interface CreateGoalRequest {
  type: GoalType;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  status: GoalStatus;
  parentId?: string;
}

export interface UpdateGoalRequest {
  title?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  status?: GoalStatus;
  parentId?: string;
}

export interface DecomposeGoalResponse {
  suggestedGoals: Array<{
    title: string;
    description: string;
    startDate: string;
    endDate: string;
  }>;
}

export interface ConfirmDecomposeRequest {
  goals: Array<{
    title: string;
    description: string;
    startDate: string;
    endDate: string;
  }>;
}

export interface ConfirmDecomposeResponse {
  createdCount: number;
  goals: Array<{ id: string; title: string }>;
}

export interface DailyRecord {
  id: string;
  date: string;
  plan: string;
  completed: string;
  problems: string;
  tomorrowIdeas: string;
  aiAnalysis: AiWorkAnalysis | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiWorkAnalysis {
  qualityScore: number;
  highlights: string[];
  problems: string[];
  suggestions: string[];
  nextActions: string[];
}

export interface DailyRecordListResponse {
  items: Array<{ id: string; date: string; plan: string; hasAnalysis: boolean }>;
  total: number;
}

export interface SaveDailyRecordRequest {
  plan?: string;
  completed?: string;
  problems?: string;
  tomorrowIdeas?: string;
}

export type TaskPriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

export interface Task {
  id: string;
  goalId: string | null;
  dailyRecordId: string | null;
  title: string;
  priority: TaskPriority;
  estimatedTime: number | null;
  status: TaskStatus;
  dueDate: string | null;
  isAiSuggested: boolean;
  aiReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskListResponse {
  items: Task[];
  total: number;
}

export interface BatchCreateTasksRequest {
  tasks: Array<{
    title: string;
    priority: TaskPriority;
    estimatedTime?: number;
    dueDate: string;
    isAiSuggested?: boolean;
  }>;
}

export interface BatchCreateTasksResponse {
  createdCount: number;
  items: Array<{ id: string; title: string }>;
}

export interface UpdateTaskRequest {
  status?: TaskStatus;
  title?: string;
  priority?: TaskPriority;
}

export type CustomerStage = 'UNCONTACTED' | 'ADDED' | 'COMMUNICATING' | 'INTERESTED' | 'CLOSED';

export interface Customer {
  id: string;
  company: string;
  contactName: string;
  contactInfo: string;
  industry: string | null;
  stage: CustomerStage;
  notes: string | null;
  aiAnalysis: AiCustomerAnalysis | null;
  lastFollowUpAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiCustomerAnalysis {
  intentionLevel: string;
  dealProbability: number;
  concerns: string[];
  suggestions: string[];
  nextStep: string;
}

export interface CustomerListResponse {
  items: Customer[];
  total: number;
}

export interface CreateCustomerRequest {
  company: string;
  contactName?: string;
  contactInfo?: string;
  industry?: string;
  stage?: CustomerStage;
  notes?: string;
  legalRep?: string;
  phones?: string[];
  morePhones?: string[];
  emails?: string[];
  website?: string;
}

export interface UpdateCustomerRequest {
  company?: string;
  contactName?: string;
  contactInfo?: string;
  industry?: string;
  stage?: CustomerStage;
  notes?: string;
  legalRep?: string;
  phones?: string[];
  morePhones?: string[];
  emails?: string[];
  website?: string;
}

export type FollowUpType = 'PHONE' | 'WECHAT' | 'MEETING' | 'EMAIL' | 'OTHER';

export interface FollowUpRecord {
  id: string;
  customerId: string;
  content: string;
  followType: FollowUpType;
  aiSuggestion: string | null;
  createdAt: string;
}

export interface FollowUpListResponse {
  items: FollowUpRecord[];
}

export interface CreateFollowUpRequest {
  content: string;
  followType: FollowUpType;
}

export interface ChatAnalysisResult {
  needs: string[];
  concerns: string[];
  dealProbability: number;
  nextReply: string;
}

export interface ChatAnalysisRequest {
  chatText: string;
}

export interface KnowledgeFile {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  hasExtractedText: boolean;
}

export interface KnowledgeFileListResponse {
  items: KnowledgeFile[];
  total: number;
}

export interface AiConversation {
  id: string;
  title: string;
  createdAt: string;
  lastMessage: string;
}

export interface AiConversationListResponse {
  items: AiConversation[];
  total: number;
}

export interface AiMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface AiMessageListResponse {
  items: AiMessage[];
}

export interface SendMessageRequest {
  content: string;
  attachments?: Array<{ type: string; name: string; content: string }>;
}

export type ReportType = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface ReportContent {
  completed: string[];
  statistics: Array<{ label: string; value: string }>;
  problems: string[];
  aiAnalysis: string;
  suggestions: string[];
  tomorrowGoals: string[];
}

export interface Report {
  id: string;
  title: string;
  type: ReportType;
  date: string;
  content: ReportContent;
  fullText: string;
  createdAt: string;
}

export interface ReportListResponse {
  items: Array<{ id: string; title: string; date: string; type: ReportType }>;
  total: number;
}

export interface GenerateReportRequest {
  date?: string;
  type: ReportType;
}

export interface DashboardTodayResponse {
  todayDate: string;
  completionRate: number;
  todayTaskCount: number;
  monthlyGoalProgress: number;
  streakDays: number;
  todayTasks: Array<{ id: string; title: string; status: string; priority: string }>;
  aiSuggestion: string | null;
}

export interface AnalyticsSummaryResponse {
  kpis: {
    taskCompletionRate: number;
    totalCustomers: number;
    closedCustomers: number;
    dealRate: number;
  };
  workTrend: Array<{ date: string; completedCount: number }>;
  taskCompletionByPeriod: Array<{ period: string; rate: number }>;
  customerGrowth: Array<{ date: string; newCount: number }>;
  communicationStats: Array<{ date: string; count: number }>;
  stageDistribution: Array<{ stage: string; count: number }>;
  industryDistribution: Array<{ industry: string; count: number }>;
}

export interface GenerateAnalyticsReportRequest {
  type: 'WEEKLY' | 'MONTHLY';
  date?: string;
}

export interface AnalyticsReportResponse {
  id: string;
  title: string;
  type: string;
  date: string;
  content: string;
  fullText: string;
}

export type MemoryType = 'PROFILE' | 'WORK_STYLE' | 'SALES_STYLE' | 'PREFERENCE';
export type MemorySource = 'USER_EXPLICIT' | 'AI_EXTRACTED';

export interface Memory {
  id: string;
  type: MemoryType;
  content: string;
  source: MemorySource;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryListResponse {
  items: Memory[];
  total: number;
}

export interface CreateMemoryRequest {
  type: MemoryType;
  content: string;
  source?: MemorySource;
}

export interface UpdateMemoryRequest {
  type?: MemoryType;
  content?: string;
}

export interface MemorySuggestionResponse {
  hasMemory: boolean;
  memory?: Memory;
  suggestion?: string;
}
