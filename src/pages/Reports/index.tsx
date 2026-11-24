import { useState, useEffect, useMemo } from 'react'
import { AlertTriangle, QrCode, FileDown } from 'lucide-react'
import { invoke } from '@/lib/tauri'
import PageTransition from '@/components/shared/PageTransition'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDate, formatTime, formatNumber, getDaysLeft, formatPhone, getLocalDateString } from '@/lib/utils'
import { Member, Attendance } from '@/types'
import { useLanguage } from '@/lib/i18n'
import { useExport } from '@/hooks/useExport'

export default function ReportsPage() {
  const { isArabic } = useLanguage()
  const { exportToExcel } = useExport()
  const [members, setMembers] = useState<Member[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])

  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const [m, a] = await Promise.all([
        invoke('get_members_light'),
        invoke('get_attendance_by_date', { date: getLocalDateString() })
      ])
      if (m) setMembers(m as Member[])
      if (a) setAttendance(a as Attendance[])
    } catch {}
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const expired = useMemo(() => members.filter((m) => m.status === 'expired'), [members])
  const expiring3 = useMemo(() => members.filter((m) => {
    const d = getDaysLeft(m.end_date)
    return m.status === 'active' && d >= 0 && d <= 3
  }), [members])
  const todayAtt = useMemo(() => attendance.filter((a) => a.date === getLocalDateString()), [attendance])

  if (loading) return <PageTransition><div className="space-y-4">{[1,2,3].map((i) => <div key={i} className="h-32 rounded-xl bg-muted" />)}</div></PageTransition>

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: isArabic ? 'الأعضاء المنتهية' : 'Expired Members', value: expired.length, icon: AlertTriangle, color: 'text-destructive' },
            { label: isArabic ? 'ينتهي خلال 3 أيام' : 'Expiring ≤3 Days', value: expiring3.length, icon: AlertTriangle, color: 'text-yellow-400' },
            { label: isArabic ? 'حضور اليوم' : "Today's Attendance", value: todayAtt.length, icon: QrCode, color: 'text-green-400' },
          ].map((s, i) => (
            <div key={i}>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{s.label}</CardTitle></CardHeader>
                <CardContent><p className={`text-2xl font-bold ${s.color}`}>{s.value}</p></CardContent>
              </Card>
            </div>
          ))}
        </div>

        <Tabs defaultValue="expired">
          <TabsList>
            <TabsTrigger value="expired">{isArabic ? 'الأعضاء المنتهية' : 'Expired Members'}</TabsTrigger>
            <TabsTrigger value="expiring">{isArabic ? 'ينتهي قريبًا (3 أيام)' : 'Expiring Soon (3d)'}</TabsTrigger>
            <TabsTrigger value="attendance">{isArabic ? 'حضور اليوم' : "Today's Attendance"}</TabsTrigger>
          </TabsList>

          <TabsContent value="expired">
            <div className="flex items-center justify-between mb-3">
              <span />
              <Button variant="secondary" size="sm" className="gap-2" onClick={() => exportToExcel(`expired_members_${new Date().toISOString().split('T')[0]}`, [
                { header: 'Name', key: 'name' }, { header: 'Phone', key: 'phone' }, { header: 'End Date', key: 'end' },
              ], expired.map(m => ({ name: m.name, phone: formatPhone(m.phone), end: m.end_date })))}>
                <FileDown className="w-4 h-4" />Export
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                {expired.length === 0 ? <p className="text-muted-foreground text-center py-8">{isArabic ? 'لا يوجد أعضاء منتهية' : 'No expired members'}</p>
                : <div className="divide-y divide-border">{
                  expired.map((m, i) => (
                    <div key={m.id} className="flex items-center justify-between p-3">
                      <div><p className="text-sm text-foreground">{m.name}</p><p className="text-xs text-muted-foreground">{formatPhone(m.phone)}</p></div>
                      <Badge variant="destructive">{isArabic ? `منتهي ${formatDate(m.end_date)}` : `Expired ${formatDate(m.end_date)}`}</Badge>
                    </div>
                  ))
                }</div>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="expiring">
            <div className="flex items-center justify-between mb-3">
              <span />
              <Button variant="secondary" size="sm" className="gap-2" onClick={() => exportToExcel(`expiring_members_${new Date().toISOString().split('T')[0]}`, [
                { header: 'Name', key: 'name' }, { header: 'End Date', key: 'end' }, { header: 'Days Left', key: 'days' },
              ], expiring3.map(m => ({ name: m.name, end: m.end_date, days: getDaysLeft(m.end_date) })))}>
                <FileDown className="w-4 h-4" />Export
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                {expiring3.length === 0 ? <p className="text-muted-foreground text-center py-8">{isArabic ? 'لا يوجد أعضاء تنتهي خلال 3 أيام' : 'No members expiring in 3 days'}</p>
                : <div className="divide-y divide-border">{
                  expiring3.map((m, i) => (
                    <div key={m.id} className="flex items-center justify-between p-3">
                      <div><p className="text-sm text-foreground">{m.name}</p><p className="text-xs text-muted-foreground">{formatDate(m.end_date)}</p></div>
                      <Badge variant="warning">{isArabic ? `${formatNumber(getDaysLeft(m.end_date))} يوم متبقي` : `${formatNumber(getDaysLeft(m.end_date))}d left`}</Badge>
                    </div>
                  ))
                }</div>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attendance">
            <div className="flex items-center justify-between mb-3">
              <span />
              <Button variant="secondary" size="sm" className="gap-2" onClick={() => exportToExcel(`today_attendance_${new Date().toISOString().split('T')[0]}`, [
                { header: 'Member', key: 'member' }, { header: 'Method', key: 'method' }, { header: 'Time', key: 'time' },
              ], todayAtt.map(a => {
                const m = members.find(x => x.id === a.member_id)
                return { member: m?.name || 'Unknown', method: a.method, time: formatTime(a.time) }
              }))}>
                <FileDown className="w-4 h-4" />Export
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                {todayAtt.length === 0 ? <p className="text-muted-foreground text-center py-8">{isArabic ? 'لا يوجد حضور اليوم' : 'No attendance today'}</p>
                : <div className="divide-y divide-border">{
                  todayAtt.map((a, i) => {
                    const m = members.find((x) => x.id === a.member_id)
                    return (
                      <div key={a.id} className="flex items-center justify-between p-3">
                        <div><p className="text-sm text-foreground">{m?.name || (isArabic ? 'غير معروف' : 'Unknown')}</p><p className="text-xs text-muted-foreground">{a.method === 'Manual' && isArabic ? 'يدوي' : a.method}</p></div>
                        <span className="text-xs text-muted-foreground">{formatTime(a.time)}</span>
                      </div>
                    )
                  })
                }</div>}
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </PageTransition>
  )
}
