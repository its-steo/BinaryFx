"use client"

import CopyButton from "./copy-button"

interface PaymentInfoDisplayProps {
  method: string
  agent: {
    paypal_email?: string
    bank_name?: string
    bank_account_name?: string
    bank_account_number?: string
    bank_swift?: string
    mpesa_phone?: string
  }
}

export default function PaymentInfoDisplay({ method, agent }: PaymentInfoDisplayProps) {
  if (method.toLowerCase() === "paypal") {
    return (
      <div className="space-y-3 bg-indigo-50 p-3 sm:p-4 rounded-lg border border-indigo-200">
        <p className="text-xs sm:text-sm font-semibold text-indigo-900">Send payment to PayPal:</p>
        <div className="flex items-center justify-between gap-2 bg-white p-2 sm:p-3 rounded border border-indigo-100">
          <span className="text-xs sm:text-sm font-mono text-indigo-600 truncate">{agent.paypal_email || "N/A"}</span>
          {agent.paypal_email && <CopyButton text={agent.paypal_email} label="Email" className="flex-shrink-0" />}
        </div>
      </div>
    )
  }

  if (method.toLowerCase() === "bank") {
    return (
      <div className="space-y-3 bg-emerald-50 p-3 sm:p-4 rounded-lg border border-emerald-200">
        <p className="text-xs sm:text-sm font-semibold text-emerald-900">Bank Transfer Details:</p>

        <div className="space-y-2">
          {/* Bank Name */}
          {agent.bank_name && (
            <div className="flex items-center justify-between gap-2 bg-white p-2 sm:p-3 rounded border border-emerald-100">
              <div>
                <p className="text-xs text-emerald-700 font-medium">Bank Name</p>
                <p className="text-xs sm:text-sm font-mono text-emerald-600">{agent.bank_name}</p>
              </div>
              <CopyButton text={agent.bank_name} label="Bank" className="flex-shrink-0" />
            </div>
          )}

          {/* Account Name */}
          {agent.bank_account_name && (
            <div className="flex items-center justify-between gap-2 bg-white p-2 sm:p-3 rounded border border-emerald-100">
              <div>
                <p className="text-xs text-emerald-700 font-medium">Account Name</p>
                <p className="text-xs sm:text-sm font-mono text-emerald-600">{agent.bank_account_name}</p>
              </div>
              <CopyButton text={agent.bank_account_name} label="Name" className="flex-shrink-0" />
            </div>
          )}

          {/* Account Number */}
          {agent.bank_account_number && (
            <div className="flex items-center justify-between gap-2 bg-white p-2 sm:p-3 rounded border border-emerald-100">
              <div>
                <p className="text-xs text-emerald-700 font-medium">Account Number</p>
                <p className="text-xs sm:text-sm font-mono text-emerald-600 break-all">{agent.bank_account_number}</p>
              </div>
              <CopyButton text={agent.bank_account_number} label="Acc No" className="flex-shrink-0" />
            </div>
          )}

          {/* SWIFT Code */}
          {agent.bank_swift && (
            <div className="flex items-center justify-between gap-2 bg-white p-2 sm:p-3 rounded border border-emerald-100">
              <div>
                <p className="text-xs text-emerald-700 font-medium">SWIFT Code</p>
                <p className="text-xs sm:text-sm font-mono text-emerald-600">{agent.bank_swift}</p>
              </div>
              <CopyButton text={agent.bank_swift} label="SWIFT" className="flex-shrink-0" />
            </div>
          )}
        </div>
      </div>
    )
  }

  if (method.toLowerCase() === "mpesa") {
    return (
      <div className="space-y-3 bg-blue-50 p-3 sm:p-4 rounded-lg border border-blue-200">
        <p className="text-xs sm:text-sm font-semibold text-blue-900">Send M-Pesa to:</p>
        <div className="flex items-center justify-between gap-2 bg-white p-2 sm:p-3 rounded border border-blue-100">
          <span className="text-xs sm:text-sm font-mono text-blue-600">{agent.mpesa_phone || "N/A"}</span>
          {agent.mpesa_phone && <CopyButton text={agent.mpesa_phone} label="Phone" className="flex-shrink-0" />}
        </div>
      </div>
    )
  }

  return null
}
