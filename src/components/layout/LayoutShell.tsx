import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';

export function LayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full bg-background text-foreground selection:bg-primary/20">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0 overflow-x-hidden relative">
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
