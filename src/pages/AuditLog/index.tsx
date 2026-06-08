import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ScrollText, Trash2, Clock } from 'lucide-react'
import { invoke } from '@/lib/tauri'
import PageTransition from '@/components/shared/PageTransition'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate, formatTime } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { AuditLog } from '@/types'
import { useLanguage } from '@/lib/i18n'

export default function AuditLogPage() {
  const { isArabic } = useLanguage()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const l = await invoke('get_audit_logs')
      if (l) setLogs(l as AuditLog[])
    } catch {}
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleClear = async () => {
    await invoke('clear_audit_logs')
    setLogs([])
    toast({ title: isArabic ? 'تم مسح سجل النشاط' : 'Audit Log Cleared', variant: 'success' })
  }

  const getActionColor = (action: string) => {
    if (action.startsWith('New member:')) return 'text-green-400 bg-green-500/10'
    if (action.startsWith('Delete member:')) return 'text-red-400 bg-red-500/10'
    if (action.startsWith('Edit member:')) return 'text-yellow-400 bg-yellow-500/10'
    if (action.startsWith('Renewal:')) return 'text-yellow-400 bg-yellow-500/10'
    if (action.startsWith('Add plan:')) return 'text-purple-400 bg-purple-500/10'
    if (action.startsWith('Edit plan:')) return 'text-purple-400 bg-purple-500/10'
    if (action.startsWith('Add supplement:')) return 'text-cyan-400 bg-cyan-500/10'
    if (action.startsWith('Supplement sale:')) return 'text-orange-400 bg-orange-500/10'
    if (action.startsWith('Supplement order:')) return 'text-orange-400 bg-orange-500/10'
    return 'text-gray-300 bg-white/5'
  }

  const translateLogText = (text: string) => {
    if (!isArabic) return text
    return text
      .replace(/^New member:/, 'عضو جديد:')
      .replace(/^Delete member:/, 'حذف عضو:')
      .replace(/^Edit member:/, 'تعديل عضو:')
      .replace(/^Renewal:/, 'تجديد:')
      .replace(/^Add plan:/, 'إضافة خطة:')
      .replace(/^Edit plan:/, 'تعديل خطة:')
      .replace(/^Freeze member:/, 'تجميد عضو:')
      .replace(/^Unfreeze member:/, 'إلغاء تجميد عضو:')
      .replace(/^Add supplement:/, 'إضافة مكمل:')
      .replace(/^Supplement sale:/, 'بيع مكمل:')
      .replace(/^Supplement order:/, 'طلب مكمل:')
      .replace(/\((\d+) days\)/, '($1 يوم)')
  }

  if (loading) return <PageTransition><div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-12 rounded-lg skeleton" />)}</div></PageTransition>

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-yellow-400" />
            <h2 className="text-lg font-semibold text-white">{isArabic ? 'سجل النشاط' : 'Audit Log'}</h2>
            <Badge variant="secondary">{isArabic ? `${logs.length} إدخال` : `${logs.length} entries`}</Badge>
          </div>
          <Button variant="ghost" size="sm" className="gap-2 text-red-400" onClick={handleClear}>
            <Trash2 className="w-4 h-4" />{isArabic ? 'مسح' : 'Clear'}
          </Button>
        </div>

        <Card className="border-[#1a2d45]">
          <CardContent className="p-0">
            {logs.length === 0 ? (
              <div className="text-center py-16"><ScrollText className="w-12 h-12 text-gray-600 mx-auto mb-3" /><p className="text-gray-400">{isArabic ? 'لا يوجد سجل نشاط' : 'No audit logs'}</p></div>
            ) : (
              <div className="divide-y divide-[#1a2d45]">
                {logs.map((log, i) => {
                  let colorClass = getActionColor(log.action)
                  return (
                    <motion.div key={log.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }}
                      className="flex items-start gap-3 p-3 hover:bg-white/[0.02]"
                    >
                      <Clock className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorClass}`}>{translateLogText(log.action)}</span>
                          <span className="text-xs text-gray-500">{log.date} {formatTime(log.time)}</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{translateLogText(log.details)}</p>
                      </div>
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
