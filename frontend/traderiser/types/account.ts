// src/types/account.ts
export interface Account {
  id?: string | number;
  account_type: string;
  login?: string;
  balance?: number;
  currency?: string;
  // Add more fields as needed from your API
}

interface SidebarProps {
  loginType: string;
  activeAccount: Account | null;
  
}

export interface ManagementRequest {
  id: number
  management_id: string
  user: string
  stake: number
  target_profit: number
  payment_amount: number
  status: string
  status_display: string
  current_pnl: number
  days: number | null
  daily_target_profit: number | null
  start_date: string | null
  end_date: string | null
  created_at: string
  account_type: "standard" | "profx"
}

export const ACCOUNT_TYPE_LABELS = {
  standard: "Standard Account",
  profx: "ProFX Account",
} as const

