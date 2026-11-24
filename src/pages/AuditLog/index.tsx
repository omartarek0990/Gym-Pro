import { useState, useEffect } from 'react'
import { ScrollText, Trash2, Clock, FileDown } from 'lucide-react'
import { invoke } from '@/lib/tauri'
import PageTransition from '@/components/shared/PageTransition'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate, formatTime } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { useExport } from '@/hooks/useExport'
import { AuditLog } from '@/types'
import { useLanguage } from '@/lib/i18n'

export default function AuditLogPage() {
  const { isArabic } = useLanguage()
  const { exportToExcel } = useExport()
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
    if (action.startsWith('Delete member:')) return 'text-destructive bg-destructive/10'
    if (action.startsWith('Edit member:')) return 'text-yellow-400 bg-yellow-500/10'
    if (action.startsWith('Renewal:')) return 'text-yellow-400 bg-yellow-500/10'
    if (action.startsWith('Add plan:')) return 'text-purple-400 bg-purple-500/10'
    if (action.startsWith('Edit plan:')) return 'text-purple-400 bg-purple-500/10'
    if (action.startsWith('Add supplement:')) return 'text-cyan-400 bg-cyan-500/10'
    if (action.startsWith('Supplement sale:')) return 'text-orange-400 bg-orange-500/10'
    if (action.startsWith('Supplement order:')) return 'text-orange-400 bg-orange-500/10'
    return 'text-muted-foreground bg-muted'
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

  if (loading) return <PageTransition><div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-12 rounded-lg bg-muted" />)}</div></PageTransition>

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">{isArabic ? 'سجل النشاط' : 'Audit Log'}</h2>
            <Badge variant="secondary">{isArabic ? `${logs.length} إدخال` : `${logs.length} entries`}</Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" className="gap-2" onClick={() => exportToExcel(`audit_log_${new Date().toISOString().split('T')[0]}`, [
              { header: 'Date', key: 'date' }, { header: 'Time', key: 'time' }, { header: 'Action', key: 'action' }, { header: 'Details', key: 'details' },
            ], logs.map(l => ({ date: l.date, time: l.time, action: l.action, details: l.details })))}>
              <FileDown className="w-4 h-4" />{isArabic ? 'تصدير' : 'Export'}
            </Button>
            <Button variant="ghost" size="sm" className="gap-2 text-destructive" onClick={handleClear}>
              <Trash2 className="w-4 h-4" />{isArabic ? 'مسح' : 'Clear'}
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            {logs.length === 0 ? (
              <div className="text-center py-16"><ScrollText className="w-12 h-12 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">{isArabic ? 'لا يوجد سجل نشاط' : 'No audit logs'}</p></div>
            ) : (
              <div className="divide-y divide-border">
                {logs.map((log, i) => {
                  let colorClass = getActionColor(log.action)
                  return (
                    <div key={log.id}
                      className="flex items-start gap-3 p-3 hover:bg-muted"
                    >
                      <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorClass}`}>{translateLogText(log.action)}</span>
                          <span className="text-xs text-muted-foreground">{log.date} {formatTime(log.time)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{translateLogText(log.details)}</p>
                      </div>
                    </div>
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
