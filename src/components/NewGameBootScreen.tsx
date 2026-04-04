import { useEffect, useMemo, useState } from 'react';

const BOOT_LINES = [
  'LOADING CORE SYSTEMS...',
  'NAVIGATION: OK',
  'MEMORY RESTORE: NO SNAPSHOT AVAILABLE',
  'LEARNING MODE: ACTIVE',
  'PRIORITY PROFILE: DEFAULT'
] as const;

const LINE_REVEAL_DELAY_MS = 360;
const CONTINUE_PROMPT = 'PRESS ANY KEY TO CONTINUE';

export interface NewGameBootScreenProps {
  onComplete: () => void;
}

export function NewGameBootScreen({ onComplete }: NewGameBootScreenProps) {
  const [visibleLineCount, setVisibleLineCount] = useState(0);
  const visibleLines = useMemo(() => BOOT_LINES.slice(0, visibleLineCount), [visibleLineCount]);
  const isAwaitingContinue = visibleLineCount >= BOOT_LINES.length;

  useEffect(() => {
    if (isAwaitingContinue) {
      const handleContinue = () => {
        onComplete();
      };

      window.addEventListener('keydown', handleContinue);
      return () => {
        window.removeEventListener('keydown', handleContinue);
      };
    }

    const revealTimer = window.setTimeout(() => {
      setVisibleLineCount((current) => current + 1);
    }, LINE_REVEAL_DELAY_MS);
    return () => window.clearTimeout(revealTimer);
  }, [isAwaitingContinue, onComplete, visibleLineCount]);

  return (
    <section
      className="new-game-boot"
      aria-label="New game boot sequence"
      onClick={() => {
        if (isAwaitingContinue) {
          onComplete();
        }
      }}
    >
      <div className="new-game-boot__panel">
        {visibleLines.map((line) => (
          <p key={line} className="new-game-boot__line">
            {line}
          </p>
        ))}
        {isAwaitingContinue ? <p className="new-game-boot__continue">{CONTINUE_PROMPT}</p> : null}
      </div>
    </section>
  );
}
