import { useState, useEffect, useMemo } from 'react'
import { Users, UserCheck, UserX, UserRoundX, QrCode, TrendingUp, DollarSign, ArrowRight } from 'lucide-react'
import { invoke, listen } from '@/lib/tauri'
import StatCard from '@/components/shared/StatCard'
import PageTransition from '@/components/shared/PageTransition'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate, formatNumber, getDaysLeft, getDaysColor } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import { DashboardStats, Member } from '@/types'
import { useLanguage } from '@/lib/i18n'
import { useAuth } from '@/contexts/AuthContext'

export default function Dashboard() {
  const navigate = useNavigate()
  const { isArabic } = useLanguage()
  const { isOwner } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      const result = await invoke('get_dashboard_stats')
      if (result) setStats(JSON.parse(result as string))
      const m = await invoke('get_members_light')
      if (m) setMembers(m as Member[])
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    let unlisten: (() => void) | undefined
    listen('attendance-updated', loadData).then((fn) => { unlisten = fn })
    return () => { unlisten?.() }
  }, [])

  const activeMembers = useMemo(() => members.filter((m) => m.status === 'active'), [members])
  const noactiveMembers = useMemo(() => members.filter((m) => m.status === 'noactive'), [members])
  const expiredMembers = useMemo(() => members.filter((m) => m.status === 'expired'), [members])
  const expiringSoon = useMemo(() => members.filter((m) => {
    const d = getDaysLeft(m.end_date)
    return m.status === 'active' && d >= 0 && d <= 7
  }), [members])

  const quickActions = [
    { label: isArabic ? 'إضافة عضو' : 'Add Member', icon: Users, path: '/members', color: 'yellow' },
    { label: isArabic ? 'خطة جديدة' : 'New Plan', icon: TrendingUp, path: '/plans', color: 'yellow' },
    { label: isArabic ? 'تسجيل حضور' : 'Scan Attendance', icon: QrCode, path: '/attendance', color: 'yellow' },
    { label: isArabic ? 'بيع مكمل' : 'Sell Supplement', icon: DollarSign, path: '/supplements', color: 'yellow' },
  ]

  if (loading) {
    return (
      <PageTransition>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[1,2,3,4].map((i) => (
            <div key={i} className="h-[120px] rounded-xl bg-muted" />
          ))}
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard title={isArabic ? 'إجمالي الأعضاء' : 'Total Members'} value={members.length} icon={Users} color="yellow" subtitle={isArabic ? `${activeMembers.length} نشط` : `${activeMembers.length} active`} index={0} />
          <StatCard title={isArabic ? 'نشط' : 'Active'} value={activeMembers.length} icon={UserCheck} color="green" subtitle={isArabic ? `${expiringSoon.length} ينتهي قريبًا` : `${expiringSoon.length} expiring soon`} index={1} />
          <StatCard title={isArabic ? 'غير نشيط' : 'No Active'} value={noactiveMembers.length} icon={UserRoundX} color="yellow" subtitle={isArabic ? 'لم يحضروا ٧ أيام' : 'No show 7 days'} index={2} />
          <StatCard title={isArabic ? 'منتهي' : 'Expired'} value={expiredMembers.length} icon={UserX} color="red" subtitle={isArabic ? 'يحتاج تجديد' : 'Need renewal'} index={3} />
          <StatCard title={isArabic ? 'حضور اليوم' : 'Today Attendance'} value={stats?.today_attendance || 0} icon={QrCode} color="yellow" index={4} />
        </div>

        {isOwner() && (
        <>
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-lg">{isArabic ? 'إجراءات سريعة' : 'Quick Actions'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {quickActions.map((action, i) => (
                <div key={action.label}>
                  <Button variant="ghost" className="w-full justify-between" onClick={() => navigate(action.path)}>
                    <span className="flex items-center gap-2"><action.icon className="w-4 h-4" />{action.label}</span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">{isArabic ? 'ينتهي قريبًا' : 'Expiring Soon'}</CardTitle>
              <Badge variant="warning">{isArabic ? `${expiringSoon.length} تنبيه` : `${expiringSoon.length} alerts`}</Badge>
            </CardHeader>
            <CardContent>
              {expiringSoon.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">{isArabic ? 'لا يوجد أعضاء تنتهي خلال 7 أيام' : 'No members expiring in 7 days'}</p>
              ) : (
                <div className="space-y-2">
                  {expiringSoon.slice(0, 5).map((m) => {
                    const days = getDaysLeft(m.end_date)
                    return (
                      <div key={m.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/10"
                      >
                        <div>
                          <p className="text-sm font-medium text-foreground">{m.name}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(m.end_date)}</p>
                        </div>
                        <Badge variant={days <= 3 ? 'destructive' : 'warning'}>{isArabic ? `${formatNumber(days)} يوم متبقي` : `${formatNumber(days)}d left`}</Badge>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">{isArabic ? 'ملخص الإيرادات' : 'Revenue Summary'}</CardTitle>
              <Badge variant="secondary">{isArabic ? 'هذا الشهر' : 'This Month'}</Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <span className="text-muted-foreground">{isArabic ? 'إيرادات الخطط' : 'Plan Revenue'}</span>
                  <span className="text-lg font-bold text-primary">{formatCurrency(stats?.month_revenue || 0)}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <span className="text-muted-foreground">{isArabic ? 'ربح المكملات' : 'Supplement Profit'}</span>
                  <span className="text-lg font-bold text-primary">{formatCurrency(stats?.supplement_profit || 0)}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <span className="font-medium text-foreground">{isArabic ? 'إجمالي الإيرادات' : 'Total Revenue'}</span>
                  <span className="text-xl font-bold text-foreground">{formatCurrency(stats?.total_revenue || 0)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        </>
        )}
      </div>
    </PageTransition>
  )
}
