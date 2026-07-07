import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home,
  Trophy,
  SlidersHorizontal,
  LayoutDashboard,
  Map as MapIcon,
  GitCompare,
  Inbox,
  Calculator,
  PencilLine,
  Database,
  Plus,
  PanelLeftClose,
  PanelLeft,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}
interface NavGroup {
  title: string;
  items: NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    title: 'Screening',
    items: [
      { to: '/', label: 'Home', icon: Home, end: true },
      { to: '/rankings', label: 'Rankings', icon: Trophy },
      { to: '/sensitivity', label: 'Sensitivity', icon: SlidersHorizontal },
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/map', label: 'Map', icon: MapIcon },
      { to: '/compare', label: 'Compare', icon: GitCompare },
    ],
  },
  {
    title: 'Deals',
    items: [
      { to: '/pipeline', label: 'Pipeline', icon: Inbox },
      { to: '/underwrite', label: 'Underwrite', icon: Calculator },
    ],
  },
  {
    title: 'Admin',
    items: [
      { to: '/data-entry', label: 'Data Entry', icon: PencilLine },
      { to: '/sources', label: 'Data Sources', icon: Database },
      { to: '/add', label: 'Add Market', icon: Plus },
    ],
  },
];

const STORAGE_KEY = 'sf_sidebar_collapsed';

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === '1');
  }, []);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      return next;
    });
  }

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex h-full flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200',
          collapsed ? 'w-16' : 'w-60'
        )}
      >
        {/* Brand header */}
        <div className="flex items-center gap-2 px-3 h-16 border-b border-sidebar-border">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground font-bold">
            B
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold leading-tight text-white">Brunswick</div>
              <div className="truncate text-[11px] text-sidebar-foreground/70">Screening Framework</div>
            </div>
          )}
        </div>

        {/* Grouped nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          {GROUPS.map((group) => (
            <div key={group.title}>
              {!collapsed && (
                <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                  {group.title}
                </div>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const link = (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                          collapsed && 'justify-center px-0',
                          isActive
                            ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                            : 'text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                        )
                      }
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </NavLink>
                  );
                  return collapsed ? (
                    <Tooltip key={item.to}>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  ) : (
                    link
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Collapse toggle */}
        <div className="border-t border-sidebar-border p-2">
          <button
            onClick={toggle}
            className={cn(
              'flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              collapsed && 'justify-center px-0'
            )}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <PanelLeft className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
