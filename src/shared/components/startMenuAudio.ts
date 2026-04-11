const START_SCREEN_MUSIC_PATH = '/music/intro.mp3';

let startMenuAudio: HTMLAudioElement | null = null;

function ensureStartMenuAudio() {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!startMenuAudio) {
    const audio = new Audio(START_SCREEN_MUSIC_PATH);
    audio.loop = true;
    audio.preload = 'auto';
    startMenuAudio = audio;
  }

  return startMenuAudio;
}

export function playStartMenuAudio() {
  const audio = ensureStartMenuAudio();
  if (!audio) {
    return Promise.resolve();
  }
  return audio.play();
}

export function pauseStartMenuAudio(reset = true) {
  const audio = ensureStartMenuAudio();
  if (!audio) {
    return;
  }
  audio.pause();
  if (reset) {
    audio.currentTime = 0;
  }
}

export function getStartMenuAudio() {
  return ensureStartMenuAudio();
}
