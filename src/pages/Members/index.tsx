import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { Plus, Search, User, Trash2, RotateCcw, X, Calendar, Phone, QrCode, Activity, Users, Gift, Snowflake, Eye, CheckCircle, XCircle, AlertTriangle, Camera } from 'lucide-react'
import { invoke } from '@/lib/tauri'
import PageTransition from '@/components/shared/PageTransition'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { formatCurrency, formatDate, formatTime, getDaysLeft, getDaysColor, getStatusColor, generateId } from '@/lib/utils'
import { useCountdown } from '@/hooks/useCountdown'
import FrozenCountdown from '@/components/cards/FrozenCountdown'
import FreezePreview from '@/components/cards/FreezePreview'
import BarcodeCard from '@/components/cards/BarcodeCard'
import { toast } from '@/hooks/useToast'
import { Member, Plan, Attendance, Renewal } from '@/types'
import { useLanguage } from '@/lib/i18n'
import JsBarcode from 'jsbarcode'
import { useLocation } from 'react-router-dom'

interface GeneratedMemberCard {
  memberId: string
  name: string
  phone: string
  planName: string
  planPrice: number
  endDate: string
  status: string
  cardCode: string
  photo: string
}

export default function MembersPage() {
  const { t, isArabic } = useLanguage()
  const location = useLocation()
  const [members, setMembers] = useState<Member[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [renewDialogOpen, setRenewDialogOpen] = useState(false)
  const [profileMember, setProfileMember] = useState<Member | null>(null)
  const [profileAttendance, setProfileAttendance] = useState<Attendance[]>([])
  const [profileRenewals, setProfileRenewals] = useState<Renewal[]>([])
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [form, setForm] = useState({ name: '', phone: '', card_code: '', plan_id: '' })
  const [renewForm, setRenewForm] = useState({ extend_from_end: true, plan_id: '' })
  const [editForm, setEditForm] = useState({ name: '', phone: '', card_code: '' })
  const [editCardValidation, setEditCardValidation] = useState<{ status: string; message?: string }>({ status: '' })
  const [freezeDialogOpen, setFreezeDialogOpen] = useState(false)
  const [freezeDays, setFreezeDays] = useState(1)
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({ open: false, title: '', message: '', onConfirm: () => {} })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const addFileInputRef = useRef<HTMLInputElement>(null)
  const [addPhotoPreview, setAddPhotoPreview] = useState('')
  const [generatedCard, setGeneratedCard] = useState<GeneratedMemberCard | null>(null)
  const [scannedReference, setScannedReference] = useState('')
  const addBarcodeRef = useRef<HTMLCanvasElement>(null)

  const handleAddPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg']
    if (!validTypes.includes(file.type)) {
      toast({
        title: isArabic ? 'خطأ في الملف' : 'Invalid File',
        description: isArabic ? 'يرجى اختيار صورة بصيغة png أو jpg فقط.' : 'Please select a png or jpg image only.',
        variant: 'destructive'
      })
      return
    }
    const reader = new FileReader()
    reader.onload = () => setAddPhotoPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profileMember) return

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg']
    if (!validTypes.includes(file.type)) {
      toast({
        title: isArabic ? 'خطأ في الملف' : 'Invalid File',
        description: isArabic ? 'يرجى اختيار صورة بصيغة png أو jpg فقط.' : 'Please select a png or jpg image only.',
        variant: 'destructive'
      })
      return
    }

    const reader = new FileReader()
    reader.onload = async () => {
      const base64Data = reader.result as string
      try {
        await invoke('update_member', {
          id: profileMember.id,
          name: profileMember.name,
          phone: profileMember.phone,
          card_code: profileMember.card_code,
          photo: base64Data,
          plan_id: profileMember.plan_id,
          start_date: profileMember.start_date,
          end_date: profileMember.end_date
        })

        toast({
          title: isArabic ? 'تم تحديث الصورة' : 'Photo Updated',
          description: isArabic ? 'تم حفظ صورة العميل بنجاح.' : 'Client photo has been saved successfully.',
          variant: 'success'
        })

        loadData()
        loadProfile(profileMember.id)
      } catch (err) {
        toast({
          title: isArabic ? 'فشل تحديث الصورة' : 'Update Failed',
          description: String(err),
          variant: 'destructive'
        })
      }
    }
    reader.onerror = () => {
      toast({
        title: isArabic ? 'فشل قراءة الملف' : 'File Read Failed',
        variant: 'destructive'
      })
    }
    reader.readAsDataURL(file)
  }

  const loadData = useCallback(async () => {
    try {
      const m = await invoke('get_members')
      if (m) setMembers(m as Member[])
      const p = await invoke('get_plans')
      if (p) setPlans(p as Plan[])
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const filtered = members.filter((m) => {
    const q = search.toLowerCase()
    const matchSearch = m.name.toLowerCase().includes(q) || m.phone.includes(q) || m.card_code.toLowerCase().includes(q)
    const matchStatus = statusFilter === 'all' || m.status === statusFilter
    return matchSearch && matchStatus
  })

  const getPlanName = (pid: string) => plans.find((p) => p.id === pid)?.name || 'N/A'

  useEffect(() => {
    const state = location.state as { openAddMember?: boolean; scannedCode?: string } | null
    if (!state?.openAddMember) return
    setScannedReference(state.scannedCode || '')
    setGeneratedCard(null)
    setAddDialogOpen(true)
    window.history.replaceState({}, document.title)
  }, [location.state])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        setScannedReference('')
        setGeneratedCard(null)
        setAddDialogOpen(true)
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  useEffect(() => {
    if (!generatedCard || !addBarcodeRef.current) return
    JsBarcode(addBarcodeRef.current, generatedCard.cardCode, {
      format: 'CODE128',
      width: 2,
      height: 72,
      displayValue: false,
      background: '#ffffff',
      lineColor: '#000000',
      margin: 8,
    })
  }, [generatedCard])

  useEffect(() => {
    if (!editForm.card_code || editForm.card_code.length < 3) { setEditCardValidation({ status: '' }); return }
    const timer = setTimeout(async () => {
      const r = await invoke('validate_card_code', { card_code: editForm.card_code }) as string
      if (r === 'valid') setEditCardValidation({ status: 'valid' })
      else if (r === 'not_found') setEditCardValidation({ status: 'invalid', message: isArabic ? 'كود البطاقة غير موجود. أنشئه من إدارة البطاقات أولًا.' : 'Card code not found. Create it from Card Manager first.' })
      else if (r === 'already_used') {
        // Check if it's the same card the member already has
        if (profileMember?.card_code === editForm.card_code) setEditCardValidation({ status: 'valid' })
        else setEditCardValidation({ status: 'invalid', message: isArabic ? 'هذه البطاقة مستخدمة بالفعل مع عضو آخر.' : 'This card is already used by another member.' })
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [editForm.card_code])

  const handleAdd = async () => {
    const plan = plans.find((p) => p.id === form.plan_id)
    if (!plan) return
    const id = generateId()
    const start = new Date().toISOString().split('T')[0]
    const end = new Date()
    end.setDate(end.getDate() + plan.duration_months * 30)
    const endDate = end.toISOString().split('T')[0]

    const generatedCardCode = await invoke('add_member', { id, name: form.name, phone: form.phone, card_code: '', photo: addPhotoPreview, plan_id: form.plan_id, start_date: start, end_date: endDate, status: 'active', plan_name: plan.name }) as string
    await invoke('renew_member', { id: generateId(), member_id: id, date: new Date().toISOString().split('T')[0], amount: plan.price, new_start: start, new_end: endDate, plan_name: plan.name, member_name: form.name })
    toast({ title: isArabic ? 'تمت إضافة العضو' : 'Member Added', description: isArabic ? `تمت إضافة ${form.name} بنجاح` : `${form.name} added successfully`, variant: 'success' })
    setGeneratedCard({
      memberId: id,
      name: form.name,
      phone: form.phone,
      planName: plan.name,
      planPrice: plan.price,
      endDate,
      status: 'active',
      cardCode: generatedCardCode,
      photo: addPhotoPreview,
    })
    loadData()
  }

  const closeAddDialog = () => {
    setAddDialogOpen(false)
    setForm({ name: '', phone: '', card_code: '', plan_id: '' })
    setAddPhotoPreview('')
    setGeneratedCard(null)
    setScannedReference('')
    if (addFileInputRef.current) addFileInputRef.current.value = ''
  }

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    return (parts[0]?.[0] || '?') + (parts[1]?.[0] || '')
  }

  const saveGeneratedMemberCard = async () => {
    if (!generatedCard) return
    const settings = await invoke('get_settings')
    const settingsMap: Record<string, string> = {}
    ;((settings || []) as { key: string; value: string }[]).forEach((setting) => { settingsMap[setting.key] = setting.value })
    const canvas = document.createElement('canvas')
    canvas.width = 800
    canvas.height = 450
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#111111'
    ctx.fillRect(0, 0, 800, 450)
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, 0, 800, 74)
    ctx.fillRect(0, 378, 800, 72)

    ctx.fillStyle = '#E8A020'
    ctx.font = '700 28px Arial'
    ctx.fillText(settingsMap.gym_name || 'My Gym', 36, 47)
    ctx.textAlign = 'right'
    ctx.fillText('GymPro', 764, 47)
    ctx.textAlign = 'left'

    ctx.beginPath()
    ctx.arc(82, 150, 42, 0, Math.PI * 2)
    ctx.fillStyle = '#2b210b'
    ctx.fill()
    ctx.fillStyle = '#E8A020'
    ctx.font = '700 30px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(getInitials(generatedCard.name), 82, 160)
    ctx.textAlign = 'left'

    ctx.fillStyle = '#FFFFFF'
    ctx.font = '700 34px Arial'
    ctx.fillText(generatedCard.name, 150, 136)
    ctx.fillStyle = '#888888'
    ctx.font = '22px Arial'
    ctx.fillText(`${generatedCard.planName} — ${formatCurrency(generatedCard.planPrice)}`, 150, 170)
    ctx.fillText(generatedCard.phone, 150, 204)

    ctx.fillStyle = '#E8A020'
    ctx.font = '700 24px Arial'
    ctx.fillText(`Card Code: ${generatedCard.cardCode}`, 36, 260)

    const barcodeCanvas = document.createElement('canvas')
    JsBarcode(barcodeCanvas, generatedCard.cardCode, {
      format: 'CODE128',
      width: 3,
      height: 92,
      displayValue: false,
      background: '#FFFFFF',
      lineColor: '#000000',
      margin: 10,
    })
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(36, 282, 420, 110)
    ctx.drawImage(barcodeCanvas, 46, 292, 400, 90)

    ctx.fillStyle = '#888888'
    ctx.font = '20px Arial'
    ctx.fillText(`Expiry date: ${formatDate(generatedCard.endDate)}`, 36, 421)
    ctx.fillStyle = '#0f3d1f'
    ctx.roundRect(640, 396, 112, 32, 16)
    ctx.fill()
    ctx.fillStyle = '#4ade80'
    ctx.font = '700 18px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('نشط', 696, 418)
    ctx.textAlign = 'left'

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) return
    const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()))
    const fileName = `${generatedCard.name}_${generatedCard.cardCode}.png`
    const folder = await invoke('save_member_card_png', { file_name: fileName, png_bytes: bytes }) as string
    toast({ title: `✅ تم حفظ الكارت في ${folder}`, variant: 'success' })
    closeAddDialog()
  }

  const handleEdit = async () => {
    if (!profileMember) return
    await invoke('update_member', { id: profileMember.id, ...editForm, photo: profileMember.photo, plan_id: profileMember.plan_id, start_date: profileMember.start_date, end_date: profileMember.end_date })
    toast({ title: isArabic ? 'تم التحديث' : 'Updated', variant: 'success' })
    setEditDialogOpen(false)
    loadData()
  }

  const handleDelete = async () => {
    const settings = await invoke('get_settings')
    const arr = (settings || []) as {key: string; value: string}[]
    const saved = arr.find((s: any) => s.key === 'delete_password')?.value || 'admin123'
    if (deletePassword !== saved) {
      setDeleteError(isArabic ? 'كلمة المرور غير صحيحة' : 'Wrong password')
      return
    }
    if (!profileMember) return
    await invoke('delete_member', { id: profileMember.id, name: profileMember.name })
    toast({ title: isArabic ? 'تم الحذف' : 'Deleted', description: isArabic ? `تم حذف ${profileMember.name}` : `${profileMember.name} removed`, variant: 'destructive' })
    setDeleteDialogOpen(false)
    setProfileMember(null)
    setDeletePassword('')
    setDeleteError('')
    loadData()
  }

  const handleRenew = async () => {
    if (!profileMember) return
    const plan = plans.find((p) => p.id === (renewForm.plan_id || profileMember.plan_id))
    if (!plan) return
    const baseDate = renewForm.extend_from_end
      ? new Date(profileMember.end_date || new Date())
      : new Date()
    const newStart = baseDate.toISOString().split('T')[0]
    const newEnd = new Date(baseDate)
    newEnd.setDate(newEnd.getDate() + plan.duration_months * 30)
    const endDateStr = newEnd.toISOString().split('T')[0]

    await invoke('renew_member', { id: generateId(), member_id: profileMember.id, date: new Date().toISOString().split('T')[0], amount: plan.price, new_start: newStart, new_end: endDateStr, plan_name: plan.name, member_name: profileMember.name })
    toast({ title: isArabic ? 'تم تجديد الاشتراك' : 'Membership Renewed', variant: 'success' })
    setRenewDialogOpen(false)
    loadData()
    loadProfile(profileMember.id)
  }

  const loadProfile = async (memberId: string) => {
    const att = await invoke('get_attendance', { member_id: memberId })
    if (att) setProfileAttendance(att as Attendance[])
    const ren = await invoke('get_renewals', { member_id: memberId })
    if (ren) setProfileRenewals(ren as Renewal[])
    const members = await invoke('get_members')
    if (members) {
      const updated = (members as Member[]).find((x) => x.id === memberId)
      if (updated) setProfileMember(updated)
    }
  }

  const openProfile = async (m: Member) => {
    setProfileMember(m)
    setEditForm({ name: m.name, phone: m.phone, card_code: m.card_code })
    await loadProfile(m.id)
  }

  const useFeature = async (feature: string) => {
    if (!profileMember) return
    await invoke('use_member_feature', { member_id: profileMember.id, feature })
    const m = await invoke('get_members')
    if (m) {
      const updated = (m as Member[]).find((x) => x.id === profileMember.id)
      if (updated) setProfileMember(updated)
    }
    loadData()
  }

  if (loading) return (
    <PageTransition>
      <div className="space-y-4">
        {[1,2,3,4,5].map((i) => <div key={i} className="h-16 rounded-lg skeleton" />)}
      </div>
    </PageTransition>
  )

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex gap-3 flex-1 flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input placeholder={isArabic ? 'بحث بالاسم / الهاتف / البطاقة...' : 'Search name / phone / card...'} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                  <SelectItem value="active">{t('common.active')}</SelectItem>
                  <SelectItem value="frozen">{t('common.frozen')}</SelectItem>
                  <SelectItem value="expired">{t('common.expired')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
            <Dialog open={addDialogOpen} onOpenChange={(o) => { if (o) setAddDialogOpen(true); else closeAddDialog() }}>
            <Button className="gap-2" onClick={() => setAddDialogOpen(true)}><Plus className="w-4 h-4" />{t('members.addMember')}</Button>
            <DialogContent className="sm:max-w-[450px]">
              <DialogHeader><DialogTitle>{t('members.addNewMember')}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                {scannedReference && (
                  <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3">
                    <p className="text-xs text-gray-400">{isArabic ? 'الكود الممسوح كمرجع' : 'Scanned reference'}</p>
                    <p className="font-mono text-sm font-bold text-yellow-400">{scannedReference}</p>
                  </div>
                )}
                <div className="space-y-2"><Label>{t('members.fullName')}</Label><Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} /></div>
                <div className="space-y-2"><Label>{t('members.phone')}</Label><Input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} /></div>
                <div className="space-y-2">
                  <Label>{t('members.plan')}</Label>
                  <Select value={form.plan_id} onValueChange={(v) => setForm({...form, plan_id: v})}>
                    <SelectTrigger><SelectValue placeholder={t('members.selectPlan')} /></SelectTrigger>
                    <SelectContent>
                      {plans.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name} - {formatCurrency(p.price)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('members.photo')}</Label>
                  <input type="file" ref={addFileInputRef} onChange={handleAddPhotoSelect} accept="image/png, image/jpeg, image/jpg" className="hidden" />
                  <div className="flex items-center gap-3">
                    <div
                      onClick={() => addFileInputRef.current?.click()}
                      className="w-16 h-16 rounded-full bg-yellow-600/20 border-2 border-dashed border-yellow-500/30 flex items-center justify-center cursor-pointer hover:border-yellow-400 transition-colors overflow-hidden shrink-0"
                    >
                      {addPhotoPreview ? (
                        <img src={addPhotoPreview} className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="w-5 h-5 text-yellow-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-300">{addPhotoPreview ? (isArabic ? 'صورة مختارة' : 'Photo selected') : (isArabic ? 'اضغط لاختيار صورة' : 'Click to select photo')}</p>
                      <p className="text-xs text-gray-500">PNG / JPG</p>
                    </div>
                    {addPhotoPreview && (
                      <Button variant="ghost" size="sm" className="text-red-400 h-8 w-8 p-0" onClick={() => { setAddPhotoPreview(''); if (addFileInputRef.current) addFileInputRef.current.value = '' }}>
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
                {!generatedCard ? (
                  <Button className="w-full" onClick={handleAdd}>{t('members.addMember')}</Button>
                ) : (
                  <div className="space-y-3 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 text-center">
                    <p className="text-xs text-gray-400">{t('members.cardCode')}</p>
                    <p className="font-mono text-lg font-bold text-yellow-400">{generatedCard.cardCode}</p>
                    <div className="rounded bg-white p-2">
                      <canvas ref={addBarcodeRef} className="mx-auto max-w-full" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button onClick={saveGeneratedMemberCard}>حفظ كارت العضو</Button>
                      <Button variant="outline" onClick={closeAddDialog}>إغلاق</Button>
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="border-[#1a2d45] bg-[#0d1117]/80">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1a2d45] text-xs text-gray-400 uppercase">
                    <th className="text-left p-3 font-medium">{t('members.name')}</th>
                    <th className="text-left p-3 font-medium">{t('members.cardCode')}</th>
                    <th className="text-left p-3 font-medium">{t('members.plan')}</th>
                    <th className="text-left p-3 font-medium">{isArabic ? 'البداية' : 'Start'}</th>
                    <th className="text-left p-3 font-medium">{isArabic ? 'النهاية' : 'End'}</th>
                    <th className="text-left p-3 font-medium">{isArabic ? 'الأيام المتبقية' : 'Days Left'}</th>
                    <th className="text-left p-3 font-medium">{isArabic ? 'الحالة' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m, i) => {
                    const days = getDaysLeft(m.end_date)
                    return (
                      <motion.tr
                        key={m.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.02 }}
                        className="border-b border-[#1a2d45]/50 hover:bg-yellow-600/5 cursor-pointer transition-colors"
                        onDoubleClick={() => openProfile(m)}
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-yellow-600/20 flex items-center justify-center text-xs text-yellow-400 font-bold overflow-hidden border border-yellow-500/20">
                              {m.photo ? (
                                <img src={m.photo} className="w-full h-full object-cover" alt="" />
                              ) : (
                                m.name.charAt(0)
                              )}
                            </div>
                            <span className="text-sm text-white">{m.name}</span>
                          </div>
                        </td>
                        <td className="p-3 text-sm text-gray-300 font-mono">{m.card_code || '—'}</td>
                        <td className="p-3 text-sm text-gray-300">{getPlanName(m.plan_id)}</td>
                        <td className="p-3 text-sm text-gray-400">{formatDate(m.start_date)}</td>
                        <td className="p-3 text-sm text-gray-400">{formatDate(m.end_date)}</td>
                        <td className="p-3 text-sm font-bold" style={{ color: days <= 0 ? '#ef4444' : days <= 7 ? '#f59e0b' : '#22c55e' }}>
                          {days > 0 ? `${days}d` : t('common.expired')}
                        </td>
                        <td className="p-3">
                          <Badge className={getStatusColor(m.status)}>{m.status === 'active' ? t('common.active') : m.status === 'frozen' ? t('common.frozen') : m.status === 'expired' ? t('common.expired') : m.status}</Badge>
                        </td>
                      </motion.tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && (
              <div className="text-center py-12">
                <User className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-400">{t('members.noMembers')}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Member Profile Popup */}
        <Dialog open={!!profileMember} onOpenChange={(o) => { if (!o) setProfileMember(null) }}>
          <DialogContent className="sm:max-w-[850px] max-h-[85vh] overflow-y-auto">
            {profileMember && (
              <>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handlePhotoChange}
                  accept="image/png, image/jpeg, image/jpg"
                  className="hidden"
                />
                <DialogHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="relative group w-24 h-24 rounded-full bg-yellow-600/20 border-2 border-yellow-500/30 flex items-center justify-center cursor-pointer overflow-hidden transition-all duration-200 hover:border-yellow-400 shadow-md"
                        title={isArabic ? 'تغيير الصورة' : 'Change Photo'}
                      >
                        {profileMember.photo ? (
                          <img src={profileMember.photo} className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-110" alt={profileMember.name} />
                        ) : (
                          <span className="text-3xl text-yellow-400 font-bold group-hover:scale-90 transition-transform duration-200">{profileMember.name.charAt(0)}</span>
                        )}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200">
                          <Camera className="w-6 h-6 text-white" />
                        </div>
                      </div>
                      <div>
                        <DialogTitle className="text-2xl font-bold text-white">{profileMember.name}</DialogTitle>
                        <div className="flex items-center gap-2 text-sm text-gray-400 mt-1.5">
                          <Phone className="w-3.5 h-3.5" />{profileMember.phone}
                          <QrCode className="w-3.5 h-3.5 ml-2" />{profileMember.card_code || t('members.noCard')}
                        </div>
                      </div>
                    </div>
                    <Badge className={getStatusColor(profileMember.status)}>{profileMember.status === 'active' ? t('common.active') : profileMember.status === 'frozen' ? t('common.frozen') : profileMember.status === 'expired' ? t('common.expired') : profileMember.status}</Badge>
                  </div>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mt-6">
                  {/* Left Column - Main info (3 of 5 columns) */}
                  <div className="md:col-span-3 space-y-4">
                    {/* Plan & Days Left */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 rounded-lg bg-yellow-600/10 border border-yellow-500/20">
                        <p className="text-xs text-gray-400">{t('members.plan')}</p>
                        <p className="font-bold text-white text-base">{getPlanName(profileMember.plan_id)}</p>
                        <p className="text-xs text-gray-400 mt-1">{formatDate(profileMember.start_date)} → {formatDate(profileMember.end_date)}</p>
                      </div>
                      <div className={`p-3 rounded-lg border ${getDaysLeft(profileMember.end_date) <= 0 ? 'bg-red-500/10 border-red-500/20' : getDaysLeft(profileMember.end_date) <= 7 ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-green-500/10 border-green-500/20'}`}>
                        <p className="text-xs text-gray-400">{isArabic ? 'الأيام المتبقية' : 'Days Left'}</p>
                        <p className={`text-2xl font-bold ${getDaysColor(getDaysLeft(profileMember.end_date))}`}>
                          {getDaysLeft(profileMember.end_date) > 0 ? (isArabic ? `${getDaysLeft(profileMember.end_date)} يوم` : `${getDaysLeft(profileMember.end_date)} days`) : t('common.expired').toUpperCase()}
                        </p>
                      </div>
                    </div>

                    <FrozenCountdown frozenUntil={profileMember.frozen_until} status={profileMember.status} freezeDaysEntered={profileMember.freeze_days_entered} />

                    {/* Feature Usage */}
                    <div className="mb-2">
                      <h4 className="text-sm font-medium text-gray-400 mb-2">{t('members.planFeatures')}</h4>
                      <div className="grid grid-cols-4 gap-2">
                          {[
                            { key: 'inbody', label: 'InBody', used: profileMember.inbody_used, total: plans.find((p) => p.id === profileMember.plan_id)?.inbody_count || 0, icon: Activity },
                            { key: 'invitation', label: isArabic ? 'الدعوات' : 'Invitations', used: profileMember.invitation_used, total: plans.find((p) => p.id === profileMember.plan_id)?.invitation_count || 0, icon: Gift },
                            { key: 'freeze', label: isArabic ? 'أيام التجميد' : 'Freeze Days', used: profileMember.freeze_used, total: plans.find((p) => p.id === profileMember.plan_id)?.freeze_days || 0, icon: Snowflake },
                            { key: 'private', label: isArabic ? 'جلسة خاصة' : 'Private Sesh', used: profileMember.private_used, total: plans.find((p) => p.id === profileMember.plan_id)?.private_sessions || 0, icon: Users },
                          ].map((f) => {
                            const maxed = f.used >= f.total && f.total > 0
                            return (
                            <div key={f.key} className="p-2 rounded-lg bg-white/5 border border-[#1a2d45] text-center">
                              <f.icon className={`w-4 h-4 mx-auto mb-1 ${f.key === 'freeze' ? 'text-red-400' : 'text-yellow-400'}`} />
                              <p className="text-xs text-gray-400">{f.label}</p>
                              <p className="text-sm font-bold text-white">{f.used}/{f.total}</p>
                              {maxed ? (
                                <div className="mt-1 w-5 h-5 mx-auto" />
                              ) : (
                                <button
                                  onClick={() => f.key === 'freeze' ? setFreezeDialogOpen(true) : setConfirmDialog({
                                    open: true,
                                    title: t('members.useFeature', { feature: f.label }),
                                    message: t('members.useFeatureMessage', { feature: f.label.toLowerCase(), name: profileMember?.name || '' }),
                                    onConfirm: () => useFeature(f.key)
                                  })}
                                  className={`mt-1 w-5 h-5 rounded-full flex items-center justify-center mx-auto transition-colors ${f.key === 'freeze' ? 'bg-red-600/20 hover:bg-red-600/40' : 'bg-yellow-600/20 hover:bg-yellow-600/40'}`}
                                  title={t('members.useFeature', { feature: f.label })}
                                >
                                  <span className={`text-xs ${f.key === 'freeze' ? 'text-red-400' : 'text-yellow-400'}`}>+</span>
                                </button>
                              )}
                            </div>
                            )
                          })}
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Barcode & Histories (2 of 5 columns) */}
                  <div className="md:col-span-2 space-y-4">
                    {/* Barcode Card */}
                    {profileMember.card_code && <BarcodeCard cardCode={profileMember.card_code} />}

                    {/* Attendance History */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-400 mb-2">{t('members.attendanceHistory')}</h4>
                      <div className="max-h-24 overflow-y-auto space-y-1">
                        {profileAttendance.slice(0, 5).map((a) => (
                          <div key={a.id} className="flex justify-between text-xs p-2 rounded bg-white/5">
                            <span className="text-gray-300">{formatDate(a.date)}</span>
                            <span className="text-gray-500">{formatTime(a.time)} · {a.method}</span>
                          </div>
                        ))}
                        {profileAttendance.length === 0 && <p className="text-xs text-gray-500 text-center py-2">{t('members.noAttendance')}</p>}
                      </div>
                    </div>

                    {/* Renewal History */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-400 mb-2">{t('members.renewalHistory')}</h4>
                      <div className="max-h-24 overflow-y-auto space-y-1">
                        {profileRenewals.slice(0, 5).map((r) => (
                          <div key={r.id} className="flex justify-between text-xs p-2 rounded bg-white/5">
                            <span className="text-gray-300">{formatDate(r.date)}</span>
                            <span className="text-green-400 font-bold">{formatCurrency(r.amount)}</span>
                          </div>
                        ))}
                        {profileRenewals.length === 0 && <p className="text-xs text-gray-500 text-center py-2">{t('members.noRenewals')}</p>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-4 mt-4 border-t border-[#1a2d45]">
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => {
                    setEditForm({ name: profileMember.name, phone: profileMember.phone, card_code: profileMember.card_code })
                    setEditDialogOpen(true)
                  }}>
                    {t('common.edit')}
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2 text-blue-400 border-blue-500/30" onClick={() => fileInputRef.current?.click()}>
                    <Camera className="w-3 h-3" /> {profileMember.photo ? (isArabic ? 'تغيير الصورة' : 'Change Photo') : (isArabic ? 'إضافة صورة' : 'Add Photo')}
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2 text-yellow-400 border-yellow-500/30" onClick={() => {
                    setRenewForm({ extend_from_end: true, plan_id: profileMember.plan_id })
                    setRenewDialogOpen(true)
                  }}>
                    <RotateCcw className="w-3 h-3" /> {t('common.renew')}
                  </Button>
                  {profileMember.status === 'frozen' && (
                    <Button variant="outline" size="sm" className="gap-2 text-yellow-400 border-yellow-500/30" onClick={() => setConfirmDialog({
                      open: true,
                      title: t('members.unfreezeMember'),
                      message: t('members.unfreezeMessage', { name: profileMember?.name || '' }),
                      onConfirm: async () => {
                        await invoke('unfreeze_member', { member_id: profileMember!.id })
                        toast({ title: t('members.unfreezeMember'), variant: 'success' })
                        loadData()
                        loadProfile(profileMember!.id)
                      }
                    })}>
                      <Snowflake className="w-3 h-3" /> {t('members.unfreezeMember')}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="gap-2 text-red-400 border-red-500/30 ml-auto" onClick={() => setDeleteDialogOpen(true)}>
                    <Trash2 className="w-3 h-3" /> {t('common.delete')}
                  </Button>
                </div>

                {/* Freeze Dialog */}
                <Dialog open={freezeDialogOpen} onOpenChange={(o) => { setFreezeDialogOpen(o); if (!o) setFreezeDays(1) }}>
                  <DialogContent className="sm:max-w-[350px]">
                    <DialogHeader><DialogTitle>{t('members.freezeMember')}</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      {(() => {
                        const plan = plans.find((p) => p.id === profileMember?.plan_id)
                        const available = (plan?.freeze_days || 0) - (profileMember?.freeze_used || 0)
                        return (
                          <>
                            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-center">
                              <p className="text-xs text-gray-400">{t('members.availableFreezeDays')}</p>
                              <p className="text-2xl font-bold text-yellow-400">{available}</p>
                            </div>
                            <div className="space-y-2">
                              <Label>{t('members.freezeDuration')}</Label>
                              <Input type="number" min={1} max={available} value={freezeDays || ''}
                                onChange={(e) => setFreezeDays(Math.min(Math.max(parseInt(e.target.value) || 1, 1), available))} />
                            </div>
                            <FreezePreview days={freezeDays} />
                            <Button className="w-full" disabled={available <= 0}
                              onClick={() => setConfirmDialog({
                                open: true,
                                title: t('members.freezeMember'),
                                message: t('members.freezeMessage', { name: profileMember?.name || '', days: freezeDays, plural: freezeDays > 1 ? 's' : '' }),
                                  onConfirm: async () => {
                                    if (!profileMember) return
                                    await invoke('freeze_member', { member_id: profileMember.id, days: freezeDays })
                                    toast({ title: t('members.freezeMember'), description: isArabic ? `تم تجميد ${profileMember.name} لمدة ${freezeDays} يوم` : `${profileMember.name} frozen for ${freezeDays} days`, variant: 'success' })
                                    setFreezeDialogOpen(false)
                                    setFreezeDays(1)
                                    loadData()
                                    loadProfile(profileMember.id)
                                  }
                              })}
                            >
                              {isArabic ? `تجميد ${freezeDays} يوم` : `Freeze ${freezeDays} Days`}
                            </Button>
                          </>
                        )
                      })()}
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Edit Dialog */}
                <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                  <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader><DialogTitle>{t('members.editMember')}</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-2"><Label>{t('members.name')}</Label><Input value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} /></div>
                      <div className="space-y-2"><Label>{t('members.phone')}</Label><Input value={editForm.phone} onChange={(e) => setEditForm({...editForm, phone: e.target.value})} /></div>
                      <div className="space-y-2">
                        <Label>{t('members.cardCode')}</Label>
                        <div className="relative">
                          <Input value={editForm.card_code} onChange={(e) => setEditForm({...editForm, card_code: e.target.value})} className={editForm.card_code ? (editCardValidation.status === 'valid' ? 'border-green-500 pr-8' : editCardValidation.status === 'invalid' ? 'border-red-500 pr-8' : '') : ''} />
                          {editCardValidation.status === 'valid' && <CheckCircle className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400" />}
                          {editCardValidation.status === 'invalid' && <XCircle className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400" />}
                        </div>
                        {editCardValidation.status === 'invalid' && <p className="text-xs text-red-400">{editCardValidation.message}</p>}
                      </div>
                      <Button className="w-full" onClick={handleEdit}>{t('members.saveChanges')}</Button>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Delete Dialog */}
                <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                  <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader><DialogTitle>{t('members.deleteMember')}</DialogTitle><DialogDescription>{t('members.adminPassword')}</DialogDescription></DialogHeader>
                    <div className="space-y-3">
                      <Input type="password" placeholder={t('members.password')} value={deletePassword} onChange={(e) => { setDeletePassword(e.target.value); setDeleteError('') }} />
                      {deleteError && <p className="text-xs text-red-400">{deleteError}</p>}
                      <Button variant="destructive" className="w-full" onClick={handleDelete}>{t('members.confirmDelete')}</Button>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Renew Dialog */}
                <Dialog open={renewDialogOpen} onOpenChange={setRenewDialogOpen}>
                  <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader><DialogTitle>{t('members.renewMembership')}</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>{t('members.plan')}</Label>
                        <Select value={renewForm.plan_id} onValueChange={(v) => {
                          const p = plans.find((x) => x.id === v)
                          setRenewForm({...renewForm, plan_id: v })
                        }}>
                          <SelectTrigger><SelectValue placeholder={t('members.selectPlan')} /></SelectTrigger>
                          <SelectContent>
                            {plans.map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.name} - {formatCurrency(p.price)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id="extend" checked={renewForm.extend_from_end} onChange={(e) => setRenewForm({...renewForm, extend_from_end: e.target.checked})} className="accent-blue-600" />
                        <Label htmlFor="extend">{t('members.extendFromEnd')}</Label>
                      </div>
                      <Button className="w-full" onClick={handleRenew}>{t('common.renew')}</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(o) => setConfirmDialog({ ...confirmDialog, open: o })}>
        <DialogContent className="sm:max-w-[350px] border-yellow-700/30">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-yellow-500/10">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
              </div>
              <DialogTitle className="text-white">{confirmDialog.title}</DialogTitle>
            </div>
          </DialogHeader>
          <p className="text-sm text-gray-300 px-2">{confirmDialog.message}</p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" className="border-gray-700 text-gray-300" onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}>
              {t('common.cancel')}
            </Button>
            <Button className="bg-yellow-600 hover:bg-yellow-700 text-white" onClick={() => {
              confirmDialog.onConfirm()
              setConfirmDialog({ ...confirmDialog, open: false })
            }}>
              {t('common.confirm')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageTransition>
  )
}
