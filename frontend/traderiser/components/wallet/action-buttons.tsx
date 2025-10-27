"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import type { Wallet } from "@/lib/api"

export function ActionButtons({ onDeposit, onWithdraw }: { onDeposit: () => void; onWithdraw: () => void }) {
  const [isDemo, setIsDemo] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasValidWallet, setHasValidWallet] = useState(false)

  useEffect(() => {
    const currentAccountType = localStorage.getItem("account_type") || "standard"
    // Initial isDemo based on localStorage (fallback if fetch fails)
    setIsDemo(currentAccountType === "demo")

    const fetchWallets = async () => {
      try {
        const res = await api.getWallets()
        if (res.error) throw new Error(res.error)
        const mainWallet = res.data?.wallets.find(
          (w: Wallet) => w.wallet_type === "main" && w.account_type === currentAccountType
        )
        if (mainWallet) {
          setIsDemo(mainWallet.account_type === "demo")
          setBalance(Number(mainWallet.balance) || 0)
          setHasValidWallet(true)
        } else {
          console.warn(`No main wallet found for account type: ${currentAccountType}`)
          setHasValidWallet(false)
          setBalance(0)
          // Fallback to localStorage for isDemo
          setIsDemo(currentAccountType === "demo")
        }
      } catch (error) {
        console.error("Failed to fetch wallets:", error)
        setHasValidWallet(false)
        setBalance(0)
        // Fallback to localStorage for isDemo
        setIsDemo(currentAccountType === "demo")
      } finally {
        setLoading(false)
      }
    }

    fetchWallets()
  }, [])

  return (
    <div className="flex gap-4">
      <button
        onClick={onDeposit}
        disabled={loading || (isDemo && hasValidWallet)} // Deposit enabled for real accounts
        className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-semibold py-3 px-6 rounded-xl transition-colors duration-200 shadow-md hover:shadow-lg"
        title={isDemo && hasValidWallet ? "Deposits are not available in demo mode" : ""}
      >
        Deposit
      </button>
      <button
        onClick={onWithdraw}
        disabled={loading || (isDemo && hasValidWallet) || balance === 0} // Withdraw disabled if balance is 0
        className="flex-1 bg-white hover:bg-slate-50 disabled:bg-slate-200 text-slate-900 font-semibold py-3 px-6 rounded-xl border-2 border-slate-200 transition-colors duration-200 shadow-sm hover:shadow-md"
        title={balance === 0 ? "No balance available to withdraw" : isDemo && hasValidWallet ? "Withdrawals are not available in demo mode" : ""}
      >
        Withdraw
      </button>
    </div>
  )
}