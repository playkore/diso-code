import { useEffect, useState } from 'react';
import { loadStartMenuMusicEnabled, persistStartMenuMusicEnabled } from '../store/gameStateFactory';

const START_SCREEN_SCENE_PROMISE = import('./StartScreenScene');

export interface StartScreenLoaderProps {
  onContinue: () => void;
}

export function StartScreenLoader({ onContinue }: StartScreenLoaderProps) {
  const [isReady, setIsReady] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(() => loadStartMenuMusicEnabled());

  useEffect(() => {
    let isCancelled = false;

    // The loader waits on the same lazy scene chunk as the menu so the user
    // never sees half-hydrated controls or a menu that still lacks its stage.
    START_SCREEN_SCENE_PROMISE.then(() => {
      if (!isCancelled) {
        setIsReady(true);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isReady) {
      return undefined;
    }

    const handleContinue = () => {
      onContinue();
    };

    window.addEventListener('keydown', handleContinue);

    return () => {
      window.removeEventListener('keydown', handleContinue);
    };
  }, [isReady, onContinue]);

  useEffect(() => {
    persistStartMenuMusicEnabled(musicEnabled);
  }, [musicEnabled]);

  return (
    <section
      className="start-loader"
      aria-label="Start screen loader"
      onPointerDown={() => {
        if (isReady) {
          onContinue();
        }
      }}
    >
      <span className="start-loader__label">{isReady ? 'Press any key to continue' : 'Loading'}</span>
      <label
        className="start-loader__toggle"
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <input type="checkbox" checked={musicEnabled} onChange={(event) => setMusicEnabled(event.target.checked)} />
        <span>Music</span>
      </label>
    </section>
  );
}
