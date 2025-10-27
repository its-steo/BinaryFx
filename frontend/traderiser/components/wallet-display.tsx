// components/wallet-display.tsx
"use client"

import { Wallet } from "lucide-react"
import { Card } from "@/components/ui/card"
import { useEffect, useState } from "react"
import { api } from "@/lib/api"

export default function WalletDisplay() {
  const [balance, setBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBalance = async () => {
    try {
      const token = localStorage.getItem("access_token")
      if (!token) throw new Error("No auth token")

      const res = await api.getWallets()
      if (res.error) throw new Error(res.error)

      const proFxWallet = res.data?.wallets.find(
        (w) => w.account_type === "pro-fx" && w.wallet_type === "main" && w.currency.code === "USD"
      )
      setBalance(proFxWallet ? (Number(proFxWallet.balance) || 0) : 0)
      setLoading(false)
    } catch (e) {
      console.error("Fetch balance error:", e)
      setError("Failed to load balance")
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBalance()
    const interval = setInterval(fetchBalance, 60000) // Poll every 60s
    const handleSessionUpdate = () => fetchBalance() // Listen for session updates
    window.addEventListener("session-updated", handleSessionUpdate)
    return () => {
      clearInterval(interval)
      window.removeEventListener("session-updated", handleSessionUpdate)
    }
  }, [])

  return (
    <Card className="px-3 py-1.5 flex items-center gap-2 bg-primary/10">
      <Wallet className="w-4 h-4 text-primary" />
      <div className="text-sm">
        <p className="text-muted-foreground">FX Wallet</p>
        <p className="font-bold text-primary">
          {loading ? "…" : error ? "Error" : `$${balance?.toFixed(2) ?? "0.00"}`}
        </p>
      </div>
    </Card>
  )
}