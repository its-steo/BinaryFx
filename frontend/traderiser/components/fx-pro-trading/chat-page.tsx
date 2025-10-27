// components/fx-pro-trading/chat-page.tsx
"use client"

import { useState, useEffect, useRef } from "react"
import { Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface Message {
  id: number
  user: string
  avatar: string
  message: string
  timestamp: string
  isOwn: boolean
}

interface ChatPageProps {
  setIsNavVisible?: (visible: boolean) => void;
}

export default function ChatPage({ setIsNavVisible }: ChatPageProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      user: "Trader John",
      avatar: "JJ",
      message: "EURUSD looking bullish on the 1H chart",
      timestamp: "2:30 PM",
      isOwn: false,
    },
    {
      id: 2,
      user: "You",
      avatar: "ME",
      message: "Agreed, resistance at 1.095 is key",
      timestamp: "2:31 PM",
      isOwn: true,
    },
    {
      id: 3,
      user: "Market Analyst",
      avatar: "MA",
      message: "Watch for the ECB announcement at 3 PM",
      timestamp: "2:32 PM",
      isOwn: false,
    },
  ])
  const [newMessage, setNewMessage] = useState("")
  const messagesRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      setMessages([
        ...messages,
        {
          id: messages.length + 1,
          user: "You",
          avatar: "ME",
          message: newMessage,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          isOwn: true,
        },
      ])
      setNewMessage("")
    }
  }

  // Scroll handler for the internal messages container
  useEffect(() => {
    if (!setIsNavVisible) return;

    const handleScroll = () => {
      const currentScrollY = messagesRef.current?.scrollTop || 0;
      if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
        setIsNavVisible(false); // Hide on scroll down past 100px
      } else {
        setIsNavVisible(true); // Show on scroll up or small scroll
      }
      lastScrollY.current = currentScrollY;
    };

    const ref = messagesRef.current;
    if (ref) {
      ref.addEventListener("scroll", handleScroll, { passive: true });
    }
    return () => {
      if (ref) {
        ref.removeEventListener("scroll", handleScroll);
      }
    };
  }, [setIsNavVisible]);

  return (
    <div className="flex flex-col h-screen bg-background p-4 md:p-6">
      <h1 className="text-3xl font-bold text-foreground mb-6">Market Chat</h1>

      {/* Messages Container */}
      <div ref={messagesRef} className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.isOwn ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-xs px-4 py-2 rounded-lg ${
                msg.isOwn
                  ? "bg-primary text-primary-foreground rounded-br-none"
                  : "bg-card border border-border text-foreground rounded-bl-none"
              }`}
            >
              {!msg.isOwn && <p className="text-xs font-semibold mb-1 opacity-70">{msg.user}</p>}
              <p className="text-sm">{msg.message}</p>
              <p className="text-xs mt-1 opacity-50">{msg.timestamp}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
          className="flex-1 bg-card border-border"
        />
        <Button onClick={handleSendMessage} className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}