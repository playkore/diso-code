import { useEffect, useState } from 'react';

const START_SCREEN_SCENE_PROMISE = import('./StartScreenScene');

export interface StartScreenLoaderProps {
  onContinue: () => void;
}

export function StartScreenLoader({ onContinue }: StartScreenLoaderProps) {
  const [isReady, setIsReady] = useState(false);

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

    window.addEventListener('pointerdown', handleContinue);
    window.addEventListener('keydown', handleContinue);

    return () => {
      window.removeEventListener('pointerdown', handleContinue);
      window.removeEventListener('keydown', handleContinue);
    };
  }, [isReady, onContinue]);

  return (
    <section className="start-loader" aria-label="Start screen loader">
      <span className="start-loader__label">{isReady ? 'Press any key to continue' : 'Loading'}</span>
    </section>
  );
}
