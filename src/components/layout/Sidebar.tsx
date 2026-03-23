'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, Home, PieChart, Settings, CheckSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { name: 'Today', href: '/', icon: Home },
  { name: 'Calendar', href: '/calendar', icon: CalendarDays },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare },
  { name: 'Insights', href: '/insights', icon: PieChart },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-20 lg:w-64 border-r border-border/40 bg-background/60 backdrop-blur-xl h-screen sticky top-0 px-4 py-8 z-40">
      <div className="flex items-center gap-3 px-2 mb-10">
        <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold shadow-md">
          L
        </div>
        <span className="font-semibold text-lg hidden lg:block tracking-tight text-foreground">LinPing</span>
      </div>

      <nav className="flex flex-col gap-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 group hover:bg-muted/60",
                isActive 
                  ? "bg-primary/10 text-primary font-medium" 
                  : "text-muted-foreground hover:text-foreground"
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
