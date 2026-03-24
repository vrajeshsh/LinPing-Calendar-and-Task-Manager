'use client';

import { useMemo, useState } from 'react';
import { useScheduleStore } from '@/store/useScheduleStore';
import { ScheduleTemplate, TimeBlock } from '@/types';
import { formatTime12h } from '@/lib/scheduleHelpers';
import { Clock, Edit2, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface DefaultBlocksProps {
  onSelectBlock?: (block: TimeBlock) => void;
}

export function DefaultBlocks({ onSelectBlock }: DefaultBlocksProps) {
  const { templates } = useScheduleStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editingBlock, setEditingBlock] = useState<TimeBlock | null>(null);
  
  const defaultTemplate = useMemo(() => templates[0], [templates]);
  
  if (!defaultTemplate || !defaultTemplate.blocks) {
    return null;
  }

  const handleBlockClick = (block: TimeBlock) => {
    if (onSelectBlock) {
      onSelectBlock(block);
    }
  };

  return (
    <div className="mx-4 md:mx-8 mb-6">
      <div className="bg-card/60 border border-border/30 rounded-2xl p-5 shadow-sm" style={{ borderColor: 'var(--nature-muted)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <Clock className="w-4 h-4" style={{ color: 'var(--nature-green)' }} />
            Default Schedule
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
            className="gap-1.5"
            style={{ borderColor: 'var(--nature-muted)' }}
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isEditing ? 'Done' : 'Edit'}</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {defaultTemplate.blocks.map((block) => (
            <button
              key={block.id}
              onClick={() => handleBlockClick(block)}
              className={cn(
                "p-3 rounded-xl border transition-all text-left group",
                isEditing
                  ? "border-border/50 bg-background hover:border-primary/50"
                  : "border-border/20 bg-background/50 hover:border-border/50 hover:bg-background/80 cursor-pointer",
                block.type === 'fixed' && "border-l-4"
              )}
              style={block.type === 'fixed' ? { borderLeftColor: 'var(--nature-leaf)' } : undefined}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm text-foreground truncate">{block.title}</p>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground shrink-0">
                      {block.type === 'fixed' ? 'Fixed' : 'Flex'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatTime12h(block.startTime)} – {formatTime12h(block.endTime)}
                  </p>
                </div>
                {isEditing && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingBlock(block);
                      }}
                      className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>

        {isEditing && (
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-3 gap-1.5"
            onClick={() => toast.info('Add block feature coming soon')}
          >
            <Plus className="w-3.5 h-3.5" />
            Add Block
          </Button>
        )}
      </div>
    </div>
  );
}
