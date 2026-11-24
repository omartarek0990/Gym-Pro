# Session Summary

## What We Did

### 1. **إضافة عمود `rtype` لجدول `renewals`**
   - نوع المعاملة: `renewal` (تجديد) / `upgrade` (ترقية) / `payment` (دفعة)
   - الترحيل (migration) للقواعد القديمة: `ALTER TABLE renewals ADD COLUMN rtype`
   - تحديث `Renewal` struct في Rust و TypeScript يشمل `rtype`

### 2. **تحديث الأوامر لتضمين `rtype`**
   - `renew_member` → يدرج بـ `rtype='renewal'`
   - `upgrade_member_plan` → يدرج بـ `rtype='upgrade'`
   - `record_payment` **جديد** → يدرج بـ `rtype='payment'`
   - `get_renewals` / `get_all_renewals` → يرجع `rtype` في النتيجة

### 3. **صفحة الأرباح (Profits)**
   - عرض "ترقية خطة" (Plan Upgrade) كبند منفصل عن التجديدات
   - عرض "دفعة" (Payment) للدفعات المسجلة يدويًا

### 4. **زر أصفر "تسديد الباقي" (Pay Remaining)**
   - زر أصفر صغير بجانب حقل "الباقي" (Remaining) في:
     - `InlineMemberProfile.tsx` (البرنامجين)
     - `MemberProfileDialog.tsx` (البرنامجين)
   - عند الضغط: يفتح Dialog يدخل المدير المبلغ اللي عاوز يسدده
   - يستدعي `record_payment` ويسجل في `renewals` بنوع `payment`
   - `paidAmount` بقى مجموع كل المبالغ (مش آخر تجديد بس) — عشان الحسبة صحيحة

### 5. **بناء الـ exe ونسخها لـ `D:\SETUP`**
   - `GymPro.exe` (15.8MB)
   - `GymPro_0.1.0_x64-setup.exe` (5.1MB)
   - `GymAttendance.exe` (13.7MB)
   - `GymAttendance_0.1.0_x64-setup.exe` (3.5MB)

### 6. **حذف نظام البوكس نهائيًا من البرنامجين**
   - حذف `plan_type='box'` وحقول `sessions_total`/`sessions_used` وأمر `add_box_session` من Rust (البرنامجين)
   - إرجاع بادئة البطاقات إلى `MRX-` بدل `BOX-`
   - حذف فرع "حصص البوكس" من `InlineMemberProfile.tsx` (عرض شبكة الميزات دائمًا)
   - حذف `setMemberType` من `Members/index.tsx` (كان مرجعًا لمتغير غير موجود)
   - صفر نتائج لـ `box`/`plan_type`/`sessions` في الشيفرة بعد التنظيف

### 7. **تعديل تاريخ بداية العضو من ملفه الشخصي**
   - زرا سماوي «Edit Start Date» في شريط أزرار البروفايل (البرنامجين)
   - Dialog يختار التاريخ الجديد ويعرض `end_date` المحسوبة (`addMonthsToDate(newStart, plan_duration_months)`)
   - يستدعي أمر `update_member_dates` الموجود مسبقًا بـ `new_start` + `new_end`

### 8. **نظام ترقية الخطة (Plan Upgrade) بخيارين للحساب**
   - زرا بنفسجي «Upgrade» في شريط أزرار البروفايل + زرا على كارت الخطة الحالية
   - Dialog الترقية: يعرض الخطة الحالية، اختيار الخطة الجديدة، واختيار نظام الحساب:
     - **فرق السعر الكامل** (`diff`): يدفع `سعر الجديد − سعر الحالي`، و`new_end` = `start_date + مدة الجديدة`
     - **نسبي على الأيام المتبقية** (`prorated`): خصم `سعر الحالي × (أيام متبقية / إجمالي الأيام)`، و`new_end` = `today + مدة الجديدة`
   - `new_end` و`amount_paid` محسوبة في الواجهة وتمرر لأمر `upgrade_member_plan` (استبدل الحساب من Rust)
   - مفاتيح i18n جديدة: `upgradeCalcMethod`/`upgradeModeDiff`/`upgradeModeProrated`/`upgradeCredit`/`editStartDate`/`currentStartDate`/`newStartDate`

### 9. **تنظيف تحذيرات Rust (صفر تحذيرات)**
   - حذف دالة `add_months_to_date` الميتة من `src-tauri/src/lib.rs` (البرنامجين) واستيراد `chrono::Datelike` (Attendance)
   - حذف struct `Invitation` الميت من `setup.rs` واستيراد `User` الزائد من `database/mod.rs` (Gym Management)

### 10. **إعادة البناء والنسخ لـ `D:\SETUP`**
   - `GymPro.exe` (15.1MB) + `GymPro_0.1.0_x64-setup.exe` (4.9MB)
   - `GymAttendance.exe` (13.1MB) + `GymAttendance_0.1.0_x64-setup.exe` (3.3MB)

### 11. **تحسين الأداء للجهاز الضعيف (HP EliteDesk 705 G1 SFF — A10/4GB/HDD)**
   - حذف `backdrop-blur`/`backdrop-filter` (أغلى تأثير على كرت الشاشة الضعيفة) من: `Navbar.tsx`, `Sidebar.tsx`, `ui/card.tsx`, `ui/dialog.tsx` (overlay), `cards/StatsCards.tsx`, `SystemNotificationStack.tsx`, `.glass-card` في `index.css` (البرنامجين)
   - حذف أنيميشن فتح/إغلاق Radix من `dialog/select/popover/toast` (`data-[state=open]:animate-in` ... و`zoom-in/out` و`slide-in`) — تُفتح فورًا
   - `AnimatedCounter.tsx`: عرض القيمة مباشرة بدون `requestAnimationFrame` (البرنامجين)
   - استبدال `recharts` (AreaChart باهظ) برسم أعمدة CSS خفيف في `Dashboard/index.tsx` وحذف `recharts` من `package.json`
   - حذف `framer-motion` غير المستخدم من `package.json` (البرنامجين)
   - تقليل الـ polling لتخفيف ضغط CPU والقرص:
     - Gym Management: `Navbar` notifications 10s→30s وbackup 30s→60s، `SystemNotificationStack` 15s→30s، `Layout` (check_inactive+generate) 120s→300s
     - Gym Attendance: `App.tsx` (generate_notifications) 120s→300s
   - إزالة `skeleton` shimmer المستمر و`transition-all duration-200` من `ui/button.tsx` (Gym Management)
   - إزالة ظل `glow` من `StatCard.tsx` (البرنامجين)
   - النتائج: حزمة Gym Management ≈ 1190KB (330KB gzip) بدون recharts/framer، حزمة Attendance ≈ 431KB
   - `tsc -b` + `npx tauri build` ناجحان، ونُسخت النواتج لـ `D:\SETUP`:
     - `GymPro.exe` (15.0MB) + `GymPro_0.1.0_x64-setup.exe` (4.8MB)
     - `GymAttendance.exe` (13.1MB) + `GymAttendance_0.1.0_x64-setup.exe` (3.3MB)

### 12. **Code splitting + lazy loading (Gym Management)**
   - كل الصفحات في `App.tsx` أصبحت `React.lazy` + `Suspense` (مع `PageFallback` خفيف)
   - `xlsx` في `useExport.ts` و`html2canvas` في `Members/index.tsx` أصبحا dynamic import — يتحملوا فقط عند الاستخدام
   - النتيجة: الحزمة الأساسية للبداية انخفضت من **1190KB → 388KB (gzip 120KB)** — 3 مرات أقل JS عند الفتح
   - المكتبات الثقيلة في ملفات منفصلة: `xlsx` (426KB) و`html2canvas` (200KB) تُحمَّل عند الطلب فقط
   - كل صفحة في chunk مستقل (Dashboard 8KB، Members 91KB، Settings 22KB، ...)
   - `vite.config.ts` — `build.target: 'es2018'`
   - `npx tauri build` ناجح، نُسخ لـ `D:\SETUP` (أُغلق GymPro شغال أولًا لرفع قفل الملف)

### 13. **تشخيص بطء البرنامج عند العميل (HP EliteDesk الضعيف) + أوامر أداء**
   - المستخدم أكد أن البطء عند **العميل** (جهاز ضعيف) مش عند المستخدم
   - السبب الجذري: `get_members` كان بيجلب عمود `photo` (base64 داخل الـ DB، الحجم الكلي 65.6MB + WAL 11.8MB) في كل الأماكن + `get_all_attendance` بيجلب كل سجل الحضور التاريخي
   - أوامر Rust جديدة في `lib.rs` (المشروعين):
     - `get_members_light` — نفس القائمة بدون `photo` (للـ Dashboard/Attendance/Reports/Invitations)
     - `get_member_by_id` — جلب عضو واحد كامل بالصورة (لبروفايل الحضور والتفاصيل)
     - `get_attendance_by_date` — `WHERE date=?1` (بدل كل السجل) مع `getLocalDateString()` في الواجهة لتجنب فرق التوقيت
   - `PRAGMA wal_checkpoint(TRUNCATE)` في `Database::new` في `setup.rs` (المشروعين) — تدفق الـ WAL للـ DB ويمنع تراكم ملفات -wal/-shm
   - صفحة Members أبقيت على `get_members` الكامل (تحتاج الصور)

### 14. **حذف نظام التفعيل نهائيًا (Gym Management)**
   - حُذف من Rust: `LICENSE_SECRET`, `fnv_hash`, `get_hardware_fingerprint`, `get_machine_uuid`, `lic_path`, `get_hardware_id`, `activate_license`, `check_license`
   - **كود إعادة تعيين باسورد المالك**: ثابت `MASTER_RESET_CODE = "MRX-RESET-2026"` في `lib.rs` (سطر ~56) — **قابل للتغيير قبل البناء**، ويُستدعى من Login عبر `reset_owner_password(master_code, new_password)`
   - أُزيلت شاشة activate من `App.tsx` (state + handleActivate + كتلة 'activate') و`LicenseCard` من `Settings`
   - `SetupWizard` ماكانش فيه خطوة لايسنس أصلاً (خطواته: db, backup, cloud)
   - i18n: حُذفت مفاتيح `license.*` من union والقواميس، أُضيف `login.masterCode`؛ أُبقيت `setup.license*` غير المستخدمة (قرار متعمد، صالحة TS)
   - Gym Attendance مافيهوش لايسنس أصلاً (فقط `reactivate_member` غير متعلق)

### 15. **حذف النسخ الاحتياطي السحابي نهائيًا (Gym Management)**
   - الطلب: «عاوز الغي الحفظ الداتا علي الجوجل» — لأن نسخ الـ DB الكاملة (65MB+WAL) لمجلد متزامن (Google Drive/OneDrive) كان سببًا كبيرًا في تعليق جهاز العميل
   - حُذف من `lib.rs`: قراءة `cloud_backup_folder` في `do_run_backup` + فرع النسخ للـ cloud + إدراج مجلد السحابة في حلقة التنظيف، ومن `restore_backup` قراءة `cloud_backup_folder`
   - حُذف من `setup.rs`: بذر `('cloud_backup_folder', '')` و`INSERT OR IGNORE` الخاص بها (الصف الموجود في قواعد العملاء القديمة لا يُقرأ، غير ضار)
   - الواجهة: حذف خطوة السحابة من `SetupWizard.tsx` (total 3→2)؛ `App.tsx` حذف `cloudBackupFolder`/`pickCloudFolder`/`skipCloud`/`finishCloud` — بعد اختيار مجلد النسخ المحلي يُكمل الـ wizard مباشرة (`completeWizard`)
   - `Settings/index.tsx`: حذف قسم «مجلد النسخ السحابي» كاملًا
   - i18n: حُذفت `setup.cloudTitle/cloudDesc/pickCloudFolder/skip/continue`؛ `setup.stepOf` صارت «من 3» (الخطوة {n} من 3)
   - فحص نهائي: لا توجد أي إشارة لـ `cloud_backup_folder`/`cloud` في `src` و`src-tauri` (باستثناء `objc2-cloud-kit` تبعية tauri نفسها في Cargo.lock)

### 16. **إبقاء آخر نسختين فقط في النسخ الاحتياطي (Gym Management)**
   - الطلب: «عاوز اخلي الاوتو باك اب يحفظ نسختين بس» — مثال: نسخة 16/8، ثم 17/8، وعند حفظ 18/8 يمسح 16/8 (يُبقي أحدث نسختين فقط)
   - في `do_run_backup` في `lib.rs`: استُبدل حذف الملفات الأقدم من 30 يوم بحلقة تجمع كل ملفات `gym_backup_*.db`، ترتبها تنازليًا بالتاريخ، وتحذف كل ما بعد الأحدثين (`skip(2)`)
   - الـ auto backup بيشغل كل ساعة لكن الاسم بيعتمد على اليوم فقط (`gym_backup_YYYY-MM-DD.db`) فبيتسجّل فوق بعضه في نفس اليوم — فالنتيجة: ملفين فقط (آخر يومين)
   - ينطبق التنظيف أيضًا على «Backup Now» من Settings (نفس الدالة) — Gym Attendance مافيهوش باك اب
   - `npx tauri build` ناجح، نُسخ لـ `D:\SETUP` 5:30 م: `GymPro.exe` (15.03MB) + `GymPro_0.1.0_x64-setup.exe` (4.85MB) + `GymPro_0.1.0_x64_en-US.msi` (6.34MB)

### 17. **ضغط صور الأعضاء عند الإضافة (الجولة النهائية للمراجعة — البرنامجين)**
   - مراجعة شاملة: كل تحسينات الأداء السابقة سارية، والبطء المتبقي جذره الصور المخزنة بالحجم الكامل base64 في الـ DB (65MB)
   - **جديد**: ضغط أي صورة قبل حفظها في الـ DB:
     - ملف جديد `src/lib/image.ts` (البرنامجين): `compressImageData(dataUrl, 900, 0.8)` و`compressPhotoFile(file)` — تغيير الحجم لـ 900px كحد أقصى، تحويل لـ JPEG بجودة 0.8، خلفية بيضاء للـ PNG الشفافة، وfallback للصورة الأصلية لو فشل الضغط
     - استُخدم في: إضافة عضو من ملف أو كاميرا (`Members/index.tsx` — `handleAddPhotoSelect` و`capturePhoto`)، وتغيير الصورة من `InlineMemberProfile.tsx` و`MemberProfileDialog.tsx` (البرنامجين)
     - الفائدة: صورة من الموبايل 3-5MB تبقى ~100-200KB — يتوقف نمو الـ DB نهائيًا (الصور القديمة 65MB تفضل كما هي، لكن لا زيادة)
   - فحص الأداء النهائي: لا `get_all_attendance` في الصفحات، لا `backdrop-blur`/أنيميشن، polling منخفض (30s/60s/300s)، Members فقط بتحميل الصور الكامل (يحتاجها للشبكة والطباعة)
   - البناء النهائي ناجح للمشروعين (5:58 م)، نُسخ لـ `D:\SETUP`:
     - `GymPro.exe` (15.03MB) + `GymPro_0.1.0_x64-setup.exe` (4.85MB) + `GymPro_0.1.0_x64_en-US.msi` (6.34MB)
     - `GymAttendance.exe` (13.13MB) + `GymAttendance_0.1.0_x64-setup.exe` (3.34MB)

### 18. **إصلاح التعليق على أجهزة قوية — مراجعة أداء شاملة (Gym Management)**
   - المستخدم أبلغ عن تعليق حتى على جهاز قوي (i5 210H, 16GB, RTX 4050)
   - **المسبب الرئيسي**: `generate_notifications` كان بيشتغل كل 300 ثانية في `Layout.tsx` — بيعمل **12+ SQL query** (DELETEs + SELECTs with JOINs + INSERTs) وهو ماسك الـ DB lock. كل أمر tauri تاني بيستنى لحد ما يخلص → واجهة بتتجمد.
   - **إصلاح 1** (Layout.tsx): إزالة الـ interval بالكامل — `generate_notifications` و`check_inactive_members` بيشتغلوا مرة واحدة بس عند بدء التشغيل، مش كل 5 دقائق.
   - **إصلاح 2** (Navbar.tsx + SystemNotificationStack.tsx): كان في polling مزدوج — Navbar بيجيب `get_notifications` كل 30s و`SystemNotificationStack` بيعمل نفس الدعوة كل 30s. Navbar بقى بيسمع Event `notifications-updated` بس (بدون setInterval)، و`SystemNotificationStack` هو اللي بيعمل dispatch للحدث لما يلاقي تنبيهات جديدة.
   - **إصلاح 3** (Navbar.tsx): تقليل `get_backup_info` من كل 60s لـ كل 300s (5 دقائق) — معلومات الباك أبRarely بتتغير.
   - **النتيجة**: الصلاحيات المتكررة على الـ DB انخفضت بشكل كبير — مفيش DB lock متكرر، ومفيش IPC calls مكررة كل 30s.
   - `npx tauri build` ناجح، نُسخ لـ `D:\SETUP` (10:12 م): `GymPro.exe` (15.03MB) + `GymPro_0.1.0_x64-setup.exe` (4.85MB) + `GymPro_0.1.0_x64_en-US.msi` (6.34MB)

## What We Changed / New Files
- `src-tauri/src/database/setup.rs` — renewals table `rtype` column + migration، حذف struct `Invitation`، `PRAGMA wal_checkpoint(TRUNCATE)` في `Database::new`، حذف `cloud_backup_folder` (بذر + INSERT)
- `src-tauri/src/lib.rs` — `record_payment` command, update `renew_member`, `upgrade_member_plan` (يقبل `new_end`), `get_renewals`, `get_all_renewals`، حذف `add_months_to_date`، أوامر `get_members_light`/`get_member_by_id`/`get_attendance_by_date`، حذف التفعيل + `MASTER_RESET_CODE` + `reset_owner_password`، حذف السحابة من `do_run_backup`/`restore_backup`
- `src-tauri/src/database/mod.rs` — حذف استيراد `User` الزائد
- `src/types/index.ts` — `Renewal` interface + `rtype`
- `src/pages/Profits/index.tsx` — عرض Upgrade/Payment كبند منفصل
- `src/components/shared/InlineMemberProfile.tsx` — زر أصفر Pay + تعديل التاريخ + Dialog الترقية بالخيارين
- `src/components/shared/MemberProfileDialog.tsx` — زر أصفر Pay + تعديل التاريخ + Dialog الترقية بالخيارين
- `src/components/setup/SetupWizard.tsx` — حذف خطوة السحابة (3→2) وإزالة `Cloud` import
- `src/App.tsx` — إزالة license + إزالة السحابة، `WizardStep` صارت `0|1|2`، بعد مجلد النسخ المحلي → `completeWizard`
- `src/pages/Settings/index.tsx` — إزالة `LicenseCard` + حذف قسم النسخ السحابي
- `src/pages/Login` — زر forgot password يستدعي `reset_owner_password(master_code, ...)`
- `src/lib/i18n.tsx` — مفاتيح الترقية وتاريخ البداية، حذف `license.*` (union+قواميس) و`setup.cloud*` و`setup.skip/continue`، `login.masterCode`، `setup.stepOf` → «من 3»
- `src/pages/Dashboard/index.tsx` — استبدال recharts برسم أعمدة CSS خفيف + `get_members_light`
- `src/pages/Attendance/index.tsx` — `get_members_light` + `get_member_by_id` + `get_attendance_by_date` (البرنامجين)
- `src/pages/Reports/index.tsx` — `get_members_light` + `get_attendance_by_date`
- `src/pages/Invitations/index.tsx` — `get_members_light`
- `src/components/ui/dialog.tsx` / `card.tsx` / `toast.tsx` / `select.tsx` / `popover.tsx` / `button.tsx` — إزالة backdrop-blur وأنيميشن الفتح/الإغلاق (البرنامجين)
- `src/index.css` — إزالة `backdrop-filter` من `.glass-card` + إيقاف `skeleton` shimmer (البرنامجين)
- `src/components/shared/AnimatedCounter.tsx` / `StatCard.tsx` — عرض مباشر بدون rAF/ظلال
- `package.json` — حذف `recharts` و`framer-motion` (البرنامجين)
- `src/lib/image.ts` — ضغط الصور عند الإضافة/التغيير (compressImageData + compressPhotoFile)
- `D:\css\Gym Attendance` — كل تحسينات الأداء (لا لايسنس/سحابة فيه)

## Pending
- (none)