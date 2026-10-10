import { LOG } from "./logger.js";
import { getSetting, setSetting } from "./config.js";
import { dbState, downloadGistDatabase, importDbJson, registerDbStatusCallback } from "./database.js";
import { setBackgroundMode } from "./background.js";
import { requestApiKeyTab } from "./apikey_grabber.js";
import { applyAutoHideBlur } from "./features.js";

export function createUI() {
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

export function updateUiStatus(customMsg) {
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
