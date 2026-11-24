import { Check, Database, FolderOpen, HardDrive } from 'lucide-react'
import { useLanguage } from '@/lib/i18n'

type WizardStep = 0 | 1 | 2

interface Props {
  step: WizardStep
  dbPath: string
  backupFolder: string
  picking: boolean
  error: string
  onPickDb: () => void
  onPickBackup: () => void
}

function StepDots({ step, total }: { step: WizardStep; total: number }) {
  const steps = Array.from({ length: total }, (_, i) => i + 1) as WizardStep[]
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.map(n => (
        <div key={n} className={`h-2 rounded-full transition-all ${n === step ? 'w-8 bg-primary' : n < step ? 'w-2 bg-primary/60' : 'w-2 bg-muted-foreground/30'}`} />
      ))}
    </div>
  )
}

export default function SetupWizard(props: Props) {
  const { t } = useLanguage()
  const { step, dbPath, backupFolder, picking, error, onPickDb, onPickBackup } = props

  const stepLabel = t('setup.stepOf').replace('{n}', String(step))

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <div className="max-w-md w-full p-8 rounded-2xl border border-border bg-card space-y-4 shadow-xl">
        <p className="text-center text-xs text-primary font-medium">{stepLabel}</p>
        <StepDots step={step} total={2} />

        {step === 1 && (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto"><Database className="w-8 h-8 text-primary" /></div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{t('setup.dbTitle')}</h1>
              <p className="text-muted-foreground text-sm mt-2">{t('setup.dbDesc')}</p>
              <p className="text-muted-foreground text-xs mt-1">{t('setup.dbHint')}</p>
            </div>
            {dbPath && <div className="flex items-center gap-2 justify-center text-sm text-green-500 bg-green-500/10 rounded-lg p-3 break-all"><Check className="w-4 h-4 shrink-0" />{dbPath}</div>}
            {error && <p className="text-destructive text-sm bg-destructive/10 rounded-lg p-3">{error}</p>}
            <button type="button" onClick={onPickDb} disabled={picking} className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              <FolderOpen className="w-4 h-4" />{picking ? t('setup.picking') : t('setup.pickFolder')}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto"><HardDrive className="w-8 h-8 text-primary" /></div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{t('setup.backupTitle')}</h1>
              <p className="text-muted-foreground text-sm mt-2">{t('setup.backupDesc')}</p>
            </div>
            {backupFolder && <div className="flex items-center gap-2 justify-center text-sm text-green-500 bg-green-500/10 rounded-lg p-3 break-all"><Check className="w-4 h-4 shrink-0" />{backupFolder}</div>}
            {error && <p className="text-destructive text-sm bg-destructive/10 rounded-lg p-3">{error}</p>}
            <button type="button" onClick={onPickBackup} disabled={picking} className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              <FolderOpen className="w-4 h-4" />{picking ? t('setup.picking') : t('setup.pickFolder')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}