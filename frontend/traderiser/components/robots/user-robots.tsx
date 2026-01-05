"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { api } from "@/lib/api"
import { formatPrice } from "@/lib/format-currency"

interface UserRobot {
  id: number
  robot: {
    id: number
    name: string
    description: string
    price: string | number
    discounted_price?: string | number | null
    original_price?: string | number
    effective_price?: string | number
  }
  purchased_at: string | null
  purchased_price?: string | number | null
}

export function UserRobots() {
  const [userRobots, setUserRobots] = useState<UserRobot[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchUserRobots = async () => {
      const { data, error } = await api.getUserRobots()
      if (error) {
        toast.error("Failed to load your robots")
      } else {
        setUserRobots(data as UserRobot[])
      }
      setIsLoading(false)
    }
    fetchUserRobots()
  }, [])

  if (isLoading) {
    return <p className="text-white/60 text-center py-8">Loading your robots...</p>
  }

  if (userRobots.length === 0) {
    return (
      <div className="rounded-2xl p-12 bg-white/10 backdrop-blur-md border border-white/20 text-center">
        <p className="text-white/60 mb-4">You have not purchased any robots yet</p>
        <p className="text-sm text-white/60">Visit the marketplace to purchase your first robot</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {userRobots.map((userRobot) => {
        const purchasedPrice = userRobot.purchased_price
          ? Number(userRobot.purchased_price)
          : userRobot.robot.effective_price
            ? Number(userRobot.robot.effective_price)
            : Number(userRobot.robot.price)

        const originalPrice = userRobot.robot.original_price
          ? Number(userRobot.robot.original_price)
          : Number(userRobot.robot.price)

        const wasPurchasedAtDiscount = purchasedPrice < originalPrice

        return (
          <div
            key={userRobot.id}
            className="rounded-2xl p-6 bg-white/10 backdrop-blur-md border border-white/20 relative overflow-hidden"
          >
            {wasPurchasedAtDiscount && (
              <div className="absolute top-3 right-3">
                <div className="bg-gradient-to-r from-amber-400 to-cyan-400 text-gray-900 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 shadow-md">
                  🎆 New Year Deal
                </div>
              </div>
            )}

            <h3 className="text-lg font-bold text-white mb-2">{userRobot.robot.name}</h3>
            <p className="text-sm text-white/60 mb-4">{userRobot.robot.description}</p>

            <div className="space-y-3 pt-4 border-t border-white/20">
              <div className="flex justify-between">
                <span className="text-sm text-white/60">{wasPurchasedAtDiscount ? "Purchased Price" : "Price"}</span>
                <div className="flex flex-col items-end">
                  {wasPurchasedAtDiscount && (
                    <span className="text-xs text-white/40 line-through">{formatPrice(originalPrice)}</span>
                  )}
                  <span className={`text-sm font-bold ${wasPurchasedAtDiscount ? "text-cyan-400" : "text-white"}`}>
                    {formatPrice(purchasedPrice)}
                  </span>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-white/60">Purchased</span>
                <span className="text-sm font-bold text-white">
                  {userRobot.purchased_at
                    ? new Date(userRobot.purchased_at).toLocaleDateString()
                    : "Available for Demo"}
                </span>
              </div>
            </div>

            <Button className="w-full mt-6 bg-pink-500 hover:bg-pink-600 text-white">Use Robot</Button>
          </div>
        )
      })}
    </div>
  )
}
