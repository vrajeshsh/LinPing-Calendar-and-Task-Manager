'use client';

import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { signOut } from '@/app/auth/actions';
import { LogOut, User } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="flex flex-col h-full">
      <header className="px-5 md:px-8 py-8 md:py-10">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1 text-[15px] font-medium">Preferences and configuration</p>
      </header>

      <div className="flex-1 px-4 md:px-8 max-w-2xl w-full mx-auto pb-32 space-y-4">
        <div className="bg-card/60 border border-border/30 rounded-2xl p-5 shadow-sm">
          <h2 className="font-semibold text-base mb-4 flex items-center gap-2">
            <User className="w-4 h-4" /> Account
          </h2>
          <div className="flex items-center justify-between py-3 border-b border-border/30 last:border-0">
            <div>
              <p className="font-medium text-[15px]">Sign Out</p>
              <p className="text-muted-foreground text-[12px] mt-0.5">Logout from your account on this device</p>
            </div>
            <form action={signOut}>
              <Button variant="destructive" size="sm" type="submit">
                <LogOut className="mr-2 h-4 w-4" /> Sign Out
              </Button>
            </form>
          </div>
        </div>

        <div className="bg-card/60 border border-border/30 rounded-2xl p-5 shadow-sm">
          <h2 className="font-semibold text-base mb-4">Appearance</h2>
          <div className="flex items-center justify-between py-3 border-b border-border/30 last:border-0">
            <div>
              <p className="font-medium text-[15px]">Color Theme</p>
              <p className="text-muted-foreground text-[12px] mt-0.5">Switch between light and dark mode</p>
            </div>
            <ThemeToggle />
          </div>
        </div>

        <div className="bg-card/60 border border-border/30 rounded-2xl p-5 shadow-sm">
          <h2 className="font-semibold text-base mb-1">About</h2>
          <p className="text-muted-foreground text-sm">LinPing AI Calendar · v2.0</p>
          <p className="text-muted-foreground text-xs mt-1 italic">vibe coded at 3am with lots of coffee</p>
        </div>
      </div>
    </div>
  );
}
