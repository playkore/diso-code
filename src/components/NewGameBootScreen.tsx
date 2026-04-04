import { useEffect, useMemo, useState } from 'react';

const BOOT_LINES = [
  'LOADING CORE SYSTEMS...',
  'NAVIGATION: OK',
  'MEMORY RESTORE: NO SNAPSHOT AVAILABLE',
  'LEARNING MODE: ACTIVE',
  'PRIORITY PROFILE: DEFAULT'
] as const;

const LINE_REVEAL_DELAY_MS = 360;
const FINAL_HOLD_MS = 700;

export interface NewGameBootScreenProps {
  onComplete: () => void;
}

export function NewGameBootScreen({ onComplete }: NewGameBootScreenProps) {
  const [visibleLineCount, setVisibleLineCount] = useState(0);
  const visibleLines = useMemo(() => BOOT_LINES.slice(0, visibleLineCount), [visibleLineCount]);

  useEffect(() => {
    if (visibleLineCount >= BOOT_LINES.length) {
      const completionTimer = window.setTimeout(() => {
        onComplete();
      }, FINAL_HOLD_MS);
      return () => window.clearTimeout(completionTimer);
    }

    const revealTimer = window.setTimeout(() => {
      setVisibleLineCount((current) => current + 1);
    }, LINE_REVEAL_DELAY_MS);
    return () => window.clearTimeout(revealTimer);
  }, [onComplete, visibleLineCount]);

  return (
    <section className="new-game-boot" aria-label="New game boot sequence">
      <div className="new-game-boot__panel">
        {visibleLines.map((line) => (
          <p key={line} className="new-game-boot__line">
            {line}
          </p>
        ))}
      </div>
    </section>
  );
}

