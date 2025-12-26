'use client';

import {
  ClockCounterClockwiseIcon,
  GearIcon,
  HouseSimpleIcon,
  MagnifyingGlassIcon,
  ImagesIcon,
  UploadIcon,
  ArrowLeftIcon,
} from '@phosphor-icons/react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type AdminSidebarProps = {
  username: string | null;
  email?: string;
};

type NavItemProps = {
  icon: React.ElementType;
  label: string;
  href: string;
  isActive: boolean;
};

function NavItem({ icon: Icon, label, href, isActive }: NavItemProps) {
  return (
    <a
      href={href}
      className={cn(
        'group relative flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200',
        isActive
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
      )}
    >
      <Icon className="w-[18px] h-[18px] shrink-0" />
      <span
        className={cn(
          'text-[15px] transition-opacity duration-200',
          isActive ? 'font-medium' : 'font-normal'
        )}
      >
        {label}
      </span>
    </a>
  );
}

export function AdminSidebar({ username, email }: AdminSidebarProps) {
  const navItems = [
    { icon: HouseSimpleIcon, label: 'Dashboard', href: '/admin' },
    { icon: ClockCounterClockwiseIcon, label: 'Generation History', href: '/admin/histories' },
    { icon: MagnifyingGlassIcon, label: 'Vector Search', href: '/admin/search' },
    { icon: ImagesIcon, label: 'Logo Management', href: '/admin/logos' },
    { icon: UploadIcon, label: 'Upload SVGs', href: '/admin/upload' },
  ];

  const displayName = username || email;
  const initials = displayName
    ? displayName
        .split(/[\s@]/)
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0].toUpperCase())
        .join('')
    : '?';

  return (
    <TooltipProvider delayDuration={0}>
      <aside className="fixed left-0 top-0 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col z-40">
        {/* Vertical accent line */}
        <div className="absolute left-0 top-0 h-full w-px bg-gradient-to-b from-transparent via-orange-500/40 to-transparent" />

        {/* Header */}
        <div className="relative border-b border-sidebar-border/50 px-5 py-6">
          <div className="flex items-center gap-2">
            <GearIcon className="w-5 h-5 text-orange-500" />
            <h1 className="font-serif text-[19px] font-semibold tracking-[-0.01em] text-sidebar-foreground">
              Admin
            </h1>
          </div>
          <p className="text-[13px] font-normal text-muted-foreground mt-0.5 truncate">
            {displayName}
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive =
              typeof window !== 'undefined' &&
              (item.href === '/admin'
                ? window.location.pathname === '/admin'
                : window.location.pathname.startsWith(item.href));
            return (
              <NavItem
                key={item.href}
                icon={item.icon}
                label={item.label}
                href={item.href}
                isActive={isActive}
              />
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border/50 py-3 px-3 space-y-1">
          <a
            href="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          >
            <ArrowLeftIcon className="w-[18px] h-[18px] shrink-0" />
            <span className="text-[15px]">Back to App</span>
          </a>
        </div>
      </aside>
    </TooltipProvider>
  );
}
