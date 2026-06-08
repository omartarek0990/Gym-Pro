import { Routes, Route } from 'react-router-dom'
import Layout from '@/components/layout/Layout'
import Dashboard from '@/pages/Dashboard'
import MembersPage from '@/pages/Members'
import PlansPage from '@/pages/Plans'
import AttendancePage from '@/pages/Attendance'
import SupplementsPage from '@/pages/Supplements'
import ProfitsPage from '@/pages/Profits'
import ReportsPage from '@/pages/Reports'
import NotificationsPage from '@/pages/Notifications'
import AuditLogPage from '@/pages/AuditLog'
import CardManagerPage from '@/pages/CardManager'
import SettingsPage from '@/pages/Settings'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/members" element={<MembersPage />} />
        <Route path="/plans" element={<PlansPage />} />
        <Route path="/attendance" element={<AttendancePage />} />
        <Route path="/supplements" element={<SupplementsPage />} />
        <Route path="/profits" element={<ProfitsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/audit-log" element={<AuditLogPage />} />
        <Route path="/cards" element={<CardManagerPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}
