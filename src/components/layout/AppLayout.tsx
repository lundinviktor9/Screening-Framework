import { Outlet, useLocation, Link } from 'react-router-dom';

import Sidebar from './Sidebar';
import { Toaster } from '@/components/ui/sonner';
import { ConfirmDialog } from '@/components/ui/confirm';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

// Route → human label for the breadcrumb / page title.
const ROUTE_LABELS: Record<string, string> = {
  '': 'Home',
  rankings: 'Rankings',
  sensitivity: 'Sensitivity',
  dashboard: 'Dashboard',
  map: 'Map',
  compare: 'Compare',
  pipeline: 'Pipeline',
  underwrite: 'Underwrite',
  'data-entry': 'Data Entry',
  sources: 'Data Sources',
  add: 'Add Market',
  edit: 'Edit Market',
};

function labelFor(segment: string): string {
  return ROUTE_LABELS[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1);
}

export default function AppLayout() {
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean);
  const current = segments.length === 0 ? 'Home' : labelFor(segments[0]);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar: breadcrumb + page title */}
        <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-card px-6">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/">Brunswick</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              {segments.length <= 1 ? (
                <BreadcrumbItem>
                  <BreadcrumbPage>{current}</BreadcrumbPage>
                </BreadcrumbItem>
              ) : (
                <>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to={`/${segments[0]}`}>{labelFor(segments[0])}</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{labelFor(segments[1])}</BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              )}
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Global overlays */}
      <Toaster position="bottom-right" richColors />
      <ConfirmDialog />
    </div>
  );
}
