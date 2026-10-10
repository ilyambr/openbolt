import { LOG } from "./logger.js";
import { getSetting, setSetting } from "./config.js";
import { getQuizDoc, isGradedActivity } from "./dom.js";
import { gmFetch } from "./network.js";

let lastInteractiveCheck = 0;
export function handleAutoInteractive() {
  if (!getSetting("AutoInteractive")) return;
  const now = Date.now();
  if (now - lastInteractiveCheck < 1000) return;
  lastInteractiveCheck = now;

  try {
    const previewFrame = window.frames[0]?.document?.getElementById("iFramePreview") || document.getElementById("iFramePreview");
    const interactiveDoc = previewFrame?.contentWindow?.document || previewFrame?.contentDocument;
    const docs = [interactiveDoc, document, window.frames[0]?.document].filter(Boolean);

    for (const d of docs) {
      
      const iframes = d.querySelectorAll("iframe[src*='interactiveFrame']");
      for (const ifr of iframes) {
        if (ifr?.contentWindow?._ifUtils?.completeTask && !ifr._obTaskDone) {
          ifr._obTaskDone = true;
          LOG.success("AUTO-INTERACTIVE", "Interactive activity completed via _ifUtils.completeTask().");
          ifr.contentWindow._ifUtils.completeTask();
          if (getSetting("AutoAdvance")) {
            setTimeout(() => {
              const nextBtn = window.frames[0]?.document?.querySelector(".FrameRight") || document.querySelector(".FrameRight");
              nextBtn?.click();
            }, 1000);
          }
          return;
        }
      }

      
      const taskEl = d.querySelector("[taskid]");
      if (taskEl) {
        const taskId = taskEl.getAttribute("taskid");
        if (taskId && taskEl._obTaskDone !== taskId) {
          taskEl._obTaskDone = taskId;
          LOG.success("AUTO-INTERACTIVE", `Found interactive task [${taskId}], completing via API...`);
          if (window.frames[0]?.API?.Frame?.completeTask) {
            window.frames[0].API.Frame.completeTask(taskId);
          }
          if (getSetting("AutoAdvance")) {
            setTimeout(() => {
              const nextBtn = window.frames[0]?.document?.querySelector(".FrameRight") || document.querySelector(".FrameRight");
              nextBtn?.click();
            }, 1000);
          }
          return;
        }
      }
    }
  } catch (err) {
    LOG.debug("AUTO-INTERACTIVE", "Interactive check error:", err);
  }
}

export function handleAutoVocab() {
  if (!getSetting("AutoVocab")) return;
  try {
    const quizDoc = window?.frames?.[0]?.document || getQuizDoc() || document;
    const wordsContainer = quizDoc?.getElementById("words");
    if (!wordsContainer) return;

    
    const submitWordBtn = quizDoc.querySelector('a[data-bind*="visible:lastWord == currentWord()"][data-bind*="click: submit"], a[data-bind*="click: submit"]');
    if (submitWordBtn && submitWordBtn.style.display !== "none") {
      submitWordBtn.click();
      LOG.info("AUTO-VOCAB", "Clicked submit vocab word.");
    }

    
    const nextWordBtn = quizDoc.querySelector(".uibtn.uibtn-blue.uibtn-arrow-next");
    if (nextWordBtn) {
      nextWordBtn.click();
    }

    
    const bluePlainBtn = quizDoc.querySelector(".plainbtn.alt.blue:not(.selected)");
    if (bluePlainBtn) {
      bluePlainBtn.click();
    }

    const selectedWordBtn = quizDoc.querySelector(".plainbtn.alt.blue.selected");
    if (selectedWordBtn) {
      const vocabWord = selectedWordBtn.innerText.trim();
      const wordInputs = quizDoc.getElementsByClassName("word-textbox");
      if (wordInputs.length > 0 && vocabWord) {
        for (const input of wordInputs) {
          if (input.value !== vocabWord) {
            input.value = vocabWord;
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
            input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, cancelable: true }));
          }
        }
      }
    }

    
    const playButtons = quizDoc.getElementsByClassName("playbutton vocab-play");
    for (const btn of playButtons) {
      if (!btn._obClicked) {
        btn._obClicked = true;
        btn.click();
      }
    }
  } catch (err) {
    LOG.debug("AUTO-VOCAB", err);
  }
}

export function handleAutoGuessing() {
  if (!getSetting("AutoGuessing")) return;
  try {
    const stageDoc = window?.frames?.[0]?.document;
    if (!stageDoc) return;

    
    const submitQuestionsBtn = stageDoc.getElementById("SubmitQuestionsButton");
    const overlayAttemptBtn = stageDoc.querySelector(".overlay-attempt.overlay-attempt-clickable");
    const markReturnEl = stageDoc.querySelector(".mark-return");
    const hasNoInnerIframe = stageDoc.querySelector("iframe") === null;
    const hasNoRemainingQuestions = stageDoc.querySelectorAll("[qid]").length === 0;

    if (!overlayAttemptBtn && !markReturnEl && submitQuestionsBtn && hasNoInnerIframe && hasNoRemainingQuestions) {
      LOG.success("AUTO-GUESS", "All questions answered! Submitting questions...");
      submitQuestionsBtn.click();
      return;
    }

    const mainAreaEl = stageDoc.getElementById("main_area");
    const activityTitleText = document.getElementById("activity-title")?.innerText || "";
    const videoContainer = stageDoc.getElementById("home_video_container");

    if (!mainAreaEl || activityTitleText.includes("Assignment")) return;
    if (videoContainer && videoContainer.parentNode?.style?.opacity == 1) return;

    const questionDoc = window?.frames?.[0]?.frames?.[0]?.document;
    const toolsDoc = window?.frames?.[0]?.frames?.[0]?.frames?.[0]?.document;

    
    const radioInputs = questionDoc?.querySelectorAll('input[type="radio"]:not(:checked)');
    if (radioInputs && radioInputs.length > 0) {
      const randomRadio = radioInputs[Math.floor(Math.random() * radioInputs.length)];
      randomRadio.checked = true;
      randomRadio.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
      randomRadio.dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));
      LOG.info("AUTO-GUESS", "AutoGuessing: selected random radio option.");
    }

    
    const selects = questionDoc?.querySelectorAll("select");
    if (selects) {
      selects.forEach((sel) => {
        if (!sel.classList.contains("disabled") && sel.selectedIndex <= 0) {
          const validOptions = Array.from(sel.options).filter((opt) => opt.value && !opt.innerText.toLowerCase().startsWith("x "));
          if (validOptions.length > 0) {
            const randOpt = validOptions[Math.floor(Math.random() * validOptions.length)];
            sel.value = randOpt.value;
            sel.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }
      });
    }

    
    window?.frames?.[0]?.API?.Frame?.check?.();
    const toolButtons = toolsDoc?.querySelectorAll(".uibtn.toolButton") || stageDoc.querySelectorAll(".uibtn.toolButton");
    toolButtons?.forEach((btn) => {
      if (btn.innerText?.includes("Check")) {
        btn.click();
      }
    });

    
    handleUnquestionedSections();
  } catch (err) {
    LOG.debug("AUTO-GUESS", err);
  }
}

let lastUnquestionedSubmitTime = 0;

export function handleUnquestionedSections() {
  if (!getSetting("AutoGuessing") && !getSetting("AutoLanguage") && !getSetting("AutoAdvance")) return;

  const now = Date.now();
  if (now - lastUnquestionedSubmitTime < 2000) return;

  const allDocs = [];
  try { if (document?.body) allDocs.push(document); } catch (_) {}
  for (let i = 0; i < window.frames.length; i++) {
    try {
      if (window.frames[i]?.document?.body) {
        allDocs.push(window.frames[i].document);
        for (let j = 0; j < window.frames[i].frames.length; j++) {
          try {
            if (window.frames[i].frames[j]?.document?.body) allDocs.push(window.frames[i].frames[j].document);
          } catch (_) {}
        }
      }
    } catch (_) {}
  }

  
  try {
    const iframes = document.querySelectorAll("iframe");
    for (const ifr of iframes) {
      try {
        const d = ifr.contentDocument || ifr.contentWindow?.document;
        if (d && d.body && !allDocs.includes(d)) allDocs.push(d);
      } catch (_) {}
    }
  } catch (_) {}

  for (const doc of allDocs) {
    try {
      
      const radios = doc.querySelectorAll('input[type="radio"]');
      const checkboxes = doc.querySelectorAll('input[type="checkbox"]');
      const emptyTextInputs = Array.from(doc.querySelectorAll('input[type="text"]:not([readonly])')).filter(i => !i.value && i.offsetParent !== null);
      const emptyTextareas = Array.from(doc.querySelectorAll('textarea')).filter(t => !t.value && t.offsetParent !== null && !t.closest("#enotes, .enotes"));

      if (radios.length > 0 || checkboxes.length > 0 || emptyTextInputs.length > 0 || emptyTextareas.length > 0) {
        continue;
      }

      
      const candidates = Array.from(
        doc.querySelectorAll(
          '#SubmitButton, #submit, button[type="submit"], input[type="submit"], input[value="Submit"], button[value="Submit"], .uibtn-blue[value="Submit"], .submit-button, input[value="submit" i], button.submit, input.submit'
        )
      );

      
      const textButtons = Array.from(doc.querySelectorAll('button, a, input[type="button"], div[role="button"], span.uibtn'));
      for (const btn of textButtons) {
        const txt = (btn.innerText || btn.value || "").trim().toUpperCase();
        if (txt === "SUBMIT" || txt === "SUBMIT ANSWER" || txt === "CONTINUE") {
          candidates.push(btn);
        }
      }

      for (const btn of candidates) {
        if (btn.offsetParent !== null && !btn.disabled && !btn.classList.contains("disabled")) {
          if (btn.closest(".mainfoot, .mainhead, .breadcrumbs, #activity-status")) continue;

          lastUnquestionedSubmitTime = now;
          LOG.success("AUTO-GUESS", `Unquestioned section / Advisor slide detected. Clicking Submit button (${btn.tagName})...`);
          btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
          try { btn.click(); } catch (_) {}
          return;
        }
      }
    } catch (_) {}
  }
}

export function handleAutoAssignment() {
  if (!getSetting("AutoAssignment")) return;
  try {
    const qDoc = getQuizDoc();
    const startBtn = qDoc?.querySelector(".done-start") || window?.frames?.[0]?.frames?.[0]?.document?.querySelector(".done-start");
    if (startBtn && startBtn.offsetParent !== null) {
      startBtn.click();
    }

    
    const doneBtns = qDoc?.querySelectorAll(".done-complete, .done-retry") || [];
    doneBtns.forEach((b) => {
      if (b.offsetParent !== null && !b._obDone) {
        b._obDone = true;
        b.click();
      }
    });

    
    const readingPane = qDoc?.querySelector(".reading.pane-blue");
    const textAreas = qDoc?.querySelectorAll(".QuestionTextArea");
    if (readingPane && textAreas && textAreas.length > 0) {
      const sampleText = readingPane.innerText.replace(/sample\s+response:?/i, "").trim();
      if (sampleText) {
        textAreas.forEach((ta) => {
          if (!ta.value || ta.value.length < 5) {
            ta.value = sampleText;
            ta.dispatchEvent(new Event("input", { bubbles: true }));
            ta.dispatchEvent(new Event("change", { bubbles: true }));
          }
        });
        const checkboxes = qDoc.querySelectorAll('input[type="checkbox"]:not(:checked)');
        checkboxes.forEach((cb) => cb.click());
        setTimeout(() => {
          window?.frames?.[0]?.API?.Frame?.check?.();
          window?.frames?.[0]?.API?.FrameChain?.nextFrame?.();
        }, 1500);
      }
    }
  } catch (err) {
    LOG.debug("AUTO-ASSIGNMENT", err);
  }
}

export function handleAutoShowMe() {
  if (!getSetting("AutoShowMe")) return;
  try {
    const activityTitle = document.getElementById("activity-title")?.innerText?.toLowerCase() || "";
    if (!activityTitle.includes("assignment") && !activityTitle.includes("instruction")) return;

    const frameDocs = [
      window?.frames?.[0]?.frames?.[0]?.frames?.[0]?.document,
      window?.frames?.[0]?.frames?.[0]?.document,
      window?.frames?.[0]?.document
    ].filter(Boolean);

    for (const doc of frameDocs) {
      const toolButtons = Array.from(doc.querySelectorAll(".uibtn.toolButton, .uibtn.mathButton"));
      const showMeBtns = toolButtons.filter((btn) => /Demo|Hint|Again|Show/i.test(btn.innerText));
      showMeBtns.forEach((btn) => {
        btn.style.display = "block";
        btn.click();
        LOG.info("AUTOSHOWME", `Unhid and clicked: ${btn.innerText.trim()}`);
      });
    }
  } catch (_) {}
}

export function handleAutoShow() {
  if (!getSetting("AutoShow")) return;
  try {
    const stageDoc = window.frames[0]?.document;
    const homeVideoContainer = stageDoc?.getElementById("home_video_container");
    if (homeVideoContainer && homeVideoContainer.parentNode?.style?.opacity == 1) return;

    const rightColumn = window.frames[0]?.frames?.[0]?.document?.querySelector(".right-column");
    if (rightColumn && rightColumn.children.length >= 2) {
      rightColumn.children[0].style.display = "block";
      rightColumn.children[1].style.display = "block";
    }
  } catch (_) {}
}

const BLUR_SELECTORS = [
  "body > div.mainhead > ul > li:nth-child(3) > a",
  "#profile-nav-dropdown",
  "#maincontent > div > div > div > div > div > div > div > div > div > h2 > a",
  "#header-container > div > nav > li > h1 > div > div",
  "body > div.mainhead > span"
];

export function applyAutoHideBlur() {
  const enabled = getSetting("AutoHide");
  BLUR_SELECTORS.forEach((selector) => {
    document.querySelectorAll(selector).forEach((el) => {
      el.style.filter = enabled ? "blur(5px)" : "";
    });
  });
}

export function removeInvisoDiv() {
  if (!getSetting("AntiDelay")) return;
  try {
    const stageFrame = window.frames[0];
    if (stageFrame) {
      const invisoDiv = stageFrame.document.getElementById("invis-o-div");
      if (invisoDiv) {
        invisoDiv.remove();
        LOG.debug("ANTIDELAY", "Removed invis-o-div click blocking overlay.");
      }
    }
  } catch (_) {}
}

export function handleAntiLogout() {
  if (!getSetting("AntiLogout")) return;
  try {
    const stayBtn = document.getElementById("timerStay");
    if (stayBtn) {
      const style = window.getComputedStyle(stayBtn);
      const isVisible = style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0" && stayBtn.offsetWidth > 0;
      if (isVisible) {
        LOG.info("ANTILOGOUT", "Dismissing inactivity logout dialog...");
        stayBtn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        stayBtn.click();
      }
    }
  } catch (_) {}
}

export function handleAntiHome() {
  const courseEl = document.querySelector(".course");
  if (courseEl && courseEl.innerText) {
    setSetting("course", courseEl.innerText.trim());
  }

  if (!getSetting("AntiHome")) return;
  const href = window.location.href;
  const lastCourse = getSetting("course");

  if (href.includes("/enrollment") && !href.includes("referrer=UserClick")) {
    const cardBodies = document.querySelectorAll(".card-body");
    for (let i = cardBodies.length - 1; i >= 0; i--) {
      const card = cardBodies[i];
      if (card.textContent?.includes("Next Activity")) {
        LOG.info("ANTI-HOME", `Clicking Next Activity on enrollment page...`);
        card.click();
        return;
      }
    }
  }

  if (!href.includes("/enrollment") && lastCourse) {
    const studentCards = document.querySelectorAll(".sle-card.card");
    studentCards.forEach((card) => {
      if (card.innerText?.includes(lastCourse)) {
        const nextBtn = card.querySelector('[title="Next Activity"], [aria-label*="Next Activity"]');
        if (nextBtn) {
          LOG.info("ANTI-HOME", `Found student card for ${lastCourse}, navigating to Next Activity...`);
          nextBtn.click();
        }
      }
    });
  }
}

let isAutoLanguageSubmitting = false;
export async function handleAutoLanguage() {
  if (!getSetting("AutoLanguage")) return;
  try {
    const soundBlocker = document.querySelectorAll(".App__container__soundBlocker button");
    const continueBtns = document.querySelectorAll(".CompleteWindow__continue");
    if (soundBlocker.length > 0 || continueBtns.length > 0) {
      soundBlocker.forEach((b) => b.dispatchEvent(new MouseEvent("click", { bubbles: true })));
      setTimeout(() => {
        continueBtns.forEach((b) => b.dispatchEvent(new MouseEvent("click", { bubbles: true })));
      }, 1000);
    }

    
    if (isAutoLanguageSubmitting) return;

    const allDocs = [
      document,
      window.frames[0]?.document,
      document.getElementById("stageFrame")?.contentDocument,
      document.getElementById("ps-frame")?.contentDocument
    ].filter(Boolean);

    for (const d of allDocs) {
      const submitBtn = d.getElementById("SubmitButton") || d.querySelector('input[value="Submit"], button[value="Submit"], .uibtn-blue[value="Submit"]');
      if (submitBtn && submitBtn.offsetParent !== null && !submitBtn.disabled) {
        isAutoLanguageSubmitting = true;
        LOG.success("AUTO-LANG", "Found Powerspeak SubmitButton. Submitting language slide...");
        setTimeout(() => {
          submitBtn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
          try { submitBtn.click(); } catch (_) {}
          isAutoLanguageSubmitting = false;
        }, 800);
        return;
      }
    }
  } catch (_) {
    isAutoLanguageSubmitting = false;
  }
}

export async function bypassSpeechRecording() {
  if (!getSetting("AntiSpeaking")) return;
  try {
    const stageFrame = document.getElementById("stageFrame");
    const psFrameSrc = stageFrame?.contentDocument?.getElementById("ps-frame")?.src || "";
    if (!psFrameSrc.includes("Audio_Recording&file_name=audio")) return;

    const powerspeakForm = stageFrame?.contentDocument?.getElementById("ps-form");
    if (!powerspeakForm) return;

    const tokenKey = powerspeakForm.querySelector("#Key")?.value;
    if (!tokenKey) return;

    const storeUrl = `${window.origin}/ContentViewers/Powerspeak/StoreResponse?token=${tokenKey}`;
    LOG.info("ANTI-SPEAKING", "Bypassing speech recording with dummy audio response token...");
    await fetch(storeUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: '<data answer="audio/n" server="//media.powerspeak.edgenuity.com" url="//media.powerspeak.edgenuity.com/audio/audio.mp3"/>'
    });

    const submitBtn = stageFrame.contentDocument.getElementById("SubmitButton");
    if (submitBtn) {
      LOG.success("ANTI-SPEAKING", "Submitted speech recording dummy response!");
      submitBtn.click();
    }
  } catch (err) {
    LOG.debug("ANTI-SPEAKING", err);
  }
}

export function shouldMissQuestion(questionIndex) {
  const rangeStr = String(getSetting("Range") || "100").trim();
  if (rangeStr === "100") return false;

  let min = 100;
  let max = 100;
  if (rangeStr.includes("-")) {
    const parts = rangeStr.split("-").map(Number);
    min = parts[0] || 80;
    max = parts[1] || 100;
  } else {
    min = Number(rangeStr) || 100;
    max = 100;
  }

  
  let missedScores = getSetting("SingleScore");
  if (!missedScores) {
    const targetScore = Math.floor(Math.random() * (max - min + 1)) + min;
    const numMissed = Math.round(10 - (targetScore / 10));
    const missedSet = new Set();
    while (missedSet.size < numMissed) {
      missedSet.add(Math.floor(Math.random() * 10));
    }
    missedScores = Array.from(missedSet).join(",");
    setSetting("SingleScore", missedScores);
  }

  const missedList = missedScores.split(",").map(Number);
  const qNum = Number(questionIndex);
  return missedList.includes(qNum % 10);
}

let isJournalSubmitting = false;

function findPromptText() {
  const selectors = [
    '#essay-prompt-content',
    '#essay-prompt',
    '.essay-prompt',
    '.prompt-content',
    '#prompt-content',
    '.prompt-container',
    '.journal-prompt',
    '.question-text',
    '.instruction-text'
  ];

  
  const docs = [document];
  for (let f = 0; f < window.frames.length; f++) {
    try {
      if (window.frames[f].document) docs.push(window.frames[f].document);
    } catch (_) {}
  }

  for (const d of docs) {
    for (const sel of selectors) {
      try {
        const el = d.querySelector(sel);
        if (el && el.innerText?.trim().length > 10) {
          return el.innerText.trim();
        }
      } catch (_) {}
    }
  }
  return "";
}

export async function handleAutoJournal() {
  if (!getSetting("AutoJournal") || isJournalSubmitting) return;

  try {
    const docs = [document];
    for (let f = 0; f < window.frames.length; f++) {
      try {
        if (window.frames[f].document) docs.push(window.frames[f].document);
      } catch (_) {}
    }

    let targetBox = null;
    let targetDoc = null;

    for (const d of docs) {
      const boxes = d.querySelectorAll('textarea, [contenteditable="true"], .cke_editable, .essay-textArea, [class*="journal-textArea"]');
      for (const b of boxes) {
        if (b.offsetParent !== null && !b.closest?.("#enotes, .enotes")) {
          targetBox = b;
          targetDoc = d;
          break;
        }
      }
      if (targetBox) break;
    }

    if (!targetBox) return;

    const currentText = (targetBox.innerText || targetBox.value || "").trim();
    if (currentText.length > 30) return; 

    
    if (getSetting("AutoGuessing") && !isGradedActivity()) {
      LOG.info("AUTO-JOURNAL", "Non-graded activity detected. Submitting safe reflection...");
      const reflections = [
        "I understand the concepts explained in this activity.",
        "This lesson helped clarify the core principles of the topic.",
        "The examples provided demonstrate how this concept works in practice."
      ];
      const thought = reflections[Math.floor(Math.random() * reflections.length)];
      if (targetBox.tagName === "TEXTAREA" || targetBox.tagName === "INPUT") {
        targetBox.value = thought;
      } else {
        targetBox.innerText = thought;
      }
      targetBox.dispatchEvent(new Event("input", { bubbles: true }));
      targetBox.dispatchEvent(new Event("change", { bubbles: true }));

      setTimeout(() => {
        const subBtn = targetDoc?.querySelector('input[value="Submit"], button[value="Submit"], .uibtn-blue[value="Submit"]');
        subBtn?.click();
      }, 500);
      return;
    }

    
    const apiKey = getSetting("APIKey");
    if (!apiKey) return;

    const promptText = findPromptText();
    if (!promptText || promptText.length < 10) return;

    isJournalSubmitting = true;
    LOG.info("AUTO-JOURNAL", `Generating response for prompt: "${promptText.slice(0, 60)}..."`);

    const aiRes = await gmFetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: getSetting("AIModel") || "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "You are a high school student writing a thoughtful, clear response for an online assignment. Answer directly, stay on topic, and meet standard essay/journal requirements (100-150 words). Do not use AI preambles."
          },
          {
            role: "user",
            content: promptText
          }
        ],
        temperature: 0.7,
        max_tokens: 300
      })
    });

    if (aiRes.ok) {
      const data = await aiRes.json();
      const answer = data?.choices?.[0]?.message?.content?.trim();
      if (answer) {
        if (targetBox.tagName === "TEXTAREA" || targetBox.tagName === "INPUT") {
          targetBox.value = answer;
        } else {
          targetBox.innerText = answer;
        }
        targetBox.dispatchEvent(new Event("input", { bubbles: true }));
        targetBox.dispatchEvent(new Event("change", { bubbles: true }));
        LOG.success("AUTO-JOURNAL", "Filled AI generated journal response!");

        setTimeout(() => {
          const subBtn = targetDoc?.querySelector('input[value="Submit"], button[value="Submit"], .uibtn-blue[value="Submit"]');
          subBtn?.click();
        }, 1500);
      }
    }
  } catch (err) {
    LOG.error("AUTO-JOURNAL", "Error generating journal:", err);
  } finally {
    isJournalSubmitting = false;
  }
}
