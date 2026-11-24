export interface Member {
  id: string
  name: string
  phone: string
  card_code: string
  photo: string
  plan_id: string
  gender: string
  start_date: string
  end_date: string
  status: string
  inbody_used: number
  invitation_used: number
  freeze_used: number
  private_used: number
  frozen_until: string
  freeze_start_date: string
  freeze_days_entered: number
  plan_name: string
  plan_price: number
  plan_duration_months: number
  plan_inbody_count: number
  plan_invitation_count: number
  plan_freeze_days: number
  plan_private_sessions: number
  days_left?: number
}

export interface Plan {
  id: string
  name: string
  duration_months: number
  price: number
  inbody_count: number
  invitation_count: number
  freeze_days: number
  private_sessions: number
}

export interface Attendance {
  id: string
  member_id: string
  date: string
  time: string
  method: string
  member_name?: string
}

export interface Renewal {
  id: string
  member_id: string
  date: string
  amount: number
  rtype: string
  member_name?: string
}

export interface Supplement {
  id: string
  name: string
  cost: number
  price: number
  stock: number
  added_date: string
  profit_margin?: number
}

export interface SupplementOrder {
  id: string
  supplement_id: string
  qty: number
  total_cost: number
  total_price: number
  profit: number
  date: string
  time: string
  supplement_name?: string
}

export interface AuditLog {
  id: string
  action: string
  details: string
  date: string
  time: string
}

export interface AppSetting {
  key: string
  value: string
}

export interface DashboardStats {
  total_members: number
  active_members: number
  expired_members: number
  today_attendance: number
  month_revenue: number
  supplement_profit: number
  total_revenue: number
  expiring_count: number
  chart_data: string[]
}

export interface Card {
  id: number
  card_code: string
  member_id: string | null
  created_at: string
  assigned_at: string | null
  status: string
  member_name: string | null
  member_phone: string | null
}

export interface BackupInfo {
  current_file: string
  previous_file: string
  current_time: string
  previous_time: string
  last_backup: string
  backup_folder: string
}

export interface CardStats {
  total: number
  available: number
  used: number
}

export interface GenerateResult {
  generated: number
  skipped: number
}

export interface ProfitData {
  total_plan: number
  total_supplement_profit: number
  total: number
  today_plan: number
  today_supplement: number
  today: number
  month_plan: number
  month_supplement: number
  month: number
  year_plan: number
  year_supplement: number
  year: number
}



