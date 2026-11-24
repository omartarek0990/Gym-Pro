import { useState, useEffect, useMemo } from 'react'
import { TrendingUp, DollarSign, CalendarDays, FileDown, Package, BarChart3 } from 'lucide-react'
import { invoke } from '@/lib/tauri'
import PageTransition from '@/components/shared/PageTransition'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { useExport } from '@/hooks/useExport'
import { ProfitData, Renewal, SupplementOrder } from '@/types'
import { useLanguage } from '@/lib/i18n'

export default function ProfitsPage() {
  const { isArabic } = useLanguage()
  const [profits, setProfits] = useState<ProfitData | null>(null)
  const [renewals, setRenewals] = useState<Renewal[]>([])
  const [orders, setOrders] = useState<SupplementOrder[]>([])
  const { exportToExcel } = useExport()
  const [loading, setLoading] = useState(true)
  const [monthlyOpen, setMonthlyOpen] = useState(false)

  const load = async () => {
    try {
      const [p, r, o] = await Promise.all([
        invoke('get_profits'),
        invoke('get_all_renewals'),
        invoke('get_supplement_orders'),
      ])
      if (p) setProfits(JSON.parse(p as string))
      if (r) setRenewals(r as Renewal[])
      if (o) setOrders(o as SupplementOrder[])
    } catch {}
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleExport = () => {
    const summary = [
      { Category: '=== SUMMARY ===', Plans: '', Supplements: '', Total: '' },
      { Category: 'Total Revenue', Plans: String(profits?.total_plan || 0), Supplements: String(profits?.total_supplement_profit || 0), Total: String(profits?.total || 0) },
      { Category: 'Today', Plans: String(profits?.today_plan || 0), Supplements: String(profits?.today_supplement || 0), Total: String(profits?.today || 0) },
      { Category: 'This Month', Plans: String(profits?.month_plan || 0), Supplements: String(profits?.month_supplement || 0), Total: String(profits?.month || 0) },
      { Category: 'This Year', Plans: String(profits?.year_plan || 0), Supplements: String(profits?.year_supplement || 0), Total: String(profits?.year || 0) },
      { Category: '', Plans: '', Supplements: '', Total: '' },
      { Category: '=== DETAIL TRANSACTIONS ===', Plans: '', Supplements: '', Total: '' },
      ...combined.map(c => ({ Category: c.date, Plans: c.type, Supplements: String(c.amount), Total: String(c.profit) })),
    ]
    exportToExcel(`profits_${new Date().toISOString().split('T')[0]}`, [
      { header: 'Category', key: 'Category' },
      { header: 'Plans', key: 'Plans' },
      { header: 'Supplements', key: 'Supplements' },
      { header: 'Total', key: 'Total' },
    ], summary)
  }

  const calcRevenue = (filter: (r: Renewal) => boolean) => {
    let total = 0
    for (const r of renewals) {
      if (!filter(r)) continue
      total += r.amount
    }
    return total
  }

  const todayStr = new Date().toISOString().split('T')[0]
  const thisMonth = new Date().toISOString().slice(0, 7)
  const thisYear = new Date().toISOString().slice(0, 4)

  const totalRev = useMemo(() => calcRevenue(() => true), [renewals])
  const todayRev = useMemo(() => calcRevenue((r) => r.date === todayStr), [renewals, todayStr])
  const monthRev = useMemo(() => calcRevenue((r) => r.date.startsWith(thisMonth)), [renewals, thisMonth])
  const yearRev = useMemo(() => calcRevenue((r) => r.date.startsWith(thisYear)), [renewals, thisYear])

  type CombinedItem = { date: string; type: 'Plan Renewal' | 'Plan Upgrade' | 'Supplement Order'; amount: number; profit: number }
  const combined: CombinedItem[] = useMemo(() => [
    ...renewals.map((r) => ({ date: r.date, type: (r.rtype === 'upgrade' ? 'Plan Upgrade' : 'Plan Renewal') as CombinedItem['type'], amount: r.amount, profit: r.amount })),
    ...orders.map((o) => ({ date: o.date, type: 'Supplement Order' as CombinedItem['type'], amount: o.total_price, profit: o.profit })),
  ].sort((a, b) => b.date.localeCompare(a.date)), [renewals, orders])

  const monthNamesEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const monthNamesAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']

  const last12Months = useMemo(() => {
    const arr: { key: string; label: string }[] = []
    const now = new Date()
    const names = isArabic ? monthNamesAr : monthNamesEn
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      arr.push({ key, label: `${names[d.getMonth()]} ${d.getFullYear()}` })
    }
    return arr
  }, [isArabic])

  const monthlyRows = useMemo(() => last12Months.map((m) => {
    const membership = renewals.filter((r) => r.date.startsWith(m.key)).reduce((s, r) => s + (r.amount || 0), 0)
    const supplement = orders.filter((o) => o.date.startsWith(m.key)).reduce((s, o) => s + (o.profit || 0), 0)
    return { ...m, membership, supplement, total: membership + supplement }
  }), [last12Months, renewals, orders])

  const handleExportMonthly = () => {
    const rows = monthlyRows.map((r) => ({
      Month: r.label,
      Memberships: String(r.membership),
      Supplements: String(r.supplement),
      Total: String(r.total),
    }))
    exportToExcel(`monthly_profits_${new Date().toISOString().split('T')[0]}`, [
      { header: 'Month', key: 'Month' },
      { header: 'Memberships', key: 'Memberships' },
      { header: 'Supplements', key: 'Supplements' },
      { header: 'Total', key: 'Total' },
    ], rows)
  }

  if (loading) return <PageTransition><div className="grid gap-4 sm:grid-cols-4">{[1,2,3,4].map((i) => <div key={i} className="h-24 rounded-xl bg-muted" />)}</div></PageTransition>

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Total Revenue', value: profits?.total || 0, color: 'text-primary', icon: TrendingUp,
              gym: totalRev, supp: profits?.total_supplement_profit || 0,
            },
            { label: 'Today', value: profits?.today || 0, color: 'text-green-400', icon: DollarSign,
              gym: todayRev, supp: profits?.today_supplement || 0,
            },
            { label: 'This Month', value: profits?.month || 0, color: 'text-primary', icon: CalendarDays,
              gym: monthRev, supp: profits?.month_supplement || 0, monthly: true,
            },
            { label: 'This Year', value: profits?.year || 0, color: 'text-purple-400', icon: CalendarDays,
              gym: yearRev, supp: profits?.year_supplement || 0,
            },
          ].map((s, i) => (
            <div key={i} className={s.monthly ? 'cursor-pointer' : ''} onClick={s.monthly ? () => setMonthlyOpen(true) : undefined} title={s.monthly ? (isArabic ? 'عرض آخر 12 شهر' : 'View last 12 months') : undefined}>
              <Card className={s.monthly ? 'hover:border-primary/40 transition-colors' : ''}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground flex items-center justify-between gap-2">
                    {s.label}
                    {s.monthly && (
                      <span className="flex items-center gap-1 text-[10px] font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">
                        <BarChart3 className="w-3 h-3" />{isArabic ? 'آخر 12 شهر' : '12 Months'}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-2xl font-bold ${s.color}`}>{formatCurrency(s.value)}</p>
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-muted-foreground"><TrendingUp className="w-3 h-3" /> {isArabic ? 'الاشتراكات' : 'Memberships'}</span>
                      <span className="font-semibold text-foreground">{formatCurrency(s.gym)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-muted-foreground"><Package className="w-3 h-3" /> {isArabic ? 'المكملات' : 'Supplements'}</span>
                      <span className="font-semibold text-foreground">{formatCurrency(s.supp)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Combined Transactions</h3>
          <Button variant="secondary" size="sm" className="gap-2" onClick={handleExport}>
            <FileDown className="w-4 h-4" />Export Excel
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground uppercase">
                    <th className="text-left p-3 font-medium">Date</th>
                    <th className="text-left p-3 font-medium">Type</th>
                    <th className="text-right p-3 font-medium">Amount</th>
                    <th className="text-right p-3 font-medium">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {combined.slice(0, 100).map((c, i) => (
                    <tr key={i}
                      className="border-b border-border/50 hover:bg-muted"
                    >
                      <td className="p-3 text-sm text-muted-foreground">{c.date}</td>
                      <td className="p-3"><Badge variant={c.type === 'Plan Renewal' ? 'default' : 'secondary'} className="text-xs">{c.type}</Badge></td>
                      <td className="p-3 text-sm text-right text-green-400">{formatCurrency(c.amount)}</td>
                      <td className="p-3 text-sm text-right text-primary">{formatCurrency(c.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {combined.length === 0 && <p className="text-muted-foreground text-center py-8">No transactions</p>}
          </CardContent>
        </Card>

        <Dialog open={monthlyOpen} onOpenChange={setMonthlyOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>{isArabic ? 'الأرباح الشهرية (آخر 12 شهر)' : 'Monthly Profits (Last 12 Months)'}</DialogTitle>
            </DialogHeader>
            <div className="flex justify-end">
              <Button variant="secondary" size="sm" className="gap-2" onClick={handleExportMonthly}>
                <FileDown className="w-4 h-4" />{isArabic ? 'تصدير Excel' : 'Export Excel'}
              </Button>
            </div>
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground uppercase">
                    <th className="text-left p-3 font-medium">{isArabic ? 'الشهر' : 'Month'}</th>
                    <th className="text-right p-3 font-medium">{isArabic ? 'الاشتراكات' : 'Memberships'}</th>
                    <th className="text-right p-3 font-medium">{isArabic ? 'المكملات' : 'Supplements'}</th>
                    <th className="text-right p-3 font-medium">{isArabic ? 'الإجمالي' : 'Total'}</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyRows.map((r) => (
                    <tr key={r.key} className="border-b border-border/50">
                      <td className="p-3 text-sm font-medium text-foreground">{r.label}</td>
                      <td className="p-3 text-sm text-right text-green-400">{formatCurrency(r.membership)}</td>
                      <td className="p-3 text-sm text-right text-amber-400">{formatCurrency(r.supplement)}</td>
                      <td className="p-3 text-sm text-right text-primary font-semibold">{formatCurrency(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  )
}
