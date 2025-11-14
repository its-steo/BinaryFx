// components/robot-marketplace.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface Robot {
  id: number;
  name: string;
  description: string;
  price: string;
  available_for_demo: boolean;
  image?: string;
}

interface UserRobot {
  robot: {
    id: number;
  };
  purchased_at: string | null;
}

interface RobotMarketplaceProps {
  balance: number;
  onBalanceChange: (balance: number) => void;
}

export function RobotMarketplace({ balance, onBalanceChange }: RobotMarketplaceProps) {
  const [robots, setRobots] = useState<Robot[]>([]);
  const [ownedRobotIds, setOwnedRobotIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [purchasingId, setPurchasingId] = useState<number | null>(null);
  const [loginType, setLoginType] = useState<"real" | "demo">("real");

  // Sync login type from localStorage
  useEffect(() => {
    const type = (localStorage.getItem("login_type") as "real" | "demo") || "real";
    setLoginType(type);
  }, []);

  // Fetch robots + owned status
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [robotsRes, userRobotsRes] = await Promise.all([
          api.getRobots(),
          api.getUserRobots(),
        ]);

        if (robotsRes.error) throw new Error(robotsRes.error);
        if (userRobotsRes.error) throw new Error(userRobotsRes.error);

        const ownedIds = new Set<number>(
          (userRobotsRes.data as UserRobot[])
            .filter((ur: UserRobot) => ur.purchased_at !== null)
            .map((ur: UserRobot) => ur.robot.id)
        );

        setRobots(robotsRes.data as Robot[]);
        setOwnedRobotIds(ownedIds);
      } catch (err) {
        toast.error("Failed to load marketplace");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handlePurchaseRobot = async (robotId: number, priceStr: string) => {
    if (loginType === "demo") {
      toast.error("Purchasing is disabled in demo mode");
      return;
    }

    const price = Number(priceStr);
    if (isNaN(price) || balance < price) {
      toast.error("Insufficient balance");
      return;
    }

    setPurchasingId(robotId);

    try {
      const response = await api.purchaseRobot(robotId);
      if (response.error) throw new Error(response.error);

      const newBalance = balance - price;
      onBalanceChange(newBalance);
      setOwnedRobotIds((prev) => new Set(prev).add(robotId));
      toast.success("Robot purchased successfully!");
    } catch (err) {
      toast.error("Purchase failed. Try again.");
    } finally {
      setPurchasingId(null);
    }
  };

  if (isLoading) {
    return <p className="text-white/60">Loading robots...</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {robots.map((robot) => {
        const priceNum = Number(robot.price);
        const isOwned = ownedRobotIds.has(robot.id);
        const isDemoMode = loginType === "demo";

        return (
          <div
            key={robot.id}
            className="rounded-2xl p-6 bg-white/10 backdrop-blur-md border border-white/20 flex flex-col"
          >
            {robot.image && (
              <img
                src={robot.image}
                alt={robot.name}
                className="w-full h-40 object-cover rounded-lg mb-4"
              />
            )}
            <div className="flex-1">
              <h3 className="text-lg font-bold text-white mb-2">{robot.name}</h3>
              <p className="text-sm text-white/60 mb-4">{robot.description}</p>
              {robot.available_for_demo && (
                <p className="text-xs text-green-400 mb-4">Available for demo</p>
              )}
            </div>

            <div className="flex items-center justify-between mt-6 pt-6 border-t border-white/20">
              <p className="text-2xl font-bold text-white">
                {isDemoMode ? "Free" : `$${priceNum.toFixed(2)}`}
              </p>
              <Button
                onClick={() => handlePurchaseRobot(robot.id, robot.price)}
                disabled={
                  isDemoMode ||
                  isOwned ||
                  purchasingId === robot.id ||
                  isNaN(priceNum) ||
                  (!isDemoMode && balance < priceNum)
                }
                className="bg-pink-500 hover:bg-pink-600 text-white disabled:opacity-50"
              >
                {purchasingId === robot.id
                  ? "Purchasing..."
                  : isOwned
                  ? "Owned"
                  : isDemoMode
                  ? "Demo Only"
                  : "Purchase"}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}