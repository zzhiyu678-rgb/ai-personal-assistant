import { Link, Outlet, useLocation } from 'react-router-dom';
import { LogOut, Sparkles, LayoutDashboard, Target, FileText, Bot, BookOpen, CalendarClock, Users, MessageSquareText, Library, BarChart3, Brain } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarTrigger,
} from '@client/src/components/ui/sidebar';
import { Breadcrumb, BreadcrumbItem, BreadcrumbList } from '@client/src/components/ui/breadcrumb';

const isLocalDev = import.meta.env.VITE_LOCAL_DEV === 'true';

const handleSignOut = async () => {
  if (isLocalDev) {
    alert('本地开发模式，退出登录功能不可用');
    return;
  }
  const { authClient } = await import('@lark-apaas/client-toolkit/auth');
  try {
    await authClient.session.signOut();
    authClient.session.redirectToLogin();
  } catch {
    authClient.session.redirectToLogin();
  }
};

const navItems = [
  { path: '/', label: '仪表盘', icon: LayoutDashboard, title: '首页仪表盘' },
  { path: '/goals', label: '目标管理', icon: Target, title: '目标管理' },
  { path: '/work/today', label: '今日记录', icon: FileText, title: '今日工作记录' },
  { path: '/assistant', label: 'AI顾问', icon: Bot, title: 'AI销售顾问' },
  { path: '/report', label: '工作日报', icon: BookOpen, title: '自动日报' },
  { path: '/crm', label: '客户管理', icon: Users, title: 'CRM客户管理' },
  { path: '/chat-analysis', label: '聊天分析', icon: MessageSquareText, title: '聊天分析' },
  { path: '/knowledge', label: '知识库', icon: Library, title: 'AI知识库' },
  { path: '/analytics', label: '数据分析', icon: BarChart3, title: '数据分析' },
  { path: '/memory', label: 'AI记忆', icon: Brain, title: 'AI长期记忆' },
];

const LocalUserBadge = () => (
  <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/50">
    <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-medium">
      本
    </div>
    <div className="flex flex-col leading-tight">
      <span className="text-xs font-medium text-foreground">本地用户</span>
      <span className="text-[10px] text-muted-foreground">dev@local.com</span>
    </div>
  </div>
);

const LayoutContent = () => {
  const { pathname } = useLocation();
  const activeItem = navItems.find((item) => {
    if (item.path === '/') return pathname === '/';
    return pathname.startsWith(item.path);
  });
  const activeTitle = activeItem?.title || 'AI私人助理';

  return (
    <>
      <Sidebar collapsible="icon" className="border-r border-sidebar-border">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link to="/">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Sparkles className="size-4" />
                  </div>
                  <div className="flex flex-col gap-0.5 leading-none group-data-[collapsible=icon]:hidden">
                    <span className="font-semibold text-foreground">AI私人助理</span>
                    <span className="text-xs text-muted-foreground">AI Personal Assistant</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => {
                  const isActive = item.path === '/' ? pathname === '/' : pathname.startsWith(item.path);
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link to={item.path}>
                          <item.icon className="size-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="px-2 py-2">
                {isLocalDev ? <LocalUserBadge /> : null}
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <main className="flex-1 flex flex-col overflow-hidden p-6 bg-background">
        <header className="flex items-center justify-between gap-2 mb-6 shrink-0">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <Breadcrumb className="self-center">
              <BreadcrumbList>
                <BreadcrumbItem className="text-foreground font-medium">{activeTitle}</BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex items-center gap-3">
            {isLocalDev ? <LocalUserBadge /> : null}
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground hover:text-foreground">
              <LogOut className="size-4 mr-1.5" />
              <span className="hidden sm:inline">退出登录</span>
            </Button>
          </div>
        </header>
        <div className="flex-1 min-h-0 overflow-auto">
          <Outlet />
        </div>
      </main>
    </>
  );
};

const Layout = () => (
  <SidebarProvider>
    <LayoutContent />
  </SidebarProvider>
);

export default Layout;
