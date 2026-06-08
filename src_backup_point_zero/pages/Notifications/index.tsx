import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Bell, AlertTriangle, Package, DollarSign, Info, Trash2, CheckCheck } from 'lucide-react'
import { invoke } from '@/lib/tauri'
import PageTransition from '@/components/shared/PageTransition'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate, formatTime } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { NotificationLog } from '@/types'

const typeConfig: Record<string, { icon: any; color: string; bg: string }> = {
  High: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
  Medium: { icon: Package, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  Low: { icon: Info, color: 'text-green-400', bg: 'bg-green-500/10' },
  revenue: { icon: DollarSign, color: 'text-green-400', bg: 'bg-green-500/10' },
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationLog[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const n = await invoke('get_notifications')
      if (n) setNotifications(n as NotificationLog[])
    } catch {}
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleClear = async () => {
    await invoke('clear_notifications')
    setNotifications([])
    toast({ title: 'Notifications Cleared', variant: 'success' })
  }

  const priorityOrder: Record<string, number> = { High: 0, Medium: 1, Low: 2, revenue: 3 }
  const sorted = [...notifications].sort((a, b) => (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99))

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-white">Notifications</h2>
            <Badge variant="secondary">{notifications.length}</Badge>
          </div>
          <Button variant="ghost" size="sm" className="gap-2 text-red-400" onClick={handleClear}>
            <Trash2 className="w-4 h-4" />Clear All
          </Button>
        </div>

        <Card className="border-[#1a2d45]">
          <CardContent className="p-0">
            {sorted.length === 0 ? (
              <div className="text-center py-16"><Bell className="w-12 h-12 text-gray-600 mx-auto mb-3" /><p className="text-gray-400">No notifications</p></div>
            ) : (
              <div className="divide-y divide-[#1a2d45]">
                {sorted.map((n, i) => {
                  const cfg = typeConfig[n.priority] || typeConfig['Medium']
                  const Icon = cfg.icon
                  return (
                    <motion.div key={n.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}
                      className="flex items-start gap-3 p-4 hover:bg-white/[0.02] cursor-pointer transition-colors"
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${cfg.bg}`}>
                        <Icon className={`w-4 h-4 ${cfg.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{n.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{n.message}</p>
                        <p className="text-xs text-gray-600 mt-1">{formatDate(n.date)} {formatTime(n.time)}</p>
                      </div>
                      <Badge className={`text-xs ${n.priority === 'High' ? 'bg-red-500/10 text-red-400' : n.priority === 'Medium' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-green-500/10 text-green-400'}`}>
                        {n.priority}
                      </Badge>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  )
}
