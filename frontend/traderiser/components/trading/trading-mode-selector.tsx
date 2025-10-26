
"use client"

import { useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface UserRobot {
  id: number
  robot: {
    id: number
    name: string
  }
}

interface TradingModeSelectorProps {
  onModeChange: (mode: "manual" | "robot") => void
  selectedRobot: number | null
  onRobotSelect: (robotId: number | null) => void
  userRobots: UserRobot[]
}

export function TradingModeSelector({
  onModeChange,
  selectedRobot,
  onRobotSelect,
  userRobots,
}: TradingModeSelectorProps) {
  const [mode, setMode] = useState<"manual" | "robot">("manual")

  const handleModeChange = (value: "manual" | "robot") => {
    setMode(value)
    onModeChange(value)
    if (value === "manual") {
      onRobotSelect(null)
    }
  }

  return (
    <div className="space-y-4 w-full">
      <div>
        <label className="text-xs text-white/60 mb-1 block">Trading Mode</label>
        <Select value={mode} onValueChange={handleModeChange}>
          <SelectTrigger className="w-full bg-white/5 border-white/10 text-white">
            <SelectValue placeholder="Select mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="robot">Robot</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {mode === "robot" && (
        <div>
          <label className="text-xs text-white/60 mb-1 block">Select Robot</label>
          <Select
            value={selectedRobot?.toString() || ""}
            onValueChange={(value) => onRobotSelect(value ? parseInt(value) : null)}
          >
            <SelectTrigger className="w-full bg-white/5 border-white/10 text-white">
              <SelectValue placeholder="Select a robot" />
            </SelectTrigger>
            <SelectContent>
              {userRobots.map(robot => (
                <SelectItem key={robot.robot.id} value={robot.robot.id.toString()}>
                  {robot.robot.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}