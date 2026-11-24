import { useState, useEffect } from 'react'
import { Sun, Moon, Shield, HardDrive, Clock, FolderOpen, RefreshCw, Save, IdCard, Trash2, User, UserCog } from 'lucide-react'

import { invoke } from '@/lib/tauri'
import PageTransition from '@/components/shared/PageTransition'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/hooks/useToast'
import { AppSetting, BackupInfo } from '@/types'
import { Language, useLanguage } from '@/lib/i18n'

export default function SettingsPage() {
  const { language, setLanguage, t, isArabic } = useLanguage()
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [backupInfo, setBackupInfo] = useState<BackupInfo | null>(null)
  const [backingUp, setBackingUp] = useState(false)
  const [countdown, setCountdown] = useState('')
  const [ownerUsername, setOwnerUsername] = useState('')
  const [ownerNewPass, setOwnerNewPass] = useState('')
  const [ownerConfirmPass, setOwnerConfirmPass] = useState('')
  const [adminUsername, setAdminUsername] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [hasAdmin, setHasAdmin] = useState(false)
  const [savingOwner, setSavingOwner] = useState(false)
  const [savingAdmin, setSavingAdmin] = useState(false)

  const load = async () => {
    try {
      const [s, bi] = await Promise.all([
        invoke('get_settings'),
        invoke('get_backup_info'),
      ])
      if (s) {
        const map: Record<string, string> = {}
        ;(s as AppSetting[]).forEach((x: AppSetting) => { map[x.key] = x.value })
        setSettings(map)
      }
      if (bi) setBackupInfo(JSON.parse(bi as string) as BackupInfo)
      try {
        const users = await invoke('get_users') as { id: string; username: string; role: string }[]
        const owner = users.find(u => u.role === 'owner')
        const admin = users.find(u => u.role === 'admin')
        if (owner) setOwnerUsername(owner.username)
        if (admin) {
          setAdminUsername(admin.username)
          setHasAdmin(true)
        }
      } catch {}
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const update = async (key: string, value: string) => {
    await invoke('update_setting', { key, value })
    setSettings((prev) => ({ ...prev, [key]: value }))
    toast({ title: t('toast.settingUpdated'), variant: 'success' })
  }

  const handleSaveOwner = async () => {
    if (!ownerUsername.trim()) {
      toast({ title: isArabic ? 'اسم المستخدم مطلوب' : 'Username required', variant: 'destructive' })
      return
    }
    if (ownerNewPass.length < 4) {
      toast({ title: isArabic ? 'كلمة السر قصيرة جداً' : 'Password too short', variant: 'destructive' })
      return
    }
    if (ownerNewPass !== ownerConfirmPass) {
      toast({ title: isArabic ? 'كلمتا السر غير متطابقتين' : 'Passwords do not match', variant: 'destructive' })
      return
    }
    setSavingOwner(true)
    try {
      await invoke('update_owner_credentials', { username: ownerUsername.trim(), password: ownerNewPass })
      toast({ title: isArabic ? 'تم حفظ حساب المالك' : 'Owner account saved', variant: 'success' })
      setOwnerNewPass('')
      setOwnerConfirmPass('')
    } catch (e) {
      toast({ title: isArabic ? 'فشل الحفظ' : 'Save failed', description: String(e), variant: 'destructive' })
    }
    setSavingOwner(false)
  }

  const handleSaveAdmin = async () => {
    if (!adminUsername.trim() || !adminPassword.trim()) {
      toast({ title: isArabic ? 'أكمل البيانات' : 'Fill all fields', variant: 'destructive' })
      return
    }
    if (adminPassword.length < 4) {
      toast({ title: isArabic ? 'كلمة السر قصيرة جداً' : 'Password too short', variant: 'destructive' })
      return
    }
    setSavingAdmin(true)
    try {
      await invoke('update_admin_credentials', { username: adminUsername.trim(), password: adminPassword })
      toast({
        title: hasAdmin ? (isArabic ? 'تم تحديث حساب الأدمن' : 'Admin account updated') : (isArabic ? 'تم إنشاء حساب الأدمن' : 'Admin account created'),
        variant: 'success',
      })
      setHasAdmin(true)
      setAdminPassword('')
    } catch (e) {
      toast({ title: isArabic ? 'فشل الحفظ' : 'Save failed', description: String(e), variant: 'destructive' })
    }
    setSavingAdmin(false)
  }

  const handleBackup = async () => {
    setBackingUp(true)
    try {
      const ts = await invoke('run_backup') as string
      toast({ title: t('toast.backupCreated'), description: `${t('settings.lastBackup')}: ${ts}`, variant: 'success' })
      const bi = await invoke('get_backup_info')
      if (bi) setBackupInfo(JSON.parse(bi as string) as BackupInfo)
    } catch (e) {
      toast({ title: t('toast.backupFailed'), description: String(e), variant: 'destructive' })
    }
    setBackingUp(false)
  }

  const handleRestore = async (_which: string) => {
    try {
      await invoke('restore_backup', { which: '' })
      toast({
        title: t('toast.restored'),
        description: isArabic
          ? 'تم استرجاع النسخة. سيتم إعادة تحميل الصفحة.'
          : 'Backup restored. Page will reload.',
        variant: 'success',
      })
      // Hard reload to force all React state and queries to re-fetch from the new DB
      setTimeout(() => {
        window.location.href = window.location.href
      }, 1500)
    } catch (e) {
      if (String(e) !== 'cancelled') {
        toast({ title: t('toast.restoreFailed'), description: String(e), variant: 'destructive' })
      }
    }
  }

  const applyTheme = (theme: string) => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  useEffect(() => { applyTheme(settings.theme || 'dark') }, [settings.theme])

  useEffect(() => {
    const tick = () => {
      if (!backupInfo?.last_backup) {
        setCountdown('Not yet')
        return
      }
      const last = new Date(backupInfo.last_backup)
      const next = new Date(last.getTime() + 3600000)
      const diff = next.getTime() - Date.now()
      if (diff <= 0) {
        setCountdown(isArabic ? 'الآن' : 'Now')
        return
      }
      const totalSecs = Math.floor(diff / 1000)
      const mins = Math.floor(totalSecs / 60)
      const secs = totalSecs % 60
      const hrs = Math.floor(mins / 60)
      const remMins = mins % 60
      if (hrs > 0) {
        setCountdown(isArabic ? `${hrs}س ${remMins}د ${secs}ث` : `${hrs}h ${remMins}m ${secs}s`)
      } else {
        setCountdown(isArabic ? `${mins}د ${secs}ث` : `${mins}m ${secs}s`)
      }
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [backupInfo?.last_backup, isArabic])

  const calcNextBackup = () => {
    if (!backupInfo?.last_backup) return t('time.notYet')
    const last = new Date(backupInfo.last_backup)
    const next = new Date(last.getTime() + 3600000)
    const diff = next.getTime() - Date.now()
    if (diff <= 0) return t('time.now')
    const mins = Math.ceil(diff / 60000)
    if (mins >= 60) return isArabic ? `خلال ${Math.floor(mins / 60)}س ${mins % 60}د` : `in ${Math.floor(mins / 60)}h ${mins % 60}m`
    return isArabic ? `خلال ${mins} دقيقة` : `in ${mins} min`
  }

  const formatTime = (t: string) => {
    if (!t) return '—'
    const d = new Date(t)
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) return <PageTransition><div className="space-y-4">{[1,2,3].map((i) => <div key={i} className="h-24 rounded-xl bg-muted" />)}</div></PageTransition>

  return (
    <PageTransition>
      <div className="space-y-6 max-w-2xl">
        {/* Theme & Language */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2">
            {settings.theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            {t('settings.appearance')}
          </CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>{t('settings.darkMode')}</Label>
              <Switch checked={settings.theme === 'dark'} onCheckedChange={(v) => update('theme', v ? 'dark' : 'light')} />
            </div>
            <div className="space-y-2">
              <Label>{t('settings.language')}</Label>
              <Select value={language} onValueChange={(v) => { setLanguage(v as Language); setSettings((prev) => ({ ...prev, language: v })) }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ar">العربية</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Backup & Restore */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><HardDrive className="w-4 h-4 text-primary" />{t('settings.backupRestore')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> {t('settings.lastBackup')}</p>
                <p className="text-sm font-bold text-foreground mt-1">{formatTime(backupInfo?.last_backup || '')}</p>
              </div>
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><RefreshCw className="w-3 h-3" /> {t('settings.nextBackup')}</p>
                <p className="text-sm font-bold text-primary mt-1 font-mono">{countdown || '—'}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('settings.backupFolder')}</Label>
              <div className="flex gap-2">
                <Input value={settings.backup_folder || ''} onChange={(e) => update('backup_folder', e.target.value)} placeholder="D:/GymBackup" />
                <Button variant="outline" className="gap-2" onClick={async () => {
                  try {
                    const p = await invoke('pick_backup_folder') as string
                    if (p) {
                      await invoke('update_setting', { key: 'backup_folder', value: p })
                      setSettings((prev) => ({ ...prev, backup_folder: p }))
                      toast({ title: t('toast.backupFolderSet'), description: p, variant: 'success' })
                    }
                  } catch (e) {
                    if (String(e) !== 'cancelled') {
                      toast({ title: t('toast.folderPickFailed'), description: String(e), variant: 'destructive' })
                    }
                  }
                }}>
                  <FolderOpen className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <Button className="w-full gap-2" onClick={handleBackup} disabled={backingUp}>
              <Save className="w-4 h-4" />{backingUp ? t('settings.backingUp') : t('settings.backupNow')}
            </Button>
            <div className="border border-border rounded-lg">
              <div className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{isArabic ? 'النسخة الاحتياطية' : 'Backup File'}</p>
                  <p className="text-xs text-muted-foreground font-mono">gym_backup.db</p>
                  <p className="text-xs text-muted-foreground">{formatTime(backupInfo?.current_time || '')}</p>
                </div>
                <Button variant="outline" size="sm" className="text-primary border-primary/30" onClick={() => handleRestore('current')}>{t('common.restore')}</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card Settings */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><IdCard className="w-4 h-4 text-primary" />{isArabic ? 'إعدادات الكارت' : 'Card Settings'}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{isArabic ? 'مجلد حفظ كروت الجيم' : 'GYM Cards Folder'}</Label>
              <div className="flex gap-2">
                <Input value={settings.gym_card_save_folder || settings.card_save_folder || ''} onChange={(e) => update('gym_card_save_folder', e.target.value)} placeholder={isArabic ? 'اختر مجلد كروت الجيم...' : 'Choose GYM cards folder...'} />
                <Button variant="outline" size="icon" onClick={async () => {
                  try {
                    const p = await invoke('pick_card_save_folder') as string
                    if (p) {
                      await invoke('update_setting', { key: 'gym_card_save_folder', value: p })
                      setSettings((prev) => ({ ...prev, gym_card_save_folder: p }))
                      toast({ title: isArabic ? 'تم تعيين المجلد' : 'Folder Set', description: p, variant: 'success' })
                    }
                  } catch (e) {
                    if (String(e) !== 'cancelled') {
                      toast({ title: isArabic ? 'فشل اختيار المجلد' : 'Folder Pick Failed', description: String(e), variant: 'destructive' })
                    }
                  }
                }}>
                  <FolderOpen className="w-4 h-4" />{isArabic ? 'تغيير المجلد' : 'Change Folder'}
                </Button>
                {(settings.gym_card_save_folder || settings.card_save_folder) && (
                  <Button variant="outline" className="gap-2" onClick={() => update('gym_card_save_folder', '')}>
                    <Trash2 className="w-4 h-4 text-destructive" />{isArabic ? 'مسح' : 'Clear'}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{isArabic ? 'إذا تم تعيين مجلد، سيتم حفظ كروت الجيم تلقائياً بدون طلب تحديد المجلد كل مرة.' : 'If set, GYM cards will save automatically without asking each time.'}</p>
            </div>
          </CardContent>
        </Card>

        {/* Security — Owner & Admin Accounts */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="w-4 h-4" />{t('settings.security')}</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            {/* Owner Account */}
            <div className="space-y-3 p-4 rounded-xl border border-border/50 bg-muted/30">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">{isArabic ? 'حساب المالك' : 'Owner Account'}</h3>
              </div>
              <div className="space-y-2">
                <Label>{isArabic ? 'اسم المستخدم' : 'Username'}</Label>
                <Input value={ownerUsername} onChange={(e) => setOwnerUsername(e.target.value)} placeholder={isArabic ? 'اسم المستخدم' : 'Username'} />
              </div>
              <div className="space-y-2">
                <Label>{isArabic ? 'كلمة السر الجديدة' : 'New Password'}</Label>
                <Input type="password" value={ownerNewPass} onChange={(e) => setOwnerNewPass(e.target.value)} placeholder="••••••••" />
              </div>
              <div className="space-y-2">
                <Label>{isArabic ? 'تأكيد كلمة السر' : 'Confirm Password'}</Label>
                <Input type="password" value={ownerConfirmPass} onChange={(e) => setOwnerConfirmPass(e.target.value)} placeholder="••••••••" />
              </div>
              <Button className="gap-2" onClick={handleSaveOwner} disabled={savingOwner}>
                {savingOwner ? <span className="inline-block w-4 h-4 rounded-full bg-primary/40" /> : <Save className="w-4 h-4" />}
                {isArabic ? 'حفظ' : 'Save'}
              </Button>
            </div>

            {/* Admin Account */}
            <div className="space-y-3 p-4 rounded-xl border border-border/50 bg-muted/30">
              <div className="flex items-center gap-2">
                <UserCog className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">{isArabic ? 'حساب الأدمن' : 'Admin Account'}</h3>
              </div>
              <div className="space-y-2">
                <Label>{isArabic ? 'اسم المستخدم' : 'Username'}</Label>
                <Input value={adminUsername} onChange={(e) => setAdminUsername(e.target.value)} placeholder={isArabic ? 'اسم المستخدم' : 'Username'} />
              </div>
              <div className="space-y-2">
                <Label>{isArabic ? 'كلمة السر' : 'Password'}</Label>
                <Input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <Button className="gap-2" onClick={handleSaveAdmin} disabled={savingAdmin}>
                {savingAdmin ? <span className="inline-block w-4 h-4 rounded-full bg-primary/40" /> : <Save className="w-4 h-4" />}
                {hasAdmin
                  ? (isArabic ? 'حفظ' : 'Save')
                  : (isArabic ? 'إنشاء حساب Admin' : 'Create Admin Account')}
              </Button>
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">{isArabic ? 'صلاحيات الأدمن:' : 'Admin permissions:'}</p>
                <p>{isArabic ? '✓ Dashboard, Members, Attendance, Invitations, Supplements (POS فقط), Plans, Alerts' : '✓ Dashboard, Members, Attendance, Invitations, Supplements (POS only), Plans, Alerts'}</p>
                <p>{isArabic ? '✗ Profits, Reports, Audit Log, Settings, Card Manager, حذف الأعضاء' : '✗ Profits, Reports, Audit Log, Settings, Card Manager, delete members'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">{t('settings.footer')}</p>
      </div>
    </PageTransition>
  )
}
