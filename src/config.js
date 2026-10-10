export const DEFAULTS = {
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

export function getSetting(key) {
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

export function setSetting(key, val) {
  if (typeof GM_setValue !== "undefined") {
    GM_setValue(key, val);
  }
  try {
    localStorage.setItem(key, String(val));
    localStorage.setItem(`ob_${key}`, JSON.stringify(val));
  } catch (_) {}
}
