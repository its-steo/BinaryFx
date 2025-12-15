// components/wallet/transaction-detail-modal.tsx
"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/format-currency";
import { type WalletTransaction } from "@/lib/api";
import Image from "next/image";

interface TransactionDetailModalProps {
  transaction: WalletTransaction;
  onClose: () => void;
}

export function TransactionDetailModal({ transaction, onClose }: TransactionDetailModalProps) {
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const isDeposit = transaction.transaction_type.toLowerCase() === "deposit";
  const flagSrc = isDeposit ? "/real-account-icon.png" : "/transaction-icon.png";
  const primaryAmount = isDeposit 
    ? `${formatCurrency(transaction.amount)} ${transaction.currency.code}` 
    : `$${formatCurrency(transaction.amount)}`;
  const secondaryAmount = isDeposit 
    ? `$${formatCurrency(transaction.converted_amount || 0)}` 
    : `- ${formatCurrency(transaction.converted_amount || 0)} ${transaction.target_currency?.code || "KSH"}`;
  const derivId = transaction.reference_id 
  ? transaction.reference_id.replace("WT-", "") 
  : "N/A";
  const mpesaId = transaction.checkout_request_id || "TL..";

  const formattedDate = new Date(transaction.created_at).toLocaleString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 mx-4">
        
        {/* Clean & Redesigned Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
            aria-label="Go back"
          >
            <span className="text-2xl font-bold text-slate-900">&lt;</span>
          </button>

          <p className="text-sm font-medium text-slate-600">{formattedDate}</p>

          {/* Invisible symmetric spacer - no comment needed */}
          <div className="w-10 h-10" />
        </div>

        {/* Detail Card - Your original design unchanged */}
        <div className="bg-white rounded-2xl p-6 text-center border border-slate-200">
          <h3 className="text-lg font-bold text-slate-900 mb-4">
            {isDeposit ? "DEPOSIT" : "WITHDRAW"}
          </h3>
          <div className="w-16 h-16 mx-auto mb-4 rounded-full overflow-hidden">
            <Image src={flagSrc} alt="Flag" width={64} height={64} className="object-cover" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mb-2">{primaryAmount}</p>
          <p className="text-xl font-bold text-slate-900 mb-6">{secondaryAmount}</p>
          <p className="text-sm text-slate-600">TRADERISER ID: {derivId}</p>
          <p className="text-sm text-green-600 bg-green-50 inline-block px-3 py-1 rounded-full mt-2">
            M-PESA ID: {mpesaId}
          </p>
        </div>

        {message && (
          <p className={message.type === "error" ? "text-red-600" : "text-green-600"}>{message.text}</p>
        )}
      </div>
    </div>
  );
}