// components/fx-pro-trading/trading-view-chart.tsx
"use client"

import { useEffect, useRef, useState } from "react";
import { useForexPairs } from "@/hooks/use-forex-data";
import { usePriceUpdates } from "@/hooks/use-price-updates";
import { toast } from "sonner";

interface Props {
  pairId: number;
  timeFrame?: string;
}

export function TradingViewChart({ pairId, timeFrame = "D" }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const { pairs, isLoading: pairsLoading, error: pairsError } = useForexPairs();
  const { prices } = usePriceUpdates();
  const pair = pairs.find((p: { id: number; name: string }) => p.id === pairId);
  const [widgetError, setWidgetError] = useState<string | null>(null);

  useEffect(() => {
    if (!container.current || !pair) {
      console.log("Cannot load widget:", { pairExists: !!pair, containerExists: !!container.current });
      return;
    }

    const validSymbols = ["EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD"];
    const symbol = `OANDA:${pair.name.toUpperCase()}`;

    if (!validSymbols.includes(pair.name.toUpperCase())) {
      setWidgetError(`Chart not available for ${pair.name}`);
      return;
    }

    container.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.onerror = () => {
      setWidgetError("Failed to load TradingView widget script");
      console.error("TradingView script failed to load");
    };
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval: "D",
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      allow_symbol_change: true,
      calendar: false,
      support_host: "www.tradingview.com",
    });

    console.log("Loading TradingView widget for symbol:", symbol);
    container.current.appendChild(script);

    return () => {
      if (container.current) {
        container.current.innerHTML = "";
      }
    };
  }, [pair, pairId]);

  useEffect(() => {
    if (pairsError) {
      toast.error(`Failed to load pairs: ${pairsError.message || pairsError}`);
    }
    if (widgetError) {
      toast.error(widgetError);
    }
  }, [pairsError, widgetError]);

  if (pairsLoading) {
    return (
      <div className="h-[500px] w-full flex items-center justify-center bg-card/50 border-border rounded-2xl">
        Loading pair...
      </div>
    );
  }

  if (!pair) {
    return (
      <div className="h-[500px] w-full flex items-center justify-center bg-card/50 border-border rounded-2xl">
        No pair selected
      </div>
    );
  }

  if (widgetError) {
    return (
      <div className="h-[500px] w-full flex items-center justify-center bg-card/50 border-border rounded-2xl">
        <p className="text-red-500">{widgetError}</p>
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl overflow-hidden bg-white/10 backdrop-blur-md border border-white/10 w-full">
      <div ref={container} className="w-full" style={{ height: "500px" }} />
      {prices[pairId] ? (
        <div className="absolute top-2 right-2 bg-card/90 px-3 py-1 rounded text-sm">
          Current: <strong>{prices[pairId].toFixed(5)}</strong>
        </div>
      ) : (
        <div className="absolute top-2 right-2 bg-card/90 px-3 py-1 rounded text-sm">
          Loading price...
        </div>
      )}
    </div>
  );
}