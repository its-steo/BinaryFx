// app/dashboard/layout.tsx
"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { TopNavbar } from "@/components/top-navbar";
import { toast } from "sonner";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [user, setUser] = useState<any>(null);
  const [activeAccount, setActiveAccount] = useState<any>(null);
  const [loginType, setLoginType] = useState<string>("real");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSession = () => {
      setIsLoading(true);
      setError(null);
      const raw = localStorage.getItem("user_session");

      if (!raw) {
        setIsLoggedIn(false);
        setUser(null);
        setActiveAccount(null);
        setError("No session data found. Please log in.");
        setIsLoading(false);
        toast.error("No session data found. Please log in.");
        window.location.href = "/login";
        return;
      }

      try {
        const data = JSON.parse(raw);
        if (!data || !data.accounts || !Array.isArray(data.accounts)) {
          throw new Error("Invalid session data: accounts missing or not an array");
        }

        // Ensure balance is a number
        const normalizedUser = {
          ...data,
          accounts: data.accounts.map((acc: any) => ({
            ...acc,
            balance: Number(acc.balance) || 0,
          })),
        };

        setIsLoggedIn(true);
        setUser(normalizedUser);
        const activeId = localStorage.getItem("active_account_id");
        const account = normalizedUser.accounts.find((acc: any) => acc.id === Number(activeId)) ||
                       normalizedUser.accounts.find((acc: any) => acc.account_type === "standard") ||
                       normalizedUser.accounts[0];

        if (!account) {
          throw new Error("No valid account found in session data");
        }

        setActiveAccount(account);
        setLoginType(account.account_type === "demo" ? "demo" : "real");
      } catch (error) {
        console.error("Error parsing user_session:", error);
        setIsLoggedIn(false);
        setUser(null);
        setActiveAccount(null);
        setError("Failed to load session. Please log in again.");
        toast.error("Failed to load session. Please log in again.");
        window.location.href = "/login";
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
    window.addEventListener("session-updated", loadSession);
    return () => window.removeEventListener("session-updated", loadSession);
  }, []);

  const handleSwitchAccount = async (account: any) => {
    if (!account) return;
    try {
      localStorage.setItem("active_account_id", account.id.toString());
      localStorage.setItem("account_type", account.account_type);
      localStorage.setItem("login_type", account.account_type === "demo" ? "demo" : "real");

      const updatedUser = {
        ...user,
        accounts: user.accounts.map((acc: any) =>
          acc.id === account.id ? { ...acc, balance: Number(account.balance) || 0 } : acc
        ),
      };
      setUser(updatedUser);
      setActiveAccount(account);
      setLoginType(account.account_type === "demo" ? "demo" : "real");
      localStorage.setItem("user_session", JSON.stringify(updatedUser));
      window.dispatchEvent(new Event("session-updated"));
    } catch (error) {
      console.error("Error switching account:", error);
      setError("Failed to switch account. Please try again.");
      toast.error("Failed to switch account. Please try again.");
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    setIsLoggedIn(false);
    setUser(null);
    setActiveAccount(null);
    setLoginType("real");
    window.location.href = "/login";
  };

  const availableAccounts = loginType === "real"
    ? (user?.accounts || []).filter((acc: any) => acc.account_type !== "demo")
    : (user?.accounts || []).filter((acc: any) => acc.account_type === "demo");

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-white">Loading...</div>;
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center text-red-400">{error}</div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-black text-white">
      <TopNavbar
        isLoggedIn={isLoggedIn}
        user={user}
        accountBalance={Number(activeAccount?.balance) || 0} // Ensure number
        showBalance={true}
        activeAccount={activeAccount}
        accounts={availableAccounts}
        onSwitchAccount={handleSwitchAccount}
        onLogout={handleLogout}
      />
      <Sidebar loginType={loginType} activeAccount={activeAccount} />
      <main className="flex-1 w-full overflow-auto">{children}</main>
    </div>
  );
}