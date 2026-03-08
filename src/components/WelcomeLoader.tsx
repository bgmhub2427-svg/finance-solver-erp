import { useState, useEffect } from 'react';
import kaLogo from '@/assets/kota-associates-logo.png';

interface Props {
  onComplete: () => void;
}

export default function WelcomeLoader({ onComplete }: Props) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState(0);

  const phases = [
    'Initializing Finance Solver...',
    'Loading modules...',
    'Preparing your workspace...',
    'Almost ready...',
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(onComplete, 400);
          return 100;
        }
        return prev + 2;
      });
    }, 40);
    return () => clearInterval(interval);
  }, [onComplete]);

  useEffect(() => {
    if (progress < 25) setPhase(0);
    else if (progress < 55) setPhase(1);
    else if (progress < 80) setPhase(2);
    else setPhase(3);
  }, [progress]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))] relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-96 h-96 rounded-full bg-primary/5 blur-3xl -top-20 -left-20 animate-pulse" />
        <div className="absolute w-80 h-80 rounded-full bg-accent/5 blur-3xl -bottom-20 -right-20 animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 px-4">
        {/* Logo with glow */}
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-150 animate-pulse" />
          <img
            src={kaLogo}
            alt="Kota Associates"
            className="w-28 h-28 rounded-2xl shadow-2xl object-contain relative z-10"
            style={{
              animation: 'float 3s ease-in-out infinite',
            }}
          />
        </div>

        {/* Title */}
        <div className="text-center space-y-1.5">
          <h1 className="text-3xl font-bold tracking-tight gradient-text">Finance Solver</h1>
          <p className="text-xs font-semibold tracking-[0.3em] text-muted-foreground uppercase">F.S.001</p>
        </div>

        {/* Progress bar */}
        <div className="w-72 space-y-3">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary via-accent to-primary transition-all duration-200 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground animate-pulse">{phases[phase]}</p>
            <p className="text-[11px] font-mono text-muted-foreground/60">{progress}%</p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center space-y-1 mt-4">
          <p className="text-[10px] text-muted-foreground/50">Created by</p>
          <p className="text-xs font-semibold text-muted-foreground tracking-wider">KOTA ASSOCIATES</p>
        </div>
      </div>
    </div>
  );
}
