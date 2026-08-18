import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';

const isLocalDev = import.meta.env.VITE_LOCAL_DEV === 'true';

const ProtectedRoute = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    if (isLocalDev) {
      setIsAuthenticated(true);
      return;
    }

    let mounted = true;
    import('@lark-apaas/client-toolkit/auth').then(({ authClient }) => {
      authClient.session.getUserInfo().then((result) => {
        if (!mounted) return;
        if (result.error) {
          authClient.session.redirectToLogin();
          setIsAuthenticated(false);
        } else {
          setIsAuthenticated(true);
        }
      }).catch(() => {
        if (!mounted) return;
        setIsAuthenticated(false);
        authClient.session.redirectToLogin();
      });
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">验证登录状态...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <Outlet />;
};

export default ProtectedRoute;
