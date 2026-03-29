import { useEffect, useMemo, useState } from 'react';

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

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

export function MobileFullscreenGate() {
  const mobilePlatform = useMemo(() => isMobilePlatform(), []);
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

  if (!mobilePlatform || isFullscreen) {
    return null;
  }

  const handleContinue = () => {
    // Browsers require fullscreen requests to originate from a direct user
    // gesture, so the overlay itself owns every activation path.
    requestDocumentFullscreen().catch(() => {
      setIsFullscreen(isDocumentFullscreen(document as FullscreenDocument));
    });
  };

  return (
    <div className="mobile-fullscreen-gate" role="presentation">
      <button
        type="button"
        className="mobile-fullscreen-gate__button"
        onClick={handleContinue}
        onKeyDown={handleContinue}
        aria-label="Press any key to continue in fullscreen"
      >
        <span className="mobile-fullscreen-gate__frame">
          <span className="mobile-fullscreen-gate__title">press any key to continue</span>
        </span>
      </button>
    </div>
  );
}
