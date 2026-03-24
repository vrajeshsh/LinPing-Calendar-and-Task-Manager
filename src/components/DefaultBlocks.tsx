'use client';

import { useMemo, useState } from 'react';
import { useScheduleStore } from '@/store/useScheduleStore';
import { TimeBlock } from '@/types';
import { formatTime12h, getBlockColor } from '@/lib/scheduleHelpers';
import { Clock, Edit2, Plus, Sun, Briefcase, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface DefaultBlocksProps {
  onSelectBlock?: (block: TimeBlock) => void;
  compact?: boolean;
}

export function DefaultBlocks({ onSelectBlock, compact = false }: DefaultBlocksProps) {
  const { templates } = useScheduleStore();
  const [isEditing, setIsEditing] = useState(false);
  
  const defaultTemplate = useMemo(() => templates[0], [templates]);
  
  // CRITICAL: Do not render if no templates exist
  if (!defaultTemplate || !defaultTemplate.blocks || templates.length === 0) {
    return null;
  }

  // Group blocks by time of day
  const groupedBlocks = useMemo(() => {
    const groups = {
      morning: [] as TimeBlock[],
      workday: [] as TimeBlock[],
      evening: [] as TimeBlock[],
    };

    defaultTemplate.blocks.forEach((block) => {
      const hour = parseInt(block.startTime.split(':')[0]);
      if (hour < 9) {
        groups.morning.push(block);
      } else if (hour < 17) {
        groups.workday.push(block);
      } else {
        groups.evening.push(block);
      }
    });

    return groups;
  }, [defaultTemplate]);

  const handleBlockClick = (block: TimeBlock) => {
    if (onSelectBlock) {
      onSelectBlock(block);
    }
  };

  const GroupIcon = ({ group }: { group: 'morning' | 'workday' | 'evening' }) => {
    switch (group) {
      case 'morning':
        return <Sun className="w-3.5 h-3.5 text-amber-500" />;
      case 'workday':
        return <Briefcase className="w-3.5 h-3.5 text-emerald-500" />;
      case 'evening':
        return <Moon className="w-3.5 h-3.5 text-indigo-500" />;
    }
  };

  const groupLabels = {
    morning: 'Morning',
    workday: 'Workday',
    evening: 'Evening',
  };

  const renderBlock = (block: TimeBlock) => (
    <button
      key={block.id}
      onClick={() => handleBlockClick(block)}
      className={cn(
        "flex items-center justify-between py-2 px-3 rounded-lg transition-all text-left group cursor-pointer",
        isEditing
          ? "bg-background hover:bg-muted/50"
          : "hover:bg-muted/30",
        compact ? "py-1.5" : "py-2"
      )}
    >
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <div 
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: 'var(--nature-green)' }}
        />
        <span className={cn(
          "text-sm truncate",
          isEditing ? "text-foreground" : "text-muted-foreground"
        )}>
          {block.title}
        </span>
      </div>
      <span className="text-xs text-muted-foreground/60 shrink-0">
        {formatTime12h(block.startTime)}
      </span>
    </button>
  );

  if (compact) {
    // Compact inline version for sidebar or smaller spaces
    return (
      <div className="space-y-1">
        {defaultTemplate.blocks.map((block) => renderBlock(block))}
      </div>
    );
  }

  return (
    <div className="pt-6 border-t border-border/20">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" />
          My Routine
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsEditing(!isEditing)}
          className="h-7 text-xs gap-1"
        >
          <Edit2 className="w-3 h-3" />
          {isEditing ? 'Done' : 'Edit'}
        </Button>
      </div>

      <div className="space-y-4">
        {(['morning', 'workday', 'evening'] as const).map((group) => {
          const blocks = groupedBlocks[group];
          if (blocks.length === 0) return null;

          return (
            <div key={group}>
              <div className="flex items-center gap-2 mb-2">
                <GroupIcon group={group} />
                <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
                  {groupLabels[group]}
                </span>
              </div>
              <div className="bg-muted/20 rounded-lg px-2 py-1">
                {blocks.map((block) => renderBlock(block))}
              </div>
            </div>
          );
        })}
      </div>

      {isEditing && (
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-4 h-8 text-xs"
          onClick={() => toast.info('Edit routine in Templates page')}
        >
          <Plus className="w-3 h-3 mr-1" />
          Manage Routine
        </Button>
      )}
    </div>
  );
}
