// components/wallet/transaction-list.tsx
"use client"

import { useEffect, useState } from "react"
import { formatCurrency } from "@/lib/format-currency"
import { type WalletTransaction, api } from "@/lib/api"
import { TransactionItem } from "./transaction-items"
import { toast } from "sonner"

export function TransactionList() {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTransactions = async () => {
    try {
      const res = await api.getWalletTransactions()
      if (res.error) throw new Error(res.error)

      // Normalize response to an array of WalletTransaction
      const data: WalletTransaction[] = (() => {
        if (!res.data) return []
        if (Array.isArray(res.data)) return res.data as WalletTransaction[]
        if (typeof res.data === "object" && "transactions" in res.data && Array.isArray((res.data as any).transactions)) {
          return (res.data as any).transactions as WalletTransaction[]
        }
        return []
      })()

      setTransactions(data)
    } catch (error) {
      console.error("Failed to fetch transactions:", error)
      toast.error("Failed to load transactions")
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTransactions()
    const handleSessionUpdate = () => fetchTransactions()
    window.addEventListener("session-updated", handleSessionUpdate)
    return () => window.removeEventListener("session-updated", handleSessionUpdate)
  }, [])

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-200">
        <h3 className="text-lg sm:text-xl font-bold text-slate-900">Transactions</h3>
        <button className="text-purple-600 hover:text-purple-700 font-semibold text-xs sm:text-sm transition-colors">
          View all
        </button>
      </div>

      {/* Transaction Items */}
      <div className="divide-y divide-slate-200">
        {loading ? (
          <div className="p-6 text-center text-slate-500">Loading transactions...</div>
        ) : transactions.length === 0 ? (
          <div className="p-6 text-center text-slate-500">No transactions yet</div>
        ) : (
          transactions.slice(0, 6).map((transaction) => (
            <TransactionItem
              key={transaction.id}
              transaction={{
                id: transaction.id,
                type: transaction.transaction_type.charAt(0).toUpperCase() + transaction.transaction_type.slice(1),
                amount: `${formatCurrency(transaction.amount)} ${transaction.currency.code}`,
                convertedAmount: transaction.converted_amount ? `${formatCurrency(transaction.converted_amount)} ${transaction.target_currency?.code || 'USD'}` : undefined,
                date: new Date(transaction.created_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }),
                transactionType: transaction.transaction_type,
                exchangeRateUsed: transaction.exchange_rate_used,
                status: transaction.status,
                currency: transaction.currency,
                target_currency: transaction.target_currency
              }}
            />
          ))
        )}
      </div>
    </div>
  )
}