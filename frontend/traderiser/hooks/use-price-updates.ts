// hooks/use-price-updates.ts
import { useEffect, useState } from 'react';
import { useForexPairs, usePositions } from './use-forex-data';
import { api } from '@/lib/api';
import { toast } from 'sonner';

class PriceSimulator {
  private basePrice: number;
  private volatility: number;
  private entryTime: Date | null;
  private isSashi: boolean;
  private direction: string;

  constructor(basePrice: number, isSashi: boolean, direction: string = 'buy', volatility: number = 0.0005) {
    this.basePrice = basePrice;
    this.volatility = volatility;
    this.entryTime = null;
    this.isSashi = isSashi;
    this.direction = direction;
  }

  setEntryTime(entryTime: string) {
    this.entryTime = new Date(entryTime);
  }

  getCurrentPrice(): number {
    if (!this.entryTime) {
      const change = (Math.random() * 2 - 1) * this.volatility;
      return Math.max(this.basePrice + change, 0.0001);
    }

    const timeElapsed = (Date.now() - this.entryTime.getTime()) / 1000 / 60;
    if (this.isSashi) {
      if (timeElapsed >= 30) {
        return Math.max(this.basePrice + (this.direction === 'buy' ? 0.0020 : -0.0020), 0.0001);
      }
      if (Math.random() < 0.1) {
        return Math.max(this.basePrice - 0.0005, 0.0001);
      }
    } else {
      if (timeElapsed >= (10 + Math.random() * 10)) {
        return Math.max(this.basePrice - (this.direction === 'buy' ? 0.0020 : -0.0020), 0.0001);
      }
    }

    const change = (Math.random() * 2 - 1) * this.volatility;
    return Math.max(this.basePrice + change, 0.0001);
  }
}

export const usePriceUpdates = () => {
  const { pairs, isLoading: pairsLoading, error: pairsError } = useForexPairs();
  const { positions, isLoading: positionsLoading, error: positionsError } = usePositions();
  const [prices, setPrices] = useState<Record<number, number>>({});
  const [simulators, setSimulators] = useState<Record<number, PriceSimulator>>({});
  const [pairIds, setPairIds] = useState<number[]>([]);
  const [isSashi, setIsSashi] = useState<boolean>(false);

  useEffect(() => {
    const fetchSashiStatus = async () => {
      try {
        const response = await api.getAccount();
        if (response.status === 403 && response.error === 'Pro-FX account required') {
          toast.error('Pro-FX account required to trade');
          return;
        }
        setIsSashi(response.data?.user?.is_sashi || false);
      } catch (error) {
        console.error('Error fetching Sashi status:', error);
        toast.error('Failed to fetch user status');
      }
    };
    fetchSashiStatus();
  }, []);

  useEffect(() => {
    if (pairsLoading || positionsLoading) return;

    const relevantPairIds = [
      ...new Set([
        ...positions.map((pos) => pos.pair.id),
        ...pairs.map((p) => p.id),
      ]),
    ];
    setPairIds(relevantPairIds);

    const newSimulators: Record<number, PriceSimulator> = {};
    pairs.forEach((pair) => {
      if (relevantPairIds.includes(pair.id)) {
        const position = positions.find((pos) => pos.pair.id === pair.id);
        newSimulators[pair.id] = new PriceSimulator(
          Number(pair.base_simulation_price),
          isSashi,
          position ? position.direction : 'buy'
        );
        if (position) {
          newSimulators[pair.id].setEntryTime(position.entry_time);
        }
      }
    });
    setSimulators(newSimulators);

    const initialPrices: Record<number, number> = {};
    relevantPairIds.forEach((pairId) => {
      initialPrices[pairId] = newSimulators[pairId]?.getCurrentPrice() || Number(pairs.find((p) => p.id === pairId)?.base_simulation_price) || 0;
    });
    setPrices(initialPrices);
  }, [pairs, positions, pairsLoading, positionsLoading, isSashi]);

  useEffect(() => {
    if (Object.keys(simulators).length === 0) return;

    const updatePrices = () => {
      const newPrices: Record<number, number> = {};
      Object.keys(simulators).forEach((pairId) => {
        newPrices[Number(pairId)] = simulators[Number(pairId)].getCurrentPrice();
      });
      setPrices(newPrices);
    };

    updatePrices();
    const interval = setInterval(updatePrices, 1000);
    return () => clearInterval(interval);
  }, [simulators]);

  useEffect(() => {
    if (pairIds.length === 0) return;

    const syncWithBackend = async () => {
      try {
        const response = await api.getForexCurrentPrices(pairIds);
        if (response.status === 403 && response.error === 'Pro-FX account required') {
          toast.error('Pro-FX account required to fetch prices');
          return;
        }
        if (response.data?.prices) {
          setPrices((prev) => ({ ...prev, ...response.data.prices }));
          Object.keys(response.data.prices).forEach((pairId) => {
            if (simulators[Number(pairId)]) {
              const position = positions.find((pos) => pos.pair.id === Number(pairId));
              simulators[Number(pairId)] = new PriceSimulator(
                response.data.prices[pairId],
                isSashi,
                position ? position.direction : 'buy'
              );
              if (position) {
                simulators[Number(pairId)].setEntryTime(position.entry_time);
              }
            }
          });
        }
      } catch (error) {
        console.error('Error syncing prices:', error);
        toast.error('Failed to sync prices with server');
      }
    };

    syncWithBackend();
    const syncInterval = setInterval(syncWithBackend, 30000);
    return () => clearInterval(syncInterval);
  }, [pairIds, simulators, positions, isSashi]);

  useEffect(() => {
    if (pairsError) {
      toast.error(`Failed to load pairs: ${pairsError.message || 'Unknown error'}`);
    }
    if (positionsError) {
      toast.error(`Failed to load positions: ${positionsError.message || 'Unknown error'}`);
    }
  }, [pairsError, positionsError]);

  return { prices, pairIds, isLoading: pairsLoading || positionsLoading, isSashi };
};