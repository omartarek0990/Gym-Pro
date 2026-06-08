import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Users, UserCheck, UserX, QrCode, TrendingUp, DollarSign, AlertTriangle, ArrowRight } from 'lucide-react'
import { invoke } from '@/lib/tauri'
import StatCard from '@/components/shared/StatCard'
import PageTransition from '@/components/shared/PageTransition'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate, getDaysLeft, getDaysColor } from '@/lib/utils'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useNavigate } from 'react-router-dom'
import { DashboardStats, Member } from '@/types'

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      const result = await invoke('get_dashboard_stats')
      if (result) setStats(JSON.parse(result as string))
      const m = await invoke('get_members')
      if (m) setMembers(m as Member[])
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const activeMembers = members.filter((m) => m.status === 'active')
  const expiredMembers = members.filter((m) => m.status === 'expired')
  const expiringSoon = members.filter((m) => {
    const d = getDaysLeft(m.end_date)
    return m.status === 'active' && d >= 0 && d <= 7
  })

  const chartData = stats?.chart_data?.map((c: string) => JSON.parse(c)) || []

  const quickActions = [
    { label: 'Add Member', icon: Users, path: '/members', color: 'yellow' },
    { label: 'New Plan', icon: TrendingUp, path: '/plans', color: 'yellow' },
    { label: 'Scan Attendance', icon: QrCode, path: '/attendance', color: 'yellow' },
    { label: 'Sell Supplement', icon: DollarSign, path: '/supplements', color: 'yellow' },
  ]

  if (loading) {
    return (
      <PageTransition>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[1,2,3,4].map((i) => (
            <div key={i} className="h-[120px] rounded-xl skeleton" />
          ))}
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Members" value={members.length} icon={Users} color="yellow" subtitle={`${activeMembers.length} active`} index={0} />
          <StatCard title="Active" value={activeMembers.length} icon={UserCheck} color="green" subtitle={`${expiringSoon.length} expiring soon`} index={1} />
          <StatCard title="Expired" value={expiredMembers.length} icon={UserX} color="red" subtitle="Need renewal" index={2} />
          <StatCard title="Today Attendance" value={stats?.today_attendance || 0} icon={QrCode} color="yellow" index={3} />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2 border-[#1a2d45] bg-[#0d1117]/80">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg text-white">Revenue Overview</CardTitle>
              <Badge variant="secondary">Monthly</Badge>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EAB308" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#EAB308" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a2d45" />
                    <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} />
                    <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid #1a2d45', borderRadius: '8px', color: '#fff' }} />
                    <Area type="monotone" dataKey="revenue" stroke="#EAB308" strokeWidth={2} fill="url(#revGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#1a2d45] bg-[#0d1117]/80">
            <CardHeader>
              <CardTitle className="text-lg text-white">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {quickActions.map((action, i) => (
                <motion.div key={action.label} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 * i }}>
                  <Button variant="ghost" className="w-full justify-between text-gray-300 hover:text-white hover:bg-yellow-600/10" onClick={() => navigate(action.path)}>
                    <span className="flex items-center gap-2"><action.icon className="w-4 h-4" />{action.label}</span>
                    <ArrowRight className="w-4 h-4 text-gray-500" />
                  </Button>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-[#1a2d45] bg-[#0d1117]/80">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg text-white">Expiring Soon</CardTitle>
              <Badge variant="warning">{expiringSoon.length} alerts</Badge>
            </CardHeader>
            <CardContent>
              {expiringSoon.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No members expiring in 7 days</p>
              ) : (
                <div className="space-y-2">
                  {expiringSoon.slice(0, 5).map((m) => {
                    const days = getDaysLeft(m.end_date)
                    return (
                      <motion.div key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/10"
                      >
                        <div>
                          <p className="text-sm text-white font-medium">{m.name}</p>
                          <p className="text-xs text-gray-400">{formatDate(m.end_date)}</p>
                        </div>
                        <Badge variant={days <= 3 ? 'destructive' : 'warning'}>{days}d left</Badge>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-[#1a2d45] bg-[#0d1117]/80">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg text-white">Revenue Summary</CardTitle>
              <Badge variant="secondary">This Month</Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                  <span className="text-gray-400">Plan Revenue</span>
                  <span className="text-lg font-bold text-yellow-400">{formatCurrency(stats?.month_revenue || 0)}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                  <span className="text-gray-400">Supplement Profit</span>
                  <span className="text-lg font-bold text-yellow-400">{formatCurrency(stats?.supplement_profit || 0)}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-600/10 border border-yellow-500/20">
                  <span className="text-white font-medium">Total Revenue</span>
                  <span className="text-xl font-bold text-white">{formatCurrency(stats?.total_revenue || 0)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageTransition>
  )
}
