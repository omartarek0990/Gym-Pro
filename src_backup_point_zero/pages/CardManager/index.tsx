import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Plus, Printer, Trash2, Filter, IdCard } from 'lucide-react'
import { invoke } from '@/lib/tauri'
import PageTransition from '@/components/shared/PageTransition'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/hooks/useToast'
import { Card as CardType, CardStats } from '@/types'
import StatsCards from '@/components/cards/StatsCards'
import CardsTable from '@/components/cards/CardsTable'
import GenerateDialog from '@/components/cards/GenerateDialog'
import PrintDialog from '@/components/cards/PrintDialog'
import { useLanguage } from '@/lib/i18n'

export default function CardManagerPage() {
  const { t, isArabic } = useLanguage()
  const [cards, setCards] = useState<CardType[]>([])
  const [stats, setStats] = useState<CardStats>({ total: 0, available: 0, used: 0 })
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([
        invoke('get_all_cards', { filter }) as Promise<CardType[]>,
        invoke('get_card_stats') as Promise<CardStats>,
      ])
      if (c) setCards(c)
      setStats(s)
    } catch {}
    setLoading(false)
  }, [filter])

  useEffect(() => { loadData() }, [loadData])

  const handleDeleteAvailable = async () => {
    if (!confirm(isArabic ? 'حذف كل البطاقات المتاحة؟ لا يمكن التراجع.' : 'Delete all available cards? This cannot be undone.')) return
    try {
      const deleted = await invoke('delete_available_cards') as number
      toast({ title: isArabic ? 'تم الحذف' : 'Deleted', description: isArabic ? `تم حذف ${deleted} بطاقة متاحة` : `${deleted} available cards removed`, variant: 'success' })
      loadData()
    } catch (e) {
      toast({ title: isArabic ? 'فشل الحذف' : 'Delete Failed', description: String(e), variant: 'destructive' })
    }
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        <StatsCards stats={stats} />

        <Card className="border-[#1a2d45]">
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <IdCard className="w-5 h-5 text-yellow-400" /> {t('nav.cards')}
              </CardTitle>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" className="gap-2" onClick={() => setGenerateOpen(true)}>
                  <Plus className="w-4 h-4" /> {isArabic ? 'إنشاء' : 'Generate'}
                </Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => setPrintOpen(true)}>
                  <Printer className="w-4 h-4" /> {isArabic ? 'طباعة PDF' : 'Print PDF'}
                </Button>
                <Button variant="outline" size="sm" className="gap-2 text-red-400 border-red-500/30" onClick={handleDeleteAvailable}>
                  <Trash2 className="w-4 h-4" /> {isArabic ? 'حذف المتاح' : 'Delete Available'}
                </Button>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <Select value={filter} onValueChange={(v) => { setFilter(v); setLoading(true) }}>
                    <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('cards.all')}</SelectItem>
                      <SelectItem value="available">{t('cards.available')}</SelectItem>
                      <SelectItem value="used">{t('cards.used')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <CardsTable cards={cards} loading={loading} />
          </CardContent>
        </Card>

        <GenerateDialog open={generateOpen} onOpenChange={setGenerateOpen} onDone={loadData} />
        <PrintDialog open={printOpen} onOpenChange={setPrintOpen} />
      </div>
    </PageTransition>
  )
}
