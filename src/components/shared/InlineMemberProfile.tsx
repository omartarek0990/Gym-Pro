import { useState, useRef, useEffect } from 'react'
import { User, Phone, QrCode, Calendar, Clock, Banknote, CalendarDays, Users, Activity, Gift, Snowflake, Camera, Trash2, RotateCcw, X, CheckCircle, XCircle, AlertTriangle, UserRound, ClipboardList, BadgeCheck, IdCard, UserPlus, Image } from 'lucide-react'
import { open as shellOpen } from '@tauri-apps/plugin-shell'
import { invoke } from '@/lib/tauri'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { formatDate, formatTime, formatNumber, formatCurrency, getDaysLeft, getDaysColor, getStatusColor, generateId, getLocalDateString, addMonthsToDate, getPlanDurationDays, formatPhone } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { useLanguage } from '@/lib/i18n'
import { useAuth } from '@/contexts/AuthContext'
import FrozenCountdown from '@/components/cards/FrozenCountdown'
import { refreshNotifications, bumpNotifications } from '@/hooks/useNotificationRefresh'
import type { Member, Plan, Attendance, Renewal } from '@/types'

interface Props {
  member: Member | null
  attendance: Attendance[]
  renewals: Renewal[]
  plans: Plan[]
  showActions?: boolean
  onClose: () => void
  onRefresh: () => void
  cardImage?: string
  onRegenerateCard?: () => Promise<void>
}

export default function InlineMemberProfile({ member, attendance, renewals, plans, showActions = true, onClose, onRefresh, cardImage, onRegenerateCard }: Props) {
  const { t, isArabic } = useLanguage()
  const { isOwner } = useAuth()

  const openWhatsApp = async (phone: string) => {
    let digits = phone.replace(/[^0-9]/g, '')
    if (digits.startsWith('20')) {
    } else if (digits.startsWith('0')) {
      digits = '20' + digits.slice(1)
    } else {
      digits = '20' + digits
    }
    try {
      await shellOpen(`https://api.whatsapp.com/send?phone=${digits}`)
    } catch {
      window.open(`https://api.whatsapp.com/send?phone=${digits}`, '_blank')
    }
  }

  const [freezeDialogOpen, setFreezeDialogOpen] = useState(false)
  const [freezeDays, setFreezeDays] = useState(1)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', phone: '', card_code: '' })
  const [editCardValidation, setEditCardValidation] = useState<{ status: string; message?: string }>({ status: '' })
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [inviteForm, setInviteForm] = useState({ guest_name: '', guest_phone: '' })
  const [renewDialogOpen, setRenewDialogOpen] = useState(false)
  const [renewForm, setRenewForm] = useState({ plan_id: '' })
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({ open: false, title: '', message: '', onConfirm: () => {} })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const getPlanName = (m: Member) => m.plan_name || (isArabic ? '—' : '—')
  const getDurationLabel = (m: Member) => {
    if (!m.plan_duration_months) return ''
    const days = getPlanDurationDays(m.plan_duration_months)
    return isArabic ? `${formatNumber(m.plan_duration_months)} شهر / ${formatNumber(days)} يوم` : `${formatNumber(m.plan_duration_months)} months / ${formatNumber(days)} days`
  }
  const emptyValue = isArabic ? 'غير مسجل' : 'Not recorded'
  const getStatusLabel = (status: string) => status === 'active' ? t('common.active') : status === 'noactive' ? t('common.noactive') : status === 'frozen' ? t('common.frozen') : status === 'expired' ? t('common.expired') : status

  const handleEdit = async () => {
    if (!member) return
    await invoke('update_member', { id: member.id, ...editForm, photo: member.photo, plan_id: member.plan_id, start_date: member.start_date, end_date: member.end_date })
    toast({ title: isArabic ? 'تم التحديث' : 'Updated', variant: 'success' })
    setEditDialogOpen(false)
    onRefresh()
  }

  const handleDelete = async () => {
    if (!member) return
    await invoke('delete_member', { id: member.id, name: member.name })
    toast({ title: isArabic ? 'تم الحذف' : 'Deleted', description: isArabic ? `تم حذف ${member.name}` : `${member.name} removed`, variant: 'destructive' })
    setDeleteDialogOpen(false)
    onClose()
    onRefresh()
  }

  const handleRenew = async () => {
    if (!member) return
    const plan = plans.find((p) => p.id === (renewForm.plan_id || member.plan_id))
    if (!plan) return
    const newStart = getLocalDateString()
    const endDateStr = addMonthsToDate(member.end_date || newStart, plan.duration_months)
    await invoke('renew_member', { id: generateId(), member_id: member.id, date: getLocalDateString(), amount: plan.price, new_start: newStart, new_end: endDateStr, plan_id: plan.id, plan_name: plan.name, member_name: member.name })
    toast({ title: isArabic ? 'تم تجديد الاشتراك' : 'Membership Renewed', variant: 'success' })
    setRenewDialogOpen(false)
    onRefresh()
  }

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !member) return
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg']
    if (!validTypes.includes(file.type)) {
      toast({ title: isArabic ? 'خطأ في الملف' : 'Invalid File', description: isArabic ? 'يرجى اختيار صورة بصيغة png أو jpg فقط.' : 'Please select a png or jpg image only.', variant: 'destructive' })
      return
    }
    const reader = new FileReader()
    reader.onload = async () => {
      const base64Data = reader.result as string
      try {
        await invoke('update_member', { id: member.id, name: member.name, phone: member.phone, card_code: member.card_code, photo: base64Data, plan_id: member.plan_id, start_date: member.start_date, end_date: member.end_date })
        toast({ title: isArabic ? 'تم تحديث الصورة' : 'Photo Updated', description: isArabic ? 'تم حفظ صورة العميل بنجاح.' : 'Client photo has been saved successfully.', variant: 'success' })
        onRefresh()
      } catch (err) {
        toast({ title: isArabic ? 'فشل تحديث الصورة' : 'Update Failed', description: String(err), variant: 'destructive' })
      }
    }
    reader.onerror = () => { toast({ title: isArabic ? 'فشل قراءة الملف' : 'File Read Failed', variant: 'destructive' }) }
    reader.readAsDataURL(file)
  }

  const useFeature = async (key: string) => {
    if (!member) return
    await invoke('use_member_feature', { member_id: member.id, feature: key })
    toast({ title: isArabic ? 'تم الاستخدام' : 'Used', variant: 'success' })
    onRefresh()
    await bumpNotifications()
  }

  useEffect(() => {
    if (!editForm.card_code || editForm.card_code.length < 3) { setEditCardValidation({ status: '' }); return }
    const timer = setTimeout(async () => {
      const r = await invoke('validate_card_code', { card_code: editForm.card_code }) as string
      if (r === 'valid') setEditCardValidation({ status: 'valid' })
      else if (r === 'not_found') setEditCardValidation({ status: 'invalid', message: isArabic ? 'كود البطاقة غير موجود. أنشئه من إدارة البطاقات أولًا.' : 'Card code not found. Create it from Card Manager first.' })
      else if (r === 'already_used') {
        if (member?.card_code === editForm.card_code) setEditCardValidation({ status: 'valid' })
        else setEditCardValidation({ status: 'invalid', message: isArabic ? 'هذه البطاقة مستخدمة بالفعل مع عضو آخر.' : 'This card is already used by another member.' })
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [editForm.card_code, member?.card_code])

  if (!member) return null

  const latestRenewal = renewals[0]
  const paidAmount = latestRenewal?.amount ?? member.plan_price
  const remainingAmount = Math.max(member.plan_price - paidAmount, 0)
  const notStarted = member.start_date > getLocalDateString()
  const daysLeft = notStarted ? getDaysLeft(member.start_date) : getDaysLeft(member.end_date)
  const lastAttendance = attendance[0]
  const cardImageSrc = cardImage ? (cardImage.startsWith('data:') ? cardImage : `data:image/png;base64,${cardImage}`) : ''

  const detailRows = [
    { label: isArabic ? 'الاسم' : 'Name', value: member.name, icon: UserRound },
    { label: isArabic ? 'رقم الفون' : 'Phone', value: formatPhone(member.phone) || emptyValue, icon: Phone },
    { label: isArabic ? 'الجنس' : 'Gender', value: member.gender ? (member.gender === 'male' ? (isArabic ? 'ذكر' : 'Male') : (isArabic ? 'أنثى' : 'Female')) : emptyValue, icon: Users },
    { label: isArabic ? 'تاريخ البداية' : 'Start Date', value: formatDate(member.start_date), icon: CalendarDays, tone: notStarted ? 'text-blue-400' : 'text-green-400' },
    { label: isArabic ? 'تاريخ النهاية' : 'End Date', value: formatDate(member.end_date), icon: Calendar, tone: notStarted ? 'text-blue-400' : daysLeft <= 0 ? 'text-destructive' : 'text-primary' },
    { label: isArabic ? 'المدة' : 'Duration', value: getDurationLabel(member), icon: Clock },
    { label: isArabic ? 'اسم الخطة' : 'Plan Name', value: getPlanName(member), icon: ClipboardList },
    { label: isArabic ? 'سعر الخطة' : 'Plan Price', value: formatCurrency(member.plan_price), icon: Banknote },
    { label: isArabic ? 'المبلغ المدفوع' : 'Paid Amount', value: formatCurrency(paidAmount), icon: Banknote, tone: 'text-green-400' },
    { label: isArabic ? 'الباقي' : 'Remaining', value: formatCurrency(remainingAmount), icon: Banknote, tone: remainingAmount > 0 ? 'text-destructive' : 'text-green-400' },
    { label: isArabic ? 'الأكونت' : 'Account', value: 'Admin', icon: BadgeCheck },
    { label: isArabic ? 'رقم العضو' : 'Member No.', value: member.card_code || member.id, icon: IdCard },
    { label: isArabic ? 'حالة العضو' : 'Member Status', value: getStatusLabel(member.status), icon: User },
    { label: isArabic ? 'آخر حضور' : 'Last Attendance', value: lastAttendance ? `${formatDate(lastAttendance.date)} - ${formatTime(lastAttendance.time)}` : emptyValue, icon: Clock },
  ]

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      <div className="p-4 sm:p-6 space-y-4" dir={isArabic ? 'rtl' : 'ltr'}>
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-foreground">{isArabic ? 'ملف العضو' : 'Member Profile'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <input type="file" ref={fileInputRef} onChange={handlePhotoChange} accept="image/png, image/jpeg, image/jpg" className="hidden" />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-4">
                <div onClick={() => showActions && fileInputRef.current?.click()} className={`relative group w-24 h-24 rounded-full bg-primary/20 border-2 border-primary/30 flex items-center justify-center cursor-pointer overflow-hidden transition-all duration-200 hover:border-primary shadow-md ${!showActions ? 'pointer-events-none' : ''}`}
                  title={showActions ? (isArabic ? 'تغيير الصورة' : 'Change Photo') : ''}
                >
                  {member.photo ? (
                    <img src={member.photo} className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-110" alt={member.name} />
                  ) : (
                    <span className="text-3xl text-primary font-bold group-hover:scale-90 transition-transform duration-200">{member.name.charAt(0)}</span>
                  )}
                  {showActions && (
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200">
                      <Camera className="w-6 h-6 text-white" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{member.name}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1.5">
                    <Phone className="w-3.5 h-3.5" />{formatPhone(member.phone)}
                    {member.phone && (
                      <button onClick={() => void openWhatsApp(member.phone)} title="WhatsApp" className="hover:opacity-70 transition-opacity">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp" className="w-4 h-4" />
                      </button>
                    )}
                    <QrCode className="w-3.5 h-3.5 ml-2" />{member.card_code || t('members.noCard')}
                  </div>
                </div>
              </div>
              <Badge className={notStarted ? 'text-blue-400 bg-blue-500/10 border-blue-500/30' : getStatusColor(member.status)}>{notStarted ? (isArabic ? 'لم يبدأ' : 'Not Started') : getStatusLabel(member.status)}</Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {detailRows.map((item) => (
                <div key={item.label} className="flex items-center gap-3 rounded-md border border-border bg-muted/50 px-3 py-2.5 min-h-[62px]">
                  <item.icon className={`w-4 h-4 shrink-0 ${item.tone || 'text-primary'}`} />
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">{item.label}</p>
                    <p className={`text-sm font-semibold truncate ${item.tone || 'text-foreground'}`}>{item.value || emptyValue}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/50 p-4 flex flex-col items-center justify-between gap-4">
            <div className="w-32 h-32 rounded-lg bg-primary/10 border border-primary/25 overflow-hidden flex items-center justify-center">
              {member.photo ? (
                <img src={member.photo} className="w-full h-full object-cover" alt={member.name} />
              ) : (
                <User className="w-14 h-14 text-primary" />
              )}
            </div>
            {cardImageSrc && (
              <div className="w-full pt-2 border-t border-border">
                <p className="text-[10px] text-muted-foreground mb-1.5 text-center">{isArabic ? 'تصميم الكرت' : 'Card Design'}</p>
                <img src={cardImageSrc} alt="Member Card" className="w-full rounded-lg border border-border" />
              </div>
            )}
            <div className="w-full text-center">
              <p className="text-xs text-muted-foreground">{isArabic ? 'كود العضوية' : 'Membership Code'}</p>
              <p className="font-mono text-lg font-bold text-foreground">{member.card_code || member.id}</p>
            </div>
          </div>
        </div>

        <div className="mb-2">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">{t('members.planFeatures')}</h4>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { key: 'inbody', label: t('feature.inbody'), used: member.inbody_used, total: member.plan_inbody_count, icon: Activity },
              { key: 'invitation', label: t('feature.invitations'), used: member.invitation_used, total: member.plan_invitation_count, icon: Gift },
              { key: 'freeze', label: t('feature.freeze'), used: member.freeze_used, total: member.plan_freeze_days, icon: Snowflake },
              { key: 'private', label: t('feature.private'), used: member.private_used, total: member.plan_private_sessions, icon: Users },
            ].map((f) => {
              const maxed = f.total <= 0 || f.used >= f.total
              return (
                <div key={f.key} className="p-3 rounded-lg bg-muted border border-border text-center">
                  <f.icon className={`w-5 h-5 mx-auto mb-1 ${f.key === 'freeze' ? 'text-destructive' : 'text-primary'}`} />
                  <p className="text-xs text-muted-foreground">{f.label}</p>
                  <p className="text-lg font-bold text-foreground">{formatNumber(f.used)}/{formatNumber(f.total)}</p>
                  {maxed ? (
                    <div className="mt-1 w-5 h-5 mx-auto" />
                  ) : (
                    <button
                      onClick={() => {
                        if (f.key === 'freeze') {
                          setFreezeDialogOpen(true)
                        } else if (f.key === 'invitation') {
                          setInviteForm({ guest_name: '', guest_phone: '' })
                          setInviteDialogOpen(true)
                        } else {
                          setConfirmDialog({
                            open: true,
                            title: t('members.useFeature', { feature: f.label }),
                            message: t('members.useFeatureMessage', { feature: f.label.toLowerCase(), name: member?.name || '' }),
                            onConfirm: () => useFeature(f.key)
                          })
                        }
                      }}
                      className={`mt-1 w-5 h-5 rounded-full flex items-center justify-center mx-auto transition-colors ${f.key === 'freeze' ? 'bg-destructive/20 hover:bg-destructive/40' : 'bg-primary/20 hover:bg-primary/40'}`}
                      title={t('members.useFeature', { feature: f.label })}
                    >
                      <span className={`text-xs ${f.key === 'freeze' ? 'text-destructive' : 'text-primary'}`}>+</span>
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mt-6">
          <div className="md:col-span-3 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-xs text-muted-foreground">{t('members.plan')}</p>
                <p className="font-bold text-foreground text-base">{getPlanName(member)}</p>
                <p className="text-xs text-muted-foreground mt-1">{formatDate(member.start_date)} → {formatDate(member.end_date)}</p>
              </div>
              <div className={`p-3 rounded-lg border ${notStarted ? 'bg-blue-500/10 border-blue-500/20' : daysLeft <= 0 ? 'bg-destructive/10 border-destructive/20' : daysLeft <= 7 ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-green-500/10 border-green-500/20'}`}>
                <p className="text-xs text-muted-foreground">{notStarted ? (isArabic ? 'يبدأ بعد' : 'Starts in') : (isArabic ? 'الأيام المتبقية' : 'Days Left')}</p>
                <p className={`text-2xl font-bold ${notStarted ? 'text-blue-400' : getDaysColor(daysLeft)}`}>
                  {notStarted ? `${formatNumber(daysLeft)}d` : daysLeft > 0 ? (isArabic ? `${formatNumber(daysLeft)} يوم` : `${formatNumber(daysLeft)} days`) : t('common.expired').toUpperCase()}
                </p>
              </div>
            </div>

            <FrozenCountdown frozenUntil={member.frozen_until} status={member.status} freezeDaysEntered={member.freeze_days_entered} />
          </div>

          <div className="md:col-span-2 space-y-4">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">{t('members.attendanceHistory')}</h4>
              <div className="max-h-24 overflow-y-auto space-y-1">
                {attendance.slice(0, 5).map((a) => (
                  <div key={a.id} className="flex justify-between text-xs p-2 rounded bg-muted">
                    <span className="text-muted-foreground">{formatDate(a.date)}</span>
                    <span className="text-muted-foreground">{formatTime(a.time)} · {a.method}</span>
                  </div>
                ))}
                {attendance.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">{t('members.noAttendance')}</p>}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">{t('members.renewalHistory')}</h4>
              <div className="max-h-24 overflow-y-auto space-y-1">
                {renewals.slice(0, 5).map((r) => (
                  <div key={r.id} className="flex justify-between text-xs p-2 rounded bg-muted">
                    <span className="text-muted-foreground">{formatDate(r.date)}</span>
                    <span className="text-green-400 font-bold">{formatCurrency(r.amount)}</span>
                  </div>
                ))}
                {renewals.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">{t('members.noRenewals')}</p>}
              </div>
            </div>
          </div>
        </div>

        {showActions && (
          <div className="flex flex-wrap gap-2 pt-4 mt-4 border-t border-border">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => { setEditForm({ name: member.name, phone: member.phone, card_code: member.card_code }); setEditDialogOpen(true) }}>
              {t('common.edit')}
            </Button>
            <Button variant="outline" size="sm" className="gap-2 text-blue-400 border-blue-500/30" onClick={() => fileInputRef.current?.click()}>
              <Camera className="w-3 h-3" /> {member.photo ? (isArabic ? 'تغيير الصورة' : 'Change Photo') : (isArabic ? 'إضافة صورة' : 'Add Photo')}
            </Button>
            <Button variant="outline" size="sm" className="gap-2 text-primary border-primary/30" onClick={() => { setRenewForm({ plan_id: member.plan_id }); setRenewDialogOpen(true) }}>
              <RotateCcw className="w-3 h-3" /> {t('common.renew')}
            </Button>
            <Button variant="outline" size="sm" className="gap-2 text-green-500 border-green-500/30" onClick={() => { setInviteForm({ guest_name: '', guest_phone: '' }); setInviteDialogOpen(true) }}>
              <UserPlus className="w-3 h-3" /> {isArabic ? 'دعوة ضيف' : 'Invite Guest'}
            </Button>
            {member.status === 'frozen' && (
              <Button variant="outline" size="sm" className="gap-2 text-primary border-primary/30" onClick={() => setConfirmDialog({
                open: true, title: t('members.unfreezeMember'),
                message: t('members.unfreezeMessage', { name: member?.name || '' }),
                onConfirm: async () => {
                  await invoke('unfreeze_member', { member_id: member!.id })
                  toast({ title: t('members.unfreezeMember'), variant: 'success' })
                  onRefresh()
                }
              })}>
                <Snowflake className="w-3 h-3" /> {t('members.unfreezeMember')}
              </Button>
            )}
            {onRegenerateCard && (
              <Button variant="outline" size="sm" className="gap-2 text-yellow-400 border-yellow-500/30" onClick={onRegenerateCard}>
                <Image className="w-3 h-3" /> {isArabic ? 'تحديث الكارت' : 'Regenerate Card'}
              </Button>
            )}
            {isOwner() && (
            <Button variant="outline" size="sm" className="gap-2 text-destructive border-destructive/30 ml-auto" onClick={() => setDeleteDialogOpen(true)}>
              <Trash2 className="w-3 h-3" /> {t('common.delete')}
            </Button>
            )}
          </div>
        )}

        <div className="flex justify-end pt-4 mt-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-1" /> {t('common.close')}
          </Button>
        </div>
      </div>

      <Dialog open={freezeDialogOpen} onOpenChange={(o) => { setFreezeDialogOpen(o); if (!o) setFreezeDays(1) }}>
        <DialogContent className="sm:max-w-[350px]">
          <DialogHeader><DialogTitle>{t('members.freezeMember')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {(() => {
              const available = (member?.plan_freeze_days || 0) - (member?.freeze_used || 0)
              return (
                <>
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-center">
                    <p className="text-xs text-muted-foreground">{t('members.availableFreezeDays')}</p>
                    <p className="text-2xl font-bold text-primary">{available}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('members.freezeDuration')}</Label>
                    <Input type="number" min={1} max={available} value={freezeDays || ''}
                      onChange={(e) => setFreezeDays(Math.min(Math.max(parseInt(e.target.value) || 1, 1), available))} />
                  </div>
                  <Button className="w-full" disabled={available <= 0}
                    onClick={() => setConfirmDialog({
                      open: true, title: t('members.freezeMember'),
                      message: t('members.freezeMessage', { name: member?.name || '', days: freezeDays, plural: freezeDays > 1 ? 's' : '' }),
                      onConfirm: async () => {
                        if (!member) return
                        await invoke('freeze_member', { member_id: member.id, days: freezeDays })
                        toast({ title: t('members.freezeMember'), description: isArabic ? `تم تجميد ${member.name} لمدة ${formatNumber(freezeDays)} يوم` : `${member.name} frozen for ${formatNumber(freezeDays)} days`, variant: 'success' })
                        setFreezeDialogOpen(false)
                        setFreezeDays(1)
                        onRefresh()
                      }
                    })}
                  >
                    {isArabic ? `تجميد ${formatNumber(freezeDays)} يوم` : `Freeze ${formatNumber(freezeDays)} Days`}
                  </Button>
                </>
              )
            })()}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>{t('members.editMember')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2"><Label>{t('members.name')}</Label><Input value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} /></div>
            <div className="space-y-2"><Label>{t('members.phone')}</Label><Input value={editForm.phone} onChange={(e) => setEditForm({...editForm, phone: e.target.value})} /></div>
            <div className="space-y-2">
              <Label>{t('members.cardCode')}</Label>
              <div className="relative">
                <Input value={editForm.card_code} onChange={(e) => setEditForm({...editForm, card_code: e.target.value})}
                  className={editForm.card_code ? (editCardValidation.status === 'valid' ? 'border-green-500 pr-8' : editCardValidation.status === 'invalid' ? 'border-destructive pr-8' : '') : ''} />
                {editCardValidation.status === 'valid' && <CheckCircle className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400" />}
                {editCardValidation.status === 'invalid' && <XCircle className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-destructive" />}
              </div>
              {editCardValidation.status === 'invalid' && <p className="text-xs text-destructive">{editCardValidation.message}</p>}
            </div>
            <Button className="w-full" onClick={handleEdit}>{t('members.saveChanges')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{isArabic ? 'حذف العضو' : 'Delete Member'}</DialogTitle>
            <DialogDescription>
              {isArabic ? 'هل أنت متأكد من حذف هذا العضو؟' : 'Are you sure you want to delete this member?'}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {isArabic ? 'هذا الإجراء لا يمكن التراجع عنه' : 'This action cannot be undone'}
          </p>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={handleDelete}>{t('common.delete')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={renewDialogOpen} onOpenChange={setRenewDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>{t('members.renewMembership')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>{t('members.plan')}</Label>
              <Select value={renewForm.plan_id} onValueChange={(v) => setRenewForm({...renewForm, plan_id: v })}>
                <SelectTrigger><SelectValue placeholder={t('members.selectPlan')} /></SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name} - {formatCurrency(p.price)}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleRenew}>{t('common.renew')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              {isArabic ? 'دعوة ضيف' : 'Invite Guest'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{isArabic ? 'العضو المضيف' : 'Host Member'}</Label>
              <Input value={member?.name || ''} disabled />
            </div>
            <div className="space-y-1.5">
              <Label>{isArabic ? 'اسم المدعو' : 'Guest Name'}</Label>
              <Input value={inviteForm.guest_name} onChange={(e) => setInviteForm({...inviteForm, guest_name: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <Label>{isArabic ? 'رقم تليفون المدعو' : 'Guest Phone'}</Label>
              <div className="flex items-center">
                <span className="px-3 py-2 bg-muted rounded-l-md border border-r-0 text-sm">+20</span>
                <Input className="rounded-l-none" value={inviteForm.guest_phone} onChange={(e) => setInviteForm({...inviteForm, guest_phone: e.target.value.replace(/[^0-9]/g, '')})} placeholder="1xxxxxxxxx" />
              </div>
            </div>
            <Button className="w-full gap-2" onClick={async () => {
              if (!inviteForm.guest_name.trim() || !inviteForm.guest_phone.trim()) return
              try {
                const result = await invoke('add_invitation', { member_id: member!.id, member_name: member!.name, guest_name: inviteForm.guest_name.trim(), guest_phone: inviteForm.guest_phone.trim() }) as string
                toast({
                  title: result === 'last_visit' ? (isArabic ? 'آخر زيارة متاحة' : 'Last visit available') : (isArabic ? 'تمت الدعوة' : 'Invited'),
                  description: result === 'last_visit' ? (isArabic ? 'هذه هي آخر مرة يمكن للمدعو الحضور فيها.' : 'This is the guest\u2019s last allowed visit.') : undefined,
                  variant: result === 'last_visit' ? 'default' : 'success'
                })
                setInviteDialogOpen(false)
                onRefresh()
                refreshNotifications()
              } catch (err) {
                toast({ title: isArabic ? 'فشل' : 'Failed', description: String(err), variant: 'destructive' })
              }
            }}>
              <UserPlus className="w-4 h-4" /> {isArabic ? 'تأكيد' : 'Confirm'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDialog.open} onOpenChange={(o) => setConfirmDialog({ ...confirmDialog, open: o })}>
        <DialogContent className="sm:max-w-[350px] border-primary/30">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <AlertTriangle className="w-5 h-5 text-primary" />
              </div>
              <DialogTitle>{confirmDialog.title}</DialogTitle>
            </div>
          </DialogHeader>
          <p className="text-sm text-muted-foreground px-2">{confirmDialog.message}</p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog({ ...confirmDialog, open: false }) }}>
              {t('common.confirm')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
