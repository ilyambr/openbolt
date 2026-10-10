import { LOG } from "./logger.js";

export function requestApiKeyTab(provider = "groq") {
  const url = provider === "cerebras" ? "https://cloud.cerebras.ai/" : "https://console.groq.com/keys";
  LOG.info("CONFIG", `Opening ${provider.toUpperCase()} Console to automatically grab a free API key...`);
  if (typeof GM_openInTab !== "undefined") {
    GM_openInTab(url, { active: true, insert: true });
  } else {
    window.open(url, "_blank");
  }
}

export function initApiKeyGrabber() {
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
