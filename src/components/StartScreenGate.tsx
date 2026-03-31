import { Suspense, lazy, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useGameStore } from '../store/useGameStore';

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
};

type FullscreenElement = HTMLElement & {
  requestFullscreen?: () => Promise<void>;
  webkitRequestFullscreen?: () => Promise<void> | void;
};

// The title shell must paint immediately because it is the game's first
// visible screen, so only the heavier Three.js showcase loads lazily.
const StartScreenScene = lazy(() => import('./StartScreenScene').then((module) => ({ default: module.StartScreenScene })));
const START_SCREEN_SCENE_PROMISE = import('./StartScreenScene');
const START_SCREEN_MUSIC_PATH = '/music/intro.mp3';

function isMobilePlatform(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  const platform = navigator.userAgent || '';
  const touches = navigator.maxTouchPoints || 0;
  const isMobileAgent = /android|iphone|ipad|ipod|mobile/i.test(platform);
  const isTouchMac = navigator.platform === 'MacIntel' && touches > 1;
  const prefersCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

  // Fullscreen is only worth requesting on phone-class devices where browser
  // chrome steals a meaningful slice of the already small viewport.
  return isMobileAgent || (isTouchMac && prefersCoarsePointer);
}

function isDocumentFullscreen(doc: FullscreenDocument): boolean {
  return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
}

async function requestDocumentFullscreen(): Promise<boolean> {
  const root = document.documentElement as FullscreenElement;

  if (root.requestFullscreen) {
    await root.requestFullscreen();
    return true;
  }

  if (root.webkitRequestFullscreen) {
    await root.webkitRequestFullscreen();
    return true;
  }

  return false;
}

function StartScreenSceneFallback() {
  return (
    <span className="mobile-fullscreen-gate__scene mobile-fullscreen-gate__scene--fallback" aria-hidden="true">
      <span className="mobile-fullscreen-gate__scene-overlay" />
    </span>
  );
}

export function StartScreenGate() {
  const isGateVisible = useGameStore((state) => state.ui.startScreenVisible);
  const setStartScreenVisible = useGameStore((state) => state.setStartScreenVisible);
  const mobilePlatform = useMemo(() => isMobilePlatform(), []);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const hasCompletedBootstrapRef = useRef(false);
  const [isBootstrapVisible, setIsBootstrapVisible] = useState(true);
  const [showResumeBootstrap, setShowResumeBootstrap] = useState(false);
  const [isBootstrapReady, setIsBootstrapReady] = useState(false);
  const [isBootstrapStarting, setIsBootstrapStarting] = useState(false);
  const [isGateSceneReady, setIsGateSceneReady] = useState(false);
  const [showcaseLabel, setShowcaseLabel] = useState('');
  const [musicEnabled, setMusicEnabled] = useState(true);

  useEffect(() => {
    const music = new Audio(START_SCREEN_MUSIC_PATH);
    music.loop = true;
    music.preload = 'auto';
    musicRef.current = music;

    return () => {
      music.pause();
      music.currentTime = 0;
      musicRef.current = null;
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    START_SCREEN_SCENE_PROMISE.then(() => {
      if (!isCancelled) {
        setIsBootstrapReady(true);
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

    const handleFullscreenChange = () => {
      // Once the initial bootstrap has completed, dropping out of fullscreen
      // should always route the user back through the lightweight entry screen
      // before they resume the title gate or live game in windowed mode.
      if (!isDocumentFullscreen(document as FullscreenDocument) && hasCompletedBootstrapRef.current) {
        const music = musicRef.current;
        if (music) {
          music.pause();
          music.currentTime = 0;
        }
        setShowResumeBootstrap(true);
        setIsBootstrapVisible(true);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange as EventListener);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange as EventListener);
    };
  }, [mobilePlatform]);

  useEffect(() => {
    // The intro track only belongs to the title flow. Any return to the live
    // game or to the bootstrap overlay should leave the app silent.
    if (isBootstrapVisible || !isGateVisible) {
      const music = musicRef.current;
      if (music) {
        music.pause();
        music.currentTime = 0;
      }
    }
  }, [isBootstrapVisible, isGateVisible]);

  const handleBootstrapContinue = async () => {
    if (!isBootstrapReady || isBootstrapStarting) {
      return;
    }

    setIsBootstrapStarting(true);

    const shouldRequestFullscreen = mobilePlatform;
    if (shouldRequestFullscreen) {
      const enteredFullscreen = await requestDocumentFullscreen().catch(() => false);
      if (!enteredFullscreen) {
        setIsBootstrapStarting(false);
        return;
      }
    }

    hasCompletedBootstrapRef.current = true;
    setIsBootstrapVisible(false);

    if (musicEnabled && isGateVisible) {
      const music = musicRef.current;
      if (music) {
        void music.play().catch(() => {
          // Playback failure should not trap the user on the bootstrap screen
          // once the gate has been loaded and their tap already happened.
        });
      }
    }

    setIsBootstrapStarting(false);
  };

  const handleGateDismiss = () => {
    const music = musicRef.current;
    if (music) {
      music.pause();
      music.currentTime = 0;
    }
    setStartScreenVisible(false);
  };

  const handleGateKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab') {
      return;
    }
    if (event.key !== ' ' && event.key !== 'Spacebar' && event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    handleGateDismiss();
  };

  const bootstrapButtonLabel = isBootstrapReady ? (showResumeBootstrap ? 'Continue' : 'Start') : 'Loading...';
  const bootstrapHint = showResumeBootstrap
    ? 'Fullscreen was closed. Continue returns to fullscreen on mobile.'
    : mobilePlatform
      ? 'Loading the hangar. Start opens the gate and enters fullscreen on mobile.'
      : 'Loading the hangar. Start opens the gate in windowed mode.';

  return (
    <>
      {isGateVisible && !isBootstrapVisible ? (
        <div className="mobile-fullscreen-gate" role="presentation">
          <div
            role="button"
            tabIndex={0}
            className="mobile-fullscreen-gate__button"
            onClick={handleGateDismiss}
            onKeyDown={handleGateKeyDown}
            aria-label="Press spacebar to start game"
          >
            <span className="mobile-fullscreen-gate__frame">
              <span className="mobile-fullscreen-gate__title">DISO CODE</span>
              <Suspense fallback={<StartScreenSceneFallback />}>
                <StartScreenScene showcaseIndex={0} onShowcaseLabelChange={setShowcaseLabel} onSceneReady={setIsGateSceneReady} />
              </Suspense>
              <span className="mobile-fullscreen-gate__ship-label" aria-live="polite">
                {showcaseLabel}
              </span>
              <span className="mobile-fullscreen-gate__prompt">{isGateSceneReady ? 'Press spacebar to start game' : ''}</span>
              <span className="mobile-fullscreen-gate__copyright">© Alexey Korepanov 2026</span>
            </span>
          </div>
        </div>
      ) : null}

      {isBootstrapVisible ? (
        <div className="start-bootstrap" role="presentation">
          <div className="start-bootstrap__panel">
            <span className="start-bootstrap__title">DISO CODE</span>
            <span className="start-bootstrap__status">{bootstrapHint}</span>
            <label className="start-bootstrap__toggle">
              <input type="checkbox" checked={musicEnabled} onChange={(event) => setMusicEnabled(event.target.checked)} />
              <span>Play music on gate screen</span>
            </label>
            <button
              type="button"
              className="start-bootstrap__action"
              onClick={() => {
                void handleBootstrapContinue();
              }}
              disabled={!isBootstrapReady || isBootstrapStarting}
            >
              {bootstrapButtonLabel}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
