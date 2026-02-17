"use client"

export default function Page() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white px-6">
      <div className="text-center max-w-2xl">
        <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-pink-500 to-red-500 bg-clip-text text-transparent">
          DAMNNNN 😭
        </h1>

        <p className="text-2xl md:text-3xl font-semibold text-white/80 mb-8">
          We have officially been scammed by the markets.
        </p>

        <div className="space-y-4 text-lg text-white/60">
          <p>📉 Forex humbled us.</p>
          <p>💀 Crypto finished us.</p>
          <p>📊 Indices said “skill issue.”</p>
        </div>

        <div className="mt-12 p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl">
          <p className="text-2xl font-bold mb-4 text-red-400">
            From today onwards…
          </p>

          <p className="text-3xl md:text-4xl font-extrabold text-white">
            We are selling nudes.
          </p>

          <p className="mt-6 text-white/50 text-sm">
            Trading career: 2024 – 2026 🪦  
            Risk management left the chat.
          </p>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="mt-10 px-8 py-3 rounded-xl bg-gradient-to-r from-pink-600 to-red-600 hover:scale-105 transition-transform font-semibold"
        >
          Start New Life 🔥
        </button>
      </div>
    </div>
  )
}
