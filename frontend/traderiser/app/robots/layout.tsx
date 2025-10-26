// app/robots/layout.tsx
"use client";

import type React from "react";
import { Sidebar } from "@/components/sidebar"
import { TopNavbar } from "@/components/top-navbar"
import { useState, useEffect } from "react";

interface RobotsLayoutProps {
  children: React.ReactNode;
}

export default function RobotsLayout({ children }: RobotsLayoutProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [balance, setBalance] = useState(0);

  // Load session from localStorage
  useEffect(() => {
    const raw = localStorage.getItem("user_session");
    if (raw) {
      try {
        const data = JSON.parse(raw);
        setIsLoggedIn(true);
        setUser(data);
        setBalance(data.balance ?? 0);
      } catch {
        setIsLoggedIn(false);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("account_type");
    localStorage.removeItem("user_session");
    window.dispatchEvent(new Event("custom-storage-change"));
    setIsLoggedIn(false);
    setUser(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-black text-white">
      {/* Top Navbar */}
      <TopNavbar
                     isLoggedIn={isLoggedIn}
                     user={user}
                     accountBalance={balance}
                     showBalance={true}
                     onLogout={() => {
                       setIsLoggedIn(false)
                       setUser(null)
                       localStorage.removeItem("user_session")
                     }}
                   />
            <Sidebar />
      

      {/* Robots Page Content */}
      <main className="flex-1 w-full overflow-auto">
        {children}
      </main>
    </div>
  );
}