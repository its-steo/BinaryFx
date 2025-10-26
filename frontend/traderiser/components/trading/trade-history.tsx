"use client"

import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { api } from "@/lib/api"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/format-currency"

interface Trade {
  id: number
  market: { name: string }
  direction: string
  amount: string
  is_win: boolean
  profit: string
  created_at: string
  entrySpot?: number | string
  exitSpot?: number | string
  buyPrice?: number
  trade_type_id?: number
}

export function TradeHistory({ sessionTrades = [] }: { sessionTrades?: any[] }) {
  const { toast } = useToast()
  const [trades, setTrades] = useState<Trade[]>([])
  const [tradeTypes, setTradeTypes] = useState<{ id: number; name: string }[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const tradesPerPage = 10

  useEffect(() => {
    const fetchTradeTypes = async () => {
      const response = await api.getTradeTypes()
      const { data, error } = response as { data?: { id: number; name: string }[]; error?: unknown }
      if (!error && Array.isArray(data)) {
        setTradeTypes(data)
      }
    }
    fetchTradeTypes()
  }, [])

  useEffect(() => {
    fetchTrades()
  }, [])

  const fetchTrades = async () => {
    setIsLoading(true)
    try {
      // Narrow the response type so `data` is not treated as `unknown`
      const response = await api.getTradeHistory() as { data?: any; error?: unknown }
      const { data, error } = response
      if (error) {
        toast({ title: "Error", description: "Failed to load trade history: " + error, variant: "destructive" })
        setIsLoading(false)
        return
      }

      const tradeData = Array.isArray(data?.trades) ? data.trades : []
      const enhancedData = tradeData.map((t: any) => ({
        id: t.id,
        market: t.market,
        direction: t.direction,
        amount: t.amount,
        is_win: t.is_win,
        profit: t.profit,
        created_at: t.timestamp,
        entrySpot: t.entry_spot ? parseFloat(t.entry_spot) : Math.random() * 100,
        exitSpot: t.exit_spot ? parseFloat(t.exit_spot) : Math.random() * 100,
        buyPrice: Number.parseFloat(t.amount),
        trade_type_id: t.trade_type_id,
      }))
      setTrades(enhancedData.reverse())
    } catch (err) {
      toast({ title: "Error", description: "Failed to fetch trade history", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const getDirectionLabel = (direction: string, tradeTypeId?: number) => {
    const tradeType = tradeTypes.find(t => t.id === tradeTypeId)
    const tradeTypeName = tradeType?.name.toLowerCase()
    switch (tradeTypeName) {
      case "rise/fall":
        return direction.toLowerCase() === "rise" ? "RISE" : "FALL"
      case "buy/sell":
      default:
        return direction.toUpperCase()
    }
  }

  const paginatedTrades = trades.slice((currentPage - 1) * tradesPerPage, currentPage * tradesPerPage)
  const totalPages = Math.ceil(trades.length / tradesPerPage)

  return (
    <div className="w-full">
      <h2 className="text-base sm:text-lg lg:text-xl font-bold text-white mb-4 sm:mb-6">Trade History</h2>
      {isLoading ? (
        <p className="text-white/60 text-sm sm:text-base">Loading trades...</p>
      ) : trades.length === 0 ? (
        <p className="text-white/60 text-sm sm:text-base">No trades yet</p>
      ) : (
        <>
          {/* Mobile: Card Layout */}
          <div className="lg:hidden space-y-3">
            <AnimatePresence>
              {paginatedTrades.map(trade => (
                <motion.div
                  key={trade.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-4 rounded-lg bg-white/5 border border-white/20"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm font-semibold text-white truncate flex-1 mr-2">
                      {trade.market.name}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      trade.direction === "buy" || trade.direction === "rise"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-red-500/20 text-red-400"
                    }`}>
                      {getDirectionLabel(trade.direction, trade.trade_type_id)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs sm:text-sm text-white/60">
                    <div>
                      <span className="block">Amount</span>
                      <span className="font-semibold text-white">${trade.buyPrice?.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="block">Spots</span>
                      <span className="font-semibold text-white/80">
                        {(typeof trade.entrySpot === 'number' ? trade.entrySpot : parseFloat(trade.entrySpot || '0')).toFixed(2)} / 
                        {(typeof trade.exitSpot === 'number' ? trade.exitSpot : parseFloat(trade.exitSpot || '0')).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/10">
                    <div className="flex items-center gap-2">
                      {trade.is_win ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400" />
                      )}
                      <span className={`font-bold ${trade.is_win ? "text-green-400" : "text-red-400"}`}>
                        {trade.is_win ? "WIN" : "LOSS"}
                      </span>
                    </div>
                    <motion.span
                      className={`font-bold text-sm sm:text-base ${
                        Number.parseFloat(trade.profit) >= 0 ? "text-green-400" : "text-red-400"
                      }`}
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 0.3, delay: 0.2 }}
                    >
                      ${Number.parseFloat(trade.profit).toFixed(2)}
                    </motion.span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Desktop: Table Layout */}
          <div className="hidden lg:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-white/60 border-b border-white/10">
                    <th className="py-3 px-4 w-[25%]">Market</th>
                    <th className="py-3 px-4 w-[15%]">Direction</th>
                    <th className="py-3 px-4 w-[20%]">Spots</th>
                    <th className="py-3 px-4 w-[12%]">Amount</th>
                    <th className="py-3 px-4 w-[13%]">Result</th>
                    <th className="py-3 px-4 w-[15%]">P/L</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {paginatedTrades.map(trade => (
                      <motion.tr
                        key={trade.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="border-b border-white/5 hover:bg-white/5"
                      >
                        <td className="py-3 px-4 text-white truncate">{trade.market.name}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full font-bold ${
                            trade.direction === "buy" || trade.direction === "rise"
                              ? "bg-green-500/20 text-green-400"
                              : "bg-red-500/20 text-red-400"
                          }`}>
                            {getDirectionLabel(trade.direction, trade.trade_type_id)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-white/60">
                          {(typeof trade.entrySpot === 'number' ? trade.entrySpot : parseFloat(trade.entrySpot || '0')).toFixed(2)} / 
                          {(typeof trade.exitSpot === 'number' ? trade.exitSpot : parseFloat(trade.exitSpot || '0')).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-white">
                          ${formatCurrency(trade.buyPrice || 0)}  
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {trade.is_win ? (
                              <CheckCircle className="w-4 h-4 text-green-400" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-400" />
                            )}
                            <span className={`font-bold ${trade.is_win ? "text-green-400" : "text-red-400"}`}>
                              {trade.is_win ? "WIN" : "LOSS"}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <motion.span
                            className={`font-bold ${
                              Number.parseFloat(trade.profit) >= 0 ? "text-green-400" : "text-red-400"
                            }`}
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ duration: 0.3, delay: 0.2 }}
                          >
                            ${Number.parseFloat(trade.profit).toFixed(2)}
                          </motion.span>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination - Responsive */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4">
              <Button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                variant="outline"
                className="border-white/20 bg-white/5 text-white hover:bg-white/10 flex-1 sm:flex-none px-4 py-2 text-sm"
                size="sm"
              >
                Previous
              </Button>
              <span className="text-sm text-white/60 font-medium">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                variant="outline"
                className="border-white/20 bg-white/5 text-white hover:bg-white/10 flex-1 sm:flex-none px-4 py-2 text-sm"
                size="sm"
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}