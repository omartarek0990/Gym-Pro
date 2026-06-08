let invokeFn: ((cmd: string, args?: Record<string, unknown>) => Promise<any>) | null = null
let initPromise: Promise<void> | null = null

export async function initTauri() {
  if (initPromise) return initPromise
  initPromise = (async () => {
    try {
      const tauri = await import('@tauri-apps/api/core')
      invokeFn = tauri.invoke
    } catch {
      invokeFn = null
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
