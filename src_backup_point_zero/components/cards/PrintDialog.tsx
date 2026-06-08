import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { invoke } from '@/lib/tauri'
import { toast } from '@/hooks/useToast'
import { Card } from '@/types'
import JsBarcode from 'jsbarcode'
import { useLanguage } from '@/lib/i18n'

interface PrintDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function renderBarcodeDataUrl(code: string): string {
  const canvas = document.createElement('canvas')
  try {
    JsBarcode(canvas, code, {
      format: 'CODE128',
      width: 2,
      height: 60,
      displayValue: false,
      background: '#ffffff',
      lineColor: '#000000',
      margin: 8,
    })
    return canvas.toDataURL('image/png')
  } catch {
    return ''
  }
}

export default function PrintDialog({ open, onOpenChange }: PrintDialogProps) {
  const { t, isArabic } = useLanguage()
  const [gymName, setGymName] = useState('My Gym')
  const [cardFilter, setCardFilter] = useState('available')
  const [generating, setGenerating] = useState(false)

  const generateCardsHtml = (cards: Card[]): string => {
    const perPage = 8
    const pages = Math.ceil(cards.length / perPage)
    let html = `<!DOCTYPE html><html><head><style>
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
      @page { margin: 8mm; size: A4 landscape; }
      body, html { margin: 0; padding: 0; background: #111111 !important; font-family: Arial, sans-serif; }
      .page { width: 277mm; height: 190mm; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: repeat(4, 1fr); gap: 12px; padding: 20px; box-sizing: border-box; }
      .card { background: #0a0a0a !important; border-radius: 16px; border: none !important; box-shadow: none; padding: 16px; display: flex; flex-direction: column; position: relative; overflow: hidden; }
      .card-corner { position: absolute; top: 0; right: 0; width: 50px; height: 50px; background: linear-gradient(135deg, transparent 50%, rgba(245,158,11,0.08) 100%) !important; pointer-events: none; }
      .card-header { display: flex; align-items: center; margin-bottom: 8px; }
      .card-header-left { display: flex; align-items: center; gap: 6px; }
      .card-icon { width: 10px; height: 10px; background: #F59E0B !important; border-radius: 2px; flex-shrink: 0; }
      .card-gym { color: #F59E0B !important; font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
      .card-divider { height: 1px; background: #1f1f1f !important; margin-bottom: 8px; }
      .barcode-wrap { background: white !important; border-radius: 4px; padding: 4px; display: flex; justify-content: center; width: 60%; margin: 0 auto; box-sizing: border-box; }
      .barcode-wrap img { height: 45px; display: block; max-width: 100%; }
      .card-code { color: #F59E0B !important; font-family: monospace; font-weight: bold; text-align: center; letter-spacing: 2px; font-size: 12px; margin-top: 8px; position: relative; }
      .card-dots { position: absolute; bottom: 10px; right: 16px; display: flex; gap: 4px; }
      .card-dot { width: 6px; height: 6px; border-radius: 50%; background: #F59E0B !important; opacity: 0.4; }
      @media print { .page { page-break-after: always; } }
    </style></head><body>`

    for (let p = 0; p < pages; p++) {
      html += '<div class="page">'
      for (let c = 0; c < perPage; c++) {
        const idx = p * perPage + c
        if (idx >= cards.length) { html += '<div></div>'; continue }
        const card = cards[idx]
        const barcodeUrl = renderBarcodeDataUrl(card.card_code)
        html += `<div class="card">
          <div class="card-corner"></div>
          <div class="card-header">
            <div class="card-header-left"><div class="card-icon"></div><span class="card-gym">${gymName}</span></div>
          </div>
          <div class="card-divider"></div>
          <div class="barcode-wrap"><img src="${barcodeUrl}" alt="barcode" /></div>
          <div class="card-code">${card.card_code}</div>
          <div class="card-dots"><div class="card-dot"></div><div class="card-dot"></div><div class="card-dot"></div></div>
        </div>`
      }
      html += '</div>'
    }
    html += '</body></html>'
    return html
  }

  const handlePrint = async () => {
    setGenerating(true)
    try {
      const cards = await invoke('get_all_cards', { filter: cardFilter }) as Card[]
      if (cards.length === 0) {
        toast({ title: isArabic ? 'لا توجد بطاقات' : 'No Cards', description: isArabic ? 'لا توجد بطاقات للطباعة' : 'No cards to print', variant: 'default' })
        setGenerating(false)
        return
      }

      const html = generateCardsHtml(cards)
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)

      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.top = '-9999px'
      iframe.style.left = '-9999px'
      iframe.style.width = '0'
      iframe.style.height = '0'
      document.body.appendChild(iframe)

      iframe.onload = () => {
        setTimeout(() => {
          try { iframe.contentWindow?.print() } catch {}
          setTimeout(() => {
            document.body.removeChild(iframe)
            URL.revokeObjectURL(url)
          }, 1000)
        }, 300)
      }

      iframe.src = url
      toast({ title: isArabic ? 'الطباعة جاهزة' : 'Print Ready', description: isArabic ? 'اختر Save as PDF من نافذة الطباعة' : 'Choose "Save as PDF" in the print dialog', variant: 'success' })
      onOpenChange(false)
    } catch (e) {
      toast({ title: isArabic ? 'فشلت الطباعة' : 'Print Failed', description: String(e), variant: 'destructive' })
    }
    setGenerating(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader><DialogTitle>{t('cards.printCards')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('settings.gymName')}</Label>
            <Input value={gymName} onChange={(e) => setGymName(e.target.value)} placeholder="My Gym" />
          </div>
          <div className="space-y-2">
            <Label>{isArabic ? 'البطاقات المطلوب طباعتها' : 'Cards to Print'}</Label>
            <Select value={cardFilter} onValueChange={setCardFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="available">{t('cards.availableOnly')}</SelectItem>
                <SelectItem value="all">{t('cards.allCards')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-gray-500">{isArabic ? 'عند فتح نافذة الطباعة اختر "Save as PDF" كوجهة.' : 'When the print dialog opens, choose '} {!isArabic && <strong>"Save as PDF"</strong>} {!isArabic && ' as the destination.'}</p>
          <Button className="w-full" onClick={handlePrint} disabled={generating}>
            {generating ? (isArabic ? 'جاري التحضير...' : 'Preparing...') : (isArabic ? 'فتح نافذة الطباعة' : 'Open Print Dialog')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
