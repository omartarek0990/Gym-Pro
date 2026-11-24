import { Save } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { invoke } from '@/lib/tauri'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '@/lib/i18n'

const pageTitleKeys = {
  '/': 'page.dashboard',
  '/members': 'page.members',
  '/plans': 'page.plans',
  '/attendance': 'page.attendance',
  '/invitations': 'page.invitations',
  '/supplements': 'page.supplements',
  '/profits': 'page.profits',
  '/reports': 'page.reports',
  '/audit-log': 'page.auditLog',
  '/settings': 'page.settings',
} as const

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { t, isArabic } = useLanguage()
  const [lastBackup, setLastBackup] = useState('')

  const titleKey = pageTitleKeys[location.pathname as keyof typeof pageTitleKeys] || 'page.dashboard'

  useEffect(() => {
    const fetchBackup = async () => {
      try {
        const bi = await invoke('get_backup_info') as string
        const info = JSON.parse(bi)
        if (info.last_backup) setLastBackup(info.last_backup)
      } catch {}
    }
    fetchBackup()
    const interval = setInterval(fetchBackup, 300000)
    return () => clearInterval(interval)
  }, [])

  const calcBackupAge = (): { text: string; color: string } => {
    if (!lastBackup) return { text: t('time.never'), color: 'text-destructive' }
    const diff = Date.now() - new Date(lastBackup).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return { text: t('time.justNow'), color: 'text-green-400' }
    if (mins < 60) return { text: isArabic ? `منذ ${mins} دقيقة` : `${mins} min ago`, color: 'text-green-400' }
    const hours = Math.floor(mins / 60)
    if (hours < 2) return { text: isArabic ? `منذ ${hours}س ${mins % 60}د` : `${hours}h ${mins % 60}m ago`, color: 'text-yellow-400' }
    return { text: isArabic ? `منذ ${hours}س` : `${hours}h ago`, color: 'text-yellow-400' }
  }

  const age = calcBackupAge()

  return (
    <header className="h-16 border-b border-navbar-border bg-navbar-bg flex items-center justify-between px-6">
      <h1
        key={location.pathname}
        className="text-xl font-bold text-foreground"
      >
        {t(titleKey)}
      </h1>

      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/settings')}
          className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg hover:bg-muted transition-colors ${age.color}`}
          title="Click to go to Backup settings"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{age.text}</span>
        </button>
      </div>
    </header>
  )
}
