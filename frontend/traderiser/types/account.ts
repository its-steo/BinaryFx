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
