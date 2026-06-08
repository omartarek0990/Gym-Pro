import { motion } from 'framer-motion'
import { Bell, Save } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useState, useEffect } from 'react'
import { invoke } from '@/lib/tauri'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '@/lib/i18n'

const pageTitleKeys = {
  '/': 'page.dashboard',
  '/members': 'page.members',
  '/plans': 'page.plans',
  '/attendance': 'page.attendance',
  '/supplements': 'page.supplements',
  '/profits': 'page.profits',
  '/reports': 'page.reports',
  '/notifications': 'page.notifications',
  '/cards': 'page.cards',
  '/audit-log': 'page.auditLog',
  '/settings': 'page.settings',
} as const

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { t, isArabic } = useLanguage()
  const [unreadCount, setUnreadCount] = useState(0)
  const [lastBackup, setLastBackup] = useState('')

  const titleKey = pageTitleKeys[location.pathname as keyof typeof pageTitleKeys] || 'page.dashboard'

  useEffect(() => {
    const checkNotifications = async () => {
      try {
        const notifs = await invoke('get_notifications')
        setUnreadCount(Array.isArray(notifs) ? notifs.length : 0)
      } catch {}
    }
    checkNotifications()
    const interval = setInterval(checkNotifications, 10000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const fetchBackup = async () => {
      try {
        const bi = await invoke('get_backup_info') as string
        const info = JSON.parse(bi)
        if (info.last_backup) setLastBackup(info.last_backup)
      } catch {}
    }
    fetchBackup()
    const interval = setInterval(fetchBackup, 30000)
    return () => clearInterval(interval)
  }, [])

  const calcBackupAge = (): { text: string; color: string } => {
    if (!lastBackup) return { text: t('time.never'), color: 'text-red-400' }
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
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="h-16 border-b border-[#1a2d45] bg-[#0a0a0a]/50 backdrop-blur-xl flex items-center justify-between px-6"
    >
      <motion.h1
        key={location.pathname}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-xl font-bold text-white"
      >
        {t(titleKey)}
      </motion.h1>

      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/settings')}
          className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg hover:bg-white/5 transition-colors ${age.color}`}
          title="Click to go to Backup settings"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{age.text}</span>
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          onClick={() => navigate('/notifications')}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.span>
          )}
        </Button>
      </div>
    </motion.header>
  )
}
