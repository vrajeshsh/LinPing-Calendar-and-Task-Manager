import React from 'react';

interface AuthCardProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

export function AuthCard({ children, title, subtitle }: AuthCardProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="text-muted-foreground text-sm">{subtitle}</p>
        </div>
        <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-3xl p-8 shadow-2xl shadow-primary/5">
          {children}
        </div>
      </div>
    </div>
  );
}
