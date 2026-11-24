import { useState } from 'react'
import { Dumbbell, Eye, EyeOff, Key, ArrowLeft } from 'lucide-react'
import { invoke } from '@/lib/tauri'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/lib/i18n'
import { toast } from '@/hooks/useToast'

export default function LoginPage() {
  const { t } = useLanguage()
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetting, setResetting] = useState(false)

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) return
    setLoading(true)
    await login(username.trim(), password)
    setLoading(false)
  }

  const handleReset = async () => {
    if (newPassword.length < 4) { toast({ title: t('owner.passwordShort'), variant: 'destructive' }); return }
    if (newPassword !== confirmPassword) { toast({ title: t('owner.passwordMismatch'), variant: 'destructive' }); return }
    setResetting(true)
    try {
      await invoke('reset_owner_password', { new_password: newPassword })
      toast({ title: t('login.passwordReset') || 'Password reset successfully', variant: 'success' })
      setShowReset(false)
      setNewPassword('')
      setConfirmPassword('')
    } catch (e) {
      toast({ title: String(e), variant: 'destructive' })
    }
    setResetting(false)
  }

  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="w-full max-w-sm mx-4">
        {!showReset ? (
          <div key="login" className="rounded-2xl border border-border/50 bg-card p-8 shadow-xl space-y-6">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Dumbbell className="w-8 h-8 text-primary" />
                </div>
                <h1 className="text-2xl font-bold text-foreground">{t('login.appName')}</h1>
                <p className="text-sm text-muted-foreground">{t('login.subtitle')}</p>
              </div>
              <div className="space-y-3">
                <input className="w-full h-11 rounded-xl bg-muted border border-border px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50" placeholder={t('login.username')} value={username} onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} className="w-full h-11 rounded-xl bg-muted border border-border px-4 pr-10 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50" placeholder={t('login.password')} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button onClick={handleLogin} disabled={loading} className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50">
                  {loading ? t('login.signingIn') : t('login.signIn')}
                </button>
                <button onClick={() => setShowReset(true)} className="w-full text-xs text-muted-foreground hover:text-primary transition-colors">
                  {t('login.forgotPassword')}
                </button>
              </div>
            </div>
          ) : (
            <div key="reset" className="rounded-2xl border border-border/50 bg-card p-8 shadow-xl space-y-6">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Key className="w-8 h-8 text-primary" />
                </div>
                <h1 className="text-xl font-bold text-foreground">{t('login.resetTitle')}</h1>
                <p className="text-sm text-muted-foreground">{t('login.resetDesc')}</p>
              </div>
              <div className="space-y-3">
                <input type="password" className="w-full h-11 rounded-xl bg-muted border border-border px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50" placeholder={t('login.newPassword') || 'New Password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                <input type="password" className="w-full h-11 rounded-xl bg-muted border border-border px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50" placeholder={t('login.confirmPassword') || 'Confirm Password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                <button onClick={handleReset} disabled={resetting} className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50">
                  {resetting ? t('login.resetting') : t('login.reset')}
                </button>
                <button onClick={() => setShowReset(false)} className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors">
                  <ArrowLeft className="w-3 h-3" />{t('login.backToLogin')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
}
