import { useCallback } from 'react'
import { invoke } from '@/lib/tauri'
import { toast } from '@/hooks/useToast'
import { useLanguage } from '@/lib/i18n'

interface Column {
  header: string
  key: string
}

export function useExport() {
  const { isArabic } = useLanguage()

  const exportToExcel = useCallback(async (filenameBase: string, columns: Column[], data: Record<string, unknown>[]) => {
    if (data.length === 0) {
      toast({ title: isArabic ? 'لا توجد بيانات' : 'No data', variant: 'destructive' })
      return
    }
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(data.map(row => {
      const obj: Record<string, unknown> = {}
      columns.forEach(col => { obj[col.header] = row[col.key] })
      return obj
    }))
    const maxWidth = columns.reduce((m, c) => Math.max(m, c.header.length * 2 + 5), 15)
    ws['!cols'] = columns.map(() => ({ wch: maxWidth }))
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    try {
      await invoke('export_excel', { filename_base: filenameBase, data: Array.from(new Uint8Array(wbout)) })
      toast({ title: isArabic ? 'تم التصدير' : 'Exported', variant: 'success' })
    } catch (e) {
      if (e !== 'cancelled') toast({ title: isArabic ? 'فشل التصدير' : 'Export failed', description: String(e), variant: 'destructive' })
    }
  }, [isArabic])

  return { exportToExcel }
}
