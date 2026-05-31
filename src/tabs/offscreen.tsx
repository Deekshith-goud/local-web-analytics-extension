import { useEffect } from "react"
import { SOUNDS } from "./sounds"

function playBeep(soundId: string = 'beep') {
  try {
    const base64Sound = SOUNDS[soundId] || SOUNDS['beep'];
    const audio = new Audio(base64Sound);
    audio.play().catch(e => console.error("Offscreen audio playback failed:", e));
  } catch (err) {
    console.error("Offscreen audio creation failed:", err);
  }
}

export default function OffscreenDocument() {
  useEffect(() => {
    const handleMessage = (message: { type?: string; target?: string; soundId?: string }) => {
      if (message.type === "PLAY_SOUND" && message.target === "offscreen") {
        playBeep(message.soundId);
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  return <div>Offscreen Audio Processor</div>;
}
