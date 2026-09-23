/**
 * Notification sounds using HTML5 Audio with base64 WAV data.
 * Unlike AudioContext (Web Audio API), HTML5 Audio works even when the browser tab is in the background.
 */

// Generate a simple WAV file with a beep tone
function generateWav(frequency: number, duration: number, volume: number = 0.3): string {
  const sampleRate = 22050;
  const numSamples = Math.floor(sampleRate * duration);
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = numSamples * blockAlign;
  const headerSize = 44;
  const buffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buffer);

  // WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  // Generate tone with fade-out
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const fadeOut = Math.max(0, 1 - t / duration);
    const sample = Math.sin(2 * Math.PI * frequency * t) * volume * fadeOut;
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(headerSize + i * 2, clamped * 0x7fff, true);
  }

  // Convert to base64
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return "data:audio/wav;base64," + btoa(binary);
}

// Pre-generate sounds as base64 data URIs
const MESSAGE_SOUND = generateWav(784, 0.2, 0.25); // Higher pitch for external messages
const CHAT_SOUND = generateWav(659, 0.15, 0.2);    // Medium pitch for internal chat
const NOTIFICATION_SOUND = generateWav(880, 0.25, 0.3); // Highest pitch for system notifications

// Cache Audio elements to avoid re-creation
let messageAudio: HTMLAudioElement | null = null;
let chatAudio: HTMLAudioElement | null = null;
let notificationAudio: HTMLAudioElement | null = null;

function playSound(dataUri: string, audioRef: { current: HTMLAudioElement | null }): HTMLAudioElement | null {
  try {
    // Reuse or create audio element
    if (!audioRef.current) {
      audioRef.current = new Audio(dataUri);
    }
    const audio = audioRef.current;
    audio.currentTime = 0;
    audio.play().catch(() => {
      // Browser may block autoplay; try AudioContext as fallback
    });
    return audio;
  } catch {
    return null;
  }
}

const messageRef = { current: messageAudio };
const chatRef = { current: chatAudio };
const notificationRef = { current: notificationAudio };

/** Play sound for incoming WhatsApp/external messages */
export function playMessageSound() {
  playSound(MESSAGE_SOUND, messageRef);
}

/** Play sound for internal chat messages */
export function playChatSound() {
  playSound(CHAT_SOUND, chatRef);
}

/** Play sound for system notifications */
export function playNotificationSound() {
  playSound(NOTIFICATION_SOUND, notificationRef);
}
