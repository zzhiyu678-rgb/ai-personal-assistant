import React from 'react';
import { Route, Routes } from 'react-router-dom';

import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import NotFound from './pages/NotFound/NotFound';

import DashboardPage from './pages/dashboard/DashboardPage';
import GoalsPage from './pages/goals/GoalsPage';
import WorkTodayPage from './pages/work/WorkTodayPage';
import AssistantPage from './pages/assistant/AssistantPage';
import ReportPage from './pages/report/ReportPage';
import CrmPage from './pages/crm/CrmPage';
import ChatAnalysisPage from './pages/chat-analysis/ChatAnalysisPage';
import KnowledgePage from './pages/knowledge/KnowledgePage';
import AnalyticsPage from './pages/analytics/AnalyticsPage';
import MemoryPage from './pages/memory/MemoryPage';

const RoutesComponent = () => {
  return (
    <Routes>
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
        <Route path="goals" element={<GoalsPage />} />
        <Route path="work/today" element={<WorkTodayPage />} />
        <Route path="assistant" element={<AssistantPage />} />
        <Route path="report" element={<ReportPage />} />
        <Route path="crm" element={<CrmPage />} />
        <Route path="chat-analysis" element={<ChatAnalysisPage />} />
        <Route path="knowledge" element={<KnowledgePage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="memory" element={<MemoryPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default RoutesComponent;
