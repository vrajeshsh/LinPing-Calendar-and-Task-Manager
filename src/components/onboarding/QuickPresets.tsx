'use client';

import { TimeBlock } from '@/types';
import { Sun, Clock, Moon, Pencil } from 'lucide-react';
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
      {
        id: 'sleep-early',
        title: 'Sleep',
        startTime: '22:00',
        endTime: '05:00',
        type: 'fixed',
        status: 'pending',
      },
      {
        id: 'workout-early',
        title: 'Workout',
        startTime: '05:30',
        endTime: '06:30',
        type: 'flexible',
        status: 'pending',
      },
      {
        id: 'work-early-morning',
        title: 'Work',
        startTime: '07:00',
        endTime: '12:00',
        type: 'fixed',
        status: 'pending',
      },
      {
        id: 'lunch-early',
        title: 'Lunch',
        startTime: '12:00',
        endTime: '12:30',
        type: 'flexible',
        status: 'pending',
      },
      {
        id: 'work-early-afternoon',
        title: 'Work',
        startTime: '12:30',
        endTime: '17:00',
        type: 'fixed',
        status: 'pending',
      },
    ],
  },
  {
    id: 'standard-9-5',
    title: 'Standard 9–5',
    description: 'Sleep 11pm – 7am, traditional work hours with lunch break',
    icon: <Clock className="w-6 h-6" />,
    accentColor: 'from-emerald-500/20 to-emerald-500/5',
    blocks: [
      {
        id: 'sleep-standard',
        title: 'Sleep',
        startTime: '23:00',
        endTime: '07:00',
        type: 'fixed',
        status: 'pending',
      },
      {
        id: 'work-morning',
        title: 'Work',
        startTime: '09:00',
        endTime: '12:00',
        type: 'fixed',
        status: 'pending',
      },
      {
        id: 'lunch-standard',
        title: 'Lunch',
        startTime: '12:00',
        endTime: '12:45',
        type: 'flexible',
        status: 'pending',
      },
      {
        id: 'work-afternoon',
        title: 'Work',
        startTime: '12:45',
        endTime: '17:00',
        type: 'fixed',
        status: 'pending',
      },
    ],
  },
  {
    id: 'night-owl',
    title: 'Night Owl',
    description: 'Sleep 1am – 9am, afternoon work, evening focus blocks',
    icon: <Moon className="w-6 h-6" />,
    accentColor: 'from-indigo-500/20 to-indigo-500/5',
    blocks: [
      {
        id: 'sleep-night',
        title: 'Sleep',
        startTime: '01:00',
        endTime: '09:00',
        type: 'fixed',
        status: 'pending',
      },
      {
        id: 'work-night-main',
        title: 'Work',
        startTime: '10:00',
        endTime: '13:00',
        type: 'fixed',
        status: 'pending',
      },
      {
        id: 'lunch-night',
        title: 'Lunch',
        startTime: '13:00',
        endTime: '13:45',
        type: 'flexible',
        status: 'pending',
      },
      {
        id: 'work-night-afternoon',
        title: 'Work',
        startTime: '13:45',
        endTime: '18:00',
        type: 'fixed',
        status: 'pending',
      },
      {
        id: 'focus-evening',
        title: 'Focus Block',
        startTime: '20:00',
        endTime: '23:00',
        type: 'flexible',
        status: 'pending',
      },
    ],
  },
];

interface QuickPresetsProps {
  onSelect: (preset: PresetOption) => void;
  onCustom: () => void;
  loading?: boolean;
}

export function QuickPresets({ onSelect, onCustom, loading = false }: QuickPresetsProps) {
  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Clock className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-semibold mb-2">Pick a starting point</h2>
        <p className="text-muted-foreground max-w-sm mx-auto">
          Choose a preset schedule that matches your lifestyle, or build your own
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 rounded-xl bg-background/50 group-hover:bg-background transition-colors">
                <div className="text-muted-foreground group-hover:text-foreground transition-colors">
                  {preset.icon}
                </div>
              </div>
            </div>

            <h3 className="font-semibold text-base mb-1">{preset.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {preset.description}
            </p>

            <div className="mt-4 pt-4 border-t border-border/20 flex items-center gap-2 text-xs font-medium text-primary/60 group-hover:text-primary/80">
              <span>★ {preset.blocks.length} blocks included</span>
            </div>
          </button>
        ))}
      </div>

      {/* Build My Own Button */}
      <button
        onClick={onCustom}
        disabled={loading}
        className={cn(
          "w-full p-5 rounded-2xl border-2 border-dashed transition-all duration-300",
          "border-border/40 hover:border-primary/40 hover:bg-primary/5 active:scale-95",
          "flex items-center justify-center gap-3 text-sm font-semibold text-muted-foreground hover:text-foreground",
          loading && "opacity-50 cursor-not-allowed"
        )}
      >
        <Pencil className="w-4 h-4" />
        Build My Own Schedule
      </button>

      <p className="text-center text-xs text-muted-foreground mt-6">
        You can adjust or create blocks anytime after setup
      </p>
    </div>
  );
}
