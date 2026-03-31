import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  hasPersistedDockedSession,
  loadStartMenuFullscreenEnabled,
  loadStartMenuMusicEnabled,
  persistStartMenuFullscreenEnabled,
  persistStartMenuMusicEnabled
} from '../store/gameStateFactory';
import { useGameStore } from '../store/useGameStore';

type FullscreenElement = HTMLElement & {
  requestFullscreen?: () => Promise<void>;
  webkitRequestFullscreen?: () => Promise<void> | void;
};

// The start menu should appear immediately, so only the decorative scene stays
// behind a lazy boundary while the menu controls render synchronously.
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

  // Fullscreen only matters on phone-sized devices where browser chrome takes
  // enough space to hurt the in-game viewport.
  return isMobileAgent || (isTouchMac && prefersCoarsePointer);
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
    <span className="start-menu__scene start-menu__scene--fallback" aria-hidden="true">
      <span className="start-menu__scene-overlay" />
    </span>
  );
}

export function StartScreenGate() {
  const navigate = useNavigate();
  const isMenuVisible = useGameStore((state) => state.ui.startScreenVisible);
  const setStartScreenVisible = useGameStore((state) => state.setStartScreenVisible);
  const startNewGame = useGameStore((state) => state.startNewGame);
  const saveStates = useGameStore((state) => state.saveStates);
  const mobilePlatform = useMemo(() => isMobilePlatform(), []);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const [isMenuReady, setIsMenuReady] = useState(false);
  const [showcaseLabel, setShowcaseLabel] = useState('');
  const [musicEnabled, setMusicEnabled] = useState(() => loadStartMenuMusicEnabled());
  const [fullscreenEnabled, setFullscreenEnabled] = useState(() => loadStartMenuFullscreenEnabled());
  const [isLaunching, setIsLaunching] = useState(false);
  const canContinue = Object.keys(saveStates).length > 0 || hasPersistedDockedSession();

  useEffect(() => {
    const music = new Audio(START_SCREEN_MUSIC_PATH);
    music.loop = true;
    music.preload = 'auto';
    musicRef.current = music;

    // Browsers may block autoplay on first paint, so the menu retries once on
    // the first trusted interaction while the overlay remains visible.
    const tryPlayMusic = () => {
      if (!isMenuVisible || !musicEnabled) {
        return;
      }
      void music.play().catch(() => {
        // The retry path below is enough; failed autoplay should stay silent.
      });
    };

    const handleInteractionUnlock = () => {
      tryPlayMusic();
      window.removeEventListener('pointerdown', handleInteractionUnlock);
      window.removeEventListener('keydown', handleInteractionUnlock);
    };

    tryPlayMusic();
    window.addEventListener('pointerdown', handleInteractionUnlock);
    window.addEventListener('keydown', handleInteractionUnlock);

    return () => {
      window.removeEventListener('pointerdown', handleInteractionUnlock);
      window.removeEventListener('keydown', handleInteractionUnlock);
      music.pause();
      music.currentTime = 0;
      musicRef.current = null;
    };
  }, [isMenuVisible, musicEnabled]);

  useEffect(() => {
    let isCancelled = false;

    START_SCREEN_SCENE_PROMISE.then(() => {
      if (!isCancelled) {
        setIsMenuReady(true);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    persistStartMenuMusicEnabled(musicEnabled);
    const music = musicRef.current;
    if (!music) {
      return;
    }

    if (!isMenuVisible || !musicEnabled) {
      music.pause();
      music.currentTime = 0;
      return;
    }

    void music.play().catch(() => {
      // Some browsers still require an explicit tap before playback begins.
    });
  }, [isMenuVisible, musicEnabled]);

  useEffect(() => {
    persistStartMenuFullscreenEnabled(fullscreenEnabled);
  }, [fullscreenEnabled]);

  const closeMenu = () => {
    const music = musicRef.current;
    if (music) {
      music.pause();
      music.currentTime = 0;
    }
    setStartScreenVisible(false);
  };

  const launchIntoGame = async (mode: 'continue' | 'new-game') => {
    if (!isMenuReady || isLaunching) {
      return;
    }

    setIsLaunching(true);

    if (mobilePlatform && fullscreenEnabled) {
      const enteredFullscreen = await requestDocumentFullscreen().catch(() => false);
      if (!enteredFullscreen) {
        setIsLaunching(false);
        return;
      }
    }

    if (mode === 'new-game') {
      startNewGame();
    } else {
      closeMenu();
    }

    setIsLaunching(false);
  };

  if (!isMenuVisible) {
    return null;
  }

  return (
    <div className="start-menu" role="presentation">
      <div className="start-menu__panel">
        <span className="start-menu__frame">
          <span className="start-menu__title">DISO CODE</span>
          <Suspense fallback={<StartScreenSceneFallback />}>
            <StartScreenScene showcaseIndex={0} onShowcaseLabelChange={setShowcaseLabel} onSceneReady={setIsMenuReady} />
          </Suspense>
          <span className="start-menu__ship-label" aria-live="polite">
            {showcaseLabel}
          </span>
          <div className="start-menu__controls">
            <button
              type="button"
              className="start-menu__action"
              onClick={() => {
                void launchIntoGame('new-game');
              }}
              disabled={!isMenuReady || isLaunching}
            >
              New Game
            </button>
            {canContinue ? (
              <button
                type="button"
                className="start-menu__action"
                onClick={() => {
                  void launchIntoGame('continue');
                }}
                disabled={!isMenuReady || isLaunching}
              >
                Continue
              </button>
            ) : null}
            <button
              type="button"
              className="start-menu__action"
              onClick={() => {
                closeMenu();
                navigate('/save-load');
              }}
            >
              Load
            </button>
          </div>
          <div className="start-menu__settings">
            <label className="start-menu__toggle">
              <input type="checkbox" checked={musicEnabled} onChange={(event) => setMusicEnabled(event.target.checked)} />
              <span>Music</span>
            </label>
            <label className="start-menu__toggle">
              <input
                type="checkbox"
                checked={fullscreenEnabled}
                onChange={(event) => setFullscreenEnabled(event.target.checked)}
              />
              <span>Full Screen</span>
            </label>
          </div>
          <span className="start-menu__status">
            {isMenuReady
              ? mobilePlatform && fullscreenEnabled
                ? 'Start actions open the game in fullscreen on mobile.'
                : 'Start actions open the game without fullscreen.'
              : 'Loading start menu...'}
          </span>
          <span className="start-menu__copyright">© Alexey Korepanov 2026</span>
        </span>
      </div>
    </div>
  );
}
