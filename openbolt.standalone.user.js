// ==UserScript==
// @name         OpenBolt
// @version      2.0.0
// @description  Free and open-source Edgenuity companion: AutoAdvance, WebAudio Background Mode, Offline Answer Database, and AI Solver.
// @namespace    https://github.com/ilyambr/openbolt
// @author       ilyambr
// @license      MIT
// @match        *://*.edgenuity.com/*
// @include      *://*.edgenuity.com/*
// @include      *://*groq.com*/*
// @include      *://*cerebras.ai*/*
// @connect      gist.githubusercontent.com
// @connect      api.groq.com
// @connect      api.cerebras.ai
// @connect      openrouter.ai
// @connect      githubusercontent.com
// @connect      raw.githubusercontent.com
// @connect      *
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_openInTab
// @grant        window.close
// @grant        GM_xmlhttpRequest
// @grant        GM_addValueChangeListener
// @grant        unsafeWindow
// @grant        window.focus
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  // --- Module: config.js ---
const DEFAULTS = {
  AutoAdvance: true,
  AdvanceDelay: 2,
  AutoExam: true,
  AutoAssignment: true,
  AutoAnswer: true,
  AnswerDelay: 2,
  AutoInteractive: true,
  AutoVocab: true,
  AutoGuessing: true,
  AutoShowMe: true,
  AutoShow: true,
  AutoHide: false,
  AntiDelay: true,
  AntiLogout: true,
  AntiHome: true,
  AutoLanguage: true,
  AntiSpeaking: true,
  BackgroundMode: true,
  AutoJournal: true,
  AutoReload: false,
  AutoNotify: false,
  AutoHalt: false,
  Range: "100",
  MuteMedia: false,
  AiFallback: true,
  AIProvider: "groq", 
  AIModel: "llama-3.3-70b-versatile",
  APIKey: "",
  DbUrl: ""
};
function getSetting(key) {
  if (typeof GM_getValue !== "undefined") {
    const val = GM_getValue(key);
    if (val !== undefined && val !== null) return val;
  }
  try {
    const raw = localStorage.getItem(key) ?? localStorage.getItem(`ob_${key}`);
    if (raw !== null) {
      if (raw === "true") return true;
      if (raw === "false") return false;
      try { return JSON.parse(raw); } catch (_) { return raw; }
    }
  } catch (_) {}
  return DEFAULTS[key];
}
function setSetting(key, val) {
  if (typeof GM_setValue !== "undefined") {
    GM_setValue(key, val);
  }
  try {
    localStorage.setItem(key, String(val));
    localStorage.setItem(`ob_${key}`, JSON.stringify(val));
  } catch (_) {}
}

  // --- Module: logger.js ---
const LOG = {
  info: (tag, ...args) => console.log(`%c[OpenBolt][${tag}]`, "color: #3b82f6; font-weight: bold;", ...args),
  success: (tag, ...args) => console.log(`%c[OpenBolt][${tag}]`, "color: #10b981; font-weight: bold;", ...args),
  warn: (tag, ...args) => console.warn(`%c[OpenBolt][${tag}]`, "color: #f59e0b; font-weight: bold;", ...args),
  error: (tag, ...args) => console.error(`%c[OpenBolt][${tag}]`, "color: #ef4444; font-weight: bold;", ...args)
};

  // --- Module: network.js ---
function gmFetch(url, opts = {}) {
  return new Promise((resolve, reject) => {
    if (typeof GM_xmlhttpRequest === "undefined") {
      return fetch(url, opts).then(resolve, reject);
    }
    GM_xmlhttpRequest({
      method: opts.method || "GET",
      url: url,
      headers: opts.headers || {},
      data: opts.body || null,
      timeout: opts.timeout || 30000,
      onload: (res) => {
        resolve({
          ok: res.status >= 200 && res.status < 300,
          status: res.status,
          statusText: res.statusText,
          text: () => Promise.resolve(res.responseText),
          json: () => Promise.resolve(JSON.parse(res.responseText))
        });
      },
      onerror: reject,
      ontimeout: () => reject(new Error("Request timed out"))
    });
  });
}

  // --- Module: apikey_grabber.js ---
function requestApiKeyTab(provider = "groq") {
  const url = provider === "cerebras" ? "https://cloud.cerebras.ai/" : "https://console.groq.com/keys";
  LOG.info("CONFIG", `Opening ${provider.toUpperCase()} Console to automatically grab a free API key...`);
  if (typeof GM_openInTab !== "undefined") {
    GM_openInTab(url, { active: true, insert: true });
  } else {
    window.open(url, "_blank");
  }
}
function initApiKeyGrabber() {
  const host = window.location.hostname.toLowerCase();
  if (!host.includes("groq.com") && !host.includes("cerebras.ai")) return;

  LOG.info("KEY-GRABBER", `Key grabber active on ${host}...`);

  function saveFoundKey(rawKey) {
    if (!rawKey || typeof rawKey !== "string") return false;

    
    const groqMatch = rawKey.match(/gsk_[a-zA-Z0-9]{30,}/);
    const cerebrasMatch = rawKey.match(/csk-[a-zA-Z0-9]{20,}/);

    const fullKey = groqMatch ? groqMatch[0] : (cerebrasMatch ? cerebrasMatch[0] : null);
    if (fullKey) {
      const provider = groqMatch ? "groq" : "cerebras";
      LOG.success("KEY-GRABBER", `Detected ${provider.toUpperCase()} API key: ${fullKey.slice(0, 7)}...${fullKey.slice(-4)}`);
      GM_setValue("APIKey", fullKey);
      GM_setValue("AIProvider", provider);
      LOG.success("KEY-GRABBER", "API key saved! Closing tab in 1 second...");
      setTimeout(() => {
        try { window.close(); } catch (_) {}
      }, 1000);
      return true;
    }
    return false;
  }

  
  if (navigator.clipboard && navigator.clipboard.writeText) {
    const origWrite = navigator.clipboard.writeText.bind(navigator.clipboard);
    navigator.clipboard.writeText = function (text) {
      saveFoundKey(text);
      return origWrite(text);
    };
  }

  
  function scanDom() {
    const els = Array.from(document.querySelectorAll("input, textarea, code, pre, span, div, p"));
    for (const el of els) {
      const val = el.value || el.innerText || el.textContent || "";
      if (val.includes("gsk_") || val.includes("csk-")) {
        if (saveFoundKey(val)) return true;
      }
    }
    return false;
  }

  
  if (scanDom()) return;

  
  const observer = new MutationObserver(() => {
    if (scanDom()) observer.disconnect();
  });
  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });

  
  setTimeout(() => {
    const btns = Array.from(document.querySelectorAll("button, a"));
    const copyBtn = btns.find(b => {
      const t = (b.innerText || b.textContent || "").toLowerCase().trim();
      return t.includes("copy") || t.includes("copy key");
    });
    if (copyBtn) copyBtn.click();
  }, 2000);
}

  // --- Module: dom.js ---
function getQuizDoc() {
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
function getStageWindow() {
  try {
    return window?.frames?.[0] || window;
  } catch (_) {
    return window;
  }
}
function isGradedActivity() {
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

  // --- Module: background.js ---
let audioCtx = null;
let audioOsc = null;
let audioGain = null;
function setBackgroundMode(enable) {
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
function initBackgroundModeListener() {
  window.addEventListener("click", () => {
    if (getSetting("BackgroundMode") && (!audioCtx || audioCtx.state === "suspended")) {
      setBackgroundMode(true);
    }
  }, { once: true });
}

  // --- Module: database.js ---
const DEFAULT_GIST_PARTS = [
  "https://gist.githubusercontent.com/ilyambr/69cad1dc9d06afbda9c2609191095cac/raw/edgenuity_db_part1.json",
  "https://gist.githubusercontent.com/ilyambr/69cad1dc9d06afbda9c2609191095cac/raw/edgenuity_db_part2.json",
  "https://gist.githubusercontent.com/ilyambr/69cad1dc9d06afbda9c2609191095cac/raw/edgenuity_db_part3.json"
];
const dbState = {
  isReady: false,
  isLoading: false,
  answers: new Map(),
  idSet: new Set()
};

let onStatusChangeCallback = null;
function registerDbStatusCallback(cb) {
  onStatusChangeCallback = cb;
}

function notifyStatus(msg) {
  if (onStatusChangeCallback) onStatusChangeCallback(msg);
}

function yieldToEventLoop(ms = 10) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getIDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB not available"));
    const req = indexedDB.open("OpenBoltDB", 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("chunks");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  try {
    const db = await getIDB();
    return new Promise((resolve) => {
      const tx = db.transaction("chunks", "readonly");
      const store = tx.objectStore("chunks");
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (_) {
    return null;
  }
}

async function idbSet(key, val) {
  try {
    const db = await getIDB();
    return new Promise((resolve) => {
      const tx = db.transaction("chunks", "readwrite");
      const store = tx.objectStore("chunks");
      store.put(val, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (_) {
    return false;
  }
}

async function ingestChunk(data) {
  if (!data) return;

  
  if (data.answers) {
    for (const [k, v] of Object.entries(data.answers)) {
      dbState.answers.set(k, v);
    }
  }

  
  if (data.ids && Array.isArray(data.ids)) {
    const ids = data.ids;
    const batchSize = 15000;
    for (let i = 0; i < ids.length; i += batchSize) {
      const end = Math.min(i + batchSize, ids.length);
      for (let j = i; j < end; j++) {
        dbState.idSet.add(ids[j]);
      }
      
      await yieldToEventLoop(8);
    }
  }
}
async function loadLocalDbCache() {
  
  try {
    const topApi = window?.top?.OpenBolt;
    if (topApi && topApi.isReady && topApi.dbState?.idSet?.size > 0) {
      dbState.idSet = topApi.dbState.idSet;
      dbState.answers = topApi.dbState.answers;
      dbState.isReady = true;
      dbState.isLoading = false;
      LOG.info("DB", `Child frame: inherited ${dbState.idSet.size.toLocaleString()} IDs from top window.`);
      notifyStatus();
      return;
    }
  } catch (_) {}

  
  try {
    const p1 = await idbGet("chunk_1");
    const p2 = await idbGet("chunk_2");
    const p3 = await idbGet("chunk_3");

    if (p1 && p2 && p3) {
      LOG.info("DB", "Found cached database in IndexedDB. Loading asynchronously without freeze...");
      notifyStatus("Loading cached DB...");
      dbState.isLoading = true;

      await ingestChunk(p1);
      await ingestChunk(p2);
      await ingestChunk(p3);

      dbState.isReady = true;
      dbState.isLoading = false;
      LOG.success("DB", `Loaded ${dbState.idSet.size.toLocaleString()} IDs and ${dbState.answers.size.toLocaleString()} answers smoothly!`);
      
      
      try {
        const api = { dbState, isReady: true };
        window.OpenBolt = api;
        if (typeof unsafeWindow !== "undefined") unsafeWindow.OpenBolt = api;
        if (window.top) window.top.OpenBolt = api;
      } catch (_) {}

      notifyStatus();
      return;
    }
  } catch (e) {
    LOG.warn("DB", "Error reading IndexedDB cache:", e);
  }

  
  if (window.top === window.self) {
    LOG.info("DB", "No local cache found. Starting automatic background download of 393k database...");
    setTimeout(() => {
      downloadGistDatabase();
    }, 1000);
  }
}
async function downloadGistDatabase() {
  if (dbState.isLoading) return;
  try {
    dbState.isLoading = true;
    notifyStatus("Downloading DB (0/3)...");
    LOG.info("DB-DL", "Starting smooth background download of 3 database parts from Gist...");

    for (let i = 0; i < DEFAULT_GIST_PARTS.length; i++) {
      const url = DEFAULT_GIST_PARTS[i];
      const partNum = i + 1;
      notifyStatus(`Downloading DB part ${partNum}/3...`);
      LOG.info("DB-DL", `[Part ${partNum}/3] Fetching ${url}...`);

      const resp = await gmFetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status} downloading part ${partNum}`);
      const data = await resp.json();

      
      notifyStatus(`Indexing DB part ${partNum}/3...`);
      await ingestChunk(data);

      
      await idbSet(`chunk_${partNum}`, data);

      LOG.success("DB-DL", `[Part ${partNum}/3] Ingested & cached smoothly! Total so far: ${dbState.idSet.size.toLocaleString()} IDs`);
      await yieldToEventLoop(16);
    }

    dbState.isReady = true;
    dbState.isLoading = false;
    LOG.success("DB-DL", `All 3 database parts ready! ${dbState.idSet.size.toLocaleString()} IDs, ${dbState.answers.size.toLocaleString()} answers.`);
    notifyStatus();
    return true;
  } catch (err) {
    dbState.isLoading = false;
    LOG.error("DB-DL", "Failed downloading Gist database:", err);
    notifyStatus("DB download failed");
    return false;
  }
}
async function importDbJson(jsonData) {
  try {
    dbState.isLoading = true;
    notifyStatus("Importing database...");
    const parsed = typeof jsonData === "string" ? JSON.parse(jsonData) : jsonData;

    await ingestChunk(parsed);
    await idbSet("chunk_custom", parsed);

    dbState.isReady = dbState.idSet.size > 0 || dbState.answers.size > 0;
    dbState.isLoading = false;
    LOG.success("DB", `Database imported! ${dbState.idSet.size.toLocaleString()} IDs, ${dbState.answers.size.toLocaleString()} answers.`);
    notifyStatus();
    return true;
  } catch (err) {
    dbState.isLoading = false;
    LOG.error("DB", "Failed to import JSON database:", err);
    notifyStatus("Import failed");
    return false;
  }
}

  // --- Module: features.js ---
let lastInteractiveCheck = 0;
function handleAutoInteractive() {
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
function handleAutoVocab() {
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
function handleAutoGuessing() {
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
function handleUnquestionedSections() {
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
function handleAutoAssignment() {
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
function handleAutoShowMe() {
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
function handleAutoShow() {
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
function applyAutoHideBlur() {
  const enabled = getSetting("AutoHide");
  BLUR_SELECTORS.forEach((selector) => {
    document.querySelectorAll(selector).forEach((el) => {
      el.style.filter = enabled ? "blur(5px)" : "";
    });
  });
}
function removeInvisoDiv() {
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
function handleAntiLogout() {
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
function handleAntiHome() {
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
async function handleAutoLanguage() {
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
async function bypassSpeechRecording() {
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
function shouldMissQuestion(questionIndex) {
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
async function handleAutoJournal() {
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

  // --- Module: autoadvance.js ---
let lastActivityAdvanceTime = 0;
let lastSlideAdvanceTime = 0;
let lastInteractiveAdvanceTime = 0;
function clickAllCompleteButtons() {
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
function runAutoAdvance() {
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

  // --- Module: solver.js ---
let isSolvingQuestion = false;
let lastAnsweredQuestionText = "";
let lastAiAttemptTime = 0;
async function checkAndAnswerQuestion() {
  if (!getSetting("AutoAnswer") || isSolvingQuestion) return;
  const qDoc = getQuizDoc();
  if (!qDoc) return;

  
  if (!getSetting("AntiDelay") && qDoc.querySelector(".mark-return")) return;

  const currentBtn = qDoc.querySelector(".plainbtn.alt.icon.yellow.selected, .plainbtn.alt.icon.selected");
  const currentQNumStr = currentBtn?.innerText?.replace(/\D/g, "")?.slice(-1) || "1";
  const qIndex = currentBtn ? (parseInt(currentBtn.innerText, 10) - 1) : 0;
  const missThis = shouldMissQuestion(qIndex);

  let matched = false;

  
  if (dbState.isReady) {
    
    const radios = qDoc.querySelectorAll('input[type="radio"]');
    if (radios.length > 0) {
      if (missThis) {
        const wrongRadios = Array.from(radios).filter(r => !r.id || !dbState.idSet.has(r.id));
        if (wrongRadios.length > 0) {
          const r = wrongRadios[Math.floor(Math.random() * wrongRadios.length)];
          r.checked = true;
          r.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
          if (!r.checked) r.dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));
          matched = true;
          LOG.info("RANGE", `Intentionally selected wrong radio on question #${qIndex + 1}`);
        }
      } else {
        radios.forEach(r => {
          if (r.id && dbState.idSet.has(r.id) && !r.checked) {
            r.checked = true;
            r.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
            if (!r.checked) r.dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));
            matched = true;
            LOG.success("SOLVER-DB", `Selected matching radio: ${r.id}`);
          }
        });
      }
    }

    
    const checkboxes = qDoc.querySelectorAll('input[type="checkbox"]');
    if (checkboxes.length > 0) {
      if (missThis) {
        const wrongCbs = Array.from(checkboxes).filter(cb => !cb.id || !dbState.idSet.has(cb.id));
        if (wrongCbs.length > 0) {
          const cb = wrongCbs[Math.floor(Math.random() * wrongCbs.length)];
          cb.checked = true;
          cb.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
          if (!cb.checked) cb.dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));
          matched = true;
        }
      } else {
        checkboxes.forEach(cb => {
          if (cb.id && dbState.idSet.has(cb.id) && !cb.checked) {
            cb.checked = true;
            cb.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
            if (!cb.checked) cb.dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));
            matched = true;
            LOG.success("SOLVER-DB", `Selected matching checkbox: ${cb.id}`);
          }
        });
      }
    }

    
    const selects = qDoc.querySelectorAll("select");
    if (selects.length > 0) {
      if (missThis) {
        const wrongSelects = Array.from(selects).filter(sel => Array.from(sel.options).some(opt => !opt.id || !dbState.idSet.has(opt.id)));
        if (wrongSelects.length > 0) {
          const sel = wrongSelects[Math.floor(Math.random() * wrongSelects.length)];
          const wrongOpts = Array.from(sel.options).filter(opt => !opt.id || !dbState.idSet.has(opt.id));
          if (wrongOpts.length > 0) {
            const opt = wrongOpts[Math.floor(Math.random() * wrongOpts.length)];
            sel.value = opt.value;
            sel.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
            matched = true;
          }
        }
      } else {
        selects.forEach(sel => {
          Array.from(sel.options).forEach(opt => {
            if (opt.id && dbState.idSet.has(opt.id) && sel.value !== opt.value) {
              sel.value = opt.value;
              sel.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
              matched = true;
              LOG.success("SOLVER-DB", `Selected dropdown option: ${opt.value}`);
            }
          });
        });
      }
    }

    
    const textInputs = qDoc.querySelectorAll('input[type="text"]');
    if (textInputs.length > 0) {
      textInputs.forEach(txt => {
        if (missThis) {
          txt.value = "1";
          txt.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
          matched = true;
        } else {
          const ans = dbState.answers.get(txt.id);
          if (ans && !txt.value) {
            txt.value = ans;
            txt.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
            matched = true;
            LOG.success("SOLVER-DB", `Filled text answer: "${ans}" for ${txt.id}`);
          }
        }
      });
    }

    
    const questionContainers = qDoc.getElementsByClassName("Assessment_Main_Body_Content_Question");
    const activeQuestions = Array.from(questionContainers).filter(q => q.style.display !== "none" && q.id.includes("q_"));
    if (activeQuestions.length > 0) {
      activeQuestions.forEach(qEl => {
        const ta = qEl.querySelector("textarea");
        if (ta && !ta.value) {
          if (!missThis) {
            ta.value = qEl.innerText.trim();
            ta.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
            matched = true;
          }
        }
      });
    }
  }

  
  if (matched) {
    const delayMs = Math.max(400, (Number(getSetting("AnswerDelay")) || 2) * 1000);
    autoSubmitQuestion(qDoc, delayMs);
    return;
  }

  
  const currentQEl = qDoc.querySelector(".Assessment_Main_Body_Content_Question:not([style*='display: none']), [qid]");
  const qText = currentQEl ? (currentQEl.innerText || "").trim() : "";
  const now = Date.now();

  if (getSetting("AiFallback") && getSetting("APIKey") && qText && qText !== lastAnsweredQuestionText && now - lastAiAttemptTime > 5000) {
    lastAnsweredQuestionText = qText;
    lastAiAttemptTime = now;
    await solveWithAi(qDoc);
  }
}
function autoSubmitQuestion(doc, delayMs = 1000) {
  setTimeout(() => {
    
    const currentBtn = doc.querySelector(".plainbtn.alt.icon.yellow.selected, .plainbtn.alt.icon.selected");
    const allQBtns = Array.from(doc.querySelectorAll(".plainbtn.alt.icon.yellow, .plainbtn.alt.icon"));
    const currentQNum = currentBtn ? parseInt(currentBtn.innerText, 10) : -Infinity;
    const maxQNum = allQBtns.reduce((max, b) => {
      const v = parseInt(b.innerText, 10);
      return isNaN(v) ? max : Math.max(max, v);
    }, -Infinity);

    if (currentQNum >= maxQNum && maxQNum > 0) {
      
      LOG.success("SOLVER", `Final question (#${currentQNum}/${maxQNum}) completed. Submitting assessment...`);
      const submitBtn = doc.getElementById("submit") || doc.querySelector(".uibtn.uibtn-blue.uibtn-med.submit");
      submitBtn?.click();
      setTimeout(() => {
        const confirmBtn = doc.querySelector(".uibtn.uibtn-blue.uibtn-med.submit") || document.querySelector(".uibtn.uibtn-blue.uibtn-med.submit");
        confirmBtn?.click();
      }, 150);
    } else {
      
      const nextQBtn = doc.getElementById("nextQuestion") || doc.querySelector("#nextQuestion, .nextQuestion, [title*='Next']");
      if (nextQBtn) {
        LOG.info("SOLVER", `Question #${currentQNum || ""} answered. Advancing to next question...`);
        nextQBtn.click();
      }
    }

    
    if (allQBtns.length === 0) {
      const nextQ = doc.getElementById("nextQuestion");
      if (nextQ && nextQ.offsetParent !== null) {
        nextQ.click();
        return;
      }
      const submitBtn = doc.getElementById("submit") || doc.querySelector("input[value='Submit'], button[value='Submit'], .uibtn-blue[value='Submit']");
      if (submitBtn) {
        submitBtn.click();
        setTimeout(() => {
          const confirmBtn = doc.querySelector(".uibtn.uibtn-blue.uibtn-med.submit");
          confirmBtn?.click();
        }, 150);
      }
    }
  }, delayMs);
}
async function solveWithAi(doc) {
  const apiKey = getSetting("APIKey");
  if (!apiKey) return;

  const currentQEl = doc.querySelector(".Assessment_Main_Body_Content_Question:not([style*='display: none']), [qid]");
  if (!currentQEl) return;

  const questionText = (currentQEl.innerText || "").trim();
  if (!questionText || questionText.length < 5) return;

  isSolvingQuestion = true;
  LOG.info("AI-SOLVER", `AI fallback analyzing question: "${questionText.slice(0, 70)}..."`);

  try {
    const options = Array.from(currentQEl.querySelectorAll("li, label, .answer-choice, input[type='radio'], input[type='checkbox']"))
      .map(el => (el.innerText || el.value || "").trim())
      .filter(t => t.length > 0);

    const prompt = `You are an educational assistant answering a school assessment question.
Question: ${questionText}
${options.length > 0 ? "Options:\n" + options.map((o, i) => `${i + 1}. ${o}`).join("\n") : ""}

Respond ONLY with the exact correct answer text. Do not provide explanations or quotes.`;

    const provider = getSetting("AIProvider");
    const model = getSetting("AIModel") || "llama-3.3-70b-versatile";
    let endpoint = "https://api.groq.com/openai/v1/chat/completions";

    if (provider === "cerebras") endpoint = "https://api.cerebras.ai/v1/chat/completions";
    else if (provider === "openrouter") endpoint = "https://openrouter.ai/api/v1/chat/completions";

    const response = await gmFetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1
      })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status} from ${provider}`);

    const json = await response.json();
    const aiAnswer = json.choices?.[0]?.message?.content?.trim();
    LOG.success("AI-SOLVER", `AI Answer: "${aiAnswer}"`);

    if (aiAnswer) {
      const labels = currentQEl.querySelectorAll("label");
      let clicked = false;
      for (const lbl of labels) {
        if (lbl.innerText.toLowerCase().includes(aiAnswer.toLowerCase())) {
          const input = lbl.querySelector("input") || doc.getElementById(lbl.getAttribute("for"));
          if (input) {
            input.checked = true;
            input.dispatchEvent(new Event("change", { bubbles: true }));
            input.dispatchEvent(new Event("click", { bubbles: true }));
            clicked = true;
            break;
          }
        }
      }

      const txt = currentQEl.querySelector('input[type="text"], textarea');
      if (txt && !clicked) {
        txt.value = aiAnswer;
        txt.dispatchEvent(new Event("input", { bubbles: true }));
      }

      autoSubmitQuestion(doc, 1000);
    }
  } catch (err) {
    LOG.error("AI-SOLVER", "AI fallback error:", err);
  } finally {
    setTimeout(() => { isSolvingQuestion = false; }, 2000);
  }
}

  // --- Module: ui.js ---
function createUI() {
  if (window.top !== window.self) return;
  if (document.getElementById("openbolt-container")) return;
  if (!document.body) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => createUI());
    } else {
      setTimeout(createUI, 200);
    }
    return;
  }

  
  if (!document.getElementById("openbolt-styles")) {
    const styleEl = document.createElement("style");
    styleEl.id = "openbolt-styles";
    styleEl.textContent = `
      #openbolt-options::-webkit-scrollbar { width: 6px !important; }
      #openbolt-options::-webkit-scrollbar-track { background: #121212 !important; border-radius: 4px !important; }
      #openbolt-options::-webkit-scrollbar-thumb { background: #333333 !important; border-radius: 4px !important; }
      #openbolt-options::-webkit-scrollbar-thumb:hover { background: #444444 !important; }

      .ob-tile {
        width: 90%;
        margin: 5px auto;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-radius: 10px;
        padding: 8px 12px;
        cursor: pointer;
        transition: all 0.15s ease-in-out;
        box-sizing: border-box;
        user-select: none;
      }
      .ob-tile-off {
        background: #1c1c1c;
        border: 1px solid #2a2a2a;
        color: #888888;
        box-shadow: none;
      }
      .ob-tile-off:hover {
        background: #242424;
        border-color: #333333;
      }
      .ob-tile-on {
        background: #2f2f2f;
        border: 1px solid #444444;
        color: #ffffff;
        box-shadow: 0 0 8px rgba(255, 255, 255, 0.1);
      }
      .ob-tile-on:hover {
        background: #383838;
      }
      .ob-tile-title {
        font-weight: bold;
        font-size: 13.5px;
        letter-spacing: 0.2px;
      }
      .ob-delay-badge {
        font-size: 11px;
        background: #121212;
        border: 1px solid #333333;
        border-radius: 4px;
        padding: 2px 6px;
        margin-left: 8px;
        color: #aaa;
        cursor: pointer;
        font-family: monospace;
      }
      .ob-delay-badge:hover {
        background: #222222;
        color: #fff;
      }
      .ob-expand-btn {
        background: none;
        border: none;
        color: #777777;
        cursor: pointer;
        font-size: 15px;
        padding: 0 4px;
        transition: color 0.15s;
      }
      .ob-expand-btn:hover { color: #ffffff; }
      .ob-desc-box {
        display: none;
        width: 90%;
        margin: 0 auto 6px auto;
        background: #161616;
        border: 1px solid #282828;
        border-radius: 8px;
        padding: 8px 10px;
        font-size: 11.5px;
        color: #888888;
        line-height: 1.4;
        box-sizing: border-box;
      }
    `;
    document.head.appendChild(styleEl);
  }

  
  let isCollapsed = localStorage.getItem("ob_isCollapsed") === "true";
  const container = document.createElement("div");
  container.id = "openbolt-container";
  container.style.width = "280px";
  container.style.height = isCollapsed ? "55px" : "600px";
  container.style.background = "#121212";
  container.style.borderRadius = "15px";
  container.style.boxShadow = "0px 10px 30px rgba(0, 0, 0, 0.8), 0px 0px 1px rgba(255, 255, 255, 0.1)";
  container.style.border = "1px solid #242424";
  container.style.fontFamily = "'Times New Roman', Times, serif";
  container.style.color = "#e5e5e5";
  container.style.position = "fixed";
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.alignItems = "center";
  container.style.overflow = "hidden";
  container.style.zIndex = "999999";
  container.style.transition = "height 0.25s cubic-bezier(0.4, 0, 0.2, 1)";

  
  const savedPos = JSON.parse(localStorage.getItem("ob_position") || "null");
  if (savedPos && typeof savedPos.top === "number" && typeof savedPos.left === "number" &&
      savedPos.top >= 0 && savedPos.left >= 0 &&
      savedPos.top < (window.innerHeight || 800) && savedPos.left < (window.innerWidth || 1200)) {
    container.style.top = `${savedPos.top}px`;
    container.style.left = `${savedPos.left}px`;
  } else {
    container.style.top = "60px";
    container.style.left = "60px";
  }

  
  const header = document.createElement("div");
  header.id = "openbolt-header";
  header.style.width = "100%";
  header.style.background = "#181818";
  header.style.borderTopLeftRadius = "15px";
  header.style.borderTopRightRadius = "15px";
  header.style.padding = "12px 16px";
  header.style.boxShadow = "0px 4px 10px rgba(0, 0, 0, 0.5)";
  header.style.cursor = "move";
  header.style.boxSizing = "border-box";
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "center";

  const titleWrap = document.createElement("div");
  titleWrap.style.display = "flex";
  titleWrap.style.flexDirection = "column";

  const title = document.createElement("h1");
  title.innerText = "OpenBolt";
  title.style.margin = "0";
  title.style.fontSize = "24px";
  title.style.fontWeight = "bold";
  title.style.color = "#f0f0f0";
  title.style.fontFamily = "'Times New Roman', Times, serif";
  title.style.textShadow = "0px 0px 8px rgba(255, 255, 255, 0.3)";
  title.style.userSelect = "none";
  titleWrap.appendChild(title);

  const statusSub = document.createElement("span");
  statusSub.id = "ob-status-pill";
  statusSub.innerText = "Initializing...";
  statusSub.style.fontSize = "10px";
  statusSub.style.color = "#10b981";
  statusSub.style.fontFamily = "sans-serif";
  statusSub.style.marginTop = "2px";
  titleWrap.appendChild(statusSub);

  header.appendChild(titleWrap);

  const collapseBtn = document.createElement("button");
  collapseBtn.innerText = isCollapsed ? "<" : "˅";
  collapseBtn.style.background = "transparent";
  collapseBtn.style.color = "#888888";
  collapseBtn.style.border = "none";
  collapseBtn.style.cursor = "pointer";
  collapseBtn.style.fontSize = "18px";
  collapseBtn.style.fontWeight = "bold";
  collapseBtn.addEventListener("click", () => {
    isCollapsed = !isCollapsed;
    localStorage.setItem("ob_isCollapsed", isCollapsed);
    container.style.height = isCollapsed ? "55px" : "600px";
    collapseBtn.innerText = isCollapsed ? "<" : "˅";
  });
  header.appendChild(collapseBtn);

  container.appendChild(header);

  
  const optionsContainer = document.createElement("div");
  optionsContainer.id = "openbolt-options";
  optionsContainer.style.width = "100%";
  optionsContainer.style.flex = "1";
  optionsContainer.style.paddingTop = "10px";
  optionsContainer.style.paddingBottom = "14px";
  optionsContainer.style.display = "flex";
  optionsContainer.style.flexDirection = "column";
  optionsContainer.style.alignItems = "center";
  optionsContainer.style.background = "#121212";
  optionsContainer.style.overflowY = "auto";
  optionsContainer.style.boxSizing = "border-box";
  optionsContainer.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  
  function createOptionTile(key, label, desc, hasDelay = false, delayKey = "", defaultDelay = "2") {
    const wrap = document.createElement("div");
    wrap.style.width = "100%";
    wrap.style.marginBottom = "3px";

    const tile = document.createElement("div");
    tile.className = "ob-tile";
    tile.id = `option-${key}`;

    const left = document.createElement("div");
    left.style.display = "flex";
    left.style.alignItems = "center";

    const nameSpan = document.createElement("span");
    nameSpan.className = "ob-tile-title";
    nameSpan.innerText = label;
    left.appendChild(nameSpan);

    if (hasDelay && delayKey) {
      const delayBadge = document.createElement("span");
      delayBadge.className = "ob-delay-badge number";
      const currentVal = getSetting(delayKey) ?? defaultDelay;
      delayBadge.innerText = isNaN(Number(currentVal)) ? String(currentVal) : `${currentVal}s`;
      delayBadge.title = "Click to edit delay / setting";
      delayBadge.addEventListener("click", (e) => {
        e.stopPropagation();
        const cur = getSetting(delayKey) ?? defaultDelay;
        const res = prompt(`Set value for ${label}:`, cur);
        if (res !== null) {
          const trimmed = res.trim();
          setSetting(delayKey, trimmed);
          delayBadge.innerText = isNaN(Number(trimmed)) ? trimmed : `${trimmed}s`;
          LOG.info("CONFIG", `${delayKey} set to ${trimmed}`);
        }
      });
      left.appendChild(delayBadge);
    }
    tile.appendChild(left);

    const expandBtn = document.createElement("button");
    expandBtn.className = "ob-expand-btn";
    expandBtn.innerText = "˅";
    tile.appendChild(expandBtn);

    const descBox = document.createElement("div");
    descBox.className = "ob-desc-box";
    descBox.innerText = desc;

    
    expandBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isHidden = descBox.style.display === "none" || !descBox.style.display;
      descBox.style.display = isHidden ? "block" : "none";
      expandBtn.innerText = isHidden ? "^" : "˅";
    });

    
    function updateTileVisual() {
      const active = !!getSetting(key);
      tile.className = `ob-tile ${active ? "ob-tile-on" : "ob-tile-off"}`;
      nameSpan.style.color = active ? "#ffffff" : "#888888";
    }

    
    tile.addEventListener("click", () => {
      const newVal = !getSetting(key);
      setSetting(key, newVal);
      updateTileVisual();
      if (key === "BackgroundMode") {
        setBackgroundMode(newVal);
      }
      if (key === "AutoHide") {
        applyAutoHideBlur();
      }
      LOG.info("CONFIG", `${key} toggled to ${newVal}`);
    });

    updateTileVisual();
    wrap.appendChild(tile);
    wrap.appendChild(descBox);
    optionsContainer.appendChild(wrap);
  }

  
  createOptionTile("AutoVocab", "AutoVocab", "Automatically completes vocabulary activities.", true, "VocabDelay", "10");
  createOptionTile("AutoGuessing", "AutoGuessing", 'Automatically guesses through nongraded sections and submits unquestioned sections (like "Click to review the online content:").', true, "GuessDelay", "10");
  createOptionTile("AutoExam", "AutoExam", "Automatically completes quizzes, unit tests, and practices.", true, "AnswerDelay", "2");
  createOptionTile("AutoAssignment", "AutoAssignment", "Automatically completes assignments.", true, "AssignmentDelay", "60");
  createOptionTile("AutoInteractive", "AutoInteractive", "Automatically completes interactive activities via internal frame APIs.", false);
  createOptionTile("AutoAdvance", "AutoAdvance", "Automatically goes to the next slide or activity when finished.", true, "AdvanceDelay", "2");
  createOptionTile("AutoLanguage", "AutoLanguage", "Automatically marks language specific activities as complete.", true, "LanguageDelay", "60-90");
  createOptionTile("AutoJournal", "AutoJournal", "Automatically completes open response activities and essays with AI.", true, "JournalDelay", "300-420");
  createOptionTile("AntiSpeaking", "AntiSpeaking", "Automatically marks speaking activities as complete by bypassing audio recordings.", false);
  createOptionTile("Range", "Range", "Target score range for exams and assignments (e.g. 80-100 or 100) to keep grades natural.", true, "Range", "100");
  createOptionTile("AiFallback", "AiFallback", "Uses your free Groq/Cerebras API key to solve any questions not in the database.", false);
  createOptionTile("AutoShowMe", "AutoShowMe", 'Automatic unhiding and clicking of "Show me" or "Demo" buttons to pass interactive checkpoints.', false);
  createOptionTile("AutoShow", "AutoShow", "Automatically unhides hidden right columns in instruction and assignments.", false);
  createOptionTile("AutoHide", "AutoHide", "Automatically blurs student name and header details for privacy.", false);
  createOptionTile("AntiDelay", "AntiDelay", "Removes click-blocking overlays during instructor narration.", false);
  createOptionTile("AntiLogout", "AntiLogout", "Prevents Edgenuity from logging you out on inactivity.", false);
  createOptionTile("AntiHome", "AntiHome", 'Automatically clicks "Next Activity" whenever you are redirected to the home or coursemap page.', false);
  createOptionTile("BackgroundMode", "BackgroundMode", "Makes OpenBolt immune to browser tab throttling using a WebAudio keepalive.", false);
  createOptionTile("MuteMedia", "MuteMedia", "Mutes video narration and sound effects during lessons.", false);
  createOptionTile("AutoReload", "AutoReload", "Automatically reloads the page if Edgenuity freezes.", false);

  
  const apiKeyWrap = document.createElement("div");
  apiKeyWrap.style.width = "100%";
  apiKeyWrap.style.marginBottom = "6px";

  const keyTile = document.createElement("div");
  keyTile.className = "ob-tile ob-tile-off";
  keyTile.id = "option-ApiKeys";

  const keyLeft = document.createElement("div");
  keyLeft.style.display = "flex";
  keyLeft.style.alignItems = "center";
  keyLeft.style.gap = "8px";

  const keyTitle = document.createElement("span");
  keyTitle.className = "ob-tile-title";
  keyTitle.innerText = "API Keys";
  keyLeft.appendChild(keyTitle);

  const keyBadge = document.createElement("span");
  keyBadge.style.fontSize = "10.5px";
  keyBadge.style.padding = "2px 6px";
  keyBadge.style.borderRadius = "4px";
  keyBadge.style.fontFamily = "monospace";
  keyLeft.appendChild(keyBadge);
  keyTile.appendChild(keyLeft);

  const keyExpandBtn = document.createElement("button");
  keyExpandBtn.className = "ob-expand-btn";
  keyExpandBtn.innerText = "˅";
  keyTile.appendChild(keyExpandBtn);

  const keyDescBox = document.createElement("div");
  keyDescBox.className = "ob-desc-box";
  keyDescBox.innerHTML = `
    <div style="margin-bottom: 8px;">Connect a free Groq or Cerebras key to enable real-time AI solving:</div>
    <div style="display: flex; gap: 6px; margin-bottom: 8px;">
      <button id="ob-btn-grab-groq" style="flex: 1; background: #2f2f2f; border: 1px solid #444; color: #fff; border-radius: 6px; padding: 6px 8px; font-size: 11px; cursor: pointer;">
        ⚡ Auto-Grab Groq Key
      </button>
      <button id="ob-btn-grab-cerebras" style="flex: 1; background: #2f2f2f; border: 1px solid #444; color: #fff; border-radius: 6px; padding: 6px 8px; font-size: 11px; cursor: pointer;">
        ⚡ Cerebras Key
      </button>
    </div>
    <div style="display: flex; gap: 6px;">
      <input type="password" id="ob-manual-key" placeholder="Or paste API key here..." style="flex: 1; background: #1c1c1c; border: 1px solid #333; color: #fff; padding: 4px 8px; border-radius: 4px; font-size: 11px;">
      <button id="ob-save-key-btn" style="background: #10b981; border: none; color: #fff; border-radius: 4px; padding: 4px 10px; font-size: 11px; cursor: pointer;">Save</button>
    </div>
  `;

  function updateKeyBadge() {
    const key = (getSetting("APIKey") || "").trim();
    if (key && key.length >= 10 && key !== "undefined") {
      const prov = key.startsWith("gsk_") ? "GROQ" : (key.startsWith("csk-") ? "CEREBRAS" : "AI");
      keyBadge.innerText = `${prov}: ${key.slice(0, 5)}...${key.slice(-4)}`;
      keyBadge.style.background = "#143322";
      keyBadge.style.color = "#10b981";
      keyBadge.style.border = "1px solid #059669";
      keyTile.style.borderColor = "#059669";
    } else {
      keyBadge.innerText = "No Key Set";
      keyBadge.style.background = "#2d1616";
      keyBadge.style.color = "#ef4444";
      keyBadge.style.border = "1px solid #b91c1c";
      keyTile.style.borderColor = "#2a2a2a";
    }
  }

  keyExpandBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isHidden = keyDescBox.style.display === "none" || !keyDescBox.style.display;
    keyDescBox.style.display = isHidden ? "block" : "none";
    keyExpandBtn.innerText = isHidden ? "^" : "˅";
  });
  keyTile.addEventListener("click", () => keyExpandBtn.click());

  apiKeyWrap.appendChild(keyTile);
  apiKeyWrap.appendChild(keyDescBox);
  optionsContainer.appendChild(apiKeyWrap);

  container.appendChild(optionsContainer);
  document.body.appendChild(container);

  
  document.getElementById("ob-btn-grab-groq")?.addEventListener("click", () => {
    requestApiKeyTab("groq");
  });
  document.getElementById("ob-btn-grab-cerebras")?.addEventListener("click", () => {
    requestApiKeyTab("cerebras");
  });
  document.getElementById("ob-save-key-btn")?.addEventListener("click", () => {
    const inp = document.getElementById("ob-manual-key");
    if (inp && inp.value.trim()) {
      setSetting("APIKey", inp.value.trim());
      updateKeyBadge();
      updateUiStatus();
      LOG.success("CONFIG", "API Key saved manually.");
    }
  });

  
  if (typeof GM_addValueChangeListener !== "undefined") {
    GM_addValueChangeListener("APIKey", () => {
      updateKeyBadge();
      updateUiStatus();
    });
  }

  
  makeDraggable(container, header);
  registerDbStatusCallback(updateUiStatus);

  updateKeyBadge();
  updateUiStatus();
}
function updateUiStatus(customMsg) {
  const el = document.getElementById("ob-status-pill");
  if (!el) return;

  if (customMsg) {
    el.innerText = customMsg;
    el.style.color = "#3b82f6";
    return;
  }

  if (dbState.isLoading) {
    el.innerText = "Downloading Database (auto)...";
    el.style.color = "#f59e0b";
  } else if (dbState.isReady) {
    el.innerText = `● Database: ${dbState.idSet.size.toLocaleString()} IDs ready`;
    el.style.color = "#10b981";
  } else {
    el.innerText = "○ Connecting...";
    el.style.color = "#888888";
  }
}

function makeDraggable(el, handle) {
  let isDragging = false;
  let startX = 0, startY = 0;

  handle.addEventListener("mousedown", (e) => {
    if (e.target.tagName === "BUTTON") return;
    isDragging = true;
    startX = e.clientX - el.offsetLeft;
    startY = e.clientY - el.offsetTop;
    document.body.style.userSelect = "none";
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const newLeft = e.clientX - startX;
    const newTop = e.clientY - startY;
    el.style.left = `${newLeft}px`;
    el.style.top = `${newTop}px`;
  });

  document.addEventListener("mouseup", () => {
    if (!isDragging) return;
    isDragging = false;
    document.body.style.userSelect = "";
    localStorage.setItem("ob_position", JSON.stringify({
      left: parseInt(el.style.left, 10),
      top: parseInt(el.style.top, 10)
    }));
  });
}

  // --- Module: main.js ---
function init() {
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
})();
