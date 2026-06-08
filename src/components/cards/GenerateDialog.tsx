import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { invoke } from '@/lib/tauri'
import { toast } from '@/hooks/useToast'
import { GenerateResult } from '@/types'
import { useLanguage } from '@/lib/i18n'

interface GenerateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone: () => void
}

export default function GenerateDialog({ open, onOpenChange, onDone }: GenerateDialogProps) {
  const { t, isArabic } = useLanguage()
  const [prefix, setPrefix] = useState('GYM-')
  const [start, setStart] = useState(1)
  const [count, setCount] = useState(10)
  const [generating, setGenerating] = useState(false)

  const preview = `${prefix}${String(start).padStart(6, '0')}`

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const result = await invoke('generate_cards', { prefix, start, count }) as GenerateResult
      toast({
        title: isArabic ? 'تم إنشاء البطاقات' : 'Cards Generated',
        description: isArabic ? `تم إنشاء ${result.generated}، وتخطي ${result.skipped}` : `Generated ${result.generated}, Skipped ${result.skipped}`,
        variant: 'success',
      })
      onDone()
      onOpenChange(false)
    } catch (e) {
      toast({ title: isArabic ? 'فشل إنشاء البطاقات' : 'Generation Failed', description: String(e), variant: 'destructive' })
    }
    setGenerating(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader><DialogTitle>{t('cards.generateCards')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{isArabic ? 'البادئة' : 'Prefix'}</Label>
            <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="GYM-" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{isArabic ? 'رقم البداية' : 'Start Number'}</Label>
              <Input type="number" min={1} value={start} onChange={(e) => setStart(parseInt(e.target.value) || 1)} />
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? 'العدد (حد أقصى 1000)' : 'Count (max 1000)'}</Label>
              <Input type="number" min={1} max={1000} value={count} onChange={(e) => setCount(Math.min(parseInt(e.target.value) || 1, 1000))} />
            </div>
          </div>
          <div className="p-3 rounded-lg bg-yellow-600/10 border border-yellow-500/20 text-center">
            <p className="text-xs text-gray-400 mb-1">{isArabic ? 'معاينة' : 'Preview'}</p>
            <p className="text-lg font-mono font-bold text-yellow-400">{preview}</p>
          </div>
          <Button className="w-full" onClick={handleGenerate} disabled={generating}>
            {generating ? (isArabic ? 'جاري الإنشاء...' : 'Generating...') : (isArabic ? `إنشاء ${count} بطاقة` : `Generate ${count} Cards`)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
