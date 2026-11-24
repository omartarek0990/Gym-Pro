import { useState, useEffect, useRef, Suspense, lazy } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { invoke } from '@/lib/tauri'
import { User, AlertTriangle, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import Layout from '@/components/layout/Layout'
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const MembersPage = lazy(() => import('@/pages/Members'))
const PlansPage = lazy(() => import('@/pages/Plans'))
const AttendancePage = lazy(() => import('@/pages/Attendance'))
const SupplementsPage = lazy(() => import('@/pages/Supplements'))
const ProfitsPage = lazy(() => import('@/pages/Profits'))
const ReportsPage = lazy(() => import('@/pages/Reports'))
const AuditLogPage = lazy(() => import('@/pages/AuditLog'))
const SettingsPage = lazy(() => import('@/pages/Settings'))
const InvitationsPage = lazy(() => import('@/pages/Invitations'))
const LoginPage = lazy(() => import('@/pages/Login'))
const SetupWizard = lazy(() => import('@/components/setup/SetupWizard'))
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/lib/i18n'
import { toast } from '@/hooks/useToast'


type WizardStep = 0 | 1 | 2

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return <>{children}</>
}

function PageFallback() {
  return (
    <div className="flex items-center justify-center min-h-[50vh] bg-background">
      <div className="text-muted-foreground text-sm">Loading...</div>
    </div>
  )
}

function AppContent({ logoutRef }: { logoutRef: React.MutableRefObject<(() => void) | null> }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  logoutRef.current = logout
  if (location.pathname === '/attendance-standalone') {
    return <Suspense fallback={<PageFallback />}><AttendancePage /></Suspense>
  }
  if (!user) return <Suspense fallback={<PageFallback />}><LoginPage /></Suspense>
  return (
    <Suspense fallback={<PageFallback />}>
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/members" element={<MembersPage />} />
        <Route path="/plans" element={<PlansPage />} />
        <Route path="/attendance" element={<AttendancePage />} />
        <Route path="/attendance-standalone" element={<AttendancePage />} />
        <Route path="/supplements" element={<SupplementsPage />} />
        <Route path="/profits" element={<ProtectedRoute roles={['owner']}><ProfitsPage /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute roles={['owner']}><ReportsPage /></ProtectedRoute>} />
        <Route path="/audit-log" element={<ProtectedRoute roles={['owner']}><AuditLogPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute roles={['owner']}><SettingsPage /></ProtectedRoute>} />
        <Route path="/invitations" element={<InvitationsPage />} />
      </Route>
    </Routes>
    </Suspense>
  )
}

export default function App() {
  const location = useLocation()
  const isStandaloneAttendance = location.pathname === '/attendance-standalone'
  const { t } = useLanguage()
  const [appState, setAppState] = useState<'loading' | 'wizard' | 'create_owner' | 'ready'>('loading')
  const [wizardStep, setWizardStep] = useState<WizardStep>(0)
  const [dbPath, setDbPath] = useState('')
  const [backupFolder, setBackupFolder] = useState('')
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState('')
  const [ownerUsername, setOwnerUsername] = useState('')
  const [ownerPassword, setOwnerPassword] = useState('')
  const [ownerConfirm, setOwnerConfirm] = useState('')
  const [creatingOwner, setCreatingOwner] = useState(false)
  const logoutRef = useRef<() => void>(null)
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false)
  const closeProceedRef = useRef<() => void>(() => {})
  const [migrationMsg, setMigrationMsg] = useState('')
  useEffect(() => { if (!isStandaloneAttendance) init() }, [isStandaloneAttendance])

  // Poll migration progress while app is loading
  useEffect(() => {
    if (appState !== 'loading') return
    let alive = true
    const poll = async () => {
      while (alive) {
        try {
          const raw = await invoke('get_migration_progress') as string
          if (!alive) return
          if (raw.startsWith('done')) {
            setMigrationMsg('')
            break
          } else if (raw.startsWith('processing|')) {
            const parts = raw.split('|')
            const current = parseInt(parts[1]) || 0
            const total = parseInt(parts[2]) || 0
            const recompressed = parseInt(parts[3]) || 0
            setMigrationMsg(`جاري تحسين الصور... ${current}/${total} (${recompressed} مُحسّنة)`)
          } else if (raw === 'vacuum') {
            setMigrationMsg('جاري تحسين قاعدة البيانات...')
          } else if (raw === 'counting') {
            setMigrationMsg('جاري تحليل الصور...')
          } else if (raw.startsWith('error:')) {
            setMigrationMsg('')
            break
          }
        } catch {
          break
        }
        await new Promise(r => setTimeout(r, 1000))
      }
    }
    poll()
    return () => { alive = false }
  }, [appState])

  useEffect(() => {
    let unlisten: (() => void) | undefined
    ;(async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window')
        const appWindow = getCurrentWindow()
        if (appWindow.label !== 'main') return
        unlisten = await appWindow.onCloseRequested(async (event) => {
          event.preventDefault()
          closeProceedRef.current = async () => {
            logoutRef.current?.()
            await appWindow.destroy()
          }
          setCloseConfirmOpen(true)
        })
      } catch {}
    })()
    return () => { unlisten?.() }
  }, [])

  const completeWizard = async () => {
    await invoke('update_setting', { key: 'setup_complete', value: 'true' })
    setAppState('create_owner')
  }

  const init = async () => {
    const t0 = performance.now()
    console.log(`[TIMING] init() START`)
    // Step 1: Check DB path
    try {
      const dbStatus = await invoke('get_db_path_status') as string
      console.log(`[TIMING] get_db_path_status: ${(performance.now() - t0).toFixed(0)}ms, result=${dbStatus}`)
      if (dbStatus === 'not_set') {
        setWizardStep(1)
        setAppState('wizard')
        return
      }
    } catch {
      setWizardStep(1)
      setAppState('wizard')
      return
    }

    // Step 3: Check owner
    try {
      const users = await invoke('get_users') as any[]
      console.log(`[TIMING] get_users: ${(performance.now() - t0).toFixed(0)}ms, count=${users.length}`)
      const ownerExists = users.some((u: any) => u.role === 'owner')
      if (!ownerExists) {
        setAppState('create_owner')
        return
      }
    } catch {
      setAppState('create_owner')
      return
    }

    console.log(`[TIMING] init() TOTAL: ${(performance.now() - t0).toFixed(0)}ms`)
    setAppState('ready')
  }

  const pickDbFolder = async () => {
    setPicking(true)
    setError('')
    try {
      const path = await invoke('setup_db_folder', { backupFolder: null }) as string
      setDbPath(path)
      setWizardStep(2)
    } catch (err) {
      if (String(err) !== 'cancelled') setError(String(err))
    }
    setPicking(false)
  }

  const pickBackupFolder = async () => {
    setPicking(true)
    setError('')
    try {
      const folder = await invoke('pick_backup_folder') as string
      if (folder) {
        await invoke('update_setting', { key: 'backup_folder', value: folder })
        setBackupFolder(folder)
        await completeWizard()
      }
    } catch (err) {
      if (String(err) !== 'cancelled') setError(String(err))
    }
    setPicking(false)
  }

  const handleCreateOwner = async () => {
    if (!ownerUsername.trim() || !ownerPassword.trim()) return
    if (ownerPassword.length < 4) { toast({ title: t('owner.passwordShort'), variant: 'destructive' }); return }
    if (ownerPassword !== ownerConfirm) { toast({ title: t('owner.passwordMismatch'), variant: 'destructive' }); return }
    setCreatingOwner(true)
    try {
      await invoke('create_user', { username: ownerUsername.trim(), password: ownerPassword, role: 'owner' })
      setAppState('ready')
    } catch (e) {
      toast({ title: String(e), variant: 'destructive' })
    }
    setCreatingOwner(false)
  }

  if (!isStandaloneAttendance && appState === 'loading') {
    return (<div className="flex items-center justify-center h-screen bg-background flex-col gap-3">
      <div className="text-muted-foreground text-sm">{migrationMsg || t('app.loading')}</div>
      {migrationMsg && <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full animate-pulse" style={{width:'60%'}} /></div>}
    </div>)
  }

  if (!isStandaloneAttendance && appState === 'wizard') {
    return (
      <Suspense fallback={<PageFallback />}>
      <SetupWizard
        step={wizardStep}
        dbPath={dbPath}
        backupFolder={backupFolder}
        picking={picking}
        error={error}
        onPickDb={pickDbFolder}
        onPickBackup={pickBackupFolder}
      />
      </Suspense>
    )
  }

  if (!isStandaloneAttendance && appState === 'create_owner') {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="w-full max-w-sm mx-4">
          <div className="rounded-2xl border border-border/50 bg-card p-8 shadow-xl space-y-6">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <User className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-xl font-bold text-foreground">{t('owner.title')}</h1>
              <p className="text-sm text-muted-foreground">{t('owner.desc')}</p>
            </div>
            <div className="space-y-3">
              <input className="w-full h-11 rounded-xl bg-muted border border-border px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50" placeholder={t('owner.username')} value={ownerUsername} onChange={e => setOwnerUsername(e.target.value)} />
              <input type="password" className="w-full h-11 rounded-xl bg-muted border border-border px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50" placeholder={t('owner.password')} value={ownerPassword} onChange={e => setOwnerPassword(e.target.value)} />
              <input type="password" className="w-full h-11 rounded-xl bg-muted border border-border px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50" placeholder={t('owner.confirm')} value={ownerConfirm} onChange={e => setOwnerConfirm(e.target.value)} />
              {error && <p className="text-destructive text-sm">{error}</p>}
              <button onClick={handleCreateOwner} disabled={creatingOwner} className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50">
                {creatingOwner ? t('owner.creating') : t('owner.create')}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <AuthProvider>
      <AppContent logoutRef={logoutRef} />
      <Dialog open={closeConfirmOpen} onOpenChange={setCloseConfirmOpen}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-destructive/10">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <DialogTitle>{t('common.exit') || 'Exit'}</DialogTitle>
            </div>
            <DialogDescription>{t('common.exitConfirm') || 'Are you sure you want to exit the application?'}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setCloseConfirmOpen(false)}>
              <X className="w-4 h-4 mr-1" /> {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={() => { setCloseConfirmOpen(false); closeProceedRef.current() }}>
              {t('common.exit') || 'Exit'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AuthProvider>
  )
}
