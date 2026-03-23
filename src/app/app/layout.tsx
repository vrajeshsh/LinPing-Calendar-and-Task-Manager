import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { StoreInitializer } from '@/components/StoreInitializer';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full bg-background text-foreground selection:bg-primary/20">
      <StoreInitializer />
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0 overflow-x-hidden relative">
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
