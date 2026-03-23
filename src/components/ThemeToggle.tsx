'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="w-9 h-9" />; // Placeholder to stop layout shift

  return (
    <button
      onClick={() => setTheme(resolvedTheme === 'light' ? 'dark' : 'light')}
      className="relative flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-300 hover:bg-muted/80 text-muted-foreground hover:text-foreground active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/20"
      title="Toggle theme"
    >
      {resolvedTheme === 'dark' ? (
        <Moon className="w-[18px] h-[18px]" />
      ) : (
        <Sun className="w-[18px] h-[18px]" />
      )}
      <span className="sr-only">Toggle theme</span>
    </button>
  );
}
