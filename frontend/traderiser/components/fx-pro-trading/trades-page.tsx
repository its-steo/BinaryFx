// components/fx-pro-trading/trades-page.tsx
"use client"

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import WalletDisplay from "@/components/wallet-display";
import { usePositions } from "@/hooks/use-forex-data";
import { usePriceUpdates } from "@/hooks/use-price-updates";
import { api } from "@/lib/api";
import { mutate } from "swr";
import { toast } from "sonner";

export default function TradesPage() {
  const { positions, isLoading, error, mutate: mutatePositions } = usePositions();
  const { prices, isSashi } = usePriceUpdates();
  const [closingId, setClosingId] = useState<number | null>(null);
  const [closingAll, setClosingAll] = useState(false);
  const [animatedPL, setAnimatedPL] = useState<{ [key: number]: number }>({});

  const calculateFloatingPL = (position: any, currentPrice: number) => {
    const pipValue = 0.0001; // Standard pip value for forex
    const pipDelta = position.direction === 'buy'
      ? (currentPrice - position.entry_price) / pipValue
      : (position.entry_price - currentPrice) / pipValue;
    const profit = pipDelta * position.volume_lots * position.pair.contract_size * pipValue - 
                   (position.pair.spread * position.volume_lots * position.pair.contract_size * pipValue);
    return profit; // Return profit in account currency (USD)
  };

  // Total floating P&L
  const totalFloatingPL = positions.reduce((sum, position) => {
    const currentPrice = prices[position.pair.id] || position.entry_price;
    const pl = calculateFloatingPL(position, currentPrice);
    return sum + (isNaN(pl) ? 0 : pl);
  }, 0);

  useEffect(() => {
    const animationFrames: NodeJS.Timeout[] = [];
    positions.forEach((position) => {
      const currentPrice = prices[position.pair.id] || position.entry_price;
      const newPL = calculateFloatingPL(position, currentPrice);
      const startPL = animatedPL[position.id] ?? newPL;
      let progress = 0;

      const animate = () => {
        progress += 0.1;
        const eased = easeInOutQuad(progress);
        const nextPL = startPL + (newPL - startPL) * eased;
        setAnimatedPL(prev => ({ ...prev, [position.id]: nextPL }));
        if (progress < 1) {
          animationFrames.push(setTimeout(animate, 16));
        }
      };
      animate();

      const accountBalance = typeof position.account === 'number'
        ? position.account
        : ((position.account as any)?.balance ?? 0);

      if (!isSashi && newPL <= 0 && Math.abs(newPL) >= accountBalance) {
        toast.warning(`Margin Call: ${position.pair.name}`);
      }
    });
    return () => animationFrames.forEach(clearTimeout);
  }, [positions, prices, isSashi]);

  const handleClosePosition = async (positionId: number) => {
    try {
      setClosingId(positionId);
      const position = positions.find(p => p.id === positionId);
      if (!position) throw new Error("Position not found");

      const currentPrice = prices[position.pair.id] || position.entry_price;
      const realizedPL = calculateFloatingPL(position, currentPrice);
      console.log(`Closing ${position.pair.name}: Entry ${position.entry_price}, Close ${currentPrice}, Realized P&L ${realizedPL}`);

      await api.closeForexPosition(positionId);
      mutatePositions();
      mutate("/wallet/wallets/");
      toast.success(`Position closed with P&L $${realizedPL.toFixed(2)}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to close");
    } finally {
      setClosingId(null);
    }
  };

  const handleCloseAllPositions = async () => {
    try {
      setClosingAll(true);
      await api.closeAllPositions();
      mutatePositions();
      mutate("/wallet/wallets/");
      toast.success("All positions closed!");
    } catch (err: any) {
      toast.error(err.message || "Failed to close all");
    } finally {
      setClosingAll(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Open Trades</h1>
        <WalletDisplay />
      </div>

      <Card className="p-4 bg-card/50 border-border">
        <div className="flex justify-between items-center mb-2">
          <p className="text-muted-foreground">Open Trades</p>
          <p className="text-xl font-bold">{positions.length}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Total Floating P&L</p>
          <p className={`text-2xl font-bold ${totalFloatingPL >= 0 ? "text-green-500" : "text-red-500"}`}>
            ${totalFloatingPL.toFixed(2)}
          </p>
        </div>
      </Card>

      <div className="space-y-2">
        {isLoading ? (
          <Card className="p-8 text-center"><p>Loading...</p></Card>
        ) : error ? (
          <Card className="p-8 text-center text-red-500">
            <p>{error}</p>
            <button onClick={() => mutatePositions()} className="underline mt-2">Retry</button>
          </Card>
        ) : positions.length === 0 ? (
          <Card className="p-8 text-center"><p className="text-muted-foreground">No open trades</p></Card>
        ) : (
          <>
            <Button
              onClick={handleCloseAllPositions}
              disabled={closingAll}
              className="w-full bg-red-600 hover:bg-red-700"
            >
              {closingAll ? "Closing All..." : "Close All Positions"}
            </Button>

            {positions.map((position) => {
              const currentPrice = prices[position.pair.id] || position.entry_price;
              const pl = animatedPL[position.id] ?? calculateFloatingPL(position, currentPrice);
              const color = pl >= 0 ? "text-green-500" : "text-red-500";

              return (
                <Card key={position.id} className="p-3 bg-card/50 border-border hover:border-primary/50 transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm">{position.pair.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {position.direction.toUpperCase()} • {position.volume_lots} lots • {position.time_frame}
                      </p>
                      <p className="text-xs font-mono mt-1">
                        {Number(position.entry_price).toFixed(3)} → {Number(currentPrice).toFixed(3)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className={`font-bold text-lg ${color} animate-pulse`}>
                        ${pl.toFixed(2)}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleClosePosition(position.id)}
                        disabled={closingId === position.id}
                        className="hover:text-red-500"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}