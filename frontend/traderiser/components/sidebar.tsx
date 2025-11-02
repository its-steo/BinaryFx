// components/sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  LogOut,
  Menu,
  X,
  WalletIcon,
  Bot,
  User,
  Zap,
} from "lucide-react";
import { useState, useEffect } from "react";
import type { Account } from "@/types/account";

type LoginType = "real" | "demo" | string;

interface SidebarProps {
  loginType: LoginType;
  activeAccount?: Account | null;
  accounts?: Account[];               // Optional – safe default
  onSwitchAccount?: (account: Account) => void;
}

const ACTIVE_ACCOUNT_KEY = "active_account_id";

export function Sidebar({
  loginType,
  activeAccount: propActiveAccount,
  accounts = [],                    // Default to empty array
  onSwitchAccount,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [hasProFxAccount, setHasProFxAccount] = useState(false);
  const [activeAccount, setActiveAccount] = useState<Account | null>(propActiveAccount ?? null);

  /* -------------------------------------------------
     1. Initialise active account from localStorage
         (handles hard refresh)
     ------------------------------------------------- */
  useEffect(() => {
    const storedId = Number(localStorage.getItem(ACTIVE_ACCOUNT_KEY));
    if (Array.isArray(accounts) && accounts.length > 0) {
      const found = accounts.find((a) => a.id === storedId) ?? accounts[0];
      setActiveAccount(found);
    } else if (propActiveAccount) {
      setActiveAccount(propActiveAccount);
    }
  }, [accounts, propActiveAccount]);

  /* -------------------------------------------------
     2. Listen for account switch from TopNavbar or anywhere
     ------------------------------------------------- */
  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ account: Account }>;
      setActiveAccount(ev.detail.account);
    };
    window.addEventListener("account-switch", handler);
    return () => window.removeEventListener("account-switch", handler);
  }, []);

  /* -------------------------------------------------
     3. Live balance updates (unchanged)
     ------------------------------------------------- */
  useEffect(() => {
    const handler = (e: Event) => {
      const newBalance = (e as CustomEvent).detail;
      setActiveAccount((prev) =>
        prev ? { ...prev, balance: newBalance } : prev
      );
    };
    window.addEventListener("balance-updated", handler);
    return () => window.removeEventListener("balance-updated", handler);
  }, []);

  /* -------------------------------------------------
     4. Detect Pro-FX account presence
     ------------------------------------------------- */
  useEffect(() => {
    const userSession = localStorage.getItem("user_session");
    if (userSession) {
      const user = JSON.parse(userSession);
      setHasProFxAccount(
        user?.accounts?.some((acc: Account) => acc.account_type === "pro-fx") ?? false
      );
    }
  }, []);

  /* -------------------------------------------------
     5. Close mobile menu on route change
     ------------------------------------------------- */
  useEffect(() => setIsOpen(false), [pathname]);

  /* -------------------------------------------------
     6. Close on Escape key
     ------------------------------------------------- */
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setIsOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);

  /* -------------------------------------------------
     7. Logout – clear all session data
     ------------------------------------------------- */
  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("account_type");
    localStorage.removeItem("user_session");
    localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
    localStorage.removeItem("login_type");
    router.push("/login");
  };

  /* -------------------------------------------------
     8. Switch account – update state, storage, dispatch event
     ------------------------------------------------- */
  const switchAccount = (account: Account) => {
    setActiveAccount(account);
    localStorage.setItem(ACTIVE_ACCOUNT_KEY, String(account.id));
    onSwitchAccount?.(account);
    window.dispatchEvent(
      new CustomEvent("account-switch", { detail: { account } })
    );
  };

  /* -------------------------------------------------
     9. Build navigation items based on account type
     ------------------------------------------------- */
  const navItems =
    loginType === "real" && activeAccount
      ? activeAccount.account_type === "pro-fx"
        ? [
            { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
            { href: "/fx-pro-trading", label: "Pro-FX Trading", icon: Zap },
            { href: "/fx-pro-robots", label: "Pro-Robots", icon: Bot },
            { href: "/wallet", label: "Wallet", icon: WalletIcon },
            { href: "/profile", label: "Profile", icon: User },
          ]
        : [
            { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
            { href: "/trading", label: "Trading", icon: TrendingUp },
            { href: "/robots", label: "Robots", icon: Bot },
            { href: "/wallet", label: "Wallet", icon: WalletIcon },
            { href: "/profile", label: "Profile", icon: User },
          ]
      : [
          { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
          { href: "/trading", label: "Trading", icon: TrendingUp },
          ...(hasProFxAccount && loginType === "real"
            ? [{ href: "/fx-pro-trading", label: "Pro-FX Trading", icon: Zap }]
            : []),
          { href: "/robots", label: "Robots", icon: Bot },
          { href: "/wallet", label: "Wallet", icon: WalletIcon },
        ];

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-60 md:hidden bg-gradient-to-r from-pink-500 to-pink-600 p-2 rounded-lg"
      >
        {isOpen ? <X className="w-6 h-6 text-white" /> : <Menu className="w-6 h-6 text-white" />}
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-gradient-to-b from-black to-slate-900 border-r border-white/10 z-50 transform transition-transform duration-300 md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } md:w-64 md:flex md:flex-col md:gap-4 md:p-4 md:pt-0`}
      >
        <div
          className="h-48 w-full bg-cover bg-center relative"
          style={{ backgroundImage: "url('/sidebg.jpg')" }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 to-transparent" />
        </div>

        <div className="flex flex-col gap-4 p-4">
          {/* Current Account Pill */}
          {activeAccount && (
            <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-lg">
              <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-500 rounded-full flex items-center justify-center">
                <LayoutDashboard className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">
                  {activeAccount.account_type.charAt(0).toUpperCase() +
                    activeAccount.account_type.slice(1)}
                </p>
                <p className="text-xs text-white/70">
                  ${(() => {
                    const bal = Number(activeAccount.balance ?? 0);
                    return isNaN(bal) ? "0.00" : bal.toFixed(2);
                  })()}
                </p>
              </div>
            </div>
          )}

          {/* Account Switcher Dropdown (only if >1 account) */}
          {Array.isArray(accounts) && accounts.length > 1 && (
            <select
              value={activeAccount?.id ?? ""}
              onChange={(e) => {
                const acc = accounts.find((a) => a.id === Number(e.target.value));
                if (acc) switchAccount(acc);
              }}
              className="bg-slate-700 text-white px-3 py-2 rounded-lg w-full text-sm"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.account_type.charAt(0).toUpperCase() + acc.account_type.slice(1)} (
                  ${Number(acc.balance).toFixed(2)})
                </option>
              ))}
            </select>
          )}

          {/* Navigation */}
          <nav className="flex flex-col gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all group ${
                    isActive
                      ? "bg-gradient-to-r from-pink-500/30 to-pink-600/30 border border-pink-500/50 text-pink-300 shadow-lg shadow-pink-500/10"
                      : "text-white/70 hover:text-white hover:bg-white/5 hover:border hover:border-white/10"
                  }`}
                >
                  <Icon
                    size={20}
                    className={isActive ? "text-pink-300" : "text-white/70 group-hover:text-white"}
                  />
                  <span className="font-medium">{item.label}</span>
                  {isActive && (
                    <div className="ml-auto w-1 h-8 bg-gradient-to-b from-pink-400 to-pink-600 rounded-full" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer */}
        <div className="absolute bottom-4 left-4 right-4 flex flex-col gap-3">
          <div className="bg-black/60 backdrop-blur-md border border-white/20 rounded-lg px-3 py-2">
            <p className="text-xs font-semibold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-pink-500">
              Trade Riser v1.0
            </p>
            <p className="text-xs text-white/70">Binary FX</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-white/70 hover:text-red-400 hover:bg-red-500/10 transition-all w-full group"
          >
            <LogOut size={20} className="text-white/70 group-hover:text-red-400" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Escape" && setIsOpen(false)}
        />
      )}
    </>
  );
}