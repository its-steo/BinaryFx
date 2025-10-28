// components/fx-pro-trading/history-page.tsx
"use client";

import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { useTradeHistory } from "@/hooks/use-forex-data";
import { toast } from "sonner";

export default function HistoryPage() {
  const { trades, isLoading, error } = useTradeHistory();

  const totalRealizedPL = trades
    ? trades.reduce((sum, trade) => {
        const pl = typeof trade.realized_p_l === "string" ? parseFloat(trade.realized_p_l) : trade.realized_p_l;
        return sum + (isNaN(pl) ? 0 : pl);
      }, 0)
    : 0;

  const winRate = trades && trades.length > 0
    ? (trades.filter((t) => {
        const pl = typeof t.realized_p_l === "string" ? parseFloat(t.realized_p_l) : t.realized_p_l;
        return pl > 0;
      }).length / trades.length) * 100
    : 0;

  useEffect(() => {
    if (error) {
      if (error === "Pro-FX account required") {
        toast.error("Pro-FX account required to view trade history");
      } else {
        toast.error(`Failed to load trade history: ${error}`);
      }
    }
  }, [error]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <h1 className="text-3xl font-bold text-foreground">Trade History</h1>
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4 bg-card/50 border-border">
          <p className="text-sm text-muted-foreground">Total Realized P&L</p>
          <p className={`text-2xl font-bold ${totalRealizedPL >= 0 ? "text-green-500" : "text-red-500"}`}>
            ${totalRealizedPL.toFixed(2)}
          </p>
        </Card>
        <Card className="p-4 bg-card/50 border-border">
          <p className="text-sm text-muted-foreground">Win Rate</p>
          <p className="text-2xl font-bold text-foreground">{winRate.toFixed(1)}%</p>
        </Card>
      </div>
      <div className="space-y-3">
        {isLoading ? (
          <Card className="p-8 text-center bg-card/50 border-border">
            <p className="text-muted-foreground">Loading history...</p>
          </Card>
        ) : error ? (
          <Card className="p-8 text-center bg-card/50 border-border">
            <p className="text-red-500">Failed to load history: {error}</p>
          </Card>
        ) : !trades || trades.length === 0 ? (
          <Card className="p-8 text-center bg-card/50 border-border">
            <p className="text-muted-foreground">No trade history yet</p>
          </Card>
        ) : (
          trades.map((trade) => (
            <Card
              key={trade.id}
              className="p-4 bg-card/50 border-border hover:border-primary/50 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-foreground">{trade.position.pair.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {trade.position.direction.toUpperCase()} • {trade.position.volume_lots} lots • {trade.position.time_frame}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`font-bold ${
                      (typeof trade.realized_p_l === "string" ? parseFloat(trade.realized_p_l) : trade.realized_p_l) >= 0
                        ? "text-green-500"
                        : "text-red-500"
                    }`}
                  >
                    ${(typeof trade.realized_p_l === "string" ? parseFloat(trade.realized_p_l) : trade.realized_p_l).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">{trade.close_reason}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                <div>
                  <p>
                    Entry: $
                    {(typeof trade.position.entry_price === "string"
                      ? parseFloat(trade.position.entry_price)
                      : trade.position.entry_price
                    ).toFixed(5)}
                  </p>
                </div>
                <div>
                  <p>
                    Close: $
                    {(typeof trade.close_price === "string"
                      ? parseFloat(trade.close_price)
                      : trade.close_price
                    ).toFixed(5)}
                  </p>
                </div>
                <div className="text-right">
                  <p>{new Date(trade.close_time).toLocaleString()}</p>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}