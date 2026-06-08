import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Edit, Trash2, CreditCard, Activity, Gift, Snowflake, Users } from 'lucide-react'
import { invoke } from '@/lib/tauri'
import PageTransition from '@/components/shared/PageTransition'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { formatCurrency, generateId } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { Plan } from '@/types'
import { useLanguage } from '@/lib/i18n'

export default function PlansPage() {
  const { t, isArabic } = useLanguage()
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', duration_months: 1, price: 0, inbody_count: 0, invitation_count: 0, freeze_days: 0, private_sessions: 0 })

  const load = async () => {
    try {
      const p = await invoke('get_plans')
      if (p) setPlans(p as Plan[])
    } catch {}
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const resetForm = () => {
    setForm({ name: '', duration_months: 1, price: 0, inbody_count: 0, invitation_count: 0, freeze_days: 0, private_sessions: 0 })
    setEditId(null)
  }

  const handleSubmit = async () => {
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

  if (loading) return <PageTransition><div className="grid gap-4 md:grid-cols-3">{[1,2,3].map((i) => <div key={i} className="h-48 rounded-xl skeleton" />)}</div></PageTransition>

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{t('plans.count', { count: plans.length })}</h2>
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
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="border-yellow-500/20 hover:border-yellow-500/40 transition-all h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-white">{p.name}</CardTitle>
                    <Badge>{p.duration_months}m</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-white mb-3">{formatCurrency(p.price)}</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-400"><Activity className="w-3.5 h-3.5 text-yellow-400" />InBody: {p.inbody_count}</div>
                    <div className="flex items-center gap-2 text-gray-400"><Gift className="w-3.5 h-3.5 text-green-400" />{t('plans.invites')}: {p.invitation_count}</div>
                    <div className="flex items-center gap-2 text-gray-400"><Snowflake className="w-3.5 h-3.5 text-yellow-400" />{t('plans.freeze')}: {p.freeze_days}d</div>
                    <div className="flex items-center gap-2 text-gray-400"><Users className="w-3.5 h-3.5 text-purple-400" />{t('plans.private')}: {p.private_sessions}</div>
                  </div>
                  <div className="flex gap-2 mt-4 pt-3 border-t border-[#1a2d45]">
                    <Button variant="ghost" size="sm" className="flex-1" onClick={() => handleEdit(p)}><Edit className="w-3 h-3 mr-1" />{t('common.edit')}</Button>
                    <Button variant="ghost" size="sm" className="flex-1 text-red-400" onClick={() => handleDelete(p.id)}><Trash2 className="w-3 h-3 mr-1" />{t('common.delete')}</Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </PageTransition>
  )
}
