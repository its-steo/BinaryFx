"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { api } from "@/lib/api"

interface Robot {
  id: number
  name: string
  description: string
  price: string  // Changed to string to match API response
  available_for_demo: boolean
  image?: string
}

interface RobotMarketplaceProps {
  balance: number
  onBalanceChange: (balance: number) => void
}

export function RobotMarketplace({ balance, onBalanceChange }: RobotMarketplaceProps) {
  const { toast } = useToast()
  const [robots, setRobots] = useState<Robot[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [purchasingId, setPurchasingId] = useState<number | null>(null)

  useEffect(() => {
    const fetchRobots = async () => {
      const { data, error } = await api.getRobots()
      if (error) {
        toast({
          title: "Error",
          description: "Failed to load robots",
          variant: "destructive",
        })
      } else {
        setRobots(data as Robot[])
      }
      setIsLoading(false)
    }
    fetchRobots()
  }, [toast])

  const handlePurchaseRobot = async (robotId: number, priceStr: string) => {
    const price = Number(priceStr)  // Parse string to number
    if (isNaN(price)) {
      toast({
        title: "Error",
        description: "Invalid price for this robot",
        variant: "destructive",
      })
      return
    }
    if (balance < price) {
      toast({
        title: "Error",
        description: "Insufficient balance to purchase this robot",
        variant: "destructive",
      })
      return
    }

    setPurchasingId(robotId)

    const { data, error } = await api.purchaseRobot(robotId)

    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      })
    } else {
      onBalanceChange(balance - price)
      toast({
        title: "Success",
        description: "Robot purchased successfully!",
      })
    }
    setPurchasingId(null)
  }

  if (isLoading) {
    return <p className="text-white/60">Loading robots...</p>
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {robots.map((robot) => {
        const priceNum = Number(robot.price)  // Parse for display/checks
        return (
          <div
            key={robot.id}
            className="rounded-2xl p-6 bg-white/10 backdrop-blur-md border border-white/20 flex flex-col"
          >
            {robot.image && (
              <img
                src={robot.image || "/placeholder.svg"}
                alt={robot.name}
                className="w-full h-40 object-cover rounded-lg mb-4"
              />
            )}
            <div className="flex-1">
              <h3 className="text-lg font-bold text-white mb-2">{robot.name}</h3>
              <p className="text-sm text-white/60 mb-4">{robot.description}</p>
              {robot.available_for_demo && <p className="text-xs text-green-400 mb-4">✓ Available for demo</p>}
            </div>
            <div className="flex items-center justify-between mt-6 pt-6 border-t border-white/20">
              <p className="text-2xl font-bold text-white">
                {!isNaN(priceNum) ? `$${priceNum.toFixed(2)}` : 'Price unavailable'}
              </p>
              <Button
                onClick={() => handlePurchaseRobot(robot.id, robot.price)}
                disabled={purchasingId === robot.id || isNaN(priceNum) || balance < priceNum}
                className="bg-pink-500 hover:bg-pink-600 text-white"
              >
                {purchasingId === robot.id ? "Purchasing..." : "Purchase"}
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}