import { useState, useEffect, useMemo } from 'react'
import { Plus, Search, ShoppingCart, Edit, Trash2, Package, DollarSign, AlertTriangle, X, Minus, Plus as PlusIcon } from 'lucide-react'
import { invoke } from '@/lib/tauri'
import PageTransition from '@/components/shared/PageTransition'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency, formatDate, getStockColor, generateId } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { useExport } from '@/hooks/useExport'
import { Supplement, SupplementOrder } from '@/types'
import { useLanguage } from '@/lib/i18n'
import { useAuth } from '@/contexts/AuthContext'
import { FileDown } from 'lucide-react'

export default function SupplementsPage() {
  const { t, isArabic } = useLanguage()
  const { isOwner } = useAuth()
  const { exportToExcel } = useExport()
  const [supplements, setSupplements] = useState<Supplement[]>([])
  const [orders, setOrders] = useState<SupplementOrder[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [posOpen, setPosOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', cost: 0, price: 0, stock: 0 })
  const [cart, setCart] = useState<{ sup: Supplement; qty: number }[]>([])

  const load = async () => {
    try {
      const [s, o] = await Promise.all([
        invoke('get_supplements'),
        isOwner() ? invoke('get_supplement_orders') : Promise.resolve(undefined)
      ])
      if (s) setSupplements(s as Supplement[])
      if (o) setOrders(o as SupplementOrder[])
    } catch {}
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => supplements.filter((s) => s.name.toLowerCase().includes(search.toLowerCase())), [supplements, search])

  const resetForm = () => { setForm({ name: '', cost: 0, price: 0, stock: 0 }); setEditId(null) }

  const handleSubmit = async () => {
    if (editId) {
      await invoke('update_supplement', { id: editId, ...form })
      toast({ title: isArabic ? 'تم تحديث المنتج' : 'Product Updated', variant: 'success' })
    } else {
      await invoke('add_supplement', { id: generateId(), ...form })
      toast({ title: isArabic ? 'تمت إضافة المنتج' : 'Product Added', variant: 'success' })
    }
    setDialogOpen(false)
    resetForm()
    load()
  }

  const handleEdit = (s: Supplement) => {
    setForm({ name: s.name, cost: s.cost, price: s.price, stock: s.stock })
    setEditId(s.id)
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    await invoke('delete_supplement', { id })
    toast({ title: isArabic ? 'تم الحذف' : 'Deleted', variant: 'destructive' })
    load()
  }

  // POS
  const addToCart = (sup: Supplement) => {
    setCart((prev) => {
      const ex = prev.find((c) => c.sup.id === sup.id)
      if (ex) return prev.map((c) => c.sup.id === sup.id ? { ...c, qty: Math.min(c.qty + 1, sup.stock) } : c)
      return [...prev, { sup, qty: 1 }]
    })
  }

  const updateCartQty = (id: string, delta: number) => {
    setCart((prev) => prev.map((c) => {
      if (c.sup.id !== id) return c
      const nq = c.qty + delta
      if (nq <= 0) return null
      return { ...c, qty: Math.min(nq, c.sup.stock) }
    }).filter(Boolean) as { sup: Supplement; qty: number }[])
  }

  const handleCheckout = async () => {
    for (const item of cart) {
      const totalCost = item.sup.cost * item.qty
      const totalPrice = item.sup.price * item.qty
      const profit = totalPrice - totalCost
      await invoke('add_supplement_order', {
        id: generateId(),
        supplement_id: item.sup.id,
        qty: item.qty,
        total_cost: totalCost,
        total_price: totalPrice,
        profit,
      })
    }
    toast({ title: isArabic ? 'تم إتمام الطلب' : 'Order Completed', description: isArabic ? `تم بيع ${cart.length} عنصر` : `${cart.length} items sold`, variant: 'success' })
    setCart([])
    setPosOpen(false)
    load()
  }

  const totalProfit = useMemo(() => orders.reduce((s, o) => s + o.profit, 0), [orders])
  const supplementMap = useMemo(() => new Map(supplements.map(s => [s.id, s])), [supplements])

  const statCards = [
    { label: t('supp.products'), value: supplements.length, color: 'text-primary' },
    ...(isOwner() ? [
      { label: t('supp.totalOrders'), value: orders.length, color: 'text-green-400' },
      { label: t('supp.totalProfit'), value: formatCurrency(totalProfit), color: 'text-primary' },
    ] : []),
    { label: t('supp.lowStock'), value: supplements.filter((s) => s.stock < 7).length, color: 'text-destructive' },
  ]

  const topSupps = useMemo(() => isOwner() ? Object.entries(
    orders.reduce<Record<string, number>>((acc, o) => {
      acc[o.supplement_id] = (acc[o.supplement_id] || 0) + o.qty
      return acc
    }, {})
  )
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([id, qty]) => ({ sup: supplementMap.get(id), qty }))
    .filter(x => x.sup) : [], [orders, supplementMap])

  const inventoryGrid = (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((s, i) => {
          const isLow = s.stock < 3
          const isWarning = s.stock >= 3 && s.stock < 7
          return (
            <div key={s.id}>
              <Card className={`h-full group hover:border-primary/30 transition-colors ${isLow ? 'border-destructive/30' : isWarning ? 'border-yellow-500/30' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                        {s.name}
                        {topSupps[0]?.sup?.id === s.id && (
                          <span className="text-[10px] bg-yellow-500/20 text-yellow-600 px-1.5 py-0.5 rounded-full font-medium">
                            🏆 {isArabic ? 'الأكثر مبيعاً' : 'Best Seller'}
                          </span>
                        )}
                      </h3>
                      {isOwner() && <p className="text-xs text-muted-foreground">{t('supp.cost')}: {formatCurrency(s.cost)}</p>}
                    </div>
                    {(isLow || isWarning) && (
                      <div className="flex items-center gap-1 text-xs font-medium">
                        <AlertTriangle className="w-3 h-3" />
                        <span className={isLow ? 'text-destructive' : 'text-yellow-400'}>{s.stock}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-lg font-bold text-foreground">{formatCurrency(s.price)}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getStockColor(s.stock)}`}>{s.stock} {t('supp.inStock')}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setPosOpen(true); addToCart(s) }}><ShoppingCart className="w-3.5 h-3.5" /></Button>
                      {isOwner() && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(s)}><Edit className="w-3.5 h-3.5" /></Button>
                      )}
                      {isOwner() && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(s.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )
        })}
      </div>
      {filtered.length === 0 && (
        <div className="text-center py-12"><Package className="w-10 h-10 text-muted-foreground mx-auto mb-2" /><p className="text-muted-foreground">{t('supp.noProducts')}</p></div>
      )}
    </>
  )

  if (loading) return <PageTransition><div className="grid gap-4 md:grid-cols-4">{[1,2,3,4].map((i) => <div key={i} className="h-24 rounded-xl bg-muted" />)}</div></PageTransition>

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className={`grid gap-4 ${isOwner() ? 'sm:grid-cols-4' : 'sm:grid-cols-2'}`}>
          {statCards.map((s, i) => (
            <Card key={i}>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{s.label}</CardTitle></CardHeader>
              <CardContent><p className={`text-2xl font-bold ${s.color}`}>{s.value}</p></CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder={t('supp.searchProducts')} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            {topSupps.length > 0 && (
              <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full shrink-0">
                <span className="font-medium text-foreground/80">{isArabic ? 'الأكثر مبيعاً' : 'Top Sold'}:</span>
                {topSupps.map((item, idx) => (
                  <span key={item.sup!.id} className="flex items-center gap-1">
                    <span className="text-yellow-500 font-bold">{idx + 1}</span>
                    <span>{item.sup!.name}</span>
                    <span className="text-muted-foreground/60">({item.qty})</span>
                    {idx < topSupps.length - 1 && <span className="text-muted-foreground/30">·</span>}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="secondary" className="gap-2" onClick={() => setPosOpen(true)}><ShoppingCart className="w-4 h-4" />{t('supp.pos')}</Button>
            {isOwner() && (
            <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm() }}>
              <DialogTrigger asChild><Button className="gap-2"><Plus className="w-4 h-4" />{t('supp.addProduct')}</Button></DialogTrigger>
              <DialogContent className="sm:max-w-[450px]">
                <DialogHeader><DialogTitle>{editId ? t('supp.editProduct') : t('supp.addProduct')}</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2"><Label>{t('supp.productName')}</Label><Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>{t('supp.costPrice')}</Label><Input type="number" value={form.cost || ''} onChange={(e) => setForm({...form, cost: parseFloat(e.target.value) || 0})} /></div>
                    <div className="space-y-2"><Label>{t('supp.sellPrice')}</Label><Input type="number" value={form.price || ''} onChange={(e) => setForm({...form, price: parseFloat(e.target.value) || 0})} /></div>
                  </div>
                  <div className="space-y-2"><Label>{t('supp.stock')}</Label><Input type="number" value={form.stock || ''} onChange={(e) => setForm({...form, stock: parseInt(e.target.value) || 0})} /></div>
                  {form.cost > 0 && form.price > 0 && (
                    <p className="text-xs text-muted-foreground">{t('supp.profitMargin')}: {((form.price - form.cost) / form.cost * 100).toFixed(1)}%</p>
                  )}
                  <Button className="w-full" onClick={handleSubmit}>{editId ? t('common.update') : t('common.add')} {t('supp.products')}</Button>
                </div>
              </DialogContent>
            </Dialog>
            )}
          </div>
        </div>

        {isOwner() ? (
        <Tabs defaultValue="inventory">
          <TabsList>
            <TabsTrigger value="inventory" className="gap-2"><Package className="w-4 h-4" />{t('supp.inventory')}</TabsTrigger>
            <TabsTrigger value="orders" className="gap-2"><DollarSign className="w-4 h-4" />{t('supp.ordersHistory')}</TabsTrigger>
          </TabsList>

          <TabsContent value="inventory">
            {inventoryGrid}
          </TabsContent>

          <TabsContent value="orders">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-muted-foreground">{t('supp.ordersHistory')}</h3>
              <Button variant="secondary" size="sm" className="gap-2" onClick={() => exportToExcel(`orders_${new Date().toISOString().split('T')[0]}`, [
                { header: 'Product', key: 'product' },
                { header: 'Date', key: 'date' },
                { header: 'Time', key: 'time' },
                { header: 'Qty', key: 'qty' },
                { header: 'Total', key: 'total' },
                { header: 'Profit', key: 'profit' },
              ], orders.map(o => {
                const s = supplementMap.get(o.supplement_id)
                return {
                  product: s?.name || 'Unknown',
                  date: o.date, time: o.time, qty: o.qty,
                  total: o.total_price, profit: o.profit,
                }
              }))}>
                <FileDown className="w-4 h-4" />{isArabic ? 'تصدير' : 'Export'}
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                {orders.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">{t('supp.noOrders')}</p>
                ) : (
                  <div className="divide-y divide-border">
                    {orders.slice(0, 50).map((o, i) => {
                      const s = supplementMap.get(o.supplement_id)
                      return (
                        <div key={o.id}
                          className="flex items-center justify-between p-3"
                        >
                          <div>
                            <p className="text-sm text-foreground">{s?.name || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(o.date)} {o.time} · {t('supp.qty')}: {o.qty}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-green-400">{formatCurrency(o.total_price)}</p>
                            <p className="text-xs text-primary">{t('supp.profit')}: {formatCurrency(o.profit)}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        ) : (
          inventoryGrid
        )}

        {/* POS Dialog */}
        <Dialog open={posOpen} onOpenChange={setPosOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><ShoppingCart className="w-5 h-5" />{t('supp.pointOfSale')}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Input placeholder={t('supp.searchProducts')} onChange={(e) => setSearch(e.target.value)} className="mb-2" />
              <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                {supplements.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()) && s.stock > 0).map((s) => (
                  <button key={s.id} onClick={() => addToCart(s)}
                    className="p-2 rounded-lg border border-border bg-muted hover:border-primary/30 text-left transition-colors"
                  >
                    <p className="text-xs text-foreground truncate">{s.name}</p>
                    <p className="text-sm font-bold text-primary">{formatCurrency(s.price)}</p>
                  </button>
                ))}
              </div>

              <div className="border-t border-border pt-3 space-y-2">
                {cart.map((item) => (
                  <div key={item.sup.id} className="flex items-center justify-between p-2 rounded-lg bg-muted">
                    <span className="text-sm text-foreground">{item.sup.name}</span>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateCartQty(item.sup.id, -1)}><Minus className="w-3 h-3" /></Button>
                      <span className="text-sm font-bold text-foreground w-6 text-center">{item.qty}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateCartQty(item.sup.id, 1)}><PlusIcon className="w-3 h-3" /></Button>
                      <span className="text-sm text-green-400 w-20 text-right">{formatCurrency(item.sup.price * item.qty)}</span>
                    </div>
                  </div>
                ))}
                {cart.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">{t('supp.cartEmpty')}</p>}
              </div>

              {cart.length > 0 && (
                <>
                  <div className="flex justify-between text-lg font-bold text-foreground border-t border-border pt-2">
                    <span>{t('supp.total')}</span>
                    <span>{formatCurrency(cart.reduce((s, c) => s + c.sup.price * c.qty, 0))}</span>
                  </div>
                  <Button className="w-full" onClick={handleCheckout}>{t('supp.completeOrder')}</Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  )
}
