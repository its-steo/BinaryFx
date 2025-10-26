// app/robots/page.tsx
"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { RobotMarketplace } from "@/components/robots/robot-marketplace";
import { UserRobots } from "@/components/robots/user-robots";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/format-currency"


interface DashboardData {
  user: { username: string };
  accounts: Array<{ account_type: string; balance: number }>;
}

export default function RobotsPage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data, error: apiError } = await api.getDashboard();
        if (apiError) throw new Error(apiError as string);

        const dashboard = data as DashboardData;
        setDashboardData(dashboard);

        const accountType = localStorage.getItem("account_type") || "standard";
        const account = dashboard.accounts.find((a) => a.account_type === accountType);
        const bal = account?.balance || 0;
        setBalance(bal);

        // Update session
        localStorage.setItem(
          "user_session",
          JSON.stringify({
            username: dashboard.user.username,
            balance: bal,
            accountType: accountType === "standard" ? "real" : "demo",
          })
        );
        window.dispatchEvent(new Event("custom-storage-change"));
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
          <p className="text-white text-xl">Loading robots...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen text-red-400">
        <div className="text-center max-w-md p-6">
          <div className="text-6xl mb-4">Warning</div>
          <h2 className="text-xl font-bold mb-2">Error</h2>
          <p className="mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-lg font-bold"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 md:p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Trading Robots</h1>
        <p className="text-white/60">Purchase and manage automated trading robots</p>
      </div>

      {/* Balance Card */}
      <div className="rounded-2xl p-6 bg-white/10 backdrop-blur-md border border-white/20">
        <p className="text-sm text-white/60 mb-2">Account Balance</p>
        <p className="text-4xl font-bold">${formatCurrency(balance)}</p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="marketplace" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8 bg-white/10 border border-white/20">
          <TabsTrigger
            value="marketplace"
            className="data-[state=active]:bg-pink-500 data-[state=active]:text-white"
          >
            Marketplace
          </TabsTrigger>
          <TabsTrigger
            value="my-robots"
            className="data-[state=active]:bg-pink-500 data-[state=active]:text-white"
          >
            My Robots
          </TabsTrigger>
        </TabsList>

        <TabsContent value="marketplace">
          <RobotMarketplace balance={balance} onBalanceChange={setBalance} />
        </TabsContent>

        <TabsContent value="my-robots">
          <UserRobots />
        </TabsContent>
      </Tabs>
    </div>
  );
}