import { useEffect, useMemo, useState } from 'react';
import { createDefaultCommander } from '../domain/commander';
import { formatCredits } from '../utils/money';

const DEFAULT_COMMANDER = createDefaultCommander();
const DEFAULT_START_SYSTEM = DEFAULT_COMMANDER.currentSystem.toUpperCase();
const DEFAULT_CREDIT_BALANCE = formatCredits(DEFAULT_COMMANDER.cash).toUpperCase();
const DEFAULT_LEGAL_STATUS = 'CLEAN';

const BOOT_LINES = [
  'LOADING CORE SYSTEMS...',
  'MEMORY RESTORE: NO SNAPSHOT AVAILABLE',
  'NAVIGATION: OK',
  `CURRENT SYSTEM: ${DEFAULT_START_SYSTEM}`,
  `CREDIT BALANCE: ${DEFAULT_CREDIT_BALANCE}`,
  `LEGAL STATUS: ${DEFAULT_LEGAL_STATUS}`,
  'PRIORITY PROFILE: DEFAULT'
] as const;

const LINE_REVEAL_DELAY_MS = 360;
const CONTINUE_PROMPT_DELAY_MS = 520;
const CONTINUE_PROMPT = 'PRESS ANY KEY TO CONTINUE';

export interface NewGameBootScreenProps {
  onComplete: () => void;
}

export function NewGameBootScreen({ onComplete }: NewGameBootScreenProps) {
  const [visibleLineCount, setVisibleLineCount] = useState(0);
  const [showContinuePrompt, setShowContinuePrompt] = useState(false);
  const visibleLines = useMemo(() => BOOT_LINES.slice(0, visibleLineCount), [visibleLineCount]);
  const hasFinishedBootLines = visibleLineCount >= BOOT_LINES.length;
  const isAwaitingContinue = hasFinishedBootLines && showContinuePrompt;

  useEffect(() => {
    if (hasFinishedBootLines) {
      const promptTimer = window.setTimeout(() => {
        setShowContinuePrompt(true);
      }, CONTINUE_PROMPT_DELAY_MS);
      return () => window.clearTimeout(promptTimer);
    }

    const revealTimer = window.setTimeout(() => {
      setVisibleLineCount((current) => current + 1);
    }, LINE_REVEAL_DELAY_MS);
    return () => window.clearTimeout(revealTimer);
  }, [hasFinishedBootLines, visibleLineCount]);

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
  }, [isAwaitingContinue, onComplete]);

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
        {showContinuePrompt ? <p className="new-game-boot__continue">{CONTINUE_PROMPT}</p> : null}
      </div>
    </section>
  );
}
