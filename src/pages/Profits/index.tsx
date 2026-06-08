import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, DollarSign, CalendarDays, FileDown } from 'lucide-react'
import { invoke } from '@/lib/tauri'
import PageTransition from '@/components/shared/PageTransition'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { ProfitData, Renewal, SupplementOrder } from '@/types'

export default function ProfitsPage() {
  const [profits, setProfits] = useState<ProfitData | null>(null)
  const [renewals, setRenewals] = useState<Renewal[]>([])
  const [orders, setOrders] = useState<SupplementOrder[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const p = await invoke('get_profits')
      if (p) setProfits(JSON.parse(p as string))
      const r = await invoke('get_all_renewals')
      if (r) setRenewals(r as Renewal[])
      const o = await invoke('get_supplement_orders')
      if (o) setOrders(o as SupplementOrder[])
    } catch {}
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const exportToExcel = () => {
    let csv = 'Type,Date,Amount\n'
    renewals.forEach((r) => { csv += `Plan Renewal,${r.date},${r.amount}\n` })
    orders.forEach((o) => { csv += `Supplement Order,${o.date},${o.total_price}\n` })
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `profits_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: 'Exported to CSV', variant: 'success' })
  }

  const combined: { date: string; type: string; amount: number; profit: number }[] = [
    ...renewals.map((r) => ({ date: r.date, type: 'Plan Renewal', amount: r.amount, profit: r.amount })),
    ...orders.map((o) => ({ date: o.date, type: 'Supplement Order', amount: o.total_price, profit: o.profit })),
  ].sort((a, b) => b.date.localeCompare(a.date))

  if (loading) return <PageTransition><div className="grid gap-4 sm:grid-cols-4">{[1,2,3,4].map((i) => <div key={i} className="h-24 rounded-xl skeleton" />)}</div></PageTransition>

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Total Revenue', value: profits?.total || 0, color: 'text-yellow-400', sub: `${formatCurrency(profits?.total_plan || 0)} plans + ${formatCurrency(profits?.total_supplement_profit || 0)} supplements` },
            { label: 'Today', value: profits?.today || 0, color: 'text-green-400', sub: `Plans: ${formatCurrency(profits?.today_plan || 0)}` },
            { label: 'This Month', value: profits?.month || 0, color: 'text-yellow-400', sub: `Plans: ${formatCurrency(profits?.month_plan || 0)}` },
            { label: 'This Year', value: profits?.year || 0, color: 'text-purple-400', sub: `Plans: ${formatCurrency(profits?.year_plan || 0)}` },
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="border-[#1a2d45]">
                <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-400">{s.label}</CardTitle></CardHeader>
                <CardContent>
                  <p className={`text-2xl font-bold ${s.color}`}>{formatCurrency(s.value)}</p>
                  <p className="text-xs text-gray-500 mt-1">{s.sub}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Combined Transactions</h3>
          <Button variant="secondary" size="sm" className="gap-2" onClick={exportToExcel}>
            <FileDown className="w-4 h-4" />Export CSV
          </Button>
        </div>

        <Card className="border-[#1a2d45]">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1a2d45] text-xs text-gray-400 uppercase">
                    <th className="text-left p-3 font-medium">Date</th>
                    <th className="text-left p-3 font-medium">Type</th>
                    <th className="text-right p-3 font-medium">Amount</th>
                    <th className="text-right p-3 font-medium">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {combined.slice(0, 100).map((c, i) => (
                    <motion.tr key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }}
                      className="border-b border-[#1a2d45]/50 hover:bg-white/5"
                    >
                      <td className="p-3 text-sm text-gray-300">{c.date}</td>
                      <td className="p-3"><Badge variant={c.type === 'Plan Renewal' ? 'default' : 'secondary'} className="text-xs">{c.type}</Badge></td>
                      <td className="p-3 text-sm text-right text-green-400">{formatCurrency(c.amount)}</td>
                      <td className="p-3 text-sm text-right text-yellow-400">{formatCurrency(c.profit)}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            {combined.length === 0 && <p className="text-gray-500 text-center py-8">No transactions</p>}
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  )
}
