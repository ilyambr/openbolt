export function getQuizDoc() {
  const candidates = [];
  try { if (window.document?.body) candidates.push(window.document); } catch (_) {}
  for (let i = 0; i < window.frames.length; i++) {
    try {
      if (window.frames[i]?.document?.body) candidates.push(window.frames[i].document);
      for (let j = 0; j < window.frames[i].frames.length; j++) {
        try { if (window.frames[i].frames[j]?.document?.body) candidates.push(window.frames[i].frames[j].document); } catch (_) {}
      }
    } catch (_) {}
  }

  
  for (const doc of candidates) {
    try {
      if (
        doc.querySelector?.('[qid], .Assessment_Main_Body_Content_Question, input[type="radio"], input[type="checkbox"], input[type="text"], textarea') ||
        doc.getElementById?.("submit") ||
        doc.getElementById?.("nextQuestion") ||
        doc.querySelector?.(".plainbtn.alt.icon.yellow.selected, .plainbtn.alt.icon.selected")
      ) {
        return doc;
      }
    } catch (_) {}
  }

  
  return candidates[candidates.length - 1] || null;
}

export function getStageWindow() {
  try {
    return window?.frames?.[0] || window;
  } catch (_) {
    return window;
  }
}

export function isGradedActivity() {
  const probes = [
    () => document?.getElementById("activity-title")?.innerText,
    () => window?.frames?.[0]?.document?.getElementById("activity-title")?.innerText,
    () => document?.querySelector(".activity-title, #activity-title, [class*='activity-title']")?.innerText
  ];
  for (const probe of probes) {
    try {
      const title = probe();
      if (title && typeof title === "string" && title.trim().length > 0) {
        const t = title.toLowerCase();
        if (t.includes("warm-up") || t.includes("instruction") || t.includes("summary") || t.includes("intro") || t.includes("lecture")) {
          return false;
        }
        if (t.includes("assignment") || t.includes("quiz") || t.includes("test") || t.includes("exam") || t.includes("assessment")) {
          return true;
        }
      }
    } catch (_) {}
  }
  return true;
}
