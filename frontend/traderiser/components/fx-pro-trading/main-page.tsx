"use client"

import { useState, useEffect } from "react"
import { Plus } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import WalletDisplay from "@/components/wallet-display"
import { TradingViewChart } from "@/components/fx-pro-trading/trading-view-chart"
import PlaceOrderModal from "@/components/fx-pro-trading/place-modal"
import { mutate } from "swr"
import { toast } from "sonner"

export default function MainPage() {
  const [pairId, setPairId] = useState<number | null>(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [direction, setDirection] = useState<"buy" | "sell">("buy")
  const [timeFrame, setTimeFrame] = useState<string>("D")

  const openModal = (dir: "buy" | "sell") => {
    setDirection(dir)
    setModalOpen(true)
  }

  useEffect(() => {
    console.log("Selected pairId:", pairId, "Time Frame:", timeFrame)
  }, [pairId, timeFrame])

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Pro FX Trading</h1>
        <WalletDisplay />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Select Market</label>
        <select
          value={pairId || 1}
          onChange={(e) => setPairId(Number(e.target.value))}
          className="w-full px-3 py-2 bg-muted border border-border rounded"
        >
          {[1, 2, 3, 4, 5].map((id) => (
            <option key={id} value={id}>
              Market {id}
            </option>
          ))}
        </select>
      </div>

      <Card className="p-3">
        <TradingViewChart pairId={pairId || 1} timeFrame={timeFrame} />
      </Card>

      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Time Frame</label>
        <select
          value={timeFrame}
          onChange={(e) => setTimeFrame(e.target.value)}
          className="w-full px-3 py-2 bg-muted border border-border rounded"
        >
          {["M1", "M5", "M15", "H1", "H4", "D1"].map((tf) => (
            <option key={tf} value={tf}>
              {tf === "M1"
                ? "1 Minute"
                : tf === "M5"
                  ? "5 Minutes"
                  : tf === "M15"
                    ? "15 Minutes"
                    : tf === "H1"
                      ? "1 Hour"
                      : tf === "H4"
                        ? "4 Hours"
                        : "24 Hours"}
            </option>
          ))}
        </select>
      </div>

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
          timeFrame={timeFrame}
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
