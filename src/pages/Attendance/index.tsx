import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { QrCode, Search, User, Clock, CheckCircle, AlertTriangle, Snowflake } from 'lucide-react'
import { invoke } from '@/lib/tauri'
import PageTransition from '@/components/shared/PageTransition'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDate, formatTime, getStatusColor, generateId } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { Member, Plan, Attendance as AttendanceType } from '@/types'
import { useLanguage } from '@/lib/i18n'
import { useNavigate } from 'react-router-dom'

export default function AttendancePage() {
  const { t, isArabic } = useLanguage()
  const navigate = useNavigate()
  const [members, setMembers] = useState<Member[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [attendance, setAttendance] = useState<AttendanceType[]>([])
  const [scanValue, setScanValue] = useState('')
  const [scanResult, setScanResult] = useState<Member | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmDuplicate, setConfirmDuplicate] = useState(false)
  const [frozenDialogOpen, setFrozenDialogOpen] = useState(false)
  const [method, setMethod] = useState('Barcode')
  const inputRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    try {
      const m = await invoke('get_members')
      if (m) setMembers(m as Member[])
      const p = await invoke('get_plans')
      if (p) setPlans(p as Plan[])
      const a = await invoke('get_all_attendance')
      if (a) setAttendance(a as AttendanceType[])
    } catch {}
  }

  useEffect(() => { load() }, [])
  useEffect(() => { inputRef.current?.focus() })

  // Auto-focus input after scan
  useEffect(() => {
    if (!showConfirm) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [showConfirm])

  const handleScan = async (code: string) => {
    if (!code.trim()) return
    setScanValue('')

    const member = members.find((m) => m.card_code === code || m.phone === code)
    if (!member) {
      toast({ title: isArabic ? 'العضو غير موجود' : 'Member Not Found', description: isArabic ? `لا يوجد عضو بهذا الكود: ${code}` : `No member with code: ${code}`, variant: 'destructive' })
      navigate('/members', { state: { openAddMember: true, scannedCode: code } })
      return
    }

    setScanResult(member)

    // Check frozen
    if (member.status === 'frozen') {
      setFrozenDialogOpen(true)
      return
    }

    // Check duplicate
    const today = new Date().toISOString().split('T')[0]
    try {
      const exists = await invoke('check_attendance_today', { member_id: member.id, date: today })
      if (exists) {
        setConfirmDuplicate(true)
        setShowConfirm(true)
        return
      }
    } catch {}

    await recordAttendance(member)
  }

  const recordAttendance = async (member: Member) => {
    const now = new Date()
    const date = now.toISOString().split('T')[0]
    const time = now.toTimeString().split(' ')[0]
    await invoke('add_attendance', { id: generateId(), member_id: member.id, date, time, method })
    toast({ title: isArabic ? 'تم تسجيل الحضور' : 'Attendance Recorded', description: `${member.name} - ${formatTime(time)}`, variant: 'success' })
    setShowConfirm(false)
    setConfirmDuplicate(false)
    load()
  }

  const handleConfirmDuplicate = async () => {
    if (scanResult) await recordAttendance(scanResult)
  }

  const handleManualAttendance = async () => {
    setMethod('Manual')
    // Show member selector
    setShowConfirm(true)
  }

  const todayAttendance = attendance.filter((a) => a.date === new Date().toISOString().split('T')[0])

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <Card className="border-green-500/20">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-400">{t('attendance.todayAttendance')}</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-green-400">{todayAttendance.length}</p></CardContent>
          </Card>
          <Card className="border-yellow-500/20">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-400">{t('attendance.totalMembers')}</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-yellow-400">{members.length}</p></CardContent>
          </Card>
          <Card className="border-yellow-500/20">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-400">{t('attendance.activeToday')}</CardTitle></CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-yellow-400">
                {members.length > 0 ? ((todayAttendance.length / members.length) * 100).toFixed(1) : 0}%
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-[#1a2d45] bg-[#0d1117]/80">
          <CardContent className="p-6">
            <div className="text-center mb-4">
              <QrCode className="w-12 h-12 text-yellow-400 mx-auto mb-2" />
              <p className="text-lg text-white font-medium mb-1">{t('attendance.scanCard')}</p>
              <p className="text-sm text-gray-400">{t('attendance.scanHelp')}</p>
            </div>
            <div className="flex gap-2 max-w-md mx-auto">
              <Input
                ref={inputRef}
                placeholder={t('attendance.scanPlaceholder')}
                value={scanValue}
                onChange={(e) => setScanValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleScan(scanValue)
                  }
                }}
                className="text-center text-lg font-mono h-12"
                autoFocus
              />
              <Button onClick={() => handleScan(scanValue)} className="h-12">{t('attendance.scan')}</Button>
            </div>
            <div className="text-center mt-3">
              <Button variant="ghost" size="sm" className="text-gray-400" onClick={handleManualAttendance}>
                <User className="w-4 h-4 mr-1" /> {t('attendance.manual')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#1a2d45]">
          <CardHeader><CardTitle className="text-sm text-gray-400">{t('attendance.todayRecords')}</CardTitle></CardHeader>
          <CardContent>
            {todayAttendance.length === 0 ? (
              <p className="text-gray-500 text-center py-6">{t('attendance.noAttendanceToday')}</p>
            ) : (
              <div className="space-y-1">
                {todayAttendance.map((a) => {
                  const m = members.find((x) => x.id === a.member_id)
                  return (
                    <motion.div key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="flex items-center justify-between p-3 rounded-lg bg-white/5"
                    >
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span className="text-sm text-white">{m?.name || 'Unknown'}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400">{formatTime(a.time)}</span>
                        <Badge variant="secondary" className="text-xs">{a.method}</Badge>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Manual attendance member selector */}
        <Dialog open={showConfirm && !confirmDuplicate} onOpenChange={setShowConfirm}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader><DialogTitle>{t('attendance.selectMember')}</DialogTitle></DialogHeader>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {members.filter((m) => m.status === 'active').map((m) => (
                <button
                  key={m.id}
                  onClick={async () => {
                    await recordAttendance(m)
                  }}
                  className="w-full text-left p-3 rounded-lg hover:bg-yellow-600/10 transition-colors"
                >
                  <p className="text-sm text-white">{m.name}</p>
                  <p className="text-xs text-gray-400">{m.card_code || m.phone}</p>
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
                <Snowflake className="w-5 h-5 text-yellow-400" />
                {t('attendance.memberFrozen')}
              </DialogTitle>
            </DialogHeader>
            {scanResult && (() => {
              const remainingMs = scanResult.frozen_until ? Math.max(0, new Date(scanResult.frozen_until).getTime() - Date.now()) : 0
              const remDays = Math.ceil(remainingMs / 86400000)
              const remHours = Math.floor(remainingMs / 3600000) % 24
              const remMin = Math.floor((remainingMs % 3600000) / 60000)
              return (
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-center">
                    <p className="text-sm text-white font-medium">{scanResult.name}</p>
                    <p className="text-xs text-gray-400 mt-1">{t('attendance.currentlyFrozen')}</p>
                    {remainingMs > 0 && (
                      <p className="text-lg font-bold text-yellow-400 mt-2">{remDays}d {remHours}h {remMin}m {t('attendance.remaining')}</p>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 text-center">
                    {t('attendance.freezeUsed')}: {scanResult.freeze_used} / {plans.find((p) => p.id === scanResult.plan_id)?.freeze_days || 0}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => { setFrozenDialogOpen(false); setScanResult(null) }}>
                      {t('common.cancel')}
                    </Button>
                    <Button className="flex-1" onClick={async () => {
                      if (!scanResult) return
                      setFrozenDialogOpen(false)
                      await invoke('unfreeze_member', { member_id: scanResult.id })
                      await recordAttendance(scanResult)
                      load()
                    }}>
                      <Snowflake className="w-4 h-4 mr-1" /> {t('attendance.unfreezeAttend')}
                    </Button>
                  </div>
                </div>
              )
            })()}
          </DialogContent>
        </Dialog>

        {/* Duplicate confirmation */}
        <Dialog open={confirmDuplicate} onOpenChange={setConfirmDuplicate}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
                {t('attendance.alreadyCheckedIn')}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-400 mb-4">
              {t('attendance.recordAgain', { name: scanResult?.name || '' })}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDuplicate(false)}>{t('common.cancel')}</Button>
              <Button className="flex-1" onClick={handleConfirmDuplicate}>{t('attendance.recordAnyway')}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  )
}
