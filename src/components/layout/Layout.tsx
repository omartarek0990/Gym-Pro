import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import { initTauri, invoke } from '@/lib/tauri'
import { Loader2 } from 'lucide-react'

export default function Layout() {
  const [migrationMsg, setMigrationMsg] = useState('')

  useEffect(() => {
    const init = async () => {
      await initTauri()
      try {
        const settings = await import('@/lib/tauri').then(m => m.invoke('get_settings'))
        const themeValue = ((settings || []) as { key: string; value: string }[]).find((s) => s.key === 'theme')?.value || 'dark'
        if (themeValue === 'dark') {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
      } catch {}
      try { await invoke('check_inactive_members') } catch {}
    }
    init()
  }, [])

  // Poll migration progress
  useEffect(() => {
    let alive = true
    const poll = async () => {
      while (alive) {
        try {
          const raw = await invoke('get_migration_progress') as string
          if (!alive) return
          if (raw.startsWith('done')) { setMigrationMsg(''); break }
          else if (raw.startsWith('processing|')) {
            const parts = raw.split('|')
            const cur = parseInt(parts[1]) || 0
            const total = parseInt(parts[2]) || 0
            setMigrationMsg(`جاري تحسين الصور... ${cur}/${total}`)
          } else if (raw === 'vacuum') {
            setMigrationMsg('جاري تحسين قاعدة البيانات...')
          } else if (raw === 'counting') {
            setMigrationMsg('جاري تحليل الصور...')
          } else if (raw === 'opening_connection') {
            setMigrationMsg('جاري تحضير تحسين الصور...')
          } else if (raw.startsWith('error:')) { setMigrationMsg(''); break }
        } catch { break }
        await new Promise(r => setTimeout(r, 2000))
      }
    }
    poll()
    return () => { alive = false }
  }, [])

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        {migrationMsg && (
          <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 border-b border-primary/20 text-primary text-sm shrink-0">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{migrationMsg}</span>
          </div>
        )}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
