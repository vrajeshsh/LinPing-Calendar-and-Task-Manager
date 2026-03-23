'use client';

import { useScheduleStore } from '@/store/useScheduleStore';
import { Button } from '@/components/ui/button';
import { Plus, Layout } from 'lucide-react';

export default function TemplatesPage() {
  const { templates, loading } = useScheduleStore();

  return (
    <div className="flex flex-col h-full">
      <header className="px-5 md:px-8 py-8 md:py-10 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Templates</h1>
          <p className="text-muted-foreground mt-1 text-[15px] font-medium">Daily rhythm presets</p>
        </div>
        <Button className="rounded-xl">
          <Plus className="w-4 h-4 mr-2" /> New Template
        </Button>
      </header>

      <div className="flex-1 px-4 md:px-8 max-w-4xl w-full mx-auto pb-32">
        {loading ? (
             <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground">
                <div className="w-6 h-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                Loading templates...
             </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map(template => (
              <div 
                key={template.id} 
                className="bg-card/60 border border-border/30 rounded-2xl p-5 shadow-sm hover:border-primary/30 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <Layout className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[15px]">{template.name}</h3>
                      <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">
                        {template.blocks.length} Blocks
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {template.blocks.slice(0, 3).map((block, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px] text-muted-foreground/70">
                      <span>{block.title}</span>
                      <span>{block.startTime}</span>
                    </div>
                  ))}
                  {template.blocks.length > 3 && (
                    <p className="text-[10px] text-muted-foreground/40 italic pt-1">
                      + {template.blocks.length - 3} more blocks
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
