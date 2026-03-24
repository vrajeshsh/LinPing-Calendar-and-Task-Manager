'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, Home, PieChart, Settings, CheckSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

const MAIN_NAV = [
  { name: 'Scheduler', href: '/app/scheduler', icon: Home },
  { name: 'Tasks', href: '/app/tasks', icon: CheckSquare },
  { name: 'Calendar', href: '/app/calendar', icon: CalendarDays },
  { name: 'Insights', href: '/app/insights', icon: PieChart },
];

const BOTTOM_NAV = [
  { name: 'Settings', href: '/app/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-20 lg:w-64 border-r border-border/40 bg-background/60 backdrop-blur-xl h-screen sticky top-0 px-4 py-8 z-40">
      <div className="flex items-center gap-3 px-2 mb-10">
        <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold shadow-md">
          L
        </div>
        <div className="hidden lg:block">
          <span className="font-semibold text-lg tracking-tight text-foreground">LinPing</span>
          <span className="text-xs text-muted-foreground ml-1">AI Calendar</span>
        </div>
      </div>

      {/* Main navigation */}
      <nav className="flex flex-col gap-1">
        {MAIN_NAV.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 group uppercase tracking-wider text-[11px] font-semibold",
                isActive 
                  ? "bg-primary/10 text-primary font-medium" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              <item.icon className={cn("w-5 h-5 transition-colors", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
              <span className="hidden lg:block">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Divider */}
      <div className="border-t border-border/30 my-4" />

      {/* Bottom navigation - Settings */}
      <nav className="flex flex-col gap-1">
        {BOTTOM_NAV.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 group uppercase tracking-wider text-[11px] font-semibold",
                isActive 
                  ? "bg-primary/10 text-primary font-medium" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              <item.icon className={cn("w-5 h-5 transition-colors", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
              <span className="hidden lg:block">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
