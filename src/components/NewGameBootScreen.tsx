import { useCallback, useEffect, useMemo, useState } from 'react';
import { createDefaultCommander } from '../domain/commander';
import { formatCredits } from '../utils/money';

const DEFAULT_COMMANDER = createDefaultCommander();
const DEFAULT_START_SYSTEM = DEFAULT_COMMANDER.currentSystem.toUpperCase();
const DEFAULT_CREDIT_BALANCE = formatCredits(DEFAULT_COMMANDER.cash).toUpperCase();
const DEFAULT_LEGAL_STATUS = 'CLEAN';

interface BootLine {
  label: string;
  value?: string;
}

const BOOT_LINES: BootLine[] = [
  { label: 'LOADING CORE SYSTEMS...', value: 'DONE' },
  { label: 'MEMORY RESTORE:', value: 'NO SNAPSHOT AVAILABLE' },
  { label: 'NAVIGATION:', value: 'OK' },
  { label: 'CURRENT SYSTEM:', value: DEFAULT_START_SYSTEM },
  { label: 'CREDIT BALANCE:', value: DEFAULT_CREDIT_BALANCE },
  { label: 'LEGAL STATUS:', value: DEFAULT_LEGAL_STATUS },
  { label: 'PRIORITY PROFILE:', value: 'DEFAULT' }
];

const LINE_REVEAL_DELAY_MS = 360;
const CONTINUE_PROMPT_DELAY_MS = 520;
const CONTINUE_PROMPT = 'PRESS ANY KEY TO CONTINUE';
const TOTAL_BOOT_STEPS = BOOT_LINES.reduce((sum, line) => sum + (line.value ? 2 : 1), 0);

export interface NewGameBootScreenProps {
  onComplete: () => void;
}

export function NewGameBootScreen({ onComplete }: NewGameBootScreenProps) {
  const [visibleStepCount, setVisibleStepCount] = useState(0);
  const [showContinuePrompt, setShowContinuePrompt] = useState(false);
  const visibleLines = useMemo(() => {
    let remainingSteps = visibleStepCount;
    return BOOT_LINES.flatMap((line) => {
      if (remainingSteps <= 0) {
        return [];
      }
      if (!line.value) {
        remainingSteps -= 1;
        return [line.label];
      }
      if (remainingSteps === 1) {
        remainingSteps = 0;
        return [line.label];
      }
      remainingSteps -= 2;
      return [`${line.label} ${line.value}`];
    });
  }, [visibleStepCount]);
  const hasFinishedBootLines = visibleStepCount >= TOTAL_BOOT_STEPS;
  const isAwaitingContinue = hasFinishedBootLines && showContinuePrompt;

  const beginPowerOn = useCallback(() => {
    if (!isAwaitingContinue) {
      return;
    }
    onComplete();
  }, [isAwaitingContinue, onComplete]);

  useEffect(() => {
    if (hasFinishedBootLines) {
      const promptTimer = window.setTimeout(() => {
        setShowContinuePrompt(true);
      }, CONTINUE_PROMPT_DELAY_MS);
      return () => window.clearTimeout(promptTimer);
    }

    const revealTimer = window.setTimeout(() => {
      setVisibleStepCount((current) => current + 1);
    }, LINE_REVEAL_DELAY_MS);
    return () => window.clearTimeout(revealTimer);
  }, [hasFinishedBootLines, visibleStepCount]);

  useEffect(() => {
    if (isAwaitingContinue) {
      const handleContinue = () => {
        beginPowerOn();
      };

      window.addEventListener('keydown', handleContinue);
      return () => {
        window.removeEventListener('keydown', handleContinue);
      };
    }
  }, [beginPowerOn, isAwaitingContinue]);

  return (
    <section
      className="new-game-boot"
      aria-label="New game boot sequence"
      onClick={() => {
        beginPowerOn();
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
