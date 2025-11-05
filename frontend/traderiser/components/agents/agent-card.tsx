"use client"

import { Star, MapPin, Shield } from "lucide-react"
import Image from "next/image"
import { useState } from "react"
import DepositModal from "./deposit-modal"
import WithdrawalModal from "./withdrawal-modal"
import PaymentInfoDisplay from "./payment-info-display"

interface AgentCardProps {
  agent: {
    id: number
    name: string
    method: string
    location: string
    rating: number
    reviews: number
    deposit_rate_kes_to_usd: number
    withdrawal_rate_usd_to_kes: number
    min_amount?: number
    max_amount?: number
    response_time?: string
    verified: boolean
    image?: string
    instructions?: string
    paypal_email?: string
    bank_name?: string
    bank_account_name?: string
    bank_account_number?: string
    bank_swift?: string
    mpesa_phone?: string
  }
}

export default function AgentCard({ agent }: AgentCardProps) {
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false)

  const getMethodBadge = (method: string) => {
    const badges: Record<string, { label: string; color: string; bgColor: string }> = {
      mpesa: { label: "M-Pesa", color: "text-blue-700", bgColor: "bg-blue-50" },
      paypal: {
        label: "PayPal",
        color: "text-indigo-700",
        bgColor: "bg-indigo-50",
      },
      bank: {
        label: "Bank",
        color: "text-emerald-700",
        bgColor: "bg-emerald-50",
      },
    }
    return (
      badges[method.toLowerCase()] || {
        label: method,
        color: "text-slate-700",
        bgColor: "bg-slate-50",
      }
    )
  }

  const badge = getMethodBadge(agent.method)

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-lg hover:border-purple-300 transition-all duration-300 flex flex-col h-full">
      {/* Header with Agent Info */}
      <div className="p-4 sm:p-6 border-b border-slate-200">
        <div className="flex items-start justify-between gap-3 sm:gap-4">
          <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
            {/* Agent Image */}
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0">
              <Image
                src={agent.image || "/placeholder-agent.jpg"}
                alt={agent.name}
                className="w-full h-full object-cover rounded-lg"
                fill
              />
            </div>

            {/* Agent Details */}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate">{agent.name}</h3>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-slate-600">
                <MapPin className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                <span className="truncate">{agent.location}</span>
              </div>

              <div className="flex items-center gap-1 sm:gap-1.5">
                <div className="flex items-center gap-0.5 sm:gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3 h-3 sm:w-4 sm:h-4 ${
                        i < Math.floor(agent.rating) ? "text-yellow-400 fill-yellow-400" : "text-slate-200"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs sm:text-sm text-slate-600 ml-1">
                  {agent.rating.toFixed(1)} ({agent.reviews})
                </span>
              </div>
            </div>
          </div>

          {/* Method Badge */}
          <div
            className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${badge.color} ${badge.bgColor} whitespace-nowrap`}
          >
            {badge.label}
          </div>
        </div>
      </div>

      {/* Rates */}
      <div className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200">
        {/* Deposit Rate */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-3 sm:p-4 rounded-xl">
          <p className="text-xs text-slate-600 mb-1 sm:mb-2">Deposit Rate</p>
          <p className="font-bold text-lg sm:text-xl text-purple-600">
            {Number(agent.deposit_rate_kes_to_usd).toFixed(2)}
          </p>
          <p className="text-xs text-slate-500 mt-1">KES/USD</p>
        </div>
        {/* Withdrawal Rate */}
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-3 sm:p-4 rounded-xl">
          <p className="text-xs text-slate-600 mb-1 sm:mb-2">Withdrawal Rate</p>
          <p className="font-bold text-lg sm:text-xl text-slate-700">
            {Number(agent.withdrawal_rate_usd_to_kes).toFixed(2)}
          </p>
          <p className="text-xs text-slate-500 mt-1">KES/USD</p>
        </div>
      </div>

      <div className="p-4 sm:p-6 border-b border-slate-200">
        <PaymentInfoDisplay method={agent.method} agent={agent} />
      </div>

      {/* Verified Badge */}
      {agent.verified && (
        <div className="px-4 sm:px-6 py-2 sm:py-3 bg-green-50 border-b border-slate-200">
          <div className="flex items-center gap-1 sm:gap-2 text-green-700">
            <Shield className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="text-xs sm:text-sm font-medium">Verified Agent</span>
          </div>
        </div>
      )}

      {/* Response Time */}
      {agent.response_time && (
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200">
          <p className="text-xs text-slate-600 mb-1 sm:mb-2 font-semibold">Response Time</p>
          <p className="text-xs sm:text-sm font-medium text-slate-900">{agent.response_time}</p>
        </div>
      )}

      {/* Transaction Limits */}
      {(agent.min_amount || agent.max_amount) && (
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200">
          <p className="text-xs text-slate-600 mb-1 sm:mb-2 font-semibold">Transaction Limits</p>
          <p className="text-xs sm:text-sm font-medium text-slate-900">
            {agent.min_amount ? `${Number(agent.min_amount).toLocaleString()}` : "No min"} -{" "}
            {agent.max_amount ? `${Number(agent.max_amount).toLocaleString()}` : "No max"}
          </p>
        </div>
      )}

      {/* Agent Instructions */}
      {agent.instructions && (
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 bg-blue-50">
          <p className="text-xs text-blue-700 line-clamp-2">{agent.instructions}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="px-4 sm:px-6 py-4 mt-auto flex gap-2 sm:gap-3">
        <button
          onClick={() => setShowDepositModal(true)}
          className="flex-1 py-2.5 sm:py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold text-xs sm:text-base transition-colors duration-200"
        >
          Deposit
        </button>
        <button
          onClick={() => setShowWithdrawalModal(true)}
          className="flex-1 py-2.5 sm:py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-base transition-colors duration-200"
        >
          Withdraw
        </button>
      </div>

      {/* Modals */}
      {showDepositModal && (
        <DepositModal
          agent={agent}
          onClose={() => setShowDepositModal(false)}
          onSuccess={() => setShowDepositModal(false)}
        />
      )}
      {showWithdrawalModal && (
        <WithdrawalModal
          agent={agent}
          onClose={() => setShowWithdrawalModal(false)}
          onSuccess={() => setShowWithdrawalModal(false)}
        />
      )}
    </div>
  )
}
