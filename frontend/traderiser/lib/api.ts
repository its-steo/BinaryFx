// lib/api.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"

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

    if (response.status === 401 && token) {
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

export const signup = (data: { email: string; password: string; account_type?: string }) =>
  apiRequest("/accounts/signup/", { method: "POST", body: JSON.stringify(data) })

export const login = async (data: { email: string; password: string; account_type: string }) => {
  const response = await apiRequest("/accounts/login/", {
    method: "POST",
    body: JSON.stringify(data),
  })

  if (response.data) {
    const { access_token, refresh_token, user } = response.data
    if (access_token) {
      localStorage.setItem("access_token", access_token)
    }
    if (refresh_token) {
      localStorage.setItem("refresh_token", refresh_token)
    }
    if (user) {
      if (!user.accounts || !Array.isArray(user.accounts)) {
        console.error("Login response missing valid accounts:", user)
        return { error: "Invalid account data from server", status: response.status }
      }
      const normalizedUser = {
        ...user,
        accounts: user.accounts.map((acc: any) => ({
          ...acc,
          balance: Number(acc.balance) || 0,
        })),
      }
      localStorage.setItem("user_session", JSON.stringify(normalizedUser))
      localStorage.setItem("account_type", data.account_type)
      localStorage.setItem("login_type", data.account_type === "demo" ? "demo" : "real")
      const defaultAccount = normalizedUser.accounts.find((acc: any) => acc.account_type === data.account_type) || normalizedUser.accounts[0]
      if (defaultAccount) {
        localStorage.setItem("active_account_id", defaultAccount.id.toString())
      }
    }
  }

  return response
}

export const getAccount = () => apiRequest("/accounts/account/")

export const createAccount = (data: { account_type: string }) =>
  apiRequest("/accounts/create-account/", { method: "POST", body: JSON.stringify(data) })

export const switchAccount = async (data: { account_id: number }) => {
  const response = await apiRequest<{ user?: any; account?: any }>("/accounts/switch/", {
    method: "POST",
    body: JSON.stringify(data),
  })

  if (response.data && response.data.user && response.data.user.accounts && Array.isArray(response.data.user.accounts)) {
    const normalizedUser = {
      ...response.data.user,
      accounts: response.data.user.accounts.map((acc: any) => ({
        ...acc,
        balance: Number(acc.balance) || 0,
      })),
    }
    localStorage.setItem("user_session", JSON.stringify(normalizedUser))
    localStorage.setItem("active_account_id", data.account_id.toString())
    const account = normalizedUser.accounts.find((acc: any) => acc.id === data.account_id)
    if (account) {
      localStorage.setItem("account_type", account.account_type)
      localStorage.setItem("login_type", account.account_type === "demo" ? "demo" : "real")
    }
  } else if (response.error) {
    console.warn("Switch account API failed, using local data:", response.error)
    const userSession = localStorage.getItem("user_session")
    if (userSession) {
      const user = JSON.parse(userSession)
      const account = user.accounts?.find((acc: any) => acc.id === data.account_id)
      if (account) {
        localStorage.setItem("account_type", account.account_type)
        localStorage.setItem("login_type", account.account_type === "demo" ? "demo" : "real")
        localStorage.setItem("active_account_id", data.account_id.toString())
        return { data: { user, account }, status: 200 }
      }
    }
  }

  return response
}

export const getMarkets = () => apiRequest("/trading/markets/")

export const getTradeTypes = () => apiRequest("/trading/trade-types/")

export const getAssets = () => apiRequest("/trading/assets/")

export const placeTrade = (data: any) =>
  apiRequest("/trading/trades/place/", { method: "POST", body: JSON.stringify(data) })

export const getTradeHistory = () => apiRequest("/trading/trades/history/")

export const cancelTrade = (tradeId: number) =>
  apiRequest(`/trading/trades/${tradeId}/cancel/`, { method: "POST" })

export const getPriceHistory = (data: { symbol: string; timeframe: string }) =>
  apiRequest("/trading/price-history/", { method: "POST", body: JSON.stringify(data) })

export const getRobots = () => apiRequest("/trading/robots/")

export const getUserRobots = () => apiRequest("/trading/user-robots/")

export const purchaseRobot = (robotId: number) =>
  apiRequest(`/trading/purchase/${robotId}/`, { method: "POST" })

export const resetDemoBalance = () => apiRequest("/accounts/demo/reset/", { method: "POST" })

export const getBots = () => apiRequest("/bots/")

export const createBot = (data: any) =>
  apiRequest("/bots/", { method: "POST", body: JSON.stringify(data) })

export const toggleBot = (botId: number) =>
  apiRequest(`/bots/${botId}/toggle/`, { method: "POST" })

export const getSubscription = () => apiRequest("/bots/subscription/")

export const subscribe = () => apiRequest("/bots/subscription/", { method: "POST" })

export const getDashboard = async () => {
  const response = await apiRequest("/dashboard/")
  if (response.data) {
    const { user } = response.data
    if (user && user.accounts && Array.isArray(user.accounts)) {
      const normalizedUser = {
        ...user,
        accounts: user.accounts.map((acc: any) => ({
          ...acc,
          balance: Number(acc.balance) || 0,
        })),
      }
      localStorage.setItem("user_session", JSON.stringify(normalizedUser))
      const defaultAccount = normalizedUser.accounts.find((acc: any) => acc.account_type === localStorage.getItem("account_type")) || normalizedUser.accounts[0]
      if (defaultAccount) {
        localStorage.setItem("active_account_id", defaultAccount.id.toString())
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

export const getWalletTransactions = () => apiRequest<{ transactions: WalletTransaction[] }>("/wallet/transactions/")

export const deposit = (data: { amount: number; currency: string; wallet_type: string; mpesa_phone: string; account_type: string }) =>
  apiRequest("/wallet/deposit/", { method: "POST", body: JSON.stringify(data) })

export const withdraw = (data: { amount: number; wallet_type: string; target_currency: string }) =>
  apiRequest("/wallet/withdraw/otp/", { method: "POST", body: JSON.stringify(data) })

export const verifyWithdrawal = (data: { otp: string; wallet_type: string; transaction_id: string }) =>
  apiRequest("/wallet/withdraw/verify/", { method: "POST", body: JSON.stringify(data) })

export const getMpesaNumber = () => apiRequest<MpesaNumberResponse>("/wallet/mpesa-number/")

export const setMpesaNumber = (data: { phone_number: string }) =>
  apiRequest("/wallet/mpesa-number/", { method: "POST", body: JSON.stringify(data) })

export const resendOTP = (data: { wallet_type: string }) =>
  apiRequest("/wallet/withdraw/resend-otp/", { method: "POST", body: JSON.stringify(data) })

export const api = {
  signup,
  login,
  getAccount,
  createAccount,
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
  withdraw,
  verifyWithdrawal,
  getMpesaNumber,
  setMpesaNumber,
  resendOTP,
}