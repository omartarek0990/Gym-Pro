import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, QrCode, TrendingUp, Dumbbell } from 'lucide-react'
import { invoke } from '@/lib/tauri'
import PageTransition from '@/components/shared/PageTransition'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDate, formatTime, getDaysLeft, getDaysColor, formatCurrency } from '@/lib/utils'
import { Member, Attendance, SupplementOrder } from '@/types'
import { useLanguage } from '@/lib/i18n'

export default function ReportsPage() {
  const { isArabic } = useLanguage()
  const [members, setMembers] = useState<Member[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [orders, setOrders] = useState<SupplementOrder[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const m = await invoke('get_members')
      if (m) setMembers(m as Member[])
      const a = await invoke('get_all_attendance')
      if (a) setAttendance(a as Attendance[])
      const o = await invoke('get_supplement_orders')
      if (o) setOrders(o as SupplementOrder[])
    } catch {}
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const expired = members.filter((m) => m.status === 'expired')
  const expiring3 = members.filter((m) => {
    const d = getDaysLeft(m.end_date)
    return m.status === 'active' && d >= 0 && d <= 3
  })
  const todayAtt = attendance.filter((a) => a.date === new Date().toISOString().split('T')[0])

  // Top supplements by order count
  const supMap = new Map<string, { name: string; qty: number; revenue: number }>()
  orders.forEach((o) => {
    const id = o.supplement_id
    if (!supMap.has(id)) supMap.set(id, { name: o.supplement_name || id, qty: 0, revenue: 0 })
    const d = supMap.get(id)!
    d.qty += o.qty
    d.revenue += o.total_price
  })
  const topSupplements = [...supMap.entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 10)

  if (loading) return <PageTransition><div className="space-y-4">{[1,2,3].map((i) => <div key={i} className="h-32 rounded-xl skeleton" />)}</div></PageTransition>

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: isArabic ? 'الأعضاء المنتهية' : 'Expired Members', value: expired.length, icon: AlertTriangle, color: 'text-red-400' },
            { label: isArabic ? 'ينتهي خلال 3 أيام' : 'Expiring ≤3 Days', value: expiring3.length, icon: AlertTriangle, color: 'text-yellow-400' },
            { label: isArabic ? 'حضور اليوم' : "Today's Attendance", value: todayAtt.length, icon: QrCode, color: 'text-green-400' },
            { label: isArabic ? 'أعلى المكملات' : 'Top Supplements', value: topSupplements.length, icon: Dumbbell, color: 'text-yellow-400' },
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}>
              <Card className="border-[#1a2d45]">
                <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-400">{s.label}</CardTitle></CardHeader>
                <CardContent><p className={`text-2xl font-bold ${s.color}`}>{s.value}</p></CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <Tabs defaultValue="expired">
          <TabsList>
            <TabsTrigger value="expired">{isArabic ? 'الأعضاء المنتهية' : 'Expired Members'}</TabsTrigger>
            <TabsTrigger value="expiring">{isArabic ? 'ينتهي قريبًا (3 أيام)' : 'Expiring Soon (3d)'}</TabsTrigger>
            <TabsTrigger value="attendance">{isArabic ? 'حضور اليوم' : "Today's Attendance"}</TabsTrigger>
            <TabsTrigger value="top">{isArabic ? 'أعلى المكملات' : 'Top Supplements'}</TabsTrigger>
          </TabsList>

          <TabsContent value="expired">
            <Card className="border-[#1a2d45]">
              <CardContent className="p-0">
                {expired.length === 0 ? <p className="text-gray-500 text-center py-8">{isArabic ? 'لا يوجد أعضاء منتهية' : 'No expired members'}</p>
                : <div className="divide-y divide-[#1a2d45]">{
                  expired.map((m, i) => (
                    <motion.div key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="flex items-center justify-between p-3">
                      <div><p className="text-sm text-white">{m.name}</p><p className="text-xs text-gray-400">{m.phone}</p></div>
                      <Badge variant="destructive">{isArabic ? `منتهي ${formatDate(m.end_date)}` : `Expired ${formatDate(m.end_date)}`}</Badge>
                    </motion.div>
                  ))
                }</div>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="expiring">
            <Card className="border-[#1a2d45]">
              <CardContent className="p-0">
                {expiring3.length === 0 ? <p className="text-gray-500 text-center py-8">{isArabic ? 'لا يوجد أعضاء تنتهي خلال 3 أيام' : 'No members expiring in 3 days'}</p>
                : <div className="divide-y divide-[#1a2d45]">{
                  expiring3.map((m, i) => (
                    <motion.div key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="flex items-center justify-between p-3">
                      <div><p className="text-sm text-white">{m.name}</p><p className="text-xs text-gray-400">{formatDate(m.end_date)}</p></div>
                      <Badge variant="warning">{isArabic ? `${getDaysLeft(m.end_date)} يوم متبقي` : `${getDaysLeft(m.end_date)}d left`}</Badge>
                    </motion.div>
                  ))
                }</div>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attendance">
            <Card className="border-[#1a2d45]">
              <CardContent className="p-0">
                {todayAtt.length === 0 ? <p className="text-gray-500 text-center py-8">{isArabic ? 'لا يوجد حضور اليوم' : 'No attendance today'}</p>
                : <div className="divide-y divide-[#1a2d45]">{
                  todayAtt.map((a, i) => {
                    const m = members.find((x) => x.id === a.member_id)
                    return (
                      <motion.div key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="flex items-center justify-between p-3">
                        <div><p className="text-sm text-white">{m?.name || (isArabic ? 'غير معروف' : 'Unknown')}</p><p className="text-xs text-gray-400">{a.method === 'Manual' && isArabic ? 'يدوي' : a.method}</p></div>
                        <span className="text-xs text-gray-400">{formatTime(a.time)}</span>
                      </motion.div>
                    )
                  })
                }</div>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="top">
            <Card className="border-[#1a2d45]">
              <CardContent className="p-0">
                {topSupplements.length === 0 ? <p className="text-gray-500 text-center py-8">{isArabic ? 'لا توجد مبيعات مكملات' : 'No supplement sales'}</p>
                : <div className="divide-y divide-[#1a2d45]">{
                  topSupplements.map(([id, data], i) => (
                    <motion.div key={id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-6">{i + 1}.</span>
                        <div><p className="text-sm text-white">{data.name}</p><p className="text-xs text-gray-400">{isArabic ? `تم بيع ${data.qty} وحدة` : `${data.qty} units sold`}</p></div>
                      </div>
                      <span className="text-sm text-green-400">{formatCurrency(data.revenue)}</span>
                    </motion.div>
                  ))
                }</div>}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageTransition>
  )
}
