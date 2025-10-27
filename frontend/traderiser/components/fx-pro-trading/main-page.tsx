// components/fx-pro-trading/main-page.tsx
"use client"

import { useState, useEffect } from "react"
import { Plus } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import MarketDropdown from "@/components/market-dropdown"
import WalletDisplay from "@/components/wallet-display"
import { TradingViewChart } from "@/components/fx-pro-trading/trading-view-chart" // use named import to match export
import PlaceOrderModal from "@/components/fx-pro-trading/place-modal"
import { mutate } from "swr"
import { toast } from "sonner"

export default function MainPage() {
  const [pairId, setPairId] = useState<number | null>(1) // Default to EURUSD (assuming ID 1, adjust if different)
  const [modalOpen, setModalOpen] = useState(false)
  const [direction, setDirection] = useState<"buy" | "sell">("buy")

  const openModal = (dir: "buy" | "sell") => {
    setDirection(dir)
    setModalOpen(true)
  }

  // Log pair selection for debugging
  useEffect(() => {
    console.log("Selected pairId:", pairId)
  }, [pairId])

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Pro FX Trading</h1>
        <WalletDisplay />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Select Market</label>
        <MarketDropdown selectedMarket={pairId} onSelectMarket={setPairId} />
      </div>

      <Card className="p-3">
        <TradingViewChart pairId={pairId || 1} /> {/* Always render with default EURUSD if no selection */}
      </Card>

      {pairId && (
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={() => openModal("buy")}
            disabled={!pairId}
            className="h-12 bg-green-600 hover:bg-green-700 text-white font-semibold"
          >
            <Plus className="w-5 h-5 mr-2" />
            Buy
          </Button>
          <Button
            onClick={() => openModal("sell")}
            disabled={!pairId}
            className="h-12 bg-red-600 hover:bg-red-700 text-white font-semibold"
          >
            <Plus className="w-5 h-5 mr-2" />
            Sell
          </Button>
        </div>
      )}

      {modalOpen && pairId && (
        <PlaceOrderModal
          pairId={pairId}
          direction={direction}
          onClose={() => setModalOpen(false)}
          onPlaceOrder={() => {
            setModalOpen(false)
            mutate("/forex/positions/")
            mutate("/wallet/wallets/")
            toast.success("Order placed successfully")
          }}
        />
      )}
    </div>
  )
}