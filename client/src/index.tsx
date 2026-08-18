import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';

import RoutesComponent from './app.tsx';
import './index.css';
import { createPortal } from 'react-dom';
import { Toaster } from '@client/src/components/ui/sonner';

const CLIENT_BASE_PATH = process.env.CLIENT_BASE_PATH || '/';
const IS_LOCAL_DEV = import.meta.env.VITE_LOCAL_DEV === 'true';

// 平台组件按需加载（本地模式不加载，避免平台SDK初始化失败）
const PlatformAppContainer = lazy(() =>
  import('@lark-apaas/client-toolkit/components/AppContainer').then((m) => ({
    default: m.AppContainer,
  })),
);
const PlatformErrorRender = lazy(() =>
  import('@lark-apaas/client-toolkit/components/ErrorRender').then((m) => ({
    default: m.ErrorRender,
  })),
);

const LocalErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary,
}) => (
  <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
    <h2 style={{ color: '#e11d48' }}>应用出错了</h2>
    <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, overflow: 'auto' }}>
      {error?.message}
    </pre>
    <button
      onClick={resetErrorBoundary}
      style={{ padding: '8px 16px', marginTop: 12, cursor: 'pointer' }}
    >
      重试
    </button>
  </div>
);

const App: React.FC = () => {
  if (IS_LOCAL_DEV) {
    return (
      <BrowserRouter basename={CLIENT_BASE_PATH}>
        <ErrorBoundary fallbackRender={LocalErrorFallback}>
          <RoutesComponent />
          {createPortal(<Toaster />, document.body)}
        </ErrorBoundary>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter basename={CLIENT_BASE_PATH}>
      <Suspense fallback={<div>加载中...</div>}>
        <PlatformAppContainer defaultTheme="light">
          <ErrorBoundary
            fallbackRender={({ error, resetErrorBoundary }) => (
              <PlatformErrorRender
                error={error as Error}
                resetErrorBoundary={resetErrorBoundary}
              />
            )}
          >
            <RoutesComponent />
            {createPortal(<Toaster />, document.body)}
          </ErrorBoundary>
        </PlatformAppContainer>
      </Suspense>
    </BrowserRouter>
  );
};

createRoot(document.getElementById('root')!).render(<App />);
