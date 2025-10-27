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
    const pipValue = 0.0001;
    const pipDelta =
      position.direction === 'buy'
        ? (currentPrice - position.entry_price) / pipValue
        : (position.entry_price - currentPrice) / pipValue;
    return pipDelta * position.volume_lots * 10;
  };

  useEffect(() => {
    let animationFrames: NodeJS.Timeout[] = [];
    positions.forEach((position) => {
      const currentPrice = prices[position.pair.id] || position.entry_price;
      const newPL = calculateFloatingPL(position, currentPrice);
      const startPL = animatedPL[position.id] || newPL;
      let progress = 0;

      const animate = () => {
        progress += 0.1;
        const nextPL = startPL + (newPL - startPL) * easeInOutQuad(progress);
        setAnimatedPL((prev) => ({ ...prev, [position.id]: nextPL }));
        if (progress < 1) {
          animationFrames.push(setTimeout(animate, 20));
        } else {
          setAnimatedPL((prev) => ({ ...prev, [position.id]: newPL }));
        }
      };
      animate();

      // Margin call notification for non-Sashi users
      if (!isSashi && newPL <= 0 && Math.abs(newPL) >= position.account.balance) {
        toast.warning(`Margin call triggered for ${position.pair.name}`);
      }
    });
    return () => animationFrames.forEach(clearTimeout);
  }, [positions, prices, isSashi]);

  const handleClosePosition = async (positionId: number) => {
    try {
      setClosingId(positionId);
      const response = await api.closeForexPosition(positionId);
      if (response.status === 403 && response.error === 'Pro-FX account required') {
        toast.error('Pro-FX account required to close position');
        return;
      }
      mutatePositions();
      mutate("/wallet/wallets/");
      toast.success("Position closed successfully");
    } catch (err) {
      console.error("Failed to close position:", err);
      toast.error("Failed to close position");
    } finally {
      setClosingId(null);
    }
  };

  const handleCloseAllPositions = async () => {
    try {
      setClosingAll(true);
      const response = await api.closeAllPositions();
      if (response.status === 403 && response.error === 'Pro-FX account required') {
        toast.error('Pro-FX account required to close positions');
        return;
      }
      mutatePositions();
      mutate("/wallet/wallets/");
      toast.success("All positions closed successfully");
    } catch (err) {
      console.error("Failed to close all positions:", err);
      toast.error("Failed to close all positions");
    } finally {
      setClosingAll(false);
    }
  };

  const totalFloatingPL = positions.reduce((sum, pos) => {
    const currentPrice = prices[pos.pair.id] || pos.entry_price;
    return sum + calculateFloatingPL(pos, currentPrice);
  }, 0);

  return (
    <div className="space-y-6 p-2 sm:p-4 md:p-6">
      <div className="flex items-center justify-between flex-col sm:flex-row gap-4 sm:gap-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Open Positions</h1>
        <div className="flex items-center gap-4">
          <Button
            onClick={handleCloseAllPositions}
            disabled={closingAll || isLoading || positions.length === 0}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {closingAll ? "Closing..." : "Close All Positions"}
          </Button>
          <WalletDisplay />
        </div>
      </div>
      <Card className="p-2 sm:p-4 bg-gradient-to-r from-primary/10 to-accent/10 border-border">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
          <div>
            <p className="text-xs sm:text-sm text-muted-foreground">Total Floating P&L</p>
            <p className={`text-xl sm:text-2xl font-bold ${totalFloatingPL >= 0 ? "text-green-500" : "text-red-500"}`}>
              ${totalFloatingPL.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs sm:text-sm text-muted-foreground">Open Positions</p>
            <p className="text-xl sm:text-2xl font-bold text-foreground">{positions.length}</p>
          </div>
        </div>
      </Card>
      <div className="space-y-2">
        {isLoading ? (
          <Card className="p-4 text-center bg-card/50 border-border">
            <p className="text-muted-foreground">Loading positions...</p>
          </Card>
        ) : error ? (
          <Card className="p-4 text-center bg-card/50 border-border">
            <p className="text-red-500">Failed to load positions</p>
            <button onClick={() => mutatePositions()} className="mt-2 text-blue-500 underline">
              Retry
            </button>
          </Card>
        ) : positions.length === 0 ? (
          <Card className="p-4 text-center bg-card/50 border-border">
            <p className="text-muted-foreground">No open positions</p>
          </Card>
        ) : (
          positions.map((position) => {
            const currentPrice = prices[position.pair.id] || position.entry_price;
            const floatingPL = calculateFloatingPL(position, currentPrice);
            const animatedValue = animatedPL[position.id] || floatingPL;
            const plColor = animatedValue >= 0 ? "text-green-500" : "text-red-500";

            return (
              <Card
                key={position.id}
                className="p-2 sm:p-3 bg-card/50 border-border hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 sm:gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground text-sm">{position.pair.name}</h3>
                    <p className="text-xs text-muted-foreground capitalize">
                      {position.direction} {Number(position.volume_lots).toFixed(2)}
                    </p>
                    <p className="text-xs font-mono text-foreground mt-1">
                      {Number(position.entry_price).toFixed(3)} - {Number(currentPrice).toFixed(3)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className={`font-bold text-lg ${plColor} transition-colors duration-200 animate-pulse`}>
                      ${animatedValue.toFixed(2)}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleClosePosition(position.id)}
                      disabled={closingId === position.id}
                      className="text-muted-foreground hover:text-destructive p-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}