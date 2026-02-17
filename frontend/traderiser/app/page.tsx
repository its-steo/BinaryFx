"use client"

import Image from "next/image"

export default function Page() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6 py-16">
      <div className="max-w-4xl w-full text-center">

        {/* Main Heading */}
        <h1 className="text-5xl md:text-7xl font-extrabold mb-6 bg-gradient-to-r from-pink-500 via-red-500 to-yellow-400 bg-clip-text text-transparent animate-pulse">
          DAMMMMMN 😭
        </h1>

        <p className="text-2xl md:text-3xl font-bold text-white/80 mb-4">
          You wanna trade here on TradeRiser?
        </p>

        <p className="text-lg text-white/50 mb-10">
          Be serious.
        </p>

        {/* Image Section */}
        <div className="relative w-full h-[300px] md:h-[400px] mb-10 rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
          <Image
            src="/landing.jpg"
            alt="Chaos"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <p className="text-3xl md:text-5xl font-extrabold text-white text-center px-4">
              Go Wank 
            </p>
          </div>
        </div>

        {/* Funny Section */}
        <div className="space-y-4 text-xl text-white/70">
          <p>Account balance: $0.00</p>
          <p>Risk management: Missing</p>
          <p>Confidence: Delusional</p>
        </div>

        <div className="mt-12 p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl">
          <p className="text-3xl md:text-4xl font-extrabold text-pink-500">
            Go sell nudes.
          </p>

          <p className="mt-4 text-white/50">
            Because trading here? Not today chief.
          </p>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="mt-10 px-10 py-4 rounded-xl bg-gradient-to-r from-pink-600 to-red-600 hover:scale-110 transition-transform font-bold text-lg shadow-xl"
        >
          Try Again Tomorrow 🚀
        </button>

      </div>
    </div>
  )
}
