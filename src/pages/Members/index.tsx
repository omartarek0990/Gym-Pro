import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Plus, Search, User, Trash2, X, Camera, Image, FileDown } from 'lucide-react'
import { invoke } from '@/lib/tauri'
import { open } from '@tauri-apps/plugin-shell'
import PageTransition from '@/components/shared/PageTransition'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { formatCurrency, formatDate, formatNumber, getDaysLeft, getStatusColor, generateId, getLocalDateString, addMonthsToDate, formatPhone } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { useExport } from '@/hooks/useExport'
import { compressImageData, compressPhotoFile } from '@/lib/image'
import type { Member, Plan, Attendance, Renewal } from '@/types'
import { useLanguage } from '@/lib/i18n'
import { createRoot } from 'react-dom/client'
import MemberCardTemplate from '@/components/cards/MemberCardTemplate'
import { useLocation } from 'react-router-dom'
import MemberProfileDialog from '@/components/shared/MemberProfileDialog'

export default function MembersPage() {
  const { t, isArabic } = useLanguage()
  const { exportToExcel } = useExport()
  const location = useLocation()
  const [members, setMembers] = useState<Member[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [visibleCount, setVisibleCount] = useState(20)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [profileMember, setProfileMember] = useState<Member | null>(null)
  const [profileAttendance, setProfileAttendance] = useState<Attendance[]>([])
  const [profileRenewals, setProfileRenewals] = useState<Renewal[]>([])
  const [form, setForm] = useState({ name: '', phone: '', card_code: '', plan_id: '', gender: 'male', start_date: '' })
  const addFileInputRef = useRef<HTMLInputElement>(null)
  const addPhotoFileRef = useRef<File | null>(null)
  const addPhotoPreviewImgRef = useRef<HTMLImageElement>(null)
  const [addPhotoPreview, setAddPhotoPreview] = useState('')
  const [cameraOpen, setCameraOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [scannedReference, setScannedReference] = useState('')
  const [previewCardCode, setPreviewCardCode] = useState('')
  const [previewStartDate, setPreviewStartDate] = useState('')
  const [previewEndDate, setPreviewEndDate] = useState('')
const [saving, setSaving] = useState(false)
  const [profileCardImage, setProfileCardImage] = useState('')
  const previewContainerRef = useRef<HTMLDivElement>(null)
  const [previewScale, setPreviewScale] = useState(1)

  useEffect(() => {
    const el = previewContainerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const widthScale = entries[0].contentRect.width / 600
      const heightScale = entries[0].contentRect.height / 378
      setPreviewScale(Math.min(widthScale, heightScale))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const generatePreviewCardCode = () => {
    const digits = String(Math.floor(Math.random() * 1000000)).padStart(6, '0')
    return `MRX-${digits}`
  }

  const previewPlan = useMemo(() => plans.find((p) => p.id === form.plan_id), [plans, form.plan_id])
  const effectivePreviewCardCode = form.card_code.trim() || previewCardCode

  const normalizeEgyptPhoneInput = (value: string) => {
    const digits = value.replace(/\D/g, '')
    const withoutCountryCode = digits.startsWith('20') ? digits.slice(2) : digits
    const withoutLeadingZero = withoutCountryCode.startsWith('0') ? withoutCountryCode.slice(1) : withoutCountryCode
    return withoutLeadingZero.slice(0, 10)
  }

  const compactScanCode = (value: string) => value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  const scanDigits = (value: string) => value.replace(/\D/g, '')

  const handleAddPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg']
    if (!validTypes.includes(file.type)) {
      toast({ title: isArabic ? 'خطأ في الملف' : 'Invalid File', description: isArabic ? 'يرجى اختيار صورة بصيغة png أو jpg فقط.' : 'Please select a png or jpg image only.', variant: 'destructive' })
      return
    }
    addPhotoFileRef.current = file
    const reader = new FileReader()
    reader.onload = () => setAddPhotoPreview(reader.result as string)
    reader.readAsDataURL(file)
    try {
      setAddPhotoPreview(await compressPhotoFile(file))
    } catch { /* keep original preview */ }
    if (e.target) e.target.value = ''
  }

  const openCamera = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(d => d.kind === 'videoinput')
      let stream: MediaStream | null = null
      if (videoDevices.length > 1) {
        for (let i = videoDevices.length - 1; i >= 0; i--) {
          try { stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: videoDevices[i].deviceId } } }); break } catch { continue }
        }
      }
      if (!stream) {
        try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } }) } catch { stream = await navigator.mediaDevices.getUserMedia({ video: true }).catch(() => null) }
      }
      if (!stream) throw new Error('No camera')
      streamRef.current = stream
      setCameraOpen(true)
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream }, 100)
    } catch (err) {
      toast({ title: isArabic ? 'خطأ في الكاميرا' : 'Camera Error', description: isArabic ? 'تأكد من توصيل الكاميرا وإعطاء الصلاحيات.' : 'Cannot access camera.', variant: 'destructive' })
    }
  }

  const capturePhoto = async () => {
    if (!videoRef.current) return
    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    canvas.getContext('2d')!.drawImage(videoRef.current, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg')
    try {
      setAddPhotoPreview(await compressImageData(dataUrl))
    } catch {
      setAddPhotoPreview(dataUrl)
    }
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    setCameraOpen(false)
  }

  const loadData = useCallback(async () => {
    try {
      const [m, p] = await Promise.all([
        invoke('get_members'),
        invoke('get_plans')
      ])
      if (m) setMembers(m as Member[])
      if (p) setPlans(p as Plan[])
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filtered = useMemo(() => members.filter((m) => {
    const q = search.toLowerCase()
    const matchSearch = m.name.toLowerCase().includes(q) || m.phone.includes(q) || m.card_code.toLowerCase().includes(q)
    const matchStatus = statusFilter === 'all' || m.status === statusFilter
    return matchSearch && matchStatus
  }), [members, search, statusFilter])

  const getPlanName = (m: Member) => m.plan_name || plans.find((p) => p.id === m.plan_id)?.name || 'N/A'

  const renderAndSaveCard = async (member: Member, planName: string) => {
    if (member.photo) {
      const img = new window.Image()
      img.src = member.photo
      await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve })
    }

    const container = document.createElement('div')
    container.style.position = 'fixed'
    container.style.left = '-9999px'
    container.style.top = '0'
    container.style.width = '600px'
    container.style.height = '378px'
    container.style.zIndex = '-1'
    document.body.appendChild(container)

    const root = createRoot(container)
    try {
      root.render(<MemberCardTemplate member={member} planName={planName} />)
      await new Promise((resolve) => requestAnimationFrame(resolve))
      await new Promise((resolve) => setTimeout(resolve, 100))

      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(container, {
        width: 600,
        height: 378,
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: null,
        logging: false,
      })

      const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
      await invoke('update_member_card_image', { member_id: member.id, card_image: dataUrl })
      const fileName = `${member.name}_${member.card_code}.jpg`
      const base64Data = dataUrl.split(',')[1]
      const binaryStr = atob(base64Data)
      const bytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
      const folder = await invoke('save_member_card_png', { file_name: fileName, png_bytes: Array.from(bytes) }) as string
      return { dataUrl, folder }
    } finally {
      root.unmount()
      document.body.removeChild(container)
    }
  }

  useEffect(() => {
    const state = location.state as { openAddMember?: boolean; scannedCode?: string } | null
    if (!state?.openAddMember) return
    setScannedReference(state.scannedCode || '')
    setAddDialogOpen(true)
    window.history.replaceState({}, document.title)
  }, [location.state])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        setScannedReference('')
        setAddDialogOpen(true)
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  useEffect(() => {
    if (addDialogOpen) {
      const code = generatePreviewCardCode()
      setPreviewCardCode(code)
      const today = getLocalDateString()
      setPreviewStartDate(today)
      setPreviewEndDate(addMonthsToDate(today, 1))
    }
  }, [addDialogOpen])

  const handleAddMember = async () => {
    if (!form.name.trim() || !form.phone.trim() || !form.plan_id) return
    setSaving(true)
    try {
      const plan = plans.find((p) => p.id === form.plan_id)
      if (!plan) { setSaving(false); return }
      const id = generateId()
      const start = form.start_date || getLocalDateString()
      const end = addMonthsToDate(start, plan.duration_months)
      const photoBase64 = addPhotoPreview || ''
      const realCardCode = await invoke('add_member', { id, name: form.name, phone: form.phone, card_code: form.card_code, photo: photoBase64, plan_id: form.plan_id, start_date: start, end_date: end, status: 'active', plan_name: plan.name, gender: form.gender }) as string
      await invoke('renew_member', { id: generateId(), member_id: id, date: getLocalDateString(), amount: plan.price, new_start: start, new_end: end, plan_id: plan.id, plan_name: plan.name, member_name: form.name })
      const newMember: Member = {
        id,
        name: form.name,
        phone: form.phone,
        card_code: realCardCode,
        photo: photoBase64,
        plan_id: form.plan_id,
        gender: form.gender,
        start_date: start,
        end_date: end,
        status: 'active',
        inbody_used: 0,
        invitation_used: 0,
        freeze_used: 0,
        private_used: 0,
        frozen_until: '',
        freeze_start_date: '',
        freeze_days_entered: 0,
        plan_name: plan.name,
        plan_price: plan.price,
        plan_duration_months: plan.duration_months,
        plan_inbody_count: plan.inbody_count,
        plan_invitation_count: plan.invitation_count,
        plan_freeze_days: plan.freeze_days,
        plan_private_sessions: plan.private_sessions,
      }
      try {
        const { folder } = await renderAndSaveCard(newMember, plan.name)
        toast({ title: `✅ ${isArabic ? 'تم حفظ الكارت في' : 'Card saved to'} ${folder}`, variant: 'success' })
      } catch (saveErr) {
        toast({ title: isArabic ? 'تمت إضافة العضو لكن لم يتم حفظ الكارت' : 'Member added but card was not saved', description: String(saveErr), variant: 'destructive' })
      }
      toast({ title: isArabic ? 'تمت إضافة العضو' : 'Member Added', variant: 'success' })
      await loadData()
      setAddDialogOpen(false)
      setForm({ name: '', phone: '', card_code: '', plan_id: '', gender: 'male', start_date: '' })
      setAddPhotoPreview('')
      addPhotoFileRef.current = null
    } catch (err) {
      toast({ title: isArabic ? 'فشل' : 'Failed', description: String(err), variant: 'destructive' })
    }
    setSaving(false)
  }

  const loadProfile = async (memberId: string) => {
    setProfileCardImage('')
    const [att, ren, m, img] = await Promise.all([
      invoke('get_attendance', { member_id: memberId }),
      invoke('get_renewals', { member_id: memberId }),
      invoke('get_member_by_id', { member_id: memberId }),
      invoke('get_member_card_image', { member_id: memberId })
    ])
    if (att) setProfileAttendance(att as Attendance[])
    if (ren) setProfileRenewals(ren as Renewal[])
    if (m) setProfileMember(m as Member)
    if (img) setProfileCardImage(img as string)
  }

  const openProfile = async (m: Member) => {
    setProfileMember(m)
    await loadProfile(m.id)
  }

  useEffect(() => {
    const code = search.trim()
    if (!code) return
    const compact = compactScanCode(code)
    const digits = scanDigits(code)
    const member = members.find((m) => {
      const compactCard = compactScanCode(m.card_code || '')
      const cardDigits = scanDigits(m.card_code || '')
      return compactCard === compact || (digits.length >= 4 && cardDigits.endsWith(digits))
    })
    if (member) {
      setSearch('')
      openProfile(member)
    }
  }, [search, members])

  const handleRegenerateCard = async () => {
    if (!profileMember) return
    const plan = plans.find((p) => p.id === profileMember.plan_id)
    if (!plan) return
    try {
      const { dataUrl, folder } = await renderAndSaveCard(profileMember, plan.name)
      setProfileCardImage(dataUrl)
      toast({ title: isArabic ? 'تم تحديث الكارت' : 'Card Updated', variant: 'success' })
      toast({ title: `✅ ${isArabic ? 'تم حفظ الكارت في' : 'Card saved to'} ${folder}`, variant: 'success' })
    } catch (err) {
      toast({ title: isArabic ? 'فشل' : 'Failed', description: String(err), variant: 'destructive' })
    }
  }

  const exportMembers = async () => {
    const cols = [
      { header: 'Name', key: 'name' },
      { header: 'Phone', key: 'phone' },
      { header: 'Card Code', key: 'card_code' },
      { header: 'Plan', key: 'plan' },
      { header: 'Status', key: 'status' },
      { header: 'Start', key: 'start' },
      { header: 'End', key: 'end' },
      { header: 'Days Left', key: 'days_left' },
    ]
    const data = filtered.map((m) => ({
      name: m.name,
      phone: formatPhone(m.phone),
      card_code: m.card_code,
      plan: getPlanName(m),
      status: m.status,
      start: formatDate(m.start_date),
      end: formatDate(m.end_date),
      days_left: getDaysLeft(m.end_date),
    }))
    await exportToExcel('members', cols, data)
  }

  if (loading) return (
    <PageTransition>
      <div className="space-y-4">
        {[1,2,3,4,5].map((i) => <div key={i} className="h-16 rounded-lg bg-muted" />)}
      </div>
    </PageTransition>
  )

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex gap-3 flex-1 flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder={isArabic ? 'بحث بالاسم / الهاتف / البطاقة...' : 'Search name / phone / card...'} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                <SelectItem value="active">{t('common.active')}</SelectItem>
                <SelectItem value="noactive">{t('common.noactive')}</SelectItem>
                <SelectItem value="frozen">{t('common.frozen')}</SelectItem>
                <SelectItem value="expired">{t('common.expired')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" className="gap-2" onClick={exportMembers}>
              <FileDown className="w-4 h-4" /> Excel
            </Button>
            <Button className="gap-2" onClick={() => { setScannedReference(''); setAddDialogOpen(true) }}>
              <Plus className="w-4 h-4" />{t('members.addMember')}
            </Button>
          </div>
        </div>

        {/* Members Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground uppercase">
                    <th className="text-left p-3 font-medium">{t('members.name')}</th>
                    <th className="text-left p-3 font-medium">{isArabic ? 'الهاتف' : 'Phone'}</th>
                    <th className="text-left p-3 font-medium">{t('members.cardCode')}</th>
                    <th className="text-left p-3 font-medium">{t('members.plan')}</th>
                    <th className="text-left p-3 font-medium">{isArabic ? 'البداية' : 'Start'}</th>
                    <th className="text-left p-3 font-medium">{isArabic ? 'النهاية' : 'End'}</th>
                    <th className="text-left p-3 font-medium">{isArabic ? 'الأيام المتبقية' : 'Days Left'}</th>
                    <th className="text-left p-3 font-medium">{isArabic ? 'الحالة' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, visibleCount).map((m, i) => {
                    const notStarted = m.start_date > getLocalDateString()
                    const days = notStarted ? getDaysLeft(m.start_date) : getDaysLeft(m.end_date)
                    return (
                      <tr key={m.id}
                        className="border-b border-border/50 hover:bg-muted cursor-pointer transition-colors" onDoubleClick={() => openProfile(m)}
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs text-primary font-bold overflow-hidden border border-primary/20">
                              {m.photo ? (<img src={m.photo} className="w-full h-full object-cover" alt="" />) : (m.name.charAt(0))}
                            </div>
                            <span className="text-sm text-foreground">{m.name}</span>
                          </div>
                        </td>
                        <td className="p-3"><span className="text-sm text-muted-foreground">{formatPhone(m.phone) || '—'}</span></td>
                        <td className="p-3"><span className="text-sm text-muted-foreground font-mono">{m.card_code || '—'}</span></td>
                        <td className="p-3"><span className="text-sm text-muted-foreground">{getPlanName(m)}</span></td>
                        <td className="p-3"><span className="text-sm text-muted-foreground">{formatDate(m.start_date)}</span></td>
                        <td className="p-3"><span className="text-sm text-muted-foreground">{formatDate(m.end_date)}</span></td>
                        <td className="p-3"><span className="text-sm font-bold" style={{ color: notStarted ? '#3b82f6' : days <= 0 ? '#ef4444' : days <= 7 ? '#f59e0b' : '#22c55e' }}>
                          {notStarted ? (isArabic ? `يبدأ بعد ${formatNumber(days)}d` : `Starts in ${formatNumber(days)}d`) : days > 0 ? `${formatNumber(days)}d` : t('common.expired')}
                        </span></td>
                        <td className="p-3">
                          <Badge className={notStarted ? 'text-blue-400 bg-blue-500/10 border-blue-500/30' : getStatusColor(m.status)}>
                            {notStarted ? (isArabic ? 'لم يبدأ' : 'Not Started') : m.status === 'active' ? t('common.active') : m.status === 'noactive' ? t('common.noactive') : m.status === 'frozen' ? t('common.frozen') : m.status === 'expired' ? t('common.expired') : m.status}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length > visibleCount && (
              <div className="p-4 flex justify-center">
                <Button variant="secondary" onClick={() => setVisibleCount((c) => c + 20)}>
                  {isArabic ? 'تحميل المزيد' : 'Load More'}
                </Button>
              </div>
            )}
            {filtered.length === 0 && (
              <div className="text-center py-12">
                <User className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">{t('members.noMembers')}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Camera Dialog */}
        <Dialog open={cameraOpen} onOpenChange={(o) => { if (!o) { setCameraOpen(false); if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()) } }}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader><DialogTitle>{isArabic ? 'التقاط صورة' : 'Capture Photo'}</DialogTitle></DialogHeader>
            <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg" />
            <Button onClick={capturePhoto} className="w-full">{isArabic ? 'التقاط' : 'Capture'}</Button>
          </DialogContent>
        </Dialog>

        {/* Add Member Dialog */}
        <Dialog open={addDialogOpen} onOpenChange={(o) => { if (!o) { setAddDialogOpen(false); setForm({ name: '', phone: '', card_code: '', plan_id: '', gender: 'male', start_date: '' }); setAddPhotoPreview(''); addPhotoFileRef.current = null }}}>
          <DialogContent className="sm:max-w-[680px] max-h-[92vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{t('members.addNewMember')}</DialogTitle></DialogHeader>
            <div className="space-y-5">
              <div className="space-y-4">
                {scannedReference && (
                  <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3">
                    <p className="text-xs text-muted-foreground">{isArabic ? 'الكود الممسوح كمرجع' : 'Scanned reference'}</p>
                    <p className="font-mono text-sm font-bold text-yellow-400">{scannedReference}</p>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>{t('members.fullName')}</Label>
                    <Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{isArabic ? 'الهاتف' : 'Phone'}</Label>
                    <div className="flex h-10 overflow-hidden rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
                      <div className="flex items-center border-r border-input bg-muted px-3 text-sm font-bold text-muted-foreground">+20</div>
                      <Input
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        placeholder="1XXXXXXXXX"
                        value={form.phone}
                        onChange={(e) => setForm({...form, phone: normalizeEgyptPhoneInput(e.target.value)})}
                        className="h-10 rounded-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t('members.plan')}</Label>
                    <Select value={form.plan_id} onValueChange={(v) => {
                      setForm({...form, plan_id: v})
                      const plan = plans.find((p) => p.id === v)
                      if (plan) {
                        const start = form.start_date || getLocalDateString()
                        setPreviewEndDate(addMonthsToDate(start, plan.duration_months))
                      }
                    }}>
                      <SelectTrigger className="h-10"><SelectValue placeholder={t('members.selectPlan')} /></SelectTrigger>
                      <SelectContent>
                        {plans.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name} - {formatCurrency(p.price)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{isArabic ? 'النوع' : 'Gender'}</Label>
                    <Select value={form.gender} onValueChange={(v) => setForm({...form, gender: v})}>
                      <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">{isArabic ? 'ذكر' : 'Male'}</SelectItem>
                        <SelectItem value="female">{isArabic ? 'أنثى' : 'Female'}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{isArabic ? 'تاريخ البداية' : 'Start Date'}</Label>
                    <Input type="date" value={form.start_date} onChange={(e) => {
                      setForm({...form, start_date: e.target.value})
                      const plan = plans.find((p) => p.id === form.plan_id)
                      if (plan) setPreviewEndDate(addMonthsToDate(e.target.value, plan.duration_months))
                    }} className="h-10" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>{t('members.photo')}</Label>
                  <input type="file" ref={addFileInputRef} onChange={handleAddPhotoSelect} accept="image/png, image/jpeg, image/jpg" className="hidden" />
                  <div className="flex flex-wrap items-center gap-2">
                    <div onClick={() => addFileInputRef.current?.click()} className="w-12 h-12 rounded-full bg-primary/20 border-2 border-dashed border-primary/30 flex items-center justify-center cursor-pointer hover:border-primary transition-colors overflow-hidden shrink-0">
                      {addPhotoPreview ? (<img src={addPhotoPreview} className="w-full h-full object-cover" />) : (<Camera className="w-5 h-5 text-primary" />)}
                    </div>
                    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={openCamera}>
                      <Camera className="w-4 h-4" /> {isArabic ? 'كاميرا' : 'Camera'}
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => addFileInputRef.current?.click()}>
                      <Image className="w-4 h-4" /> {isArabic ? 'اختيار صورة' : 'Browse'}
                    </Button>
                    {addPhotoPreview && (
                      <Button variant="ghost" size="sm" className="text-destructive h-8 w-8 p-0 ml-auto" onClick={() => { setAddPhotoPreview(''); addPhotoFileRef.current = null; if (addFileInputRef.current) addFileInputRef.current.value = '' }}>
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{isArabic ? 'قالب الكارت' : 'Card Template'}</Label>
                <div className="rounded-xl border border-border bg-muted/20 p-3 flex justify-center">
                  <div ref={previewContainerRef} style={{ width: '100%', maxWidth: '600px', aspectRatio: '600/378', position: 'relative', overflow: 'hidden', borderRadius: '6px' }}>
                    <div style={{ width: 600, height: 378, transform: `scale(${previewScale})`, transformOrigin: 'top left', position: 'absolute', left: 0, top: 0 }}>
                      <MemberCardTemplate
                        member={{
                          id: '',
                          name: form.name || 'Member Name',
                          phone: form.phone || '',
                          card_code: effectivePreviewCardCode,
                          photo: addPhotoPreview,
                          plan_id: form.plan_id,
                          gender: form.gender,
                          start_date: previewStartDate,
                          end_date: previewEndDate,
                          status: 'active',
                          inbody_used: 0,
                          invitation_used: 0,
                          freeze_used: 0,
                          private_used: 0,
                          frozen_until: '',
                          freeze_start_date: '',
                          freeze_days_entered: 0,
                          plan_name: previewPlan?.name || '',
                          plan_price: 0,
                          plan_duration_months: 0,
                          plan_inbody_count: 0,
                          plan_invitation_count: 0,
                          plan_freeze_days: 0,
                          plan_private_sessions: 0,
                        }}
                        planName={previewPlan?.name || ''}
                      />
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {isArabic ? 'القالب ظاهر من أول فتح النافذة وسيتحدث تلقائيا أثناء إدخال البيانات.' : 'The template is visible immediately and updates as you enter data.'}
                </p>
              </div>
              <Button className="w-full gap-2" onClick={handleAddMember} disabled={saving || !form.name.trim() || !form.phone.trim() || !form.plan_id}>
                {saving ? (isArabic ? 'جاري الإضافة والحفظ...' : 'Adding and saving...') : <>{isArabic ? 'إضافة العضو' : 'Add Member'}</>}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Member Profile Dialog */}
        <MemberProfileDialog
          open={!!profileMember}
          onOpenChange={(o) => { if (!o) { setProfileMember(null); setProfileCardImage('') } }}
          member={profileMember}
          attendance={profileAttendance}
          renewals={profileRenewals}
          plans={plans}
          showActions={true}
          onRefresh={() => { loadData(); if (profileMember) loadProfile(profileMember.id) }}
          cardImage={profileCardImage}
          onRegenerateCard={handleRegenerateCard}
        />
      </div>
    </PageTransition>
  )
}



