// app/robots/layout.tsx
"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { TopNavbar } from "@/components/top-navbar";
import { toast } from "sonner";

interface Account {
  id: number;
  account_type: string;
  balance: number;
  kyc_verified?: boolean;
}

interface User {
  username: string;
  email: string;
  phone: string;
  is_sashi: boolean;
  is_email_verified: boolean;
  accounts: Account[];
}

interface RobotsLayoutProps {
  children: React.ReactNode;
}

export default function RobotsLayout({ children }: RobotsLayoutProps) {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [activeAccount, setActiveAccount] = useState<Account | null>(null);
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
        const data: User = JSON.parse(raw);
        if (!data || !data.accounts || !Array.isArray(data.accounts)) {
          throw new Error("Invalid session data: accounts missing or not an array");
        }

        const normalizedUser: User = {
          ...data,
          accounts: data.accounts.map((acc: Account) => ({
            ...acc,
            balance: Number(acc.balance) || 0,
          })),
        };

        setIsLoggedIn(true);
        setUser(normalizedUser);
        const activeId = localStorage.getItem("active_account_id");
        const account =
          normalizedUser.accounts.find((acc: Account) => acc.id === Number(activeId)) ||
          normalizedUser.accounts.find((acc: Account) => acc.account_type === "standard") ||
          normalizedUser.accounts[0];

        if (!account) {
          throw new Error("No valid account found in session data");
        }

        setActiveAccount(account);
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

  const handleLogout = () => {
    localStorage.clear();
    setIsLoggedIn(false);
    setUser(null);
    setActiveAccount(null);
    window.dispatchEvent(new Event("session-updated"));
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen flex flex-col bg-black text-white">
      <TopNavbar
        isLoggedIn={isLoggedIn}
        user={user}
        accountBalance={Number(activeAccount?.balance) || 0}
        showBalance={true}
        activeAccount={activeAccount}
        accounts={user?.accounts || []}
        onSwitchAccount={(account: Account) => {
          localStorage.setItem("active_account_id", account.id.toString());
          localStorage.setItem("account_type", account.account_type);
          setActiveAccount(account);
          window.dispatchEvent(new Event("session-updated"));
        }}
        onLogout={handleLogout}
      />
      <div className="flex flex-1">
        <Sidebar
          loginType={activeAccount?.account_type === "demo" ? "demo" : "real"}
          activeAccount={activeAccount}
        />
        <main className="flex-1 w-full overflow-auto md:pl-64">{children}</main>
      </div>
    </div>
  );
}