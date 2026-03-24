'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, Home, PieChart, CheckSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { name: 'Today', href: '/app/scheduler', icon: Home },
  { name: 'Calendar', href: '/app/calendar', icon: CalendarDays },
  { name: 'Tasks', href: '/app/tasks', icon: CheckSquare },
  { name: 'Insights', href: '/app/insights', icon: PieChart },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 border-t border-border/40 bg-background/80 backdrop-blur-xl z-50 flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_24px_rgba(0,0,0,0.02)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.2)]">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center w-full h-full gap-1 transition-all duration-300 uppercase tracking-wider",
              isActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            <item.icon className={cn("w-5 h-5", isActive ? "stroke-[2.5px] scale-110" : "stroke-[2px] scale-100")} />
            <span className="text-[10px] font-semibold">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
