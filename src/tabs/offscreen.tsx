import { useEffect } from "react"
import { BEEP_BASE64 } from "./beepBase64"

function playBeep() {
  try {
    const audio = new Audio(BEEP_BASE64);
    audio.play().catch(e => console.error("Offscreen audio playback failed:", e));
  } catch (err) {
    console.error("Offscreen audio creation failed:", err);
  }
}

export default function OffscreenDocument() {
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.type === "PLAY_SOUND" && message.target === "offscreen") {
        playBeep();
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  return <div>Offscreen Audio Processor</div>;
}
