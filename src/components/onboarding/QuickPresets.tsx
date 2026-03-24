'use client';

import { useState } from 'react';
import { TimeBlock } from '@/types';
import { Sun, Clock, Moon, Pencil, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PresetOption {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  accentColor: string;
  blocks: TimeBlock[];
}

export const SCHEDULE_PRESETS: PresetOption[] = [
  {
    id: 'early-riser',
    title: 'Early Riser',
    description: 'Sleep 10pm – 5am, morning workouts, focused work hours',
    icon: <Sun className="w-6 h-6" />,
    accentColor: 'from-amber-500/20 to-amber-500/5',
    blocks: [
      { id: 'sleep-early', title: 'Sleep', startTime: '22:00', endTime: '05:00', type: 'fixed', status: 'pending' },
      { id: 'workout-early', title: 'Workout', startTime: '05:30', endTime: '06:30', type: 'flexible', status: 'pending' },
      { id: 'work-early-morning', title: 'Work', startTime: '07:00', endTime: '12:00', type: 'fixed', status: 'pending' },
      { id: 'lunch-early', title: 'Lunch', startTime: '12:00', endTime: '12:30', type: 'flexible', status: 'pending' },
      { id: 'work-early-afternoon', title: 'Work', startTime: '12:30', endTime: '17:00', type: 'fixed', status: 'pending' },
    ],
  },
  {
    id: 'standard-9-5',
    title: 'Standard 9–5',
    description: 'Sleep 11pm – 6am, traditional work hours with lunch break',
    icon: <Clock className="w-6 h-6" />,
    accentColor: 'from-emerald-500/20 to-emerald-500/5',
    blocks: [
      { id: 'sleep-standard', title: 'Sleep', startTime: '23:00', endTime: '06:00', type: 'fixed', status: 'pending' },
      { id: 'work-morning', title: 'Work', startTime: '09:00', endTime: '12:00', type: 'fixed', status: 'pending' },
      { id: 'lunch-standard', title: 'Lunch', startTime: '12:00', endTime: '12:45', type: 'flexible', status: 'pending' },
      { id: 'work-afternoon', title: 'Work', startTime: '12:45', endTime: '17:00', type: 'fixed', status: 'pending' },
    ],
  },
  {
    id: 'night-owl',
    title: 'Night Owl',
    description: 'Sleep 1am – 8am, afternoon work, evening focus blocks',
    icon: <Moon className="w-6 h-6" />,
    accentColor: 'from-indigo-500/20 to-indigo-500/5',
    blocks: [
      { id: 'sleep-night', title: 'Sleep', startTime: '01:00', endTime: '08:00', type: 'fixed', status: 'pending' },
      { id: 'work-night-main', title: 'Work', startTime: '10:00', endTime: '13:00', type: 'fixed', status: 'pending' },
      { id: 'lunch-night', title: 'Lunch', startTime: '13:00', endTime: '13:45', type: 'flexible', status: 'pending' },
      { id: 'work-night-afternoon', title: 'Work', startTime: '13:45', endTime: '18:00', type: 'fixed', status: 'pending' },
      { id: 'focus-evening', title: 'Focus Block', startTime: '20:00', endTime: '23:00', type: 'flexible', status: 'pending' },
    ],
  },
];

interface QuickPresetsProps {
  onSelect: (preset: PresetOption) => void;
  onCustom: () => void;
  loading?: boolean;
}

export function QuickPresets({ onSelect, onCustom, loading = false }: QuickPresetsProps) {
  const [showPresets, setShowPresets] = useState(false);

  // Step 1: Show two primary options if not showing presets
  if (!showPresets) {
    return (
      <div className="w-full max-w-md mx-auto">
        {/* Primary Entry: Two Clear Options */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-semibold mb-2">Let's set up your day</h2>
          <p className="text-muted-foreground">Choose how you want to get started</p>
        </div>

        {/* Two Primary Options */}
        <div className="grid grid-cols-1 gap-4">
          {/* GET STARTED - Show Presets */}
          <button
            onClick={() => setShowPresets(true)}
            disabled={loading}
            className={cn(
              "p-6 rounded-2xl border-2 transition-all duration-300 text-left group",
              "border-primary/20 bg-gradient-to-br from-primary/5 to-transparent",
              "hover:border-primary/40 hover:shadow-lg active:scale-95",
              loading && "opacity-50 cursor-not-allowed"
            )}
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Sun className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">Get Started</h3>
                <p className="text-sm text-muted-foreground">Pick a preset schedule that matches your lifestyle</p>
              </div>
            </div>
          </button>

          {/* BUILD MY OWN - Custom Flow */}
          <button
            onClick={onCustom}
            disabled={loading}
            className={cn(
              "p-6 rounded-2xl border-2 border-dashed transition-all duration-300",
              "border-border/40 hover:border-primary/40 hover:bg-primary/5 active:scale-95",
              "flex items-center gap-4",
              loading && "opacity-50 cursor-not-allowed"
            )}
          >
            <div className="p-3 rounded-xl bg-muted/50">
              <Pencil className="w-6 h-6 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-1 text-foreground">Build My Own</h3>
              <p className="text-sm text-muted-foreground">Answer a few questions to create your perfect schedule</p>
            </div>
          </button>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">You can customize everything after setup</p>
      </div>
    );
  }

  // Step 2: Show preset options with back button
  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => setShowPresets(false)}
        disabled={loading}
        className={cn(
          "flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6",
          "transition-colors",
          loading && "opacity-50"
        )}
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold mb-2">Choose a preset</h2>
        <p className="text-sm text-muted-foreground">Pick the one that fits your lifestyle best</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {SCHEDULE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onSelect(preset)}
            disabled={loading}
            className={cn(
              "relative p-5 rounded-2xl border transition-all duration-300 text-left group",
              "border-border/30 hover:border-border/60 hover:shadow-md active:scale-95",
              "bg-gradient-to-br",
              preset.accentColor,
              loading && "opacity-50 cursor-not-allowed"
            )}
          >
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-xl bg-background/50">
                <div className="text-muted-foreground">{preset.icon}</div>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-base mb-1">{preset.title}</h3>
                <p className="text-xs text-muted-foreground">{preset.description}</p>
                <div className="mt-3 pt-3 border-t border-border/20 text-xs font-medium text-primary/60">
                  {preset.blocks.length} blocks included
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
