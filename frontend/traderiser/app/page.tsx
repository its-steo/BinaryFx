"use client"

import Image from "next/image"

export default function Page() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center px-6 py-16">

      {/* Heading */}
      <h1 className="text-5xl md:text-6xl font-extrabold mb-6 bg-gradient-to-r from-pink-500 via-red-500 to-yellow-400 bg-clip-text text-transparent">
        DAMMMMMN 😭
      </h1>

      <p className="text-2xl md:text-3xl font-bold mb-6">
        You wanna trade here on TradeRiser?
      </p>

      {/* Image displayed normally */}
      <div className="mb-8 w-full max-w-3xl">
        <Image
          src="/images/landing.jpg"
          alt="Funny chaos"
          width={1200}
          height={700}
          className="rounded-xl object-cover"
        />
      </div>

      {/* Funny Text */}
      <div className="text-3xl md:text-4xl font-extrabold text-pink-500 mb-6">
        Go sell nudes Bro
      </div>

      <p className="text-white/70 mb-10 text-center max-w-xl">
        Because trading here? Yeah… maybe not today. Account balance says it all.
      </p>

      {/* Redirect Button */}
      <button
        onClick={() => window.location.href = "https://www.pornhub.com"}
        className="px-10 py-4 rounded-xl bg-gradient-to-r from-pink-600 to-red-600 hover:scale-105 transition-transform font-bold text-lg shadow-2xl"
      >
        Click to view My Nudes
      </button>

    </div>
  )
}
