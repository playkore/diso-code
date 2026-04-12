import { Suspense, lazy, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  hasPersistedDockedSession,
  SAVE_SLOT_IDS,
  loadStartMenuFullscreenEnabled,
  loadStartMenuMusicEnabled,
  persistStartMenuFullscreenEnabled,
  persistStartMenuMusicEnabled
} from '../store/gameStateFactory';
import { useGameStore } from '../../store/useGameStore';
import { getStartMenuAudio, pauseStartMenuAudio, playStartMenuAudio } from './startMenuAudio';
import { START_SCREEN_SHOWCASE_COUNT } from './startScreenShowcase';

type FullscreenElement = HTMLElement & {
  requestFullscreen?: () => Promise<void>;
  webkitRequestFullscreen?: () => Promise<void> | void;
};

// The start menu should appear immediately, so only the decorative scene stays
// behind a lazy boundary while the menu controls render synchronously.
const StartScreenScene = lazy(() => import('./StartScreenScene').then((module) => ({ default: module.StartScreenScene })));
const START_SCREEN_SCENE_PROMISE = import('./StartScreenScene');

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
  const [isMenuReady, setIsMenuReady] = useState(false);
  const [showcaseLabel, setShowcaseLabel] = useState('');
  const [showcaseIndex, setShowcaseIndex] = useState(0);
  const [musicEnabled, setMusicEnabled] = useState(() => loadStartMenuMusicEnabled());
  const [fullscreenEnabled, setFullscreenEnabled] = useState(() => loadStartMenuFullscreenEnabled());
  const [isLaunching, setIsLaunching] = useState(false);
  const [isPickingNewGameSlot, setIsPickingNewGameSlot] = useState(false);
  const [overwriteSlotId, setOverwriteSlotId] = useState<(typeof SAVE_SLOT_IDS)[number] | null>(null);
  const hasResumeSession = hasPersistedDockedSession();
  const canContinue = hasResumeSession;
  const canLoad = Object.keys(saveStates).length > 0;

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
    const music = getStartMenuAudio();
    if (!music) {
      return;
    }

    if (!isMenuVisible || !musicEnabled) {
      pauseStartMenuAudio();
      return;
    }

    if (!music.paused) {
      return;
    }

    void playStartMenuAudio().catch(() => {
      // Browsers may still reject playback in dev after a hot reload. The menu
      // stays usable and the next explicit interaction can resume the track.
    });
  }, [isMenuVisible, musicEnabled]);

  useEffect(() => {
    persistStartMenuFullscreenEnabled(fullscreenEnabled);
  }, [fullscreenEnabled]);

  const closeMenu = () => {
    pauseStartMenuAudio();
    setStartScreenVisible(false);
  };

  const stepShowcase = (delta: number) => {
    setShowcaseIndex((current) => {
      const next = current + delta;
      return (next % START_SCREEN_SHOWCASE_COUNT + START_SCREEN_SHOWCASE_COUNT) % START_SCREEN_SHOWCASE_COUNT;
    });
  };

  const launchContinue = async () => {
    if (!isMenuReady || isLaunching) {
      return;
    }

    setIsLaunching(true);

    if (fullscreenEnabled) {
      const enteredFullscreen = await requestDocumentFullscreen().catch(() => false);
      if (!enteredFullscreen) {
        setIsLaunching(false);
        return;
      }
    }

    closeMenu();
    setIsLaunching(false);
  };

  const launchNewGame = async (slotId: (typeof SAVE_SLOT_IDS)[number]) => {
    if (!isMenuReady || isLaunching) {
      return;
    }

    setIsLaunching(true);

    if (fullscreenEnabled) {
      const enteredFullscreen = await requestDocumentFullscreen().catch(() => false);
      if (!enteredFullscreen) {
        setIsLaunching(false);
        return;
      }
    }

    startNewGame(slotId);
    setIsPickingNewGameSlot(false);
    setOverwriteSlotId(null);
    setIsLaunching(false);
  };

  const handleNewGameSlot = (slotId: (typeof SAVE_SLOT_IDS)[number]) => {
    if (isLaunching || !isMenuReady) {
      return;
    }
    if (saveStates[slotId]) {
      setIsPickingNewGameSlot(false);
      setOverwriteSlotId(slotId);
      return;
    }
    void launchNewGame(slotId);
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
            <StartScreenScene
              showcaseIndex={showcaseIndex}
              onShowcaseLabelChange={setShowcaseLabel}
              onSceneReady={setIsMenuReady}
            />
          </Suspense>
          <div className="start-menu__ship-nav" aria-label="Ship showcase controls">
            <button
              type="button"
              className="start-menu__ship-nav-button"
              onClick={() => stepShowcase(-1)}
              disabled={!isMenuReady}
              aria-label="Previous ship"
            >
              &lt;
            </button>
            <span className="start-menu__ship-label" aria-live="polite">
              {showcaseLabel}
            </span>
            <button
              type="button"
              className="start-menu__ship-nav-button"
              onClick={() => stepShowcase(1)}
              disabled={!isMenuReady}
              aria-label="Next ship"
            >
              &gt;
            </button>
          </div>
          <div className="start-menu__controls">
            <button
              type="button"
              className="start-menu__action"
              onClick={() => {
                setIsPickingNewGameSlot(true);
              }}
              disabled={!isMenuReady || isLaunching}
            >
              New Game
            </button>
            <button
              type="button"
              className="start-menu__action"
              onClick={() => {
                void launchContinue();
              }}
              disabled={!isMenuReady || isLaunching || !canContinue}
            >
              Continue
            </button>
            <button
              type="button"
              className="start-menu__action"
              onClick={() => {
                closeMenu();
                navigate('/load');
              }}
              disabled={!isMenuReady || !canLoad}
            >
              Load
            </button>
            <button
              type="button"
              className="start-menu__action"
              onClick={() => {
                closeMenu();
                navigate('/debug');
              }}
            >
              Debug
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
          <span className="start-menu__copyright">© Alexey Korepanov 2026</span>
        </span>
      </div>
      {isPickingNewGameSlot ? (
        <div className="dialog-backdrop" role="presentation">
          <div className="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="new-game-slot-title">
            <p className="dialog-kicker">New Commander</p>
            <h3 id="new-game-slot-title">Choose a slot</h3>
            <p>Select one of the three slots. The chosen slot will be autosaved every time you dock.</p>
            <div className="save-panels">
              {SAVE_SLOT_IDS.map((slotId) => {
                const saveState = saveStates[slotId];
                const savedCommander = saveState?.snapshot.commander;
                const savedUniverse = saveState?.snapshot.universe;

                return (
                  <button key={slotId} type="button" className="save-panel save-slot-button" onClick={() => handleNewGameSlot(slotId)}>
                    <div className="save-slot__header">
                      <p className="dialog-kicker">Slot {slotId}</p>
                      <p className="save-slot__cta">{saveState ? 'Overwrite' : 'Start'}</p>
                    </div>
                    {savedCommander && savedUniverse ? (
                      <>
                        <p className="muted">Saved {new Date(saveState.savedAt).toLocaleString()}</p>
                        <dl className="detail-grid">
                          <dt>Name</dt>
                          <dd>{savedCommander.name}</dd>
                          <dt>System</dt>
                          <dd>{savedCommander.currentSystem}</dd>
                          <dt>Stardate</dt>
                          <dd>{savedUniverse.stardate}</dd>
                        </dl>
                      </>
                    ) : (
                      <p className="muted">Empty slot.</p>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="dialog-actions dialog-actions--single">
              <button type="button" onClick={() => setIsPickingNewGameSlot(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {overwriteSlotId ? (
        <div className="dialog-backdrop" role="presentation">
          <div className="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="new-game-overwrite-title">
            <p className="dialog-kicker">Overwrite Slot</p>
            <h3 id="new-game-overwrite-title">Replace Slot {overwriteSlotId}?</h3>
            <p>
              This slot already has a save. Starting a new game here will replace that run and make Slot {overwriteSlotId} the
              active autosave target.
            </p>
            <div className="dialog-actions">
              <button
                type="button"
                onClick={() => {
                  setOverwriteSlotId(null);
                  setIsPickingNewGameSlot(true);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button-danger"
                onClick={() => {
                  const slotId = overwriteSlotId;
                  setOverwriteSlotId(null);
                  void launchNewGame(slotId);
                }}
              >
                Replace Slot {overwriteSlotId}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
