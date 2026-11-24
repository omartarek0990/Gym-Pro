import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  CreditCard,
  QrCode,
  Dumbbell,
  TrendingUp,
  BarChart3,
  ScrollText,
  Settings,
  ChevronLeft,
  UserPlus,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'
import { useAuth } from '@/contexts/AuthContext'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const allNavItems = [
  { path: '/', icon: LayoutDashboard, labelKey: 'nav.dashboard', roles: ['owner', 'admin'] },
  { path: '/members', icon: Users, labelKey: 'nav.members', roles: ['owner', 'admin'] },
  { path: '/plans', icon: CreditCard, labelKey: 'nav.plans', roles: ['owner', 'admin'] },
  { path: '/attendance', icon: QrCode, labelKey: 'nav.attendance', roles: ['owner', 'admin'] },
  { path: '/invitations', icon: UserPlus, labelKey: 'nav.invitations', roles: ['owner', 'admin'] },
  { path: '/supplements', icon: Dumbbell, labelKey: 'nav.supplements', roles: ['owner', 'admin'] },
  { path: '/profits', icon: TrendingUp, labelKey: 'nav.profits', roles: ['owner'] },
  { path: '/reports', icon: BarChart3, labelKey: 'nav.reports', roles: ['owner'] },
  { path: '/audit-log', icon: ScrollText, labelKey: 'nav.auditLog', roles: ['owner'] },
  { path: '/settings', icon: Settings, labelKey: 'nav.settings', roles: ['owner'] },
] as const

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { t } = useLanguage()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [logoutDialog, setLogoutDialog] = useState(false)

  const currentRole = user?.role || 'owner'
  const navItems = allNavItems.filter(item =>
    (item.roles as readonly string[]).includes(currentRole)
  )

  const handleLogout = () => {
    setLogoutDialog(false)
    logout()
    navigate('/')
  }

  return (
    <>
      <aside
        className={cn(
          'h-screen border-r border-sidebar-border bg-sidebar-bg flex flex-col relative z-30',
          collapsed ? 'w-[72px]' : 'w-[240px]'
        )}
      >
        <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Dumbbell className="w-5 h-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="text-lg font-bold text-foreground truncate">
              {t('login.appName')}
            </span>
          )}
        </div>

        <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
          {navItems.map((item, index) => (
            <div key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium group relative',
                    collapsed && 'justify-center px-2',
                    isActive
                      ? 'text-primary bg-primary/10 border border-primary/30 shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent'
                  )
                }
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {!collapsed && (
                  <span className="truncate">
                    {t(item.labelKey)}
                  </span>
                )}
                {collapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-surface-raised border border-sidebar-border rounded text-xs text-foreground opacity-0 invisible group-hover:opacity-100 group-hover:visible whitespace-nowrap z-50">
                    {t(item.labelKey)}
                  </div>
                )}
              </NavLink>
            </div>
          ))}
        </nav>

        <div className="p-2 border-t border-sidebar-border space-y-1">
          <button
            onClick={() => setLogoutDialog(true)}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!collapsed && <span>{t('common.logout') || 'Logout'}</span>}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center w-full p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <div>
              <ChevronLeft className="w-4 h-4" />
            </div>
          </button>
        </div>
      </aside>

      <Dialog open={logoutDialog} onOpenChange={setLogoutDialog}>
        <DialogContent className="sm:max-w-[350px]">
          <DialogHeader>
            <DialogTitle>{t('common.confirm') || 'Confirm'}</DialogTitle>
            <DialogDescription>{t('common.logoutConfirm') || 'Are you sure you want to logout?'}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setLogoutDialog(false)}>{t('common.cancel') || 'Cancel'}</Button>
            <Button variant="destructive" onClick={handleLogout}>{t('common.logout') || 'Logout'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
