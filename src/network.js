export function gmFetch(url, opts = {}) {
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
