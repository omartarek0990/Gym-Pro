let invokeFn: ((cmd: string, args?: Record<string, unknown>) => Promise<any>) | null = null
let emitFn: ((event: string, payload?: unknown) => Promise<void>) | null = null
let listenFn: (<T>(event: string, handler: (event: { payload: T }) => void) => Promise<() => void>) | null = null
let initPromise: Promise<void> | null = null

export async function initTauri() {
  if (initPromise) return initPromise
  initPromise = (async () => {
    try {
      const tauri = await import('@tauri-apps/api/core')
      const event = await import('@tauri-apps/api/event')
      invokeFn = tauri.invoke
      emitFn = event.emit
      listenFn = event.listen
    } catch {
      invokeFn = null
      emitFn = null
      listenFn = null
    }
  })()
  return initPromise
}

export async function invoke(cmd: string, args?: Record<string, unknown>) {
  if (!invokeFn && !initPromise) await initTauri()
  else if (initPromise) await initPromise
  if (invokeFn) {
    return invokeFn(cmd, args)
  }
  console.warn(`Tauri invoke not available: ${cmd}`, args)
  return null
}

export async function emit(event: string, payload?: unknown) {
  if (!emitFn && !initPromise) await initTauri()
  else if (initPromise) await initPromise
  if (emitFn) await emitFn(event, payload)
}

export async function listen<T = unknown>(event: string, handler: (event: { payload: T }) => void) {
  if (!listenFn && !initPromise) await initTauri()
  else if (initPromise) await initPromise
  if (listenFn) return listenFn<T>(event, handler)
  return () => {}
}
