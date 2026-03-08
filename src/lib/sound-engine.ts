// Sound engine using Web Audio API for SFX
const audioCtx = typeof window !== 'undefined' ? new (window.AudioContext || (window as any).webkitAudioContext)() : null;

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume = 0.15) {
  if (!audioCtx) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + duration);
  } catch {}
}

// Short beep click
export const playClick = () => playTone(800, 0.08, 'square', 0.08);

// Success chime: two ascending tones
export const playSuccess = () => {
  playTone(523, 0.15, 'sine', 0.12);
  setTimeout(() => playTone(784, 0.2, 'sine', 0.12), 120);
};

// Approved: three-tone fanfare
export const playApproved = () => {
  playTone(523, 0.12, 'sine', 0.1);
  setTimeout(() => playTone(659, 0.12, 'sine', 0.1), 100);
  setTimeout(() => playTone(784, 0.25, 'sine', 0.12), 200);
};

// Payment added: cash register sound
export const playPaymentAdded = () => {
  playTone(1200, 0.06, 'square', 0.1);
  setTimeout(() => playTone(1600, 0.08, 'square', 0.1), 60);
  setTimeout(() => playTone(2000, 0.12, 'sine', 0.08), 120);
};

// Client added
export const playClientAdded = () => {
  playTone(440, 0.1, 'sine', 0.1);
  setTimeout(() => playTone(660, 0.15, 'sine', 0.1), 100);
};

// Sync success
export const playSyncSuccess = () => {
  playTone(600, 0.08, 'triangle', 0.1);
  setTimeout(() => playTone(900, 0.08, 'triangle', 0.1), 80);
  setTimeout(() => playTone(1200, 0.15, 'triangle', 0.1), 160);
};

// Error alert
export const playError = () => {
  playTone(200, 0.3, 'sawtooth', 0.12);
  setTimeout(() => playTone(150, 0.3, 'sawtooth', 0.1), 200);
};
