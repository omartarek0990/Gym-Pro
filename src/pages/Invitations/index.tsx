import { useState, useEffect } from 'react'
import { UserPlus, Phone, User, RefreshCw, FileDown } from 'lucide-react'
import { open } from '@tauri-apps/plugin-shell'
import { invoke } from '@/lib/tauri'
import PageTransition from '@/components/shared/PageTransition'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/hooks/useToast'
import { useExport } from '@/hooks/useExport'
import { useLanguage } from '@/lib/i18n'
import { formatPhone } from '@/lib/utils'

interface Invitation {
  id: number
  member_id: string
  member_name: string
  guest_name: string
  guest_phone: string
  visits_used: number
  max_visits: number
  created_at: string
}

export default function InvitationsPage() {
  const { isArabic } = useLanguage()
  const { exportToExcel } = useExport()
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  const [memberSearch, setMemberSearch] = useState('')
  const [members, setMembers] = useState<{ id: string; name: string; phone: string }[]>([])
  const [selectedMember, setSelectedMember] = useState<{ id: string; name: string } | null>(null)
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await invoke('get_invitations')
      if (data) setInvitations(data as Invitation[])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const loadMembers = async () => {
    try {
      const data = await invoke('get_members_light')
      if (data) setMembers(data as { id: string; name: string; phone: string }[])
    } catch {}
  }

  useEffect(() => { load() }, [])

  const openDialog = async () => {
    await loadMembers()
    setSelectedMember(null)
    setMemberSearch('')
    setGuestName('')
    setGuestPhone('')
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!selectedMember || !guestName.trim() || !guestPhone.trim()) {
      toast({ title: isArabic ? 'بيانات ناقصة' : 'Missing Data', description: isArabic ? 'اختار العضو واكتب اسم ورقم المدعو' : 'Select member and enter guest info', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    const cleanPhone = guestPhone.replace(/[^0-9]/g, '')
    if (cleanPhone.length !== 10 || cleanPhone.startsWith('0')) {
      toast({
        title: isArabic ? 'رقم غير صحيح' : 'Invalid Phone',
        description: isArabic ? 'الرقم لازم يكون 10 أرقام بدون الصفر في الأول (مثال: 1xxxxxxxxx)' : 'Phone must be 10 digits without leading 0 (e.g. 1xxxxxxxxx)',
        variant: 'destructive'
      })
      setSubmitting(false)
      return
    }
    try {
      await invoke('add_invitation', {
        member_id: selectedMember.id,
        member_name: selectedMember.name,
        guest_name: guestName.trim(),
        guest_phone: guestPhone.trim(),
      })
      toast({ title: isArabic ? 'تمت الإضافة' : 'Added', description: isArabic ? `تم إضافة ${guestName} كمدعو` : `${guestName} added as guest`, variant: 'success' })
      setDialogOpen(false)
      load()
    } catch (err) {
      toast({ title: isArabic ? 'فشل' : 'Failed', description: String(err), variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
    m.phone.includes(memberSearch)
  )

  const openWhatsApp = async (phone: string) => {
    let digits = phone.replace(/[^0-9]/g, '')
    if (digits.startsWith('20')) {
    } else if (digits.startsWith('0')) {
      digits = '20' + digits.slice(1)
    } else {
      digits = '20' + digits
    }
    try {
      await open(`https://api.whatsapp.com/send?phone=${digits}`)
    } catch {
      window.open(`https://api.whatsapp.com/send?phone=${digits}`, '_blank')
    }
  }

  const visitsColor = (used: number, max: number) => {
    if (used >= max) return 'destructive'
    if (used >= max - 1) return 'secondary'
    return 'default'
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{isArabic ? 'الدعوات' : 'Invitations'}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {isArabic ? `${invitations.length} مدعو مسجل` : `${invitations.length} registered guests`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={load} disabled={loading}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="secondary" size="sm" className="gap-2" onClick={() => exportToExcel(
              `invitations_${new Date().toISOString().split('T')[0]}`,
              [
                { header: isArabic ? 'المدعو' : 'Guest', key: 'guest_name' },
                { header: isArabic ? 'الهاتف' : 'Phone', key: 'phone' },
                { header: isArabic ? 'دعاه' : 'Invited By', key: 'member_name' },
                { header: isArabic ? 'الزيارات' : 'Visits', key: 'visits' },
                { header: isArabic ? 'التاريخ' : 'Date', key: 'date' },
              ],
              invitations.map(inv => ({
                guest_name: inv.guest_name,
                phone: formatPhone(inv.guest_phone),
                member_name: inv.member_name,
                visits: `${inv.visits_used} / ${inv.max_visits}`,
                date: inv.created_at.split(' ')[0],
              }))
            )}>
              <FileDown className="w-4 h-4" />
              {isArabic ? 'تصدير' : 'Export'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card className="border-primary/20">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">{isArabic ? 'إجمالي المدعوين' : 'Total Guests'}</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-primary">{invitations.length}</p></CardContent>
          </Card>
          <Card className="border-green-500/20">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">{isArabic ? 'لديهم زيارات متبقية' : 'Have Visits Left'}</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-green-400">{invitations.filter(i => i.visits_used < i.max_visits).length}</p></CardContent>
          </Card>
          <Card className="border-red-500/20">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">{isArabic ? 'استنفدوا الزيارات' : 'Exhausted'}</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-red-400">{invitations.filter(i => i.visits_used >= i.max_visits).length}</p></CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-0">
            {invitations.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <UserPlus className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>{isArabic ? 'لا توجد دعوات بعد' : 'No invitations yet'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground uppercase">
                      <th className="text-left p-3 font-medium">{isArabic ? 'المدعو' : 'Guest'}</th>
                      <th className="text-left p-3 font-medium">{isArabic ? 'الهاتف' : 'Phone'}</th>
                      <th className="text-left p-3 font-medium">{isArabic ? 'دعاه' : 'Invited By'}</th>
                      <th className="text-left p-3 font-medium">{isArabic ? 'الزيارات' : 'Visits'}</th>
                      <th className="text-left p-3 font-medium">{isArabic ? 'التاريخ' : 'Date'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invitations.map((inv, i) => (
                      <tr key={inv.id}
                        className="border-b border-border/50 hover:bg-muted/50 transition-colors"
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="text-sm font-medium text-foreground">{inv.guest_name}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 text-sm text-muted-foreground font-mono">
                              <Phone className="w-3 h-3" />
                              {formatPhone(inv.guest_phone)}
                            </div>
                            <button
                              onClick={() => openWhatsApp(inv.guest_phone)}
                              className="p-1 rounded-full hover:bg-green-500/10 transition-colors"
                              title="WhatsApp"
                            >
                              <svg viewBox="0 0 32 32" className="w-4 h-4" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="16" cy="16" r="16" fill="#25D366"/>
                                <path d="M23.5 8.5C21.7 6.7 19.3 5.7 16.7 5.7C11.3 5.7 6.9 10.1 6.9 15.5C6.9 17.3 7.4 19 8.2 20.5L6.8 25.3L11.7 23.9C13.1 24.7 14.9 25.1 16.7 25.1C22.1 25.1 26.5 20.7 26.5 15.3C26.3 12.7 25.3 10.3 23.5 8.5ZM16.7 23.5C15.1 23.5 13.5 23.1 12.1 22.3L11.7 22.1L8.9 22.9L9.7 20.2L9.5 19.8C8.7 18.4 8.3 16.8 8.3 15.3C8.3 10.9 11.9 7.3 16.5 7.3C18.7 7.3 20.7 8.1 22.3 9.7C23.9 11.3 24.7 13.3 24.7 15.5C24.9 19.9 21.3 23.5 16.7 23.5ZM21.3 17.5C21.1 17.4 19.7 16.7 19.5 16.6C19.3 16.5 19.1 16.5 18.9 16.7C18.7 16.9 18.2 17.5 18 17.7C17.9 17.9 17.7 17.9 17.5 17.8C16.3 17.2 15.5 16.7 14.7 15.4C14.5 15.1 14.9 15.1 15.2 14.5C15.3 14.3 15.2 14.1 15.2 14C15.1 13.9 14.6 12.5 14.4 12C14.2 11.5 14 11.6 13.8 11.6H13.3C13.1 11.6 12.8 11.7 12.6 11.9C12.4 12.1 11.7 12.8 11.7 14.2C11.7 15.6 12.6 16.9 12.7 17.1C12.8 17.3 14.6 20 17.3 21.2C19 21.9 19.7 22 20.6 21.8C21.1 21.7 22.2 21.1 22.5 20.4C22.7 19.7 22.7 19.1 22.6 19C22.5 18.8 22.3 18.7 21.3 17.5Z" fill="white"/>
                              </svg>
                            </button>
                          </div>
                        </td>
                        <td className="p-3 text-sm text-muted-foreground">{inv.member_name}</td>
                        <td className="p-3">
                          <Badge variant={visitsColor(inv.visits_used, inv.max_visits) as any}>
                            {inv.visits_used} / {inv.max_visits}
                          </Badge>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {inv.created_at.split(' ')[0]}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary" />
                {isArabic ? 'إضافة دعوة جديدة' : 'New Invitation'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {isArabic ? 'العضو الداعي' : 'Inviting Member'}
                </label>
                {selectedMember ? (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-primary/10 border border-primary/30">
                    <span className="text-sm font-medium text-foreground">{selectedMember.name}</span>
                    <button onClick={() => { setSelectedMember(null); setMemberSearch('') }} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
                  </div>
                ) : (
                  <>
                    <Input
                      placeholder={isArabic ? 'ابحث عن العضو...' : 'Search member...'}
                      value={memberSearch}
                      onChange={e => setMemberSearch(e.target.value)}
                    />
                    {memberSearch && (
                      <div className="max-h-40 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                        {filteredMembers.slice(0, 6).map(m => (
                          <button key={m.id} onClick={() => { setSelectedMember({ id: m.id, name: m.name }); setMemberSearch('') }}
                            className="w-full text-left px-3 py-2 hover:bg-muted transition-colors">
                            <p className="text-sm text-foreground">{m.name}</p>
                            <p className="text-xs text-muted-foreground">{formatPhone(m.phone)}</p>
                          </button>
                        ))}
                        {filteredMembers.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-3">{isArabic ? 'مفيش نتايج' : 'No results'}</p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{isArabic ? 'اسم المدعو' : 'Guest Name'}</label>
                <Input placeholder={isArabic ? 'اسم المدعو' : 'Guest full name'} value={guestName} onChange={e => setGuestName(e.target.value)} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{isArabic ? 'رقم تليفون المدعو' : 'Guest Phone'}</label>
                <div className="flex items-center">
                  <span className="px-3 py-2 bg-muted rounded-l-md border border-r-0 text-sm">+20</span>
                  <Input className="rounded-l-none" placeholder="1xxxxxxxxx" value={guestPhone}
                    onChange={e => {
                      const val = e.target.value.replace(/[^0-9]/g, '')
                      if (val.length <= 10) setGuestPhone(val)
                    }} />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                  {isArabic ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button className="flex-1" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? (isArabic ? 'جاري...' : 'Saving...') : (isArabic ? 'تأكيد' : 'Confirm')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  )
}
