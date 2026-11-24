import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Activity, Gift, Snowflake, Users } from 'lucide-react'
import { invoke } from '@/lib/tauri'
import PageTransition from '@/components/shared/PageTransition'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { formatCurrency, formatNumber, generateId, getPlanDurationDays } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { Plan } from '@/types'
import { useLanguage } from '@/lib/i18n'
import { useAuth } from '@/contexts/AuthContext'

export default function PlansPage() {
  const { t, isArabic } = useLanguage()
  const { isOwner } = useAuth()
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [bestSellerId, setBestSellerId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', duration_months: 1, price: 0, inbody_count: 0, invitation_count: 0, freeze_days: 0, private_sessions: 0 })
  const [topStats, setTopStats] = useState<[string, number][]>([])

  const load = async () => {
    try {
      const p = await invoke('get_plans')
      if (p) setPlans(p as Plan[])
      const stats = await invoke('get_plan_stats') as string
      if (stats) {
        const rows: [string, number][] = JSON.parse(stats)
        setTopStats(rows)
        if (rows.length > 0 && rows[0][1] > 0) setBestSellerId(rows[0][0])
      }
    } catch {}
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const resetForm = () => {
    setForm({ name: '', duration_months: 1, price: 0, inbody_count: 0, invitation_count: 0, freeze_days: 0, private_sessions: 0 })
    setEditId(null)
  }

  const handleSubmit = async () => {
    try {
      if (editId) {
        await invoke('update_plan', { id: editId, ...form })
        toast({ title: isArabic ? 'تم تحديث الخطة' : 'Plan Updated', variant: 'success' })
      } else {
        await invoke('add_plan', { id: generateId(), ...form })
        toast({ title: isArabic ? 'تمت إضافة الخطة' : 'Plan Added', variant: 'success' })
      }
      setDialogOpen(false)
      resetForm()
      load()
    } catch (err) {
      toast({ title: isArabic ? 'فشل' : 'Failed', description: String(err), variant: 'destructive' })
    }
  }

  const handleEdit = (p: Plan) => {
    setForm({ name: p.name, duration_months: p.duration_months, price: p.price, inbody_count: p.inbody_count, invitation_count: p.invitation_count, freeze_days: p.freeze_days, private_sessions: p.private_sessions })
    setEditId(p.id)
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    await invoke('delete_plan', { id })
    toast({ title: isArabic ? 'تم حذف الخطة' : 'Plan Deleted', variant: 'destructive' })
    load()
  }

  if (loading) return <PageTransition><div className="grid gap-4 md:grid-cols-3">{[1,2,3].map((i) => <div key={i} className="h-48 rounded-xl bg-muted" />)}</div></PageTransition>

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <h2 className="text-lg font-semibold text-foreground shrink-0">{t('plans.count', { count: plans.length })}</h2>
            {topStats.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
                <span className="font-medium text-foreground/80">{isArabic ? 'الأكثر مبيعاً' : 'Top Sold'}:</span>
                {topStats.slice(0, 3).map(([id, count], idx) => {
                  const plan = plans.find(p => p.id === id)
                  return plan ? (
                    <span key={id} className="flex items-center gap-1">
                      <span className="text-yellow-500 font-bold">{idx + 1}</span>
                      <span>{plan.name}</span>
                      <span className="text-muted-foreground/60">({count})</span>
                      {idx < Math.min(topStats.length, 3) - 1 && <span className="text-muted-foreground/30">·</span>}
                    </span>
                  ) : null
                })}
              </div>
            )}
          </div>
          {isOwner() && (
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm() }}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="w-4 h-4" />{t('plans.addPlan')}</Button></DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader><DialogTitle>{editId ? t('plans.editPlan') : t('plans.addPlan')}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2"><Label>{t('plans.planName')}</Label><Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>{t('plans.durationMonths')}</Label><Input type="number" value={form.duration_months} onChange={(e) => setForm({...form, duration_months: parseInt(e.target.value) || 0})} /></div>
                  <div className="space-y-2"><Label>{t('plans.price')}</Label><Input type="number" value={form.price || ''} onChange={(e) => setForm({...form, price: parseFloat(e.target.value) || 0})} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>{t('plans.inbodyCount')}</Label><Input type="number" value={form.inbody_count} onChange={(e) => setForm({...form, inbody_count: parseInt(e.target.value) || 0})} /></div>
                  <div className="space-y-2"><Label>{t('plans.invitations')}</Label><Input type="number" value={form.invitation_count} onChange={(e) => setForm({...form, invitation_count: parseInt(e.target.value) || 0})} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>{t('plans.freeze')}</Label><Input type="number" value={form.freeze_days} onChange={(e) => setForm({...form, freeze_days: parseInt(e.target.value) || 0})} /></div>
                  <div className="space-y-2"><Label>{t('plans.privateSessions')}</Label><Input type="number" value={form.private_sessions} onChange={(e) => setForm({...form, private_sessions: parseInt(e.target.value) || 0})} /></div>
                </div>
                <Button className="w-full" onClick={handleSubmit}>{editId ? t('common.update') : t('common.add')} {t('members.plan')}</Button>
              </div>
            </DialogContent>
          </Dialog>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((p, i) => (
            <div key={p.id}>
              <Card className="border-primary/20 hover:border-primary/40 transition-colors h-full">
                <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <CardTitle>{p.name}</CardTitle>
                        {bestSellerId === p.id && (
                          <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white text-[10px] px-1.5 py-0">
                            {isArabic ? 'الأكثر مبيعاً' : 'Best Seller'}
                          </Badge>
                        )}
                      </div>
                      <Badge>{formatNumber(p.duration_months)}m / {formatNumber(getPlanDurationDays(p.duration_months))}d</Badge>
                    </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-foreground mb-3">{formatCurrency(p.price)}</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground"><Activity className="w-3.5 h-3.5 text-primary" />InBody: {formatNumber(p.inbody_count)}</div>
                        <div className="flex items-center gap-2 text-muted-foreground"><Gift className="w-3.5 h-3.5 text-green-400" />{t('plans.invites')}: {formatNumber(p.invitation_count)}</div>
                        <div className="flex items-center gap-2 text-muted-foreground"><Snowflake className="w-3.5 h-3.5 text-primary" />{t('plans.freeze')}: {formatNumber(p.freeze_days)}d</div>
                        <div className="flex items-center gap-2 text-muted-foreground"><Users className="w-3.5 h-3.5 text-purple-400" />{t('plans.private')}: {formatNumber(p.private_sessions)}</div>
                  </div>
                  {isOwner() && (
                  <div className="flex gap-2 mt-4 pt-3 border-t border-border">
                    <Button variant="ghost" size="sm" className="flex-1" onClick={() => handleEdit(p)}><Edit className="w-3 h-3 mr-1" />{t('common.edit')}</Button>
                    <Button variant="ghost" size="sm" className="flex-1 text-destructive" onClick={() => handleDelete(p.id)}><Trash2 className="w-3 h-3 mr-1" />{t('common.delete')}</Button>
                  </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </PageTransition>
  )
}


