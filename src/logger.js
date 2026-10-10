export const LOG = {
  info: (tag, ...args) => console.log(`%c[OpenBolt][${tag}]`, "color: #3b82f6; font-weight: bold;", ...args),
  success: (tag, ...args) => console.log(`%c[OpenBolt][${tag}]`, "color: #10b981; font-weight: bold;", ...args),
  warn: (tag, ...args) => console.warn(`%c[OpenBolt][${tag}]`, "color: #f59e0b; font-weight: bold;", ...args),
  error: (tag, ...args) => console.error(`%c[OpenBolt][${tag}]`, "color: #ef4444; font-weight: bold;", ...args)
};
