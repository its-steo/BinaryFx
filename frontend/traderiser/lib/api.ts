// lib/api.ts
//const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://binaryfx.onrender.com/api"

interface ApiResponse<T> {
  data?: T
  error?: string
  status?: number
}

export interface Currency {
  code: string
  name: string
}

export interface Wallet {
  id: number
  account_type: string
  wallet_type: string
  balance: string | number
  currency: Currency
  created_at: string
}

export interface WalletTransaction {
  id: number
  transaction_type: string
  amount: string
  currency: Currency
  status: string
  created_at: string
  converted_amount?: string
  target_currency?: Currency
  exchange_rate_used?: number
}

export interface MpesaNumberResponse {
  phone_number: string
}

export interface ForexPair {
  id: number
  name: string
  base_currency: string
  quote_currency: string
  pip_value: number
  contract_size: number
  spread: number
  base_simulation_price: number
}

export interface Position {
  id: number
  user: number
  account: number
  pair: ForexPair
  direction: "buy" | "sell"
  volume_lots: number
  entry_price: number
  sl?: number
  tp?: number
  floating_p_l: number
  status: "open" | "closed"
  entry_time: string
  time_frame: string
}

export interface ForexTrade {
  id: number
  position: Position
  close_price: number
  realized_p_l: number
  close_time: string
  close_reason: string
}

export interface WalletBalance {
  balance: number
  currency: string
  account_type: string
}

export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem("refresh_token")
  if (!refreshToken) return null

  try {
    const response = await fetch(`${API_BASE_URL}/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    })

    if (response.ok) {
      const data = await response.json()
      localStorage.setItem("access_token", data.access)
      return data.access
    } else {
      throw new Error(`Token refresh failed with status ${response.status}`)
    }
  } catch (error) {
    console.error("[v0] Token refresh failed:", error)
    localStorage.removeItem("access_token")
    localStorage.removeItem("refresh_token")
    localStorage.removeItem("account_type")
    localStorage.removeItem("login_type")
    localStorage.removeItem("user_session")
    localStorage.removeItem("active_account_id")
    return null
  }
}

export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    const token = localStorage.getItem("access_token")
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    }

    if (token) {
      headers["Authorization"] = `Bearer ${token}`
    }

    let response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    })

    if (response.status === 401 && token && !endpoint.includes("token/refresh/")) {
      const newToken = await refreshAccessToken()
      if (newToken) {
        headers["Authorization"] = `Bearer ${newToken}`
        response = await fetch(`${API_BASE_URL}${endpoint}`, {
          ...options,
          headers,
        })
      } else {
        return { error: "Session expired. Please log in again.", status: 401 }
      }
    }

    let json
    try {
      json = await response.json()
    } catch (e) {
      return { error: `Invalid response format from ${endpoint}`, status: response.status }
    }

    if (!response.ok) {
      const errorMsg = json?.detail || json?.error || `Request to ${endpoint} failed with status ${response.status}`
      return { error: errorMsg, status: response.status }
    }

    return { data: json, status: response.status }
  } catch (error) {
    return { error: (error as Error).message || `Network error calling ${endpoint}`, status: 500 }
  }
}

export const signup = async (data: {
  username: string
  email: string
  password: string
  phone?: string
  account_type: string
}) => {
  const response = await apiRequest<{
    access: string
    refresh: string
    user: Record<string, unknown>
    active_account: Record<string, unknown>
  }>("/accounts/signup/", {
    method: "POST",
    body: JSON.stringify(data),
  })

  if (response.data) {
    localStorage.setItem("access_token", response.data.access)
    localStorage.setItem("refresh_token", response.data.refresh)
    localStorage.setItem("account_type", data.account_type)
    localStorage.setItem("login_type", data.account_type === "demo" ? "demo" : "real")
    const normalizedUser = {
      ...response.data.user,
      accounts: (response.data.user as Record<string, unknown>).accounts
        ? ((response.data.user as Record<string, unknown>).accounts as Array<Record<string, unknown>>).map((acc) => ({
            ...acc,
            balance: Number(acc.balance) || 0,
          }))
        : [],
    }
    localStorage.setItem("user_session", JSON.stringify(normalizedUser))
    const defaultAccount =
      (normalizedUser.accounts as Array<Record<string, unknown>>).find(
        (acc) => acc.account_type === data.account_type,
      ) || (normalizedUser.accounts as Array<Record<string, unknown>>)[0]
    if (defaultAccount) {
      localStorage.setItem("active_account_id", (defaultAccount.id as number).toString())
    }
  }

  return response
}

export const login = async (data: { email: string; password: string; account_type: string }) => {
  const response = await apiRequest<{
    access: string
    refresh: string
    user: Record<string, unknown>
    active_account: Record<string, unknown>
  }>("/accounts/login/", {
    method: "POST",
    body: JSON.stringify(data),
  })

  if (response.data) {
    localStorage.setItem("access_token", response.data.access)
    localStorage.setItem("refresh_token", response.data.refresh)
    localStorage.setItem("account_type", data.account_type)
    localStorage.setItem("login_type", data.account_type === "demo" ? "demo" : "real")
    const normalizedUser = {
      ...response.data.user,
      accounts: (response.data.user as Record<string, unknown>).accounts
        ? ((response.data.user as Record<string, unknown>).accounts as Array<Record<string, unknown>>).map((acc) => ({
            ...acc,
            balance: Number(acc.balance) || 0,
          }))
        : [],
    }
    localStorage.setItem("user_session", JSON.stringify(normalizedUser))
    const defaultAccount =
      (normalizedUser.accounts as Array<Record<string, unknown>>).find(
        (acc) => acc.account_type === data.account_type,
      ) || (normalizedUser.accounts as Array<Record<string, unknown>>)[0]
    if (defaultAccount) {
      localStorage.setItem("active_account_id", (defaultAccount.id as number).toString())
    }
  }

  return response
}

export const createAdditionalAccount = async (data: { account_type: string }) => {
  const response = await apiRequest<{ user: Record<string, unknown>; active_account: Record<string, unknown> }>(
    "/accounts/account/create/",
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  )

  if (response.data) {
    const { user, active_account } = response.data
    if (user && active_account) {
      const normalizedUser = {
        ...user,
        accounts: (user.accounts as Array<Record<string, unknown>>).map((acc) => ({
          ...acc,
          balance: Number(acc.balance) || 0,
        })),
      }
      localStorage.setItem("user_session", JSON.stringify(normalizedUser))
      localStorage.setItem("account_type", (active_account.account_type as string) || "")
      localStorage.setItem("login_type", (active_account.account_type as string) === "demo" ? "demo" : "real")
      localStorage.setItem("active_account_id", (active_account.id as number).toString())
      return { data: { user: normalizedUser, active_account }, status: response.status }
    }
  }

  return response
}

export const getAccount = () => apiRequest("/accounts/account/")

export const switchAccount = async (data: { account_id: number }) => {
  const response = await apiRequest<{ user: Record<string, unknown>; account: Record<string, unknown> }>(
    "/accounts/wallet/switch/",
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  )

  if (response.data) {
    const { user, account } = response.data
    if (user && account) {
      const normalizedUser = {
        ...user,
        accounts: (user.accounts as Array<Record<string, unknown>>).map((acc) => ({
          ...acc,
          balance: Number(acc.balance) || 0,
        })),
      }
      localStorage.setItem("user_session", JSON.stringify(normalizedUser))
      localStorage.setItem("account_type", (account.account_type as string) || "")
      localStorage.setItem("login_type", (account.account_type as string) === "demo" ? "demo" : "real")
      localStorage.setItem("active_account_id", data.account_id.toString())
      return { data: { user, account }, status: 200 }
    }
  }

  return response
}

export const getMarkets = () => apiRequest("/trading/markets/")

export const getTradeTypes = () => apiRequest("/trading/trade-types/")

export const getAssets = () => apiRequest("/trading/assets/")

export const placeTrade = (data: Record<string, unknown>) =>
  apiRequest("/trading/trades/place/", { method: "POST", body: JSON.stringify(data) })

export const getTradeHistory = () => apiRequest("/trading/trades/history/")

export const cancelTrade = (tradeId: number) => apiRequest(`/trading/trades/${tradeId}/cancel/`, { method: "POST" })

export const getPriceHistory = (data: { symbol: string; timeframe: string }) =>
  apiRequest("/trading/price-history/", { method: "POST", body: JSON.stringify(data) })

export const getRobots = () => apiRequest("/trading/robots/")

export const getUserRobots = () => apiRequest("/trading/user-robots/")

export const purchaseRobot = (robotId: number) => apiRequest(`/trading/purchase/${robotId}/`, { method: "POST" })

export const resetDemoBalance = () => apiRequest("/accounts/demo/reset/", { method: "POST" })

export const getBots = () => apiRequest("/bots/")

export const createBot = (data: Record<string, unknown>) =>
  apiRequest("/bots/", { method: "POST", body: JSON.stringify(data) })

export const toggleBot = (botId: number) => apiRequest(`/bots/${botId}/toggle/`, { method: "POST" })

export const getSubscription = () => apiRequest("/bots/subscription/")

export const subscribe = () => apiRequest("/bots/subscription/", { method: "POST" })

export const getDashboard = async () => {
  const response = await apiRequest<{ user?: Record<string, unknown> }>("/dashboard/")
  if (response.data) {
    const { user } = response.data
    if (user && (user.accounts as Array<Record<string, unknown>>) && Array.isArray(user.accounts)) {
      const normalizedUser = {
        ...user,
        accounts: ((user.accounts as Array<Record<string, unknown>>) || []).map((acc) => ({
          ...acc,
          balance: Number(acc.balance) || 0,
        })),
      }
      localStorage.setItem("user_session", JSON.stringify(normalizedUser))
      const defaultAccount =
        (normalizedUser.accounts as Array<Record<string, unknown>>).find(
          (acc) => acc.account_type === localStorage.getItem("account_type"),
        ) || (normalizedUser.accounts as Array<Record<string, unknown>>)[0]
      if (defaultAccount) {
        localStorage.setItem("active_account_id", (defaultAccount.id as number).toString())
      }
    }
  }
  return response
}

export const getWallets = async () => {
  const response = await apiRequest<{ wallets: Wallet[] }>("/wallet/wallets/")
  if (response.data && response.data.wallets) {
    response.data.wallets = response.data.wallets.map((wallet: Wallet) => ({
      ...wallet,
      balance: Number(wallet.balance) || 0,
    }))
  }
  return response
}

export const getForexCurrentPrices = (pairIds: number[]) =>
  apiRequest(`/forex/current-prices/?ids=${pairIds.join(",")}`)

export const getWalletTransactions = () => apiRequest<{ transactions: WalletTransaction[] }>("/wallet/transactions/")

export const deposit = (data: {
  amount: number
  currency: string
  wallet_type: string
  mpesa_phone: string
  account_type: string
}) => apiRequest("/wallet/deposit/", { method: "POST", body: JSON.stringify(data) })

export const withdrawOTP = (data: { amount: number; wallet_type: string; account_type: string }) =>
  apiRequest("/wallet/withdraw/otp/", { method: "POST", body: JSON.stringify(data) })

export const verifyWithdrawal = (data: { code: string; transaction_id: number }) =>
  apiRequest("/wallet/withdraw/verify/", { method: "POST", body: JSON.stringify(data) })

export const getMpesaNumber = () => apiRequest<MpesaNumberResponse>("/wallet/mpesa-number/")

export const setMpesaNumber = (data: { phone_number: string }) =>
  apiRequest("/wallet/mpesa-number/", { method: "POST", body: JSON.stringify(data) })

export const resendOTP = (transactionId: string) =>
  apiRequest("/wallet/resend-otp/", { method: "POST", body: JSON.stringify({ transaction_id: transactionId }) })

// Forex Trading API
export const getForexPairs = () => apiRequest<{ pairs: ForexPair[] }>("/forex/pairs/")

export const getForexCurrentPrice = (pairId: number) =>
  apiRequest<{ current_price: number }>(`/forex/current-price/${pairId}/`)

export const placeForexOrder = (data: {
  pair_id: number
  direction: "buy" | "sell"
  volume_lots: number
  sl?: number
  tp?: number
}) => apiRequest<{ position: Position }>("/forex/orders/place/", { method: "POST", body: JSON.stringify(data) })

export const getForexPositions = () => apiRequest<{ positions: Position[] }>("/forex/positions/")

export const closeForexPosition = (positionId: number) =>
  apiRequest<{ message: string }>(`/forex/positions/${positionId}/close/`, { method: "POST" })

export const closeAllPositions = () =>
  apiRequest<{ message: string }>("/forex/positions/close-all/", { method: "POST" })

export const getForexHistory = () => apiRequest<{ trades: ForexTrade[] }>("/forex/history/")

export const api = {
  signup,
  login,
  getAccount,
  createAccount: createAdditionalAccount,
  switchAccount,
  getMarkets,
  getTradeTypes,
  getAssets,
  placeTrade,
  getTradeHistory,
  cancelTrade,
  getPriceHistory,
  getRobots,
  getUserRobots,
  purchaseRobot,
  resetDemoBalance,
  getBots,
  createBot,
  toggleBot,
  getSubscription,
  subscribe,
  getDashboard,
  getWallets,
  getWalletTransactions,
  deposit,
  withdrawOTP,
  verifyWithdrawal,
  getMpesaNumber,
  setMpesaNumber,
  resendOTP,
  getForexPairs,
  getForexCurrentPrices,
  getForexCurrentPrice,
  placeForexOrder,
  getForexPositions,
  closeForexPosition,
  getForexHistory,
  closeAllPositions,
}
