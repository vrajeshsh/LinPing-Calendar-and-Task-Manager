'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthCard } from '@/components/auth/AuthCard';
import { TimeBlock } from '@/types';
import { formatTime12h } from '@/lib/scheduleHelpers';
import { Moon, Sun, Briefcase, Dumbbell, Utensils, Heart, Check, ArrowRight, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { QuickPresets, SCHEDULE_PRESETS, type PresetOption } from './QuickPresets';
import { useScheduleStore } from '@/store/useScheduleStore';

interface OnboardingData {
  sleepStart: string;
  sleepEnd: string;
  workStart: string;
  workEnd: string;
  hasWork: boolean;
  workoutTime: string;
  hasWorkout: boolean;
  lunchTime: string;
  hasLunch: boolean;
  extraBlock: {
    title: string;
    startTime: string;
    endTime: string;
  } | null;
}

const STEPS = [
  { id: 'quick-start', title: 'Quick Start', icon: Sun },
  { id: 'welcome', title: 'Welcome', icon: Heart },
  { id: 'sleep', title: 'Sleep', icon: Moon },
  { id: 'work', title: 'Work', icon: Briefcase },
  { id: 'workout', title: 'Workout', icon: Dumbbell },
  { id: 'lunch', title: 'Lunch', icon: Utensils },
  { id: 'extra', title: 'Extra', icon: Heart },
  { id: 'preview', title: 'Preview', icon: Check },
];

const EXTRA_OPTIONS = [
  { title: 'Study time', startTime: '19:00', endTime: '20:00' },
  { title: 'Family time', startTime: '18:00', endTime: '19:00' },
  { title: 'Commute', startTime: '07:00', endTime: '08:00' },
  { title: 'Journaling', startTime: '21:00', endTime: '21:30' },
  { title: 'Reading', startTime: '20:00', endTime: '21:00' },
  { title: 'Meditation', startTime: '06:00', endTime: '06:30' },
];

export function OnboardingFlow() {
  const router = useRouter();
  const [mode, setMode] = useState<'presets' | 'custom' | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedPreset, setSelectedPreset] = useState<PresetOption | null>(null);
  const [data, setData] = useState<OnboardingData>({
    sleepStart: '22:00',
    sleepEnd: '06:00',
    workStart: '09:00',
    workEnd: '17:00',
    hasWork: false,
    workoutTime: '07:00',
    hasWorkout: false,
    lunchTime: '12:00',
    hasLunch: false,
    extraBlock: null,
  });
  const [loading, setLoading] = useState(false);

  const updateData = (updates: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...updates }));
  };

  // Handle preset selection
  const handlePresetSelect = (preset: PresetOption) => {
    setSelectedPreset(preset);
    setMode('presets');
    // Jump directly to preview
    setCurrentStep(STEPS.length - 1);
  };

  // Handle custom flow start
  const handleBuildCustom = () => {
    setMode('custom');
    setCurrentStep(1); // Skip past quick presets, start at welcome
  };

  const generateSchedule = (): TimeBlock[] => {
    // If preset is selected, use its blocks
    if (selectedPreset) {
      return selectedPreset.blocks;
    }

    // Otherwise generate from custom data
    const blocks: TimeBlock[] = [];

    // Sleep block (always included)
    blocks.push({
      id: 'sleep',
      title: 'Sleep',
      startTime: data.sleepStart,
      endTime: data.sleepEnd,
      type: 'fixed',
      status: 'pending',
    });

    // Work blocks (if selected)
    if (data.hasWork) {
      blocks.push({
        id: 'work-morning',
        title: 'Work',
        startTime: data.workStart,
        endTime: '12:00',
        type: 'fixed',
        status: 'pending',
      });
      blocks.push({
        id: 'work-afternoon',
        title: 'Work',
        startTime: '13:00',
        endTime: data.workEnd,
        type: 'fixed',
        status: 'pending',
      });
    }

    // Lunch (if selected)
    if (data.hasLunch) {
      blocks.push({
        id: 'lunch',
        title: 'Lunch',
        startTime: data.lunchTime,
        endTime: '13:00',
        type: 'flexible',
        status: 'pending',
      });
    }

    // Workout (if selected)
    if (data.hasWorkout) {
      blocks.push({
        id: 'workout',
        title: 'Workout',
        startTime: data.workoutTime,
        endTime: '08:00', // Assume 1 hour workout
        type: 'fixed',
        status: 'pending',
      });
    }

    // Extra block (if selected)
    if (data.extraBlock) {
      blocks.push({
        id: 'extra',
        title: data.extraBlock.title,
        startTime: data.extraBlock.startTime,
        endTime: data.extraBlock.endTime,
        type: 'flexible',
        status: 'pending',
      });
    }

    // Sort by start time
    return blocks.sort((a, b) => a.startTime.localeCompare(b.startTime));
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      const blocks = generateSchedule();

      const response = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      // Refresh the store data to update needsOnboarding state
      // This must complete before navigation to prevent redirect loops
      const completeOnboarding = useScheduleStore.getState().completeOnboarding;
      await completeOnboarding();

      // Use router.push for client-side navigation to preserve store state
      // window.location.href would cause full page reload and reinitialize the store
      router.push('/app/scheduler');
    } catch (error) {
      console.error('Onboarding error:', error);
      toast.error(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    const step = STEPS[currentStep];

    switch (step.id) {
      case 'quick-start':
        return (
          <QuickPresets
            onSelect={handlePresetSelect}
            onCustom={handleBuildCustom}
            loading={loading}
          />
        );

      case 'welcome':
        return (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <Heart className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold mb-2">Build your schedule</h2>
              <p className="text-muted-foreground">
                Let's create a daily routine that works perfectly for you.
                Answer a few quick questions to get started.
              </p>
            </div>
            <Button onClick={() => setCurrentStep(2)} className="w-full">
              Get Started <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        );

      case 'sleep':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--nature-muted)' }}>
                <Moon className="w-6 h-6" style={{ color: 'var(--nature-sage)' }} />
              </div>
              <h2 className="text-xl font-semibold mb-2">When do you usually sleep?</h2>
              <p className="text-sm text-muted-foreground">This helps us build your ideal day around your natural rhythm.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sleepStart">Bedtime</Label>
                <Input
                  id="sleepStart"
                  type="time"
                  value={data.sleepStart}
                  onChange={(e) => updateData({ sleepStart: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="sleepEnd">Wake up</Label>
                <Input
                  id="sleepEnd"
                  type="time"
                  value={data.sleepEnd}
                  onChange={(e) => updateData({ sleepEnd: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setCurrentStep(1)} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button onClick={() => setCurrentStep(3)} className="flex-1">
                Next <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        );

      case 'work':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--nature-muted)' }}>
                <Briefcase className="w-6 h-6" style={{ color: 'var(--nature-sage)' }} />
              </div>
              <h2 className="text-xl font-semibold mb-2">Do you work regular hours?</h2>
              <p className="text-sm text-muted-foreground">We'll block out your work time so you can focus on what matters.</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="hasWork"
                  checked={data.hasWork}
                  onChange={(e) => updateData({ hasWork: e.target.checked })}
                  className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                />
                <Label htmlFor="hasWork" className="text-sm font-medium">I work regular hours</Label>
              </div>

              {data.hasWork && (
                <div className="grid grid-cols-2 gap-4 pl-7">
                  <div>
                    <Label htmlFor="workStart">Start time</Label>
                    <Input
                      id="workStart"
                      type="time"
                      value={data.workStart}
                      onChange={(e) => updateData({ workStart: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="workEnd">End time</Label>
                    <Input
                      id="workEnd"
                      type="time"
                      value={data.workEnd}
                      onChange={(e) => updateData({ workEnd: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setCurrentStep(2)} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button onClick={() => setCurrentStep(4)} className="flex-1">
                Next <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        );

      case 'workout':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--nature-muted)' }}>
                <Dumbbell className="w-6 h-6" style={{ color: 'var(--nature-green)' }} />
              </div>
              <h2 className="text-xl font-semibold mb-2">Do you work out regularly?</h2>
              <p className="text-sm text-muted-foreground">Building healthy habits starts with scheduling them.</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="hasWorkout"
                  checked={data.hasWorkout}
                  onChange={(e) => updateData({ hasWorkout: e.target.checked })}
                  className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                />
                <Label htmlFor="hasWorkout" className="text-sm font-medium">I work out regularly</Label>
              </div>

              {data.hasWorkout && (
                <div className="pl-7">
                  <Label htmlFor="workoutTime">What time do you usually work out?</Label>
                  <Input
                    id="workoutTime"
                    type="time"
                    value={data.workoutTime}
                    onChange={(e) => updateData({ workoutTime: e.target.value })}
                    className="mt-1"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setCurrentStep(3)} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button onClick={() => setCurrentStep(5)} className="flex-1">
                Next <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        );

      case 'lunch':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Utensils className="w-6 h-6 text-orange-600" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Do you want to block lunch time?</h2>
              <p className="text-sm text-muted-foreground">Taking breaks helps maintain energy throughout the day.</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="hasLunch"
                  checked={data.hasLunch}
                  onChange={(e) => updateData({ hasLunch: e.target.checked })}
                  className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                />
                <Label htmlFor="hasLunch" className="text-sm font-medium">Block time for lunch</Label>
              </div>

              {data.hasLunch && (
                <div className="pl-7">
                  <Label htmlFor="lunchTime">What time do you usually eat lunch?</Label>
                  <Input
                    id="lunchTime"
                    type="time"
                    value={data.lunchTime}
                    onChange={(e) => updateData({ lunchTime: e.target.value })}
                    className="mt-1"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setCurrentStep(4)} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button onClick={() => setCurrentStep(6)} className="flex-1">
                Next <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        );

      case 'extra':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="w-6 h-6 text-purple-600" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Any other daily activities?</h2>
              <p className="text-sm text-muted-foreground">Pick one more thing you'd like to schedule regularly.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {EXTRA_OPTIONS.map((option) => (
                <button
                  key={option.title}
                  onClick={() => updateData({ extraBlock: option })}
                  className={cn(
                    "p-3 rounded-xl border text-left transition-all",
                    data.extraBlock?.title === option.title
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-border/70"
                  )}
                >
                  <div className="font-medium text-sm">{option.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatTime12h(option.startTime)} - {formatTime12h(option.endTime)}
                  </div>
                </button>
              ))}
              <button
                onClick={() => updateData({ extraBlock: null })}
                className={cn(
                  "p-3 rounded-xl border text-left transition-all",
                  data.extraBlock === null
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-border/70"
                )}
              >
                <div className="font-medium text-sm">None for now</div>
                <div className="text-xs text-muted-foreground">I can add later</div>
              </button>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setCurrentStep(5)} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button onClick={() => setCurrentStep(7)} className="flex-1">
                Next <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        );

      case 'preview':
        const previewBlocks = generateSchedule();
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-6 h-6 text-emerald-600" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Here's your perfect day</h2>
              <p className="text-sm text-muted-foreground">You can always customize this later in settings.</p>
            </div>

            <div className="bg-muted/30 rounded-2xl p-4 border border-border/50 max-h-80 overflow-y-auto">
              <div className="space-y-3">
                {previewBlocks.map((block, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        block.type === 'fixed' ? "bg-rose-400" : "bg-blue-400"
                      )} />
                      <span className="font-medium text-sm">{block.title}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {formatTime12h(block.startTime)} - {formatTime12h(block.endTime)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setCurrentStep(6)} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button onClick={handleComplete} disabled={loading} className="flex-1">
                {loading ? 'Setting up...' : 'Start using LinPing'}
                {!loading && <ArrowRight className="w-4 h-4 ml-2" />}
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <AuthCard title="" subtitle="">
      <div className="max-w-md mx-auto">
        {/* Progress indicator */}
        <div className="flex justify-between mb-8">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.id} className="flex flex-col items-center">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all",
                  index <= currentStep
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}>
                  {index < currentStep ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span className={cn(
                  "text-xs mt-1 transition-colors",
                  index <= currentStep ? "text-foreground" : "text-muted-foreground"
                )}>
                  {step.title}
                </span>
              </div>
            );
          })}
        </div>

        {renderStep()}
      </div>
    </AuthCard>
  );
}