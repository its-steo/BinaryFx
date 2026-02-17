"use client"

import Image from "next/image"

export default function Page() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black text-white">

      {/* Fullscreen Background Image */}
      <div className="absolute inset-0">
        <Image
          src="/landing.jpg"
          alt="Chaos"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/70" />
      </div>

      {/* Content Overlay */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen text-center px-6">

        <h1 className="text-5xl md:text-7xl font-extrabold mb-6 bg-gradient-to-r from-pink-500 via-red-500 to-yellow-400 bg-clip-text text-transparent animate-pulse">
          DAMMMMMN 😭
        </h1>

        <p className="text-2xl md:text-4xl font-bold mb-4">
          You wanna trade here on TradeRiser?
        </p>

        <p className="text-lg md:text-xl text-white/70 mb-8">
          Be serious for once.
        </p>

        <div className="space-y-3 text-lg md:text-2xl text-white/80 mb-10">
        </div>

        <div className="text-3xl md:text-5xl font-extrabold text-pink-500 animate-bounce">
          Go sell nudes.
        </div>

        <button
          onClick={() => window.location.reload()}
          className="mt-12 px-10 py-4 rounded-xl bg-gradient-to-r from-pink-600 to-red-600 hover:scale-110 transition-transform font-bold text-lg shadow-2xl"
        >
          Go Wank
        </button>

      </div>
    </div>
  )
}
