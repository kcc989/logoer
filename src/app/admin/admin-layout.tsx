import { requestInfo } from 'rwsdk/worker';

import { AdminSidebar } from './admin-sidebar';
import { Unauthorized } from '@/app/pages/Unauthorized';
import { QueryClientProvider } from '@/components/query-client-provider';

type AdminLayoutProps = {
  children?: React.ReactNode;
};

export function AdminLayout({ children }: AdminLayoutProps) {
  const { ctx } = requestInfo;
  const user = ctx.user;

  // Show unauthorized if not authenticated or not admin
  if (!user || user.role !== 'admin') {
    return <Unauthorized />;
  }

  return (
    <QueryClientProvider>
      <AdminSidebar
        username={user.username ?? null}
        email={user.email}
      />
      <main className="ml-64 min-h-screen bg-background">
        <div className="p-8">
          {children}
        </div>
      </main>
    </QueryClientProvider>
  );
}
