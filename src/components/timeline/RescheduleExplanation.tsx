'use client';

import { useState } from 'react';
import { Info, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RescheduleExplanationProps {
  reason: string;
  originalTime?: string;
  newTime?: string;
  originalDate?: string;
  onUndo?: () => void;
  className?: string;
}

/**
 * "Why This Moved" indicator component
 * Shows a subtle indicator when a task was moved by the AI scheduler
 */
export function RescheduleExplanation({
  reason,
  originalTime,
  newTime,
  originalDate,
  onUndo,
  className
}: RescheduleExplanationProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showUndo, setShowUndo] = useState(false);

  if (!reason) return null;

  const handleClick = () => {
    setIsExpanded(!isExpanded);
    if (!isExpanded) {
      // Show undo option after first expansion
      setTimeout(() => setShowUndo(true), 300);
    }
  };

  const handleUndo = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUndo?.();
  };

  return (
    <div className={cn("mt-2", className)}>
      {/* Collapsed state - subtle indicator */}
      <button
        onClick={handleClick}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium",
          "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400",
          "hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors",
          "border border-amber-200/50 dark:border-amber-800/30"
        )}
      >
        <Info className="w-3 h-3" />
        <span>Updated</span>
        <ChevronDown className={cn(
          "w-3 h-3 transition-transform",
          isExpanded && "rotate-180"
        )} />
      </button>

      {/* Expanded state - explanation */}
      <div className={cn(
        "overflow-hidden transition-all duration-300 ease-in-out",
        isExpanded ? "max-h-40 opacity-100 mt-2" : "max-h-0 opacity-0"
      )}>
        <div className={cn(
          "p-3 rounded-xl text-[12px] leading-relaxed",
          "bg-amber-50/80 dark:bg-amber-950/20",
          "border border-amber-100 dark:border-amber-900/30"
        )}>
          <p className="text-foreground/90">{reason}</p>
          
          {/* Show time change details if available */}
          {(originalTime || newTime || originalDate) && (
            <div className="mt-2 pt-2 border-t border-amber-200/30 dark:border-amber-800/30">
              <p className="text-[10px] text-muted-foreground">
                {originalTime && newTime && (
                  <>Moved from {originalTime} → {newTime}</>
                )}
                {originalDate && (
                  <span className="ml-2">Originally scheduled for {originalDate}</span>
                )}
              </p>
            </div>
          )}
          
          {/* Undo option */}
          {onUndo && showUndo && (
            <button
              onClick={handleUndo}
              className={cn(
                "mt-2 flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium",
                "text-amber-700 dark:text-amber-400",
                "hover:bg-amber-100 dark:hover:bg-amber-900/40",
                "transition-colors"
              )}
            >
              <RotateCcw className="w-3 h-3" />
              <span>Undo</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Grouped explanation for multiple changes
 * Shows a summary at the top when multiple tasks are affected
 */
export function GroupedRescheduleSummary({
  count,
  primaryReason,
  onExpand,
  className
}: {
  count: number;
  primaryReason: string;
  onExpand?: () => void;
  className?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={cn("mb-3", className)}>
      <button
        onClick={() => {
          setIsExpanded(!isExpanded);
          onExpand?.();
        }}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-medium w-full",
          "bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300",
          "hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors",
          "border border-amber-200/50 dark:border-amber-800/30"
        )}
      >
        <Info className="w-4 h-4" />
        <span className="flex-1 text-left">
          Your schedule was adjusted. {count} task{count > 1 ? 's' : ''} moved.
        </span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className={cn(
          "mt-2 p-3 rounded-xl",
          "bg-muted/30 dark:bg-muted/20",
          "border border-border/50"
        )}>
          <p className="text-[11px] text-muted-foreground">{primaryReason}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Preview before apply component
 * Shows what will change before user confirms
 */
export function ReschedulePreview({
  changes,
  onConfirm,
  onCancel,
  className
}: {
  changes: Array<{
    taskTitle: string;
    action: 'move' | 'shift' | 'shorten';
    from?: string;
    to?: string;
    reason: string;
  }>;
  onConfirm: () => void;
  onCancel: () => void;
  className?: string;
}) {
  if (changes.length === 0) return null;

  return (
    <div className={cn(
      "p-4 rounded-2xl border-2 border-dashed border-amber-300 dark:border-amber-700",
      "bg-amber-50/50 dark:bg-amber-950/20",
      "animate-in fade-in zoom-in duration-300",
      className
    )}>
      <div className="flex items-center gap-2 mb-3">
        <Info className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          Adding this will:
        </h3>
      </div>

      <ul className="space-y-2 mb-4">
        {changes.map((change, index) => (
          <li key={index} className="text-[12px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
            <span className="text-amber-500 mt-0.5">•</span>
            <span>
              {change.action === 'move' && (
                <>Move <strong>{change.taskTitle}</strong> to {change.to}</>
              )}
              {change.action === 'shift' && (
                <>Shift <strong>{change.taskTitle}</strong> to {change.to}</>
              )}
              {change.action === 'shorten' && (
                <>Shorten <strong>{change.taskTitle}</strong> slightly</>
              )}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className={cn(
            "flex-1 px-3 py-2 rounded-xl text-[12px] font-medium",
            "text-muted-foreground hover:bg-muted",
            "border border-border"
          )}
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className={cn(
            "flex-1 px-3 py-2 rounded-xl text-[12px] font-medium",
            "bg-amber-500 text-white hover:bg-amber-600",
            "transition-colors"
          )}
        >
          Apply Changes
        </button>
      </div>
    </div>
  );
}