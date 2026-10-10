import { LOG } from "./logger.js";
import { getSetting } from "./config.js";

let audioCtx = null;
let audioOsc = null;
let audioGain = null;

export function setBackgroundMode(enable) {
  if (!enable) {
    if (audioOsc) {
      try { audioOsc.stop(); } catch (_) {}
      audioOsc.disconnect();
      audioOsc = null;
    }
    if (audioGain) {
      audioGain.disconnect();
      audioGain = null;
    }
    if (audioCtx && audioCtx.state !== "closed") {
      audioCtx.close();
      audioCtx = null;
    }
    LOG.info("BACKGROUND", "BackgroundMode disabled.");
    return;
  }

  try {
    if (!audioCtx || audioCtx.state === "closed") {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    if (audioOsc) {
      try { audioOsc.stop(); } catch (_) {}
      audioOsc.disconnect();
      audioOsc = null;
    }

    audioOsc = audioCtx.createOscillator();
    audioGain = audioCtx.createGain();
    audioOsc.connect(audioGain);
    audioGain.connect(audioCtx.destination);

    audioOsc.type = "sine";
    audioGain.gain.setValueAtTime(0.0001, audioCtx.currentTime); 
    audioOsc.frequency.setValueAtTime(30, audioCtx.currentTime);
    audioOsc.start();
    LOG.success("BACKGROUND", "BackgroundMode active (WebAudio dethrottler running).");
  } catch (e) {
    LOG.warn("BACKGROUND", "AudioContext autoplay restriction encountered. Will retry on user click.");
  }
}

export function initBackgroundModeListener() {
  window.addEventListener("click", () => {
    if (getSetting("BackgroundMode") && (!audioCtx || audioCtx.state === "suspended")) {
      setBackgroundMode(true);
    }
  }, { once: true });
}
