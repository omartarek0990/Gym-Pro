import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react'
import { invoke } from '@/lib/tauri'

export type Language = 'en' | 'ar'

type TranslationKey =
  | 'nav.dashboard' | 'nav.members' | 'nav.plans' | 'nav.attendance' | 'nav.supplements' | 'nav.profits' | 'nav.reports' | 'nav.alerts' | 'nav.cards' | 'nav.auditLog' | 'nav.settings'
  | 'page.dashboard' | 'page.members' | 'page.plans' | 'page.attendance' | 'page.supplements' | 'page.profits' | 'page.reports' | 'page.notifications' | 'page.cards' | 'page.auditLog' | 'page.settings'
  | 'common.all' | 'common.active' | 'common.frozen' | 'common.expired' | 'common.cancel' | 'common.confirm' | 'common.restore' | 'common.delete' | 'common.edit' | 'common.renew' | 'common.update' | 'common.add' | 'common.search'
  | 'settings.gymInfo' | 'settings.gymName' | 'settings.appearance' | 'settings.darkMode' | 'settings.language' | 'settings.backupRestore' | 'settings.lastBackup' | 'settings.nextBackup' | 'settings.backupFolder' | 'settings.backupNow' | 'settings.backingUp' | 'settings.currentBackup' | 'settings.previousBackup' | 'settings.security' | 'settings.deletePassword' | 'settings.deletePasswordHelp' | 'settings.deletePasswordPlaceholder' | 'settings.footer' | 'settings.restoreBackup' | 'settings.restoreQuestion' | 'settings.restoreWarning'
  | 'toast.settingUpdated' | 'toast.backupCreated' | 'toast.backupFailed' | 'toast.restored' | 'toast.restoreFailed' | 'toast.backupFolderSet' | 'toast.folderPickFailed'
  | 'time.never' | 'time.justNow' | 'time.notYet' | 'time.now'
  | 'members.addMember' | 'members.addNewMember' | 'members.editMember' | 'members.deleteMember' | 'members.renewMembership' | 'members.freezeMember' | 'members.unfreezeMember' | 'members.fullName' | 'members.name' | 'members.phone' | 'members.cardCode' | 'members.noCard' | 'members.plan' | 'members.selectPlan' | 'members.saveChanges' | 'members.confirmDelete' | 'members.adminPassword' | 'members.password' | 'members.extendFromEnd' | 'members.freezeDuration' | 'members.availableFreezeDays' | 'members.planFeatures' | 'members.attendanceHistory' | 'members.renewalHistory' | 'members.noMembers' | 'members.noAttendance' | 'members.noRenewals' | 'members.useFeature' | 'members.useFeatureMessage' | 'members.freezeMessage' | 'members.unfreezeMessage'
  | 'attendance.todayAttendance' | 'attendance.totalMembers' | 'attendance.activeToday' | 'attendance.scanCard' | 'attendance.scanHelp' | 'attendance.scanPlaceholder' | 'attendance.scan' | 'attendance.manual' | 'attendance.todayRecords' | 'attendance.noAttendanceToday' | 'attendance.selectMember' | 'attendance.memberFrozen' | 'attendance.currentlyFrozen' | 'attendance.remaining' | 'attendance.freezeUsed' | 'attendance.unfreezeAttend' | 'attendance.alreadyCheckedIn' | 'attendance.recordAgain' | 'attendance.recordAnyway'
  | 'plans.count' | 'plans.addPlan' | 'plans.editPlan' | 'plans.planName' | 'plans.durationMonths' | 'plans.price' | 'plans.inbodyCount' | 'plans.invitations' | 'plans.freeze' | 'plans.privateSessions' | 'plans.invites' | 'plans.private'
  | 'supp.products' | 'supp.totalOrders' | 'supp.totalProfit' | 'supp.lowStock' | 'supp.pos' | 'supp.addProduct' | 'supp.editProduct' | 'supp.productName' | 'supp.costPrice' | 'supp.sellPrice' | 'supp.stock' | 'supp.profitMargin' | 'supp.inventory' | 'supp.ordersHistory' | 'supp.searchProducts' | 'supp.noProducts' | 'supp.noOrders' | 'supp.cost' | 'supp.inStock' | 'supp.qty' | 'supp.profit' | 'supp.pointOfSale' | 'supp.cartEmpty' | 'supp.total' | 'supp.completeOrder'
  | 'cards.all' | 'cards.available' | 'cards.used' | 'cards.availableOnly' | 'cards.allCards' | 'cards.printCards' | 'cards.generateCards'

const translations: Record<Language, Record<TranslationKey, string>> = {
  en: {
    'nav.dashboard': 'Dashboard', 'nav.members': 'Members', 'nav.plans': 'Plans', 'nav.attendance': 'Attendance', 'nav.supplements': 'Supplements', 'nav.profits': 'Profits', 'nav.reports': 'Reports', 'nav.alerts': 'Alerts', 'nav.cards': 'Card Manager', 'nav.auditLog': 'Audit Log', 'nav.settings': 'Settings',
    'page.dashboard': 'Dashboard', 'page.members': 'Members Management', 'page.plans': 'Subscription Plans', 'page.attendance': 'Attendance', 'page.supplements': 'Supplements Store', 'page.profits': 'Profits', 'page.reports': 'Reports & Analytics', 'page.notifications': 'Notifications', 'page.cards': 'Card Manager', 'page.auditLog': 'Audit Log', 'page.settings': 'Settings',
    'common.all': 'All', 'common.active': 'Active', 'common.frozen': 'Frozen', 'common.expired': 'Expired', 'common.cancel': 'Cancel', 'common.confirm': 'Confirm', 'common.restore': 'Restore', 'common.delete': 'Delete', 'common.edit': 'Edit', 'common.renew': 'Renew', 'common.update': 'Update', 'common.add': 'Add', 'common.search': 'Search',
    'settings.gymInfo': 'Gym Information', 'settings.gymName': 'Gym Name', 'settings.appearance': 'Appearance', 'settings.darkMode': 'Dark Mode', 'settings.language': 'Language', 'settings.backupRestore': 'Backup & Restore', 'settings.lastBackup': 'Last Backup', 'settings.nextBackup': 'Next Backup', 'settings.backupFolder': 'Backup Folder', 'settings.backupNow': 'Backup Now', 'settings.backingUp': 'Backing up...', 'settings.currentBackup': 'Current Backup', 'settings.previousBackup': 'Previous Backup', 'settings.security': 'Security', 'settings.deletePassword': 'Delete Password', 'settings.deletePasswordHelp': 'Required when deleting members', 'settings.deletePasswordPlaceholder': 'Enter password for delete confirmation', 'settings.footer': 'Gym Pro v0.1.0 - All data stored offline in SQLite', 'settings.restoreBackup': 'Restore Backup', 'settings.restoreQuestion': 'Are you sure you want to restore this backup?', 'settings.restoreWarning': 'All current data will be replaced with backup data. This cannot be undone.',
    'toast.settingUpdated': 'Setting Updated', 'toast.backupCreated': 'Backup Created', 'toast.backupFailed': 'Backup Failed', 'toast.restored': 'Restored', 'toast.restoreFailed': 'Restore Failed', 'toast.backupFolderSet': 'Backup Folder Set', 'toast.folderPickFailed': 'Folder Pick Failed',
    'time.never': 'Never', 'time.justNow': 'Just now', 'time.notYet': 'Not yet', 'time.now': 'Now',
    'members.addMember': 'Add Member', 'members.addNewMember': 'Add New Member', 'members.editMember': 'Edit Member', 'members.deleteMember': 'Delete Member', 'members.renewMembership': 'Renew Membership', 'members.freezeMember': 'Freeze Member', 'members.unfreezeMember': 'Unfreeze Member', 'members.fullName': 'Full Name', 'members.name': 'Name', 'members.phone': 'Phone', 'members.cardCode': 'Card Code', 'members.noCard': 'No card', 'members.plan': 'Plan', 'members.selectPlan': 'Select plan', 'members.saveChanges': 'Save Changes', 'members.confirmDelete': 'Confirm Delete', 'members.adminPassword': 'Enter admin password to confirm', 'members.password': 'Password', 'members.extendFromEnd': 'Extend from end date', 'members.freezeDuration': 'Freeze Duration (Days)', 'members.availableFreezeDays': 'Available Freeze Days', 'members.planFeatures': 'Plan Features', 'members.attendanceHistory': 'Attendance History', 'members.renewalHistory': 'Renewal History', 'members.noMembers': 'No members found', 'members.noAttendance': 'No attendance records', 'members.noRenewals': 'No renewals', 'members.useFeature': 'Use {feature}', 'members.useFeatureMessage': 'Are you sure you want to use 1 {feature} for {name}?', 'members.freezeMessage': 'Freeze {name} for {days} day{plural}?', 'members.unfreezeMessage': 'Are you sure you want to unfreeze {name}?',
    'attendance.todayAttendance': "Today's Attendance", 'attendance.totalMembers': 'Total Members', 'attendance.activeToday': 'Active Today %', 'attendance.scanCard': 'Scan Card / Barcode', 'attendance.scanHelp': 'Input is always ready. Scan or type card code.', 'attendance.scanPlaceholder': 'Scan card code or type...', 'attendance.scan': 'Scan', 'attendance.manual': 'Manual Attendance', 'attendance.todayRecords': "Today's Records", 'attendance.noAttendanceToday': 'No attendance yet today', 'attendance.selectMember': 'Select Member', 'attendance.memberFrozen': 'Member Frozen', 'attendance.currentlyFrozen': 'This member is currently frozen', 'attendance.remaining': 'remaining', 'attendance.freezeUsed': 'Freeze used', 'attendance.unfreezeAttend': 'Unfreeze + Attend', 'attendance.alreadyCheckedIn': 'Already Checked In Today', 'attendance.recordAgain': '{name} has already been recorded today. Record again?', 'attendance.recordAnyway': 'Record Anyway',
    'plans.count': '{count} Plans', 'plans.addPlan': 'Add Plan', 'plans.editPlan': 'Edit Plan', 'plans.planName': 'Plan Name', 'plans.durationMonths': 'Duration (months)', 'plans.price': 'Price ($)', 'plans.inbodyCount': 'InBody Count', 'plans.invitations': 'Invitations', 'plans.freeze': 'Freeze', 'plans.privateSessions': 'Private Sessions', 'plans.invites': 'Invites', 'plans.private': 'Private',
    'supp.products': 'Products', 'supp.totalOrders': 'Total Orders', 'supp.totalProfit': 'Total Profit', 'supp.lowStock': 'Low Stock', 'supp.pos': 'POS', 'supp.addProduct': 'Add Product', 'supp.editProduct': 'Edit Product', 'supp.productName': 'Product Name', 'supp.costPrice': 'Cost Price', 'supp.sellPrice': 'Sell Price', 'supp.stock': 'Stock', 'supp.profitMargin': 'Profit Margin', 'supp.inventory': 'Inventory', 'supp.ordersHistory': 'Orders History', 'supp.searchProducts': 'Search products...', 'supp.noProducts': 'No products', 'supp.noOrders': 'No orders yet', 'supp.cost': 'Cost', 'supp.inStock': 'in stock', 'supp.qty': 'Qty', 'supp.profit': 'Profit', 'supp.pointOfSale': 'Point of Sale', 'supp.cartEmpty': 'Cart empty', 'supp.total': 'Total', 'supp.completeOrder': 'Complete Order',
    'cards.all': 'All', 'cards.available': 'Available', 'cards.used': 'Used', 'cards.availableOnly': 'Available Only', 'cards.allCards': 'All Cards', 'cards.printCards': 'Print Cards', 'cards.generateCards': 'Generate New Cards',
  },
  ar: {
    'nav.dashboard': 'لوحة التحكم', 'nav.members': 'الأعضاء', 'nav.plans': 'الخطط', 'nav.attendance': 'الحضور', 'nav.supplements': 'المكملات', 'nav.profits': 'الأرباح', 'nav.reports': 'التقارير', 'nav.alerts': 'التنبيهات', 'nav.cards': 'إدارة البطاقات', 'nav.auditLog': 'سجل النشاط', 'nav.settings': 'الإعدادات',
    'page.dashboard': 'لوحة التحكم', 'page.members': 'إدارة الأعضاء', 'page.plans': 'خطط الاشتراك', 'page.attendance': 'الحضور', 'page.supplements': 'متجر المكملات', 'page.profits': 'الأرباح', 'page.reports': 'التقارير والتحليلات', 'page.notifications': 'الإشعارات', 'page.cards': 'إدارة البطاقات', 'page.auditLog': 'سجل النشاط', 'page.settings': 'الإعدادات',
    'common.all': 'الكل', 'common.active': 'نشط', 'common.frozen': 'مجمد', 'common.expired': 'منتهي', 'common.cancel': 'إلغاء', 'common.confirm': 'تأكيد', 'common.restore': 'استرجاع', 'common.delete': 'حذف', 'common.edit': 'تعديل', 'common.renew': 'تجديد', 'common.update': 'تحديث', 'common.add': 'إضافة', 'common.search': 'بحث',
    'settings.gymInfo': 'بيانات الجيم', 'settings.gymName': 'اسم الجيم', 'settings.appearance': 'المظهر', 'settings.darkMode': 'الوضع الداكن', 'settings.language': 'اللغة', 'settings.backupRestore': 'النسخ الاحتياطي والاسترجاع', 'settings.lastBackup': 'آخر نسخة احتياطية', 'settings.nextBackup': 'النسخة القادمة', 'settings.backupFolder': 'مجلد النسخ الاحتياطي', 'settings.backupNow': 'نسخ احتياطي الآن', 'settings.backingUp': 'جاري النسخ...', 'settings.currentBackup': 'النسخة الحالية', 'settings.previousBackup': 'النسخة السابقة', 'settings.security': 'الأمان', 'settings.deletePassword': 'كلمة مرور الحذف', 'settings.deletePasswordHelp': 'مطلوبة عند حذف الأعضاء', 'settings.deletePasswordPlaceholder': 'اكتب كلمة مرور تأكيد الحذف', 'settings.footer': 'Gym Pro v0.1.0 - كل البيانات محفوظة محليًا في SQLite', 'settings.restoreBackup': 'استرجاع نسخة احتياطية', 'settings.restoreQuestion': 'هل أنت متأكد أنك تريد استرجاع هذه النسخة؟', 'settings.restoreWarning': 'سيتم استبدال كل البيانات الحالية ببيانات النسخة الاحتياطية. لا يمكن التراجع عن هذا الإجراء.',
    'toast.settingUpdated': 'تم تحديث الإعداد', 'toast.backupCreated': 'تم إنشاء نسخة احتياطية', 'toast.backupFailed': 'فشل النسخ الاحتياطي', 'toast.restored': 'تم الاسترجاع', 'toast.restoreFailed': 'فشل الاسترجاع', 'toast.backupFolderSet': 'تم تحديد مجلد النسخ', 'toast.folderPickFailed': 'فشل اختيار المجلد',
    'time.never': 'أبدًا', 'time.justNow': 'الآن', 'time.notYet': 'لم يتم بعد', 'time.now': 'الآن',
    'members.addMember': 'إضافة عضو', 'members.addNewMember': 'إضافة عضو جديد', 'members.editMember': 'تعديل العضو', 'members.deleteMember': 'حذف العضو', 'members.renewMembership': 'تجديد الاشتراك', 'members.freezeMember': 'تجميد العضو', 'members.unfreezeMember': 'إلغاء التجميد', 'members.fullName': 'الاسم بالكامل', 'members.name': 'الاسم', 'members.phone': 'الهاتف', 'members.cardCode': 'كود البطاقة', 'members.noCard': 'لا توجد بطاقة', 'members.plan': 'الخطة', 'members.selectPlan': 'اختر الخطة', 'members.saveChanges': 'حفظ التغييرات', 'members.confirmDelete': 'تأكيد الحذف', 'members.adminPassword': 'اكتب كلمة مرور المدير للتأكيد', 'members.password': 'كلمة المرور', 'members.extendFromEnd': 'التمديد من تاريخ الانتهاء', 'members.freezeDuration': 'مدة التجميد بالأيام', 'members.availableFreezeDays': 'أيام التجميد المتاحة', 'members.planFeatures': 'مميزات الخطة', 'members.attendanceHistory': 'سجل الحضور', 'members.renewalHistory': 'سجل التجديد', 'members.noMembers': 'لا يوجد أعضاء', 'members.noAttendance': 'لا يوجد سجل حضور', 'members.noRenewals': 'لا توجد تجديدات', 'members.useFeature': 'استخدام {feature}', 'members.useFeatureMessage': 'هل تريد استخدام 1 {feature} للعضو {name}؟', 'members.freezeMessage': 'تجميد {name} لمدة {days} يوم؟', 'members.unfreezeMessage': 'هل تريد إلغاء تجميد {name}؟',
    'attendance.todayAttendance': 'حضور اليوم', 'attendance.totalMembers': 'إجمالي الأعضاء', 'attendance.activeToday': 'نسبة الحضور اليوم', 'attendance.scanCard': 'مسح البطاقة / الباركود', 'attendance.scanHelp': 'حقل الإدخال جاهز دائمًا. امسح أو اكتب كود البطاقة.', 'attendance.scanPlaceholder': 'امسح كود البطاقة أو اكتبه...', 'attendance.scan': 'مسح', 'attendance.manual': 'حضور يدوي', 'attendance.todayRecords': 'سجلات اليوم', 'attendance.noAttendanceToday': 'لا يوجد حضور اليوم', 'attendance.selectMember': 'اختر العضو', 'attendance.memberFrozen': 'العضو مجمد', 'attendance.currentlyFrozen': 'هذا العضو مجمد حاليًا', 'attendance.remaining': 'متبقي', 'attendance.freezeUsed': 'أيام التجميد المستخدمة', 'attendance.unfreezeAttend': 'إلغاء التجميد + تسجيل حضور', 'attendance.alreadyCheckedIn': 'تم تسجيل الحضور اليوم', 'attendance.recordAgain': 'تم تسجيل {name} اليوم بالفعل. هل تريد التسجيل مرة أخرى؟', 'attendance.recordAnyway': 'سجل على أي حال',
    'plans.count': '{count} خطة', 'plans.addPlan': 'إضافة خطة', 'plans.editPlan': 'تعديل الخطة', 'plans.planName': 'اسم الخطة', 'plans.durationMonths': 'المدة بالشهور', 'plans.price': 'السعر', 'plans.inbodyCount': 'عدد InBody', 'plans.invitations': 'الدعوات', 'plans.freeze': 'التجميد', 'plans.privateSessions': 'الجلسات الخاصة', 'plans.invites': 'دعوات', 'plans.private': 'خاص',
    'supp.products': 'المنتجات', 'supp.totalOrders': 'إجمالي الطلبات', 'supp.totalProfit': 'إجمالي الربح', 'supp.lowStock': 'مخزون منخفض', 'supp.pos': 'نقطة البيع', 'supp.addProduct': 'إضافة منتج', 'supp.editProduct': 'تعديل المنتج', 'supp.productName': 'اسم المنتج', 'supp.costPrice': 'سعر التكلفة', 'supp.sellPrice': 'سعر البيع', 'supp.stock': 'المخزون', 'supp.profitMargin': 'هامش الربح', 'supp.inventory': 'المخزون', 'supp.ordersHistory': 'سجل الطلبات', 'supp.searchProducts': 'ابحث عن المنتجات...', 'supp.noProducts': 'لا توجد منتجات', 'supp.noOrders': 'لا توجد طلبات بعد', 'supp.cost': 'التكلفة', 'supp.inStock': 'في المخزون', 'supp.qty': 'الكمية', 'supp.profit': 'الربح', 'supp.pointOfSale': 'نقطة البيع', 'supp.cartEmpty': 'السلة فارغة', 'supp.total': 'الإجمالي', 'supp.completeOrder': 'إتمام الطلب',
    'cards.all': 'الكل', 'cards.available': 'متاحة', 'cards.used': 'مستخدمة', 'cards.availableOnly': 'المتاح فقط', 'cards.allCards': 'كل البطاقات', 'cards.printCards': 'طباعة البطاقات', 'cards.generateCards': 'إنشاء بطاقات جديدة',
  },
}

interface LanguageContextValue {
  language: Language
  isArabic: boolean
  setLanguage: (language: Language) => Promise<void>
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en')

  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const settings = await invoke('get_settings')
        const value = ((settings || []) as { key: string; value: string }[]).find((s) => s.key === 'language')?.value
        if (value === 'ar' || value === 'en') setLanguageState(value)
      } catch {}
    }
    loadLanguage()
  }, [])

  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
    document.body.classList.toggle('rtl', language === 'ar')
  }, [language])

  const setLanguage = async (nextLanguage: Language) => {
    await invoke('update_setting', { key: 'language', value: nextLanguage })
    setLanguageState(nextLanguage)
  }

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    isArabic: language === 'ar',
    setLanguage,
    t: (key, vars) => {
      let text = translations[language][key] || translations.en[key] || key
      Object.entries(vars || {}).forEach(([name, replacement]) => {
        text = text.replaceAll(`{${name}}`, String(replacement))
      })
      return text
    },
  }), [language])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider')
  return context
}
