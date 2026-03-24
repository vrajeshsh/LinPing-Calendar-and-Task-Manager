'use client';

import { useState } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { signOut } from '@/app/auth/actions';
import { LogOut, User, Globe } from 'lucide-react';
import { useScheduleStore } from '@/store/useScheduleStore';
import { supabaseService } from '@/services/supabaseService';
import { toast } from 'sonner';

const TIMEZONES = [
  'America/New_York',
  'America/Chicago', 
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
  'Pacific/Auckland'
];

export default function SettingsPage() {
  const { user } = useScheduleStore();
  const [selectedTimezone, setSelectedTimezone] = useState(user?.timezone || 'America/New_York');

  const handleTimezoneChange = async () => {
    try {
      await supabaseService.updateProfile({ timezone: selectedTimezone });
      // Update the store
      useScheduleStore.setState(s => ({
        ...s,
        user: s.user ? { ...s.user, timezone: selectedTimezone } : null
      }));
      toast.success('Timezone updated successfully');
    } catch (error) {
      toast.error('Failed to update timezone');
    }
  };

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
          <h2 className="font-semibold text-base mb-4 flex items-center gap-2">
            <Globe className="w-4 h-4" /> Timezone
          </h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-2">Your timezone</label>
              <select
                value={selectedTimezone}
                onChange={(e) => setSelectedTimezone(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {TIMEZONES.map(tz => (
                  <option key={tz} value={tz}>
                    {tz.replace('_', ' ')} ({new Date().toLocaleTimeString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit' })})
                  </option>
                ))}
              </select>
            </div>
            <Button 
              onClick={handleTimezoneChange}
              disabled={selectedTimezone === user?.timezone}
              size="sm"
            >
              Update Timezone
            </Button>
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
          <p className="text-muted-foreground text-[10px] mt-2 tracking-widest font-medium">VIBE CODED AT 3AM WITH LOTS OF COFFEE</p>
        </div>
      </div>
    </div>
  );
}
