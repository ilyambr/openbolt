import { LOG } from "./logger.js";
import { getSetting } from "./config.js";
import { getQuizDoc, getStageWindow } from "./dom.js";

let lastActivityAdvanceTime = 0;
let lastSlideAdvanceTime = 0;
let lastInteractiveAdvanceTime = 0;

export function clickAllCompleteButtons() {
  const quizDoc = getQuizDoc();
  const stageDoc = window?.frames?.[0]?.document;
  const allDocs = [quizDoc, stageDoc, document].filter(Boolean);

  let clickedCount = 0;
  for (const doc of allDocs) {
    try {
      
      const selectorBtns = Array.from(
        doc.querySelectorAll?.(
          "button.done-complete, a.done-complete, input.done-complete, .btn-complete, [title='done'].done-complete"
        ) || []
      );

      
      const textBtns = Array.from(
        doc.querySelectorAll?.("button, a.uibtn, a.btn, input[type='button']") || []
      ).filter((el) => {
        if (!el.offsetParent) return false;
        if (el.closest?.(".mainfoot, .mainhead, .breadcrumbs, .gradebar-wrap, .banner, .header, #activity-status")) return false;
        const txt = (el.innerText || el.value || "").trim().toUpperCase();
        return txt === "COMPLETE";
      });

      const combined = [...new Set([...selectorBtns, ...textBtns])];
      for (const btn of combined) {
        if (btn.offsetParent !== null && !btn.classList?.contains("disabled") && !btn.hasAttribute("data-ob-clicked")) {
          btn.setAttribute("data-ob-clicked", "true");
          btn.click();
          clickedCount++;
          LOG.success("AUTO-ADVANCE", "Clicked question 'COMPLETE' review button.");
        }
      }
    } catch (_) {}
  }
  return clickedCount;
}

function clickNextActivityButton() {
  
  const footNav = document.querySelector(".footnav.goRight:not(.disabled)");
  if (footNav) { footNav.click(); return true; }

  
  const titleBtn = document.querySelector("[title*='Next Activity' i]:not(.disabled), [aria-label*='Next Activity' i]:not(.disabled)");
  if (titleBtn) { titleBtn.click(); return true; }

  
  const allBtns = Array.from(document.querySelectorAll("button:not(.disabled), a:not(.disabled), .btn:not(.disabled), .button:not(.disabled)"));
  const textBtn = allBtns.find(b => b.textContent && b.textContent.trim().toLowerCase().includes("next activity"));
  if (textBtn) { textBtn.click(); return true; }

  
  try {
    const sDoc = window?.frames?.[0]?.document;
    if (sDoc) {
      const sFoot = sDoc.querySelector(".footnav.goRight:not(.disabled), [title*='Next Activity' i]:not(.disabled)");
      if (sFoot) { sFoot.click(); return true; }
      const sBtns = Array.from(sDoc.querySelectorAll("button:not(.disabled), a:not(.disabled), .btn:not(.disabled), .button:not(.disabled)"));
      const sText = sBtns.find(b => b.textContent && b.textContent.trim().toLowerCase().includes("next activity"));
      if (sText) { sText.click(); return true; }
    }
  } catch (_) {}

  return false;
}

export function runAutoAdvance() {
  if (!getSetting("AutoAdvance")) return;
  const now = Date.now();
  const advanceDelayMs = Math.max(500, (Number(getSetting("AdvanceDelay")) || 2) * 1000);

  
  const readyNextActivity =
    document.querySelector(".footnav.goRight:not(.disabled), [title*='Next Activity' i]:not(.disabled)") ||
    window?.frames?.[0]?.document?.querySelector(".footnav.goRight:not(.disabled), [title*='Next Activity' i]:not(.disabled)");

  if (readyNextActivity) {
    if (now - lastActivityAdvanceTime > 2000) {
      lastActivityAdvanceTime = now;
      LOG.success("AUTO-ADVANCE", "Next Activity button is active! Advancing to next activity...");
      readyNextActivity.click();
      return;
    }
  }

  
  clickAllCompleteButtons();

  
  const stageDoc = window?.frames?.[0]?.document;
  const overlayAttemptBtn = stageDoc?.querySelector(".overlay-attempt.overlay-attempt-clickable, .overlay-attempt-retake, [title*='Retake'], [title*='Begin']");
  if (overlayAttemptBtn) {
    if (getSetting("AutoExam")) {
      LOG.info("AUTO-ADVANCE", "AutoExam active: Clicking attempt overlay / retake button...");
      overlayAttemptBtn.click();
    }
    return;
  }

  
  const isAntiDelay = getSetting("AntiDelay");
  const markReturnEl = stageDoc?.querySelector(".mark-return");
  if (!isAntiDelay && markReturnEl) {
    
    return;
  }

  
  const stageWin = window?.frames?.[0];
  const video = stageDoc?.querySelector("video");
  const playBtn = stageDoc?.querySelector("#uid1_play.play, .play, [title*='Play']");
  const isVideoEnded = video
    ? (video.ended || (video.duration > 0 && Math.abs(video.duration - video.currentTime) < 0.8))
    : false;

  const frameChain = stageWin?.API?.FrameChain;
  const frameApi = stageWin?.API?.Frame;

  
  const isFrameApiComplete =
    frameApi?.isComplete?.() === true ||
    (frameChain?.framesStatus &&
      frameChain?.currentFrame !== undefined &&
      frameChain.framesStatus[frameChain.currentFrame] === "complete");

  
  if (video && video.paused && !video.ended) {
    try { video.muted = true; } catch (_) {}
    try { video.play().catch(() => {}); } catch (_) {}
    playBtn?.click();
  }

  
  const progressEl = stageDoc?.getElementById("frameProgress");
  const progressText = progressEl?.innerText?.trim() || "";
  const progressMatch = progressText.match(/(\d+)\s*(?:of|\/)\s*(\d+)/i);
  let currentSlideNum = 0;
  let totalSlidesNum = 0;
  let isLastSlide = false;

  if (progressMatch) {
    currentSlideNum = parseInt(progressMatch[1], 10);
    totalSlidesNum = parseInt(progressMatch[2], 10);
    isLastSlide = totalSlidesNum > 0 && currentSlideNum >= totalSlidesNum;
  } else if (frameChain?.framesProgressIds?.length) {
    totalSlidesNum = frameChain.framesProgressIds.length;
    currentSlideNum = (frameChain.currentFrame ?? 0) + 1;
    isLastSlide = totalSlidesNum > 0 && currentSlideNum >= totalSlidesNum;
  } else if (frameChain?.serverComplete === true) {
    isLastSlide = true;
  }

  
  if (!isLastSlide && (isVideoEnded || isFrameApiComplete)) {
    const frameRight = stageDoc?.querySelector(".FrameRight");
    if (frameRight && !frameRight.classList.contains("disabled")) {
      if (now - lastSlideAdvanceTime > advanceDelayMs) {
        lastSlideAdvanceTime = now;
        LOG.success("AUTO-ADVANCE", `Slide complete (${progressText || `${currentSlideNum} of ${totalSlidesNum}`}). Advancing to next slide...`);
        try {
          if (frameChain?.nextFrame) {
            frameChain.nextFrame();
          } else {
            frameRight.click();
          }
        } catch (_) {
          frameRight.click();
        }
        return;
      }
    }
  }

  
  const isServerComplete = frameChain?.serverComplete === true;
  const isActivityCompleteStatus = isServerComplete || (isLastSlide && (isVideoEnded || isFrameApiComplete)) || !!readyNextActivity;

  if (isActivityCompleteStatus && isLastSlide) {
    if (now - lastActivityAdvanceTime > 2500) {
      lastActivityAdvanceTime = now;
      const didClick = clickNextActivityButton();
      if (didClick) {
        LOG.success("AUTO-ADVANCE", `Activity complete (${progressText || "all slides completed"}). Advancing to Next Activity...`);
        return;
      } else {
        const moreComplete = clickAllCompleteButtons();
        if (moreComplete > 0) {
          LOG.info("AUTO-ADVANCE", `Clicked ${moreComplete} 'COMPLETE' button(s) before advancing to Next Activity.`);
          return;
        }
      }
    }
  }

  
  try {
    const subDoc = window?.frames?.[0]?.frames?.[0]?.document;
    const doneItems = subDoc?.querySelectorAll('[title="done"]');
    if (doneItems && doneItems.length > 0 && Array.from(doneItems).every(item => item.classList.contains("done-complete"))) {
      if (now - lastSlideAdvanceTime > advanceDelayMs) {
        lastSlideAdvanceTime = now;
        LOG.info("AUTO-ADVANCE", "All section items completed. Advancing to next slide (.FrameRight)...");
        stageDoc?.querySelector(".FrameRight")?.click();
        return;
      }
    }
  } catch (_) {}

  
  const iFramePrev = stageDoc?.getElementById("iFramePreview");
  if (iFramePrev) {
    const taskEl = iFramePrev?.contentWindow?.document?.querySelector?.("[taskid]");
    if (taskEl && taskEl._obTaskDone) {
      const frameRightBtn = stageDoc?.querySelector?.(".FrameRight");
      if (frameRightBtn && !frameRightBtn.classList.contains("disabled")) {
        if (now - lastInteractiveAdvanceTime > 3000) {
          lastInteractiveAdvanceTime = now;
          LOG.info("AUTO-ADVANCE", "Interactive task completed. Advancing to next slide (.FrameRight)...");
          frameRightBtn.click();
          return;
        }
      }
    }
  }
}
