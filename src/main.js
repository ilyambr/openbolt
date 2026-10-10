import { LOG } from "./logger.js";
import { getSetting } from "./config.js";
import { loadLocalDbCache } from "./database.js";
import { setBackgroundMode, initBackgroundModeListener } from "./background.js";
import { runAutoAdvance } from "./autoadvance.js";
import { checkAndAnswerQuestion } from "./solver.js";
import { createUI } from "./ui.js";
import { initApiKeyGrabber } from "./apikey_grabber.js";
import {
  handleAutoInteractive,
  handleAutoVocab,
  handleAutoGuessing,
  handleAutoAssignment,
  handleAutoShowMe,
  handleAutoShow,
  applyAutoHideBlur,
  removeInvisoDiv,
  handleAntiLogout,
  handleAntiHome,
  handleAutoLanguage,
  bypassSpeechRecording,
  handleAutoJournal,
  handleUnquestionedSections
} from "./features.js";

export function init() {
  const host = window.location.hostname.toLowerCase();

  
  if (host.includes("groq.com") || host.includes("cerebras.ai")) {
    initApiKeyGrabber();
    return;
  }

  
  if (host.includes("edgenuity.com")) {
    LOG.info("INIT", "Starting OpenBolt v2.0...");
    loadLocalDbCache();
    createUI();
    initBackgroundModeListener();

    if (getSetting("BackgroundMode")) {
      setBackgroundMode(true);
    }

    if (getSetting("AutoHide")) {
      applyAutoHideBlur();
    }

    
    try {
      if (document.body) {
        new MutationObserver(() => {
          removeInvisoDiv();
          handleAntiLogout();
          handleAutoShow();
          handleAutoShowMe();
          if (getSetting("AutoHide")) applyAutoHideBlur();
        }).observe(document.body, { childList: true, subtree: true });
      }
    } catch (_) {}

    
    handleAntiHome();

    
    setInterval(() => {
      try {
        runAutoAdvance();
        handleAutoInteractive();
        handleAutoVocab();
        handleAutoGuessing();
        handleAutoAssignment();
        handleAutoShowMe();
        handleAutoShow();
        removeInvisoDiv();
        handleAntiLogout();
        handleAntiHome();
        handleAutoLanguage();
        bypassSpeechRecording();
        handleAutoJournal();
        handleUnquestionedSections();
        checkAndAnswerQuestion();
      } catch (err) {
        LOG.warn("LOOP", "Error in monitor loop:", err);
      }
    }, 1000);
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}
