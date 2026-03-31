import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../store/useGameStore';

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
const START_SCREEN_SHOWCASE_COUNT_PROMISE = import('./StartScreenScene').then((module) => module.START_SCREEN_SHOWCASE_COUNT);

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
    </span>
  );
}

export function StartScreenGate() {
  const isDismissed = useGameStore((state) => !state.ui.startScreenVisible);
  const setStartScreenVisible = useGameStore((state) => state.setStartScreenVisible);
  const mobilePlatform = useMemo(() => isMobilePlatform(), []);
  const [isSceneReady, setIsSceneReady] = useState(false);
  const [showcaseLabel, setShowcaseLabel] = useState('');
  const [showcaseIndex, setShowcaseIndex] = useState(0);
  const [showcaseCount, setShowcaseCount] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(() => {
    if (typeof document === 'undefined') {
      return false;
    }

    return isDocumentFullscreen(document as FullscreenDocument);
  });

  useEffect(() => {
    let isCancelled = false;
    START_SCREEN_SHOWCASE_COUNT_PROMISE.then((count) => {
      if (!isCancelled) {
        setShowcaseCount(Math.max(1, count));
      }
    });
    return () => {
      isCancelled = true;
    };
  }, []);

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
      setStartScreenVisible(false);
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
        setStartScreenVisible(false);
      });
  };

  const handleShowcaseStep = (direction: -1 | 1) => {
    // The gallery loops forever so users can cycle ships in either direction
    // without hitting a hard edge or resetting the start screen.
    setShowcaseIndex((prevIndex) => (prevIndex + direction + showcaseCount) % showcaseCount);
  };

  return (
    <div className="mobile-fullscreen-gate" role="presentation">
      <div className="mobile-fullscreen-gate__button">
        <span className="mobile-fullscreen-gate__frame">
          <span className="mobile-fullscreen-gate__title">DISO CODE</span>
          <Suspense fallback={<StartScreenSceneFallback />}>
            <StartScreenScene
              showcaseIndex={showcaseIndex}
              onShowcaseLabelChange={setShowcaseLabel}
              onSceneReady={setIsSceneReady}
            />
          </Suspense>
          <span className="mobile-fullscreen-gate__ship-label" aria-live="polite">
            {showcaseLabel}
          </span>
          <button
            type="button"
            className="mobile-fullscreen-gate__nav mobile-fullscreen-gate__nav--prev"
            onClick={() => handleShowcaseStep(-1)}
            aria-label="Show previous ship"
          >
            Prev
          </button>
          <button
            type="button"
            className="mobile-fullscreen-gate__start"
            onClick={handleContinue}
            aria-label={mobilePlatform ? 'Start game in fullscreen' : 'Start game'}
          >
            {isSceneReady ? 'Start' : 'Loading...'}
          </button>
          <button
            type="button"
            className="mobile-fullscreen-gate__nav mobile-fullscreen-gate__nav--next"
            onClick={() => handleShowcaseStep(1)}
            aria-label="Show next ship"
          >
            Next
          </button>
          <span className="mobile-fullscreen-gate__copyright">© Alexey Korepanov 2026</span>
        </span>
      </div>
    </div>
  );
}
