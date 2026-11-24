import { useState, useEffect, useRef, useMemo } from 'react'
import { User, CheckCircle, Snowflake, RefreshCw } from 'lucide-react'
import { invoke, listen } from '@/lib/tauri'
import PageTransition from '@/components/shared/PageTransition'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatTime, generateId, getLocalDateString, addMonthsToDate, formatPhone } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { Member, Plan, Attendance as AttendanceType, Renewal } from '@/types'
import { useLanguage } from '@/lib/i18n'
import MemberProfileDialog from '@/components/shared/MemberProfileDialog'

export default function AttendancePage() {
  const { t, isArabic } = useLanguage()
  const [members, setMembers] = useState<Member[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [attendance, setAttendance] = useState<AttendanceType[]>([])
  const [scanValue, setScanValue] = useState('')
  const [scanResult, setScanResult] = useState<Member | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [frozenDialogOpen, setFrozenDialogOpen] = useState(false)
  const [method, setMethod] = useState('Barcode')
  const [profileMember, setProfileMember] = useState<Member | null>(null)
  const [profileAttendance, setProfileAttendance] = useState<AttendanceType[]>([])
  const [profileRenewals, setProfileRenewals] = useState<Renewal[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const scanInProgressRef = useRef(false)
  const scanTimerRef = useRef<number | undefined>(undefined)
  const lastInputAtRef = useRef(0)
  const scannerBurstRef = useRef(false)
  const unlistenRef = useRef<(() => void) | undefined>(undefined)
  const [profileCardImage, setProfileCardImage] = useState<string>('')
  const [visibleCount, setVisibleCount] = useState(25)

  const compactScanCode = (value: string) => value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  const scanDigits = (value: string) => value.replace(/\D/g, '')

  const findScannedMember = (code: string, list: Member[]) => {
    const compactCode = compactScanCode(code)
    const digits = scanDigits(code)
    return list.find((m) => {
      const compactCard = compactScanCode(m.card_code || '')
      const cardDigits = scanDigits(m.card_code || '')
      return compactCard === compactCode
        || (digits.length >= 4 && cardDigits.endsWith(digits))
        || m.phone === code
        || (digits.length >= 4 && m.phone.endsWith(digits))
    })
  }

  const loadAttendance = async () => {
    setRefreshing(true)
    try {
      const a = await invoke('get_attendance_by_date', { date: getLocalDateString() })
      if (a) setAttendance(a as AttendanceType[])
    } catch {}
    setRefreshing(false)
  }

  const load = async () => {
    setRefreshing(true)
    try {
      const [m, p, a] = await Promise.all([
        invoke('get_members_light'),
        invoke('get_plans'),
        invoke('get_attendance_by_date', { date: getLocalDateString() }),
      ])
      if (m) setMembers(m as Member[])
      if (p) setPlans(p as Plan[])
      if (a) setAttendance(a as AttendanceType[])
    } catch {}
    setRefreshing(false)
  }

  const focusScannerInput = () => {
    window.setTimeout(() => {
      // Do not steal keyboard input from an open modal dialog.
      if (!document.querySelector('[role="dialog"]')) {
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }, 0)
  }

  useEffect(() => {
    load()
    listen('attendance-updated', () => { loadAttendance() }).then((fn) => { unlistenRef.current = fn })
    return () => { unlistenRef.current?.() }
  }, [])

  useEffect(() => {
    const restoreFocus = () => focusScannerInput()
    restoreFocus()
    window.addEventListener('focus', restoreFocus)
    document.addEventListener('visibilitychange', restoreFocus)
    return () => {
      window.removeEventListener('focus', restoreFocus)
      document.removeEventListener('visibilitychange', restoreFocus)
    }
  }, [])

  useEffect(() => {
    if (!showConfirm && !frozenDialogOpen) {
      focusScannerInput()
    }
  }, [showConfirm, frozenDialogOpen])

  useEffect(() => () => {
    if (scanTimerRef.current) window.clearTimeout(scanTimerRef.current)
  }, [])

  const loadProfile = async (memberId: string) => {
    const [att, ren, m, img] = await Promise.all([
      invoke('get_attendance', { member_id: memberId }),
      invoke('get_renewals', { member_id: memberId }),
      invoke('get_member_by_id', { member_id: memberId }),
      invoke('get_member_card_image', { member_id: memberId }),
    ])
    if (att) setProfileAttendance(att as AttendanceType[])
    if (ren) setProfileRenewals(ren as Renewal[])
    if (m) {
      const updated = m as Member | null
      if (updated) setProfileMember(updated)
    }
    if (img) setProfileCardImage(img as string)
  }

  const showProfile = async (member: Member) => {
    setProfileMember(member)
    await loadProfile(member.id)
  }

  const handleScan = async (raw: string) => {
    const code = raw.trim()
    if (!code || scanInProgressRef.current) return
    scanInProgressRef.current = true
    if (scanTimerRef.current) window.clearTimeout(scanTimerRef.current)
    // Clear the actual DOM element as well as React state before the async lookup.
    // This makes the next scanner payload start cleanly even on a slow WebView render.
    if (inputRef.current) inputRef.current.value = ''
    setScanValue('')
    setMethod('Barcode')

    try {
      // Try direct DB lookup by card_code (avoids fetching all members with photos)
      let member: Member | undefined
      try {
        const result = await invoke('find_member_by_card', { card_code: code }) as Member | null
        if (result) member = result
      } catch {}

      // Fallback: search by phone from local state
      if (!member) {
        member = findScannedMember(code, members)
      }

      if (!member) {
        toast({ title: isArabic ? 'العضو غير موجود' : 'Member Not Found', description: isArabic ? `لا يوجد عضو بهذا الكود: ${code}` : `No member with code: ${code}`, variant: 'destructive' })
        return
      }

      const today = getLocalDateString()

      // A membership is valid through its end date. Never let an expired
      // membership reach the attendance command.
      if (member.status === 'expired' || (member.end_date && member.end_date < today)) {
        toast({
          title: isArabic ? 'الاشتراك منتهي' : 'Membership Expired',
          description: isArabic ? `${member.name} يحتاج إلى تجديد الاشتراك قبل تسجيل الحضور.` : `${member.name} must renew the membership before checking in.`,
          variant: 'destructive',
        })
        return
      }

      // Auto-start membership if member has future start date
      if (member.start_date && member.start_date > today) {
        const newEnd = addMonthsToDate(today, member.plan_duration_months || 1)
        await invoke('update_member_dates', { member_id: member.id, new_start: today, new_end: newEnd })
        member.start_date = today
        member.end_date = newEnd
        toast({ title: isArabic ? 'تم بدء العضوية' : 'Membership Started', description: `${member.name} بدأت من اليوم`, variant: 'success' })
      }

      if (member.status === 'frozen') {
        setScanResult(member)
        setFrozenDialogOpen(true)
        return
      }

      const exists = await invoke('check_attendance_today', { member_id: member.id, date: today })
      if (!exists) {
        const now = new Date()
        const time = now.toTimeString().split(' ')[0]
        await invoke('add_attendance', { id: generateId(), member_id: member.id, date: today, time, method: 'Barcode' })
        toast({ title: isArabic ? 'تم تسجيل الحضور' : 'Attendance Recorded', description: `${member.name} - ${formatTime(time)}`, variant: 'success' })
      }

      loadAttendance()
      await showProfile(member)
    } finally {
      scanInProgressRef.current = false
      focusScannerInput()
    }
  }

  const submitCurrentScan = () => {
    // Scanner input can arrive faster than a React state render; use the DOM value.
    void handleScan(inputRef.current?.value || scanValue)
  }

  const handleScanInput = (value: string) => {
    const now = performance.now()
    const interval = now - lastInputAtRef.current
    lastInputAtRef.current = now
    // Hardware sends a character burst roughly every 5–20ms and, as verified,
    // does not send a trailing Enter. Manual typing stays manual until Enter/click.
    if (interval > 0 && interval < 80) scannerBurstRef.current = true
    if (scanTimerRef.current) window.clearTimeout(scanTimerRef.current)
    setScanValue(value)
    if (scannerBurstRef.current && value.trim().length >= 4) {
      scanTimerRef.current = window.setTimeout(() => {
        scannerBurstRef.current = false
        void handleScan(inputRef.current?.value || value)
      }, 180)
    }
  }

  const handleScanKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' && event.code !== 'Enter' && event.code !== 'NumpadEnter') return
    event.preventDefault()
    if (scanTimerRef.current) window.clearTimeout(scanTimerRef.current)
    scannerBurstRef.current = false
    submitCurrentScan()
  }

  const recordFrozenAttendance = async (member: Member) => {
    const now = new Date()
    const date = getLocalDateString(now)
    const time = now.toTimeString().split(' ')[0]
    await invoke('add_attendance', { id: generateId(), member_id: member.id, date, time, method, was_frozen: true })
    toast({ title: isArabic ? 'تم تسجيل الحضور' : 'Attendance Recorded', description: `${member.name} - ${formatTime(time)}`, variant: 'success' })
    setFrozenDialogOpen(false)
    setScanResult(null)
    load()
    await showProfile(member)
  }

  const handleManualAttendance = async () => {
    setMethod('Manual')
    setShowConfirm(true)
  }

  const memberMap = useMemo(() => new Map(members.map(m => [m.id, m])), [members])
  const todayStr = useMemo(() => getLocalDateString(), [])
  const todayAttendance = useMemo(() => attendance.filter((a) => a.date === todayStr), [attendance, todayStr])
  const visibleAttendance = useMemo(() => todayAttendance.slice(0, visibleCount), [todayAttendance, visibleCount])

  useEffect(() => { setVisibleCount(25) }, [todayAttendance.length])

  return (
    <PageTransition>
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">{t('attendance.todayAttendance')}</h1>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className={`w-3.5 h-3.5 transition-all duration-500 ${refreshing ? 'rotate-180 text-primary' : ''}`} />
            {refreshing ? (isArabic ? 'جاري التحديث...' : 'Refreshing...') : (isArabic ? 'مباشر' : 'Live')}
          </div>
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <Card className="border-green-500/20">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t('attendance.todayAttendance')}</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-green-400">{todayAttendance.length}</p></CardContent>
          </Card>
          <Card className="border-primary/20">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t('attendance.totalMembers')}</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-primary">{members.length}</p></CardContent>
          </Card>
          <Card className="border-primary/20">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t('attendance.activeToday')}</CardTitle></CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-primary">
                {members.length > 0 ? ((todayAttendance.length / members.length) * 100).toFixed(1) : 0}%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Today's attendance list */}
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">{t('attendance.todayRecords')}</CardTitle></CardHeader>
          <CardContent>
            {todayAttendance.length === 0 ? (
              <p className="text-muted-foreground text-center py-6">{t('attendance.noAttendanceToday')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground uppercase">
                      <th className="text-left p-3 font-medium">{isArabic ? 'الاسم' : 'Name'}</th>
                      <th className="text-left p-3 font-medium">{isArabic ? 'الكود' : 'Card Code'}</th>
                      <th className="text-left p-3 font-medium">{isArabic ? 'الهاتف' : 'Phone'}</th>
                      <th className="text-left p-3 font-medium">{isArabic ? 'الوقت' : 'Time'}</th>
                      <th className="text-left p-3 font-medium">{isArabic ? 'الطريقة' : 'Method'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleAttendance.map((a) => {
                      const m = memberMap.get(a.member_id)
                      const isInvite = a.method.startsWith('Invite|')
                      const inviteParts = isInvite ? a.method.split('|') : []
                      const guestName = inviteParts[1] || ''
                      const inviterName = inviteParts[2] || m?.name || '—'

                      return (
                        <tr key={a.id}
                          onDoubleClick={() => m && showProfile(m)}
                          className="border-b border-border/50 hover:bg-muted cursor-pointer transition-colors"
                        >
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                              <span className="text-sm text-foreground">
                                {isInvite ? guestName : (m?.name || 'Unknown')}
                              </span>
                            </div>
                          </td>
                          <td className="p-3 text-sm text-muted-foreground font-mono">
                            {isInvite
                              ? <span className="text-primary text-xs">Invited by: {inviterName}</span>
                              : (m?.card_code || '—')}
                          </td>
                          <td className="p-3 text-sm text-muted-foreground">
                            {isInvite ? '—' : (formatPhone(m?.phone) || '—')}
                          </td>
                          <td className="p-3 text-sm text-muted-foreground">{formatTime(a.time)}</td>
                          <td className="p-3">
                            <Badge variant={isInvite ? 'default' : 'secondary'} className="text-xs">
                              {isInvite ? 'Invite' : a.method}
                            </Badge>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {visibleAttendance.length < todayAttendance.length && (
              <div className="pt-4 text-center">
                <Button variant="outline" onClick={() => setVisibleCount((count) => count + 25)}>
                  {isArabic ? 'عرض المزيد' : 'Load More'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scan bar */}
        <Card>
          <CardContent className="p-3">
            <form className="flex items-center gap-2 max-w-xl mx-auto" onSubmit={(event) => { event.preventDefault(); submitCurrentScan() }}>
              <Input
                ref={inputRef}
                placeholder={t('attendance.scanPlaceholder')}
                value={scanValue}
                onChange={(e) => handleScanInput(e.target.value)}
                onKeyDown={handleScanKeyDown}
                className="text-center font-mono h-10"
                autoFocus
              />
              <Button type="submit" onClick={submitCurrentScan} className="h-10 shrink-0">{t('attendance.scan')}</Button>
              <Button type="button" variant="ghost" size="icon" onClick={handleManualAttendance} className="h-10 w-10 shrink-0" title={t('attendance.manual')}>
                <User className="w-4 h-4" />
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Inline profile below scan bar */}
        {profileMember && (
          <div>
            <MemberProfileDialog
              variant="inline"
              open={false}
              onOpenChange={() => { setProfileMember(null); setProfileAttendance([]); setProfileRenewals([]); setProfileCardImage('') }}
              member={profileMember}
              attendance={profileAttendance}
              renewals={profileRenewals}
              plans={plans}
              showActions={true}
              onRefresh={() => { if (profileMember) loadProfile(profileMember.id) }}
              cardImage={profileCardImage}
            />
          </div>
        )}

        {/* Manual attendance member selector */}
        <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader><DialogTitle>{t('attendance.selectMember')}</DialogTitle></DialogHeader>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {members.filter((m) => m.status === 'active' || m.status === 'noactive').map((m) => (
                <button
                  key={m.id}
                  onClick={async () => {
                    setShowConfirm(false)
                    const today = getLocalDateString()
                    const exists = await invoke('check_attendance_today', { member_id: m.id, date: today })
                    if (!exists) {
                      const now = new Date()
                      const time = now.toTimeString().split(' ')[0]
                      await invoke('add_attendance', { id: generateId(), member_id: m.id, date: today, time, method: 'Manual' })
                      toast({ title: isArabic ? 'تم تسجيل الحضور' : 'Attendance Recorded', description: `${m.name} - ${formatTime(time)}`, variant: 'success' })
                    }
                    loadAttendance()
                    await showProfile(m)
                  }}
                  className="w-full text-left p-3 rounded-lg hover:bg-primary/10 transition-colors"
                >
                  <p className="text-sm text-foreground">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{m.card_code || formatPhone(m.phone)}</p>
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Frozen member dialog */}
        <Dialog open={frozenDialogOpen} onOpenChange={setFrozenDialogOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Snowflake className="w-5 h-5 text-primary" />
                {t('attendance.memberFrozen')}
              </DialogTitle>
            </DialogHeader>
            {scanResult && (() => {
              const remainingMs = scanResult.frozen_until ? Math.max(0, new Date(scanResult.frozen_until).getTime() - Date.now()) : 0
              const totalMinutes = Math.ceil(remainingMs / 60000)
              const remDays = Math.max(0, Math.ceil(totalMinutes / 1440) - 1)
              const minutesAfterDays = Math.max(0, totalMinutes - remDays * 1440)
              const remHours = Math.floor(minutesAfterDays / 60)
              const remMin = minutesAfterDays % 60
              return (
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-center">
                    <p className="text-sm font-medium text-foreground">{scanResult.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t('attendance.currentlyFrozen')}</p>
                    {remainingMs > 0 && (
                      <p className="text-lg font-bold text-primary mt-2">{remDays}d {remHours}h {remMin}m {t('attendance.remaining')}</p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    {t('attendance.freezeUsed')}: {scanResult.freeze_used} / {scanResult.plan_freeze_days}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => { setFrozenDialogOpen(false); setScanResult(null) }}>
                      {t('common.cancel')}
                    </Button>
                    <Button className="flex-1" onClick={async () => {
                      if (!scanResult) return
                      setFrozenDialogOpen(false)
                      await invoke('unfreeze_member', { member_id: scanResult.id })
                      await recordFrozenAttendance(scanResult)
                    }}>
                      <Snowflake className="w-4 h-4 mr-1" /> {t('attendance.unfreezeAttend')}
                    </Button>
                  </div>
                </div>
              )
            })()}
          </DialogContent>
        </Dialog>

      </div>
    </PageTransition>
  )
}
