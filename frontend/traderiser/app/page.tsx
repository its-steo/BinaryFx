"use client"

import Link from "next/link"
import Image from "next/image"
import { TrendingUp, ChevronRight } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-white/10 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-black" />
            </div>
            <span className="text-xl font-bold text-white">Traderiser</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-white hover:text-white/80 transition-colors">
              Log in
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-2xl space-y-12">
          {/* Hero Section */}
          <div className="text-center space-y-4">
            <div className="flex justify-center mb-6">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center shadow-lg">
                <TrendingUp className="w-12 h-12 text-white" />
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white">Traderiser</h1>
            <p className="text-xl text-white/80">Choose Your Journey</p>
          </div>

          <div className="rounded-3xl p-8 bg-white/10 backdrop-blur-md border border-white/20 shadow-xl">
            <div className="flex flex-col gap-6 md:gap-10">
              {/* Real Account Card */}
              <Link href="/login?type=real">
                <div className="group relative rounded-3xl p-4 md:p-6 bg-gradient-to-br from-orange-100 to-orange-50 hover:shadow-lg transition-all duration-300 cursor-pointer">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 md:w-20 md:h-20 rounded-full  flex items-center justify-center overflow-hidden shadow-md">
                        <Image
                          src="/real-account-icon.png"
                          alt="Real Account"
                          width={64}
                          height={64}
                          className="w-14 h-14 md:w-16 md:h-16 object-cover"
                        />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg md:text-2xl font-bold text-gray-900">Real Account</h3>
                      <p className="text-gray-700 text-xs md:text-sm mt-1">
                        Trade with real money and earn real profits.
                      </p>
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="w-5 h-5 md:w-6 md:h-6 text-gray-900 flex-shrink-0 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>

              {/* Demo Account Card */}
              <Link href="/login?type=demo">
                <div className="group relative rounded-3xl p-4 md:p-6 bg-gradient-to-br from-blue-100 to-blue-50 hover:shadow-lg transition-all duration-300 cursor-pointer">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-11 h-11 md:w-20 md:h-20 rounded-full  flex items-center justify-center overflow-hidden shadow-md">
                        <Image
                          src="/demo-account-icon.png"
                          alt="Demo Account"
                          width={64}
                          height={64}
                          className="w-14 h-14 md:w-16 md:h-16 object-cover"
                        />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg md:text-2xl font-bold text-gray-900">Demo Account</h3>
                      <p className="text-gray-700 text-xs md:text-sm mt-1">
                        Practice trading with $10,000 virtual balance.
                      </p>
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="w-5 h-5 md:w-6 md:h-6 text-gray-900 flex-shrink-0 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}