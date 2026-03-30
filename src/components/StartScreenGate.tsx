import { Suspense, lazy, useEffect, useMemo, useState, type KeyboardEvent } from 'react';

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  requestFullscreen?: () => Promise<void>;
  webkitRequestFullscreen?: () => Promise<void> | void;
};

// The title shell must paint immediately because it is the game's first
// visible screen, so only the heavier Three.js showcase loads lazily.
const StartScreenScene = lazy(() => import('./StartScreenScene').then((module) => ({ default: module.StartScreenScene })));

function isMobilePlatform(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  const platform = navigator.userAgent || '';
  const touches = navigator.maxTouchPoints || 0;
  const isMobileAgent = /android|iphone|ipad|ipod|mobile/i.test(platform);
  const isTouchMac = navigator.platform === 'MacIntel' && touches > 1;
  const prefersCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

  // The gate is limited to mobile-class devices where browser chrome tends to
  // consume a meaningful part of the viewport and immersive mode matters.
  return isMobileAgent || (isTouchMac && prefersCoarsePointer);
}

function isDocumentFullscreen(doc: FullscreenDocument): boolean {
  return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
}

async function requestDocumentFullscreen(): Promise<void> {
  const root = document.documentElement as FullscreenElement;

  if (root.requestFullscreen) {
    await root.requestFullscreen();
    return;
  }

  if (root.webkitRequestFullscreen) {
    await root.webkitRequestFullscreen();
  }
}

function StartScreenSceneFallback() {
  return (
    <span className="mobile-fullscreen-gate__scene mobile-fullscreen-gate__scene--fallback" aria-hidden="true">
      <span className="mobile-fullscreen-gate__scene-overlay" />
      <span className="mobile-fullscreen-gate__scene-loading">Loading showcase</span>
    </span>
  );
}

export function StartScreenGate() {
  const mobilePlatform = useMemo(() => isMobilePlatform(), []);
  const [isDismissed, setIsDismissed] = useState(false);
  const [showcaseLabel, setShowcaseLabel] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(() => {
    if (typeof document === 'undefined') {
      return false;
    }

    return isDocumentFullscreen(document as FullscreenDocument);
  });

  useEffect(() => {
    if (!mobilePlatform) {
      return undefined;
    }

    const syncFullscreenState = () => {
      setIsFullscreen(isDocumentFullscreen(document as FullscreenDocument));
    };

    syncFullscreenState();
    document.addEventListener('fullscreenchange', syncFullscreenState);
    document.addEventListener('webkitfullscreenchange', syncFullscreenState as EventListener);

    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState);
      document.removeEventListener('webkitfullscreenchange', syncFullscreenState as EventListener);
    };
  }, [mobilePlatform]);

  if (isDismissed) {
    return null;
  }

  const handleContinue = () => {
    if (!mobilePlatform || isFullscreen) {
      setIsDismissed(true);
      return;
    }

    // Browsers require fullscreen requests to originate from a direct user
    // gesture, so the title overlay owns the hand-off into the game on touch
    // devices. Desktop skips fullscreen and simply dismisses the attract mode.
    requestDocumentFullscreen()
      .catch(() => {
        setIsFullscreen(isDocumentFullscreen(document as FullscreenDocument));
      })
      .finally(() => {
        setIsDismissed(true);
      });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab') {
      return;
    }
    if (event.key !== ' ' && event.key !== 'Spacebar' && event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    handleContinue();
  };

  return (
    <div className="mobile-fullscreen-gate" role="presentation">
      <div
        role="button"
        tabIndex={0}
        className="mobile-fullscreen-gate__button"
        onClick={handleContinue}
        onKeyDown={handleKeyDown}
        aria-label={mobilePlatform ? 'Press spacebar to start game in fullscreen' : 'Press spacebar to start game'}
      >
        <span className="mobile-fullscreen-gate__frame">
          <span className="mobile-fullscreen-gate__title">DISO CODE</span>
          <Suspense fallback={<StartScreenSceneFallback />}>
            <StartScreenScene onShowcaseLabelChange={setShowcaseLabel} />
          </Suspense>
          <span className="mobile-fullscreen-gate__ship-label" aria-live="polite">
            {showcaseLabel}
          </span>
          <span className="mobile-fullscreen-gate__prompt">Press spacebar to start game</span>
          <span className="mobile-fullscreen-gate__copyright">© Alexey Korepanov 2026</span>
        </span>
      </div>
    </div>
  );
}
