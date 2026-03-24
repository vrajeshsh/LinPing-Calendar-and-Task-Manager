'use client';

import { useState, useEffect } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { signOut } from '@/app/auth/actions';
import { LogOut, User, Globe, Brain, RotateCcw, Sparkles } from 'lucide-react';
import { useScheduleStore } from '@/store/useScheduleStore';
import { supabaseService } from '@/services/supabaseService';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';

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
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [adaptiveEnabled, setAdaptiveEnabled] = useState(true);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch personalization settings
  useEffect(() => {
    const fetchPersonalization = async () => {
      try {
        const response = await fetch('/api/personalization');
        if (response.ok) {
          const data = await response.json();
          setAdaptiveEnabled(data.adaptiveEnabled ?? true);
        }
      } catch (error) {
        console.error('Failed to fetch personalization:', error);
      }
    };
    
    fetchPersonalization();
  }, []);

  const handleAdaptiveToggle = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/personalization', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adaptiveEnabled: !adaptiveEnabled })
      });
      
      if (response.ok) {
        setAdaptiveEnabled(!adaptiveEnabled);
        toast.success(!adaptiveEnabled ? 'Adaptive learning enabled' : 'Adaptive learning disabled');
      } else {
        toast.error('Failed to update settings');
      }
    } catch (error) {
      toast.error('Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPersonalization = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/personalization', {
        method: 'DELETE'
      });
      
      if (response.ok) {
        toast.success('Learned preferences have been reset');
        setShowResetDialog(false);
      } else {
        toast.error('Failed to reset preferences');
      }
    } catch (error) {
      toast.error('Failed to reset preferences');
    } finally {
      setLoading(false);
    }
  };

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
        {/* Preferences Section */}
        <div className="bg-card/60 border border-border/30 rounded-2xl p-5 shadow-sm">
          <h2 className="font-semibold text-base mb-4 flex items-center gap-2">
            <Globe className="w-4 h-4" /> Preferences
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Timezone</label>
              <select
                value={selectedTimezone}
                onChange={(e) => setSelectedTimezone(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
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

        {/* Appearance Section */}
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

        {/* Adaptive Learning Section */}
        <div className="bg-card/60 border border-border/30 rounded-2xl p-5 shadow-sm">
          <h2 className="font-semibold text-base mb-4 flex items-center gap-2">
            <Brain className="w-4 h-4" /> Adaptive Learning
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-[15px]">Adaptive Learning</p>
                  <p className="text-muted-foreground text-[12px] mt-0.5">Learn your patterns to provide smarter suggestions</p>
                </div>
              </div>
              <Switch 
                checked={adaptiveEnabled} 
                onCheckedChange={handleAdaptiveToggle}
                disabled={loading}
              />
            </div>
            
            <div className="flex items-center justify-between pt-2 border-t border-border/30">
              <div>
                <p className="font-medium text-[15px]">Reset Learned Preferences</p>
                <p className="text-muted-foreground text-[12px] mt-0.5">Clear all learned patterns and start fresh</p>
              </div>
              <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowResetDialog(true)}
                  disabled={loading}
                >
                  <RotateCcw className="mr-2 h-4 w-4" /> Reset
                </Button>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Reset Learned Preferences</DialogTitle>
                    <DialogDescription>
                      This will clear all learned patterns including your preferred times, durations, and task aliases. Your calendar data will not be affected.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowResetDialog(false)}>
                      Cancel
                    </Button>
                    <Button variant="destructive" onClick={handleResetPersonalization} disabled={loading}>
                      Reset Preferences
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* Contact Section */}
        <div className="bg-card/60 border border-border/30 rounded-2xl p-5 shadow-sm">
          <h2 className="font-semibold text-base mb-3">Contact</h2>
          <p className="text-muted-foreground text-sm">
            Bugs? Ideas? Just want to say hi? Reach out at <a href="mailto:vrajeshshah13@gmail.com" className="text-primary hover:underline">vrajeshshah13@gmail.com</a>. I reply... eventually.
          </p>
        </div>

        {/* About Section */}
        <div className="bg-card/60 border border-border/30 rounded-2xl p-5 shadow-sm">
          <h2 className="font-semibold text-base mb-1">About</h2>
          <p className="text-muted-foreground text-sm">LinPing AI Calendar · v2.0</p>
          <p className="text-muted-foreground text-[10px] mt-2 tracking-widest font-medium">VIBE CODED AT 3AM WITH LOTS OF COFFEE</p>
        </div>

        {/* Sign Out Section */}
        <div className="bg-card/60 border border-border/30 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-[15px]">Sign Out</p>
              <p className="text-muted-foreground text-[12px] mt-0.5">Logout from your account on this device</p>
            </div>
            <Dialog open={showSignOutDialog} onOpenChange={setShowSignOutDialog}>
              <Button variant="destructive" size="sm" onClick={() => setShowSignOutDialog(true)}>
                <LogOut className="mr-2 h-4 w-4" /> Sign Out
              </Button>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Sign Out</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to sign out? You&apos;ll need to sign in again to access your account.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowSignOutDialog(false)}>
                    Cancel
                  </Button>
                  <form action={signOut}>
                    <Button variant="destructive" type="submit">
                      Sign Out
                    </Button>
                  </form>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </div>
  );
}
