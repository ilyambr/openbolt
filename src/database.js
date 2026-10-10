import { LOG } from "./logger.js";
import { gmFetch } from "./network.js";

export const DEFAULT_GIST_PARTS = [
  "https://gist.githubusercontent.com/ilyambr/69cad1dc9d06afbda9c2609191095cac/raw/edgenuity_db_part1.json",
  "https://gist.githubusercontent.com/ilyambr/69cad1dc9d06afbda9c2609191095cac/raw/edgenuity_db_part2.json",
  "https://gist.githubusercontent.com/ilyambr/69cad1dc9d06afbda9c2609191095cac/raw/edgenuity_db_part3.json"
];

export const dbState = {
  isReady: false,
  isLoading: false,
  answers: new Map(),
  idSet: new Set()
};

let onStatusChangeCallback = null;

export function registerDbStatusCallback(cb) {
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

export async function loadLocalDbCache() {
  
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

export async function downloadGistDatabase() {
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

export async function importDbJson(jsonData) {
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
