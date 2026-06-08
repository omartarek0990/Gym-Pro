import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Users,
  CreditCard,
  QrCode,
  Dumbbell,
  TrendingUp,
  BarChart3,
  Bell,
  ScrollText,
  IdCard,
  Settings,
  ChevronLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'

const navItems = [
  { path: '/', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
  { path: '/members', icon: Users, labelKey: 'nav.members' },
  { path: '/plans', icon: CreditCard, labelKey: 'nav.plans' },
  { path: '/attendance', icon: QrCode, labelKey: 'nav.attendance' },
  { path: '/supplements', icon: Dumbbell, labelKey: 'nav.supplements' },
  { path: '/profits', icon: TrendingUp, labelKey: 'nav.profits' },
  { path: '/reports', icon: BarChart3, labelKey: 'nav.reports' },
  { path: '/notifications', icon: Bell, labelKey: 'nav.alerts' },
  { path: '/cards', icon: IdCard, labelKey: 'nav.cards' },
  { path: '/audit-log', icon: ScrollText, labelKey: 'nav.auditLog' },
  { path: '/settings', icon: Settings, labelKey: 'nav.settings' },
] as const

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { t } = useLanguage()

  return (
    <motion.aside
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={cn(
        'h-screen border-r border-[#1a2d45] bg-[#0a0a0a]/90 backdrop-blur-xl flex flex-col transition-all duration-300 relative z-30',
        collapsed ? 'w-[72px]' : 'w-[240px]'
      )}
    >
      <div className="flex items-center gap-3 px-4 h-16 border-b border-[#1a2d45]">
        <motion.div
          whileHover={{ rotate: 10, scale: 1.1 }}
          className="w-9 h-9 rounded-lg bg-yellow-600 flex items-center justify-center shrink-0"
        >
          <Dumbbell className="w-5 h-5 text-black" />
        </motion.div>
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="text-lg font-bold text-white truncate"
            >
              Gym Pro
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
        {navItems.map((item, index) => (
          <motion.div
            key={item.path}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 * index, duration: 0.3 }}
          >
            <NavLink
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative',
                  collapsed && 'justify-center px-2',
                  isActive
                    ? 'text-yellow-400 bg-yellow-600/10 border border-yellow-500/30 shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                )
              }
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <AnimatePresence mode="wait">
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="truncate"
                  >
                    {t(item.labelKey)}
                  </motion.span>
                )}
              </AnimatePresence>
              {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-[#0d1117] border border-[#1a2d45] rounded text-xs text-white opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                  {t(item.labelKey)}
                </div>
              )}
            </NavLink>
          </motion.div>
        ))}
      </nav>

      <div className="p-2 border-t border-[#1a2d45]">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <motion.div
            animate={{ rotate: collapsed ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <ChevronLeft className="w-4 h-4" />
          </motion.div>
        </button>
      </div>
    </motion.aside>
  )
}
