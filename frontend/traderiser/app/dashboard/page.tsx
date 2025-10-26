// app/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { BalanceCard } from "@/components/dashboard/balance-card";
import { TransactionHistory } from "@/components/dashboard/transaction-history";
import { TradingViewWidget } from "@/components/dashboard/trading-view";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ActionButtons } from "@/components/dashboard/action-buttons"; // Import ActionButtons

interface DashboardData {
  user: {
    username: string;
    email: string;
    phone: string;
    is_sashi: boolean;
    is_email_verified: boolean;
    accounts: Array<{
      id: number;
      account_type: string;
      balance: number;
      kyc_verified: boolean;
    }>;
  };
  accounts: Array<{
    account_type: string;
    balance: number;
    transactions: Array<{
      id: number;
      amount: number;
      transaction_type: "deposit" | "withdrawal" | "trade";
      description: string;
      created_at: string;
    }>;
  }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBalance, setShowBalance] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<string>("standard");
  const [loginType, setLoginType] = useState<string>("real");

  const showSuccess = (message: string) => toast.success(message);
  const showError = (message: string) => toast.error(message);

  const fetchData = () => {
    setLoading(true);
    api.getDashboard()
      .then((res) => {
        if (res.error) {
          setError(res.error);
          return;
        }
        setData(res.data);
        const activeType = localStorage.getItem("account_type") || "standard";
        setSelectedAccount(activeType);
        setLoginType(activeType === "demo" ? "demo" : "real");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      fetchData();
      const handleSessionUpdate = () => {
        const activeType = localStorage.getItem("account_type") || "standard";
        setSelectedAccount(activeType);
        fetchData();
      };
      window.addEventListener("session-updated", handleSessionUpdate);
      return () => window.removeEventListener("session-updated", handleSessionUpdate);
    }
  }, []);

  const handleResetDemo = async () => {
    try {
      const res = await api.resetDemoBalance({ account_type: selectedAccount });
      if (res.error) throw new Error(res.error);
      showSuccess("Demo balance reset to $10,000");
      window.dispatchEvent(new Event("session-updated"));
    } catch (err: any) {
      showError(err.message || "Failed to reset demo balance");
    }
  };

  const isRealAccount = loginType === "real";
  const selectedAccountData = data?.accounts.find((a) => a.account_type === selectedAccount);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white bg-black">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-white mx-auto mb-4" />
          <p className="text-base sm:text-xl">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-400 bg-black">
        <div className="text-center max-w-md p-4 sm:p-6">
          <div className="text-4xl sm:text-6xl mb-4">⚠️</div>
          <h2 className="text-lg sm:text-xl font-bold mb-2">Error</h2>
          <p className="mb-4 sm:mb-6 text-sm sm:text-base">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 sm:px-6 sm:py-3 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-lg font-bold text-sm sm:text-base"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white px-4 sm:px-6 md:px-8 py-6 sm:py-8">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header and Buttons */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2">Dashboard</h1>
            <p className="text-xs sm:text-sm text-slate-400 capitalize">{selectedAccount} Account</p>
          </div>
          {/* Buttons for md and above (top-right) */}
          <div className="hidden md:flex md:gap-3">
            {isRealAccount ? (
              <ActionButtons />
            ) : (
              <Button
                onClick={handleResetDemo}
                className="bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold hover:shadow-lg transform hover:-translate-y-1 transition-all duration-200 text-sm sm:text-base px-4 sm:px-6 py-2 sm:py-3"
              >
                🔄 Reset Demo Balance to $10,000
              </Button>
            )}
          </div>
        </div>

        {/* Balance Card */}
        <BalanceCard
          balance={selectedAccountData?.balance || 0}
          username={data.user.username}
          isRealAccount={isRealAccount}
          showBalance={showBalance}
          onToggleBalance={() => setShowBalance(!showBalance)}
          accountType={selectedAccount}
        />

        {/* Buttons for smaller screens (below md) */}
        <div className="md:hidden">
          {isRealAccount ? (
            <ActionButtons />
          ) : (
            <Button
              onClick={handleResetDemo}
              className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold hover:shadow-lg transform hover:-translate-y-1 transition-all duration-200 text-sm sm:text-base px-4 sm:px-6 py-2 sm:py-3"
            >
              🔄 Reset Demo Balance to $10,000
            </Button>
          )}
        </div>

        {/* TradingView Widget */}
        <div className="w-full" style={{ minHeight: "300px sm:400px md:450px" }}>
          <TradingViewWidget symbol={selectedAccount === "pro-fx" ? "EURUSD" : "NASDAQ:AAPL"} />
        </div>

        {/* Transaction History */}
        <div className="w-full">
          <TransactionHistory transactions={selectedAccountData?.transactions || []} />
        </div>
      </div>
    </div>
  );
}