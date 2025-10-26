"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import type { Wallet } from "@/lib/api"

export function ActionButtons({ onDeposit, onWithdraw }: { onDeposit: () => void; onWithdraw: () => void }) {
  const [isDemo, setIsDemo] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchWallets = async () => {
      try {
        const res = await api.getWallets()
        if (res.error) throw new Error(res.error)
        const mainWallet = res.data?.wallets.find((w: Wallet) => w.wallet_type === "main")
        setIsDemo(mainWallet?.account_type === "demo")
      } catch (error) {
        console.error("Failed to fetch wallets:", error)
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
        disabled={loading || isDemo}
        className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-semibold py-3 px-6 rounded-xl transition-colors duration-200 shadow-md hover:shadow-lg"
      >
        Deposit
      </button>
      <button
        onClick={onWithdraw}
        disabled={loading || isDemo}
        className="flex-1 bg-white hover:bg-slate-50 disabled:bg-slate-200 text-slate-900 font-semibold py-3 px-6 rounded-xl border-2 border-slate-200 transition-colors duration-200 shadow-sm hover:shadow-md"
      >
        Withdraw
      </button>
    </div>
  )
}
