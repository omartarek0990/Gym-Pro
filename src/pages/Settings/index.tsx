import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Settings as SettingsIcon, Database, Sun, Moon, Globe, Shield, RotateCcw, Upload, HardDrive, Clock, FolderOpen, RefreshCw, Save, AlertTriangle, Loader2, IdCard, Trash2 } from 'lucide-react'
import { invoke } from '@/lib/tauri'
import PageTransition from '@/components/shared/PageTransition'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogClose
} from '@/components/ui/dialog'
import { toast } from '@/hooks/useToast'
import { AppSetting, BackupInfo } from '@/types'
import { Language, useLanguage } from '@/lib/i18n'

export default function SettingsPage() {
  const { language, setLanguage, t, isArabic } = useLanguage()
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [backupInfo, setBackupInfo] = useState<BackupInfo | null>(null)
  const [backingUp, setBackingUp] = useState(false)
  const [restoreDialog, setRestoreDialog] = useState<{ open: boolean; which: string }>({ open: false, which: '' })
  
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
    } catch {}
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const update = async (key: string, value: string) => {
    await invoke('update_setting', { key, value })
    setSettings((prev) => ({ ...prev, [key]: value }))
    toast({ title: t('toast.settingUpdated'), variant: 'success' })
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

  const handleRestore = async (which: string) => {
    setRestoreDialog({ open: true, which })
  }

  const confirmRestore = async () => {
    setRestoreDialog({ open: false, which: '' })
    try {
      await invoke('restore_backup', { which: restoreDialog.which })
      toast({ title: t('toast.restored'), description: isArabic ? 'تم استرجاع النسخة. سيتم إعادة تحميل الصفحة.' : `${restoreDialog.which} backup restored. Page will reload.`, variant: 'success' })
      setTimeout(() => window.location.reload(), 1500)
    } catch (e) {
      toast({ title: t('toast.restoreFailed'), description: String(e), variant: 'destructive' })
    }
  }

  const applyTheme = (_theme: string) => {}

  useEffect(() => { applyTheme(settings.theme) }, [settings.theme])

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

  if (loading) return <PageTransition><div className="space-y-4">{[1,2,3].map((i) => <div key={i} className="h-24 rounded-xl skeleton" />)}</div></PageTransition>

  return (
    <PageTransition>
      <div className="space-y-6 max-w-2xl">
        {/* Gym Info */}
        <Card className="border-[#1a2d45]">
          <CardHeader><CardTitle className="text-white flex items-center gap-2"><SettingsIcon className="w-4 h-4" />{t('settings.gymInfo')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('settings.gymName')}</Label>
              <Input value={settings.gym_name || ''} onChange={(e) => update('gym_name', e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Theme & Language */}
        <Card className="border-[#1a2d45]">
          <CardHeader><CardTitle className="text-white flex items-center gap-2">
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
        <Card className="border-[#1a2d45]">
          <CardHeader><CardTitle className="text-white flex items-center gap-2"><HardDrive className="w-4 h-4 text-yellow-400" />{t('settings.backupRestore')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-yellow-600/10 border border-yellow-500/20">
                <p className="text-xs text-gray-400 flex items-center gap-1"><Clock className="w-3 h-3" /> {t('settings.lastBackup')}</p>
                <p className="text-sm font-bold text-white mt-1">{formatTime(backupInfo?.last_backup || '')}</p>
              </div>
              <div className="p-3 rounded-lg bg-yellow-600/10 border border-yellow-500/20">
                <p className="text-xs text-gray-400 flex items-center gap-1"><RefreshCw className="w-3 h-3" /> {t('settings.nextBackup')}</p>
                <p className="text-sm font-bold text-yellow-400 mt-1">{calcNextBackup()}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('settings.backupFolder')}</Label>
              <div className="flex gap-2">
                <Input value={settings.backup_folder || ''} onChange={(e) => update('backup_folder', e.target.value)} placeholder="D:/GymBackup" />
                <Button variant="outline" size="icon" onClick={async () => {
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
            <div className="border border-[#1a2d45] rounded-lg divide-y divide-[#1a2d45]">
              <div className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-white font-medium">{t('settings.currentBackup')}</p>
                  <p className="text-xs text-gray-500">gym_backup_current.db</p>
                  <p className="text-xs text-gray-400">{formatTime(backupInfo?.current_time || '')}</p>
                </div>
                <Button variant="outline" size="sm" className="text-yellow-400 border-yellow-500/30" onClick={() => handleRestore('current')}>{t('common.restore')}</Button>
              </div>
              <div className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-white font-medium">{t('settings.previousBackup')}</p>
                  <p className="text-xs text-gray-500">gym_backup_previous.db</p>
                  <p className="text-xs text-gray-400">{formatTime(backupInfo?.previous_time || '')}</p>
                </div>
                <Button variant="outline" size="sm" className="text-yellow-400 border-yellow-500/30" onClick={() => handleRestore('previous')}>{t('common.restore')}</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card Settings */}
        <Card className="border-[#1a2d45]">
          <CardHeader><CardTitle className="text-white flex items-center gap-2"><IdCard className="w-4 h-4 text-yellow-400" />{isArabic ? 'إعدادات الكارت' : 'Card Settings'}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{isArabic ? 'مجلد حفظ كروت الأعضاء' : 'Member Card Save Folder'}</Label>
              <div className="flex gap-2">
                <Input value={settings.card_save_folder || ''} onChange={(e) => update('card_save_folder', e.target.value)} placeholder={isArabic ? 'اختر مجلد الحفظ...' : 'Choose save folder...'} />
                <Button variant="outline" size="icon" onClick={async () => {
                  try {
                    const p = await invoke('pick_card_save_folder') as string
                    if (p) {
                      await invoke('update_setting', { key: 'card_save_folder', value: p })
                      setSettings((prev) => ({ ...prev, card_save_folder: p }))
                      toast({ title: isArabic ? 'تم تعيين المجلد' : 'Folder Set', description: p, variant: 'success' })
                    }
                  } catch (e) {
                    if (String(e) !== 'cancelled') {
                      toast({ title: isArabic ? 'فشل اختيار المجلد' : 'Folder Pick Failed', description: String(e), variant: 'destructive' })
                    }
                  }
                }}>
                  <FolderOpen className="w-4 h-4" />
                </Button>
                {settings.card_save_folder && (
                  <Button variant="outline" size="icon" onClick={() => update('card_save_folder', '')}>
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-gray-500">{isArabic ? 'إذا تم تعيين مجلد، سيتم حفظ كروت الأعضاء تلقائياً بدون طلب تحديد المجلد كل مرة.' : 'If set, member cards will be saved automatically without asking each time.'}</p>
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card className="border-[#1a2d45]">
          <CardHeader><CardTitle className="text-white flex items-center gap-2"><Shield className="w-4 h-4" />{t('settings.security')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('settings.deletePassword')}</Label>
              <Input
                type="password"
                value={settings.delete_password || ''}
                onChange={(e) => update('delete_password', e.target.value)}
                placeholder={t('settings.deletePasswordPlaceholder')}
              />
              <p className="text-xs text-gray-500">{t('settings.deletePasswordHelp')}</p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-gray-600">{t('settings.footer')}</p>
      </div>

      {/* Restore Confirmation Dialog */}
      <Dialog open={restoreDialog.open} onOpenChange={(open) => setRestoreDialog({ ...restoreDialog, open })}>
        <DialogContent className="border-red-900/30 max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-red-500/10">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <DialogTitle className="text-white">{t('settings.restoreBackup')}</DialogTitle>
            </div>
            <DialogDescription className="text-gray-400 pt-2">
              {t('settings.restoreQuestion')}
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-3 mx-[-1.5rem] bg-red-500/5 border-y border-red-500/10">
            <p className="text-sm text-red-400 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{t('settings.restoreWarning')}</span>
            </p>
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline" className="border-gray-700 text-gray-300">{t('common.cancel')}</Button>
            </DialogClose>
            <Button onClick={confirmRestore} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
              <RotateCcw className="w-4 h-4" /> {t('common.restore')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  )
}
