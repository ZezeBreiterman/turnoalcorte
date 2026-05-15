const isDev = import.meta.env.DEV

type Meta = Record<string, unknown> | unknown

export const logger = {
  info: (msg: string, meta?: Meta) => {
    if (isDev) console.log(`%c[INFO] ${msg}`, 'color:#6366f1', meta ?? '')
  },
  warn: (msg: string, meta?: Meta) => {
    console.warn(`[WARN] ${msg}`, meta ?? '')
  },
  error: (msg: string, meta?: Meta) => {
    console.error(`[ERROR] ${msg}`, meta ?? '')
  },
  debug: (msg: string, meta?: Meta) => {
    if (isDev) console.debug(`[DEBUG] ${msg}`, meta ?? '')
  },
}
