"use client"

import type React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"
import { useState, useEffect } from "react"
import { api } from "@/lib/api"
import Image from "next/image"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [accountType, setAccountType] = useState<"demo" | "standard">(
    searchParams.get("type") === "demo" ? "demo" : "standard"
  )
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    setAccountType(searchParams.get("type") === "demo" ? "demo" : "standard")
  }, [searchParams])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
    setError("")
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    // Validation
    if (!formData.email || !formData.password) {
      setError("Please fill in all fields")
      setIsLoading(false)
      return
    }

    try {
      const response = await api.login({
        email: formData.email,
        password: formData.password,
        account_type: accountType,
      })

      if (response.error) {
        setError(response.error)
        setIsLoading(false)
        return
      }

      if (response.data) {
        setSuccess(true)
        router.push("/dashboard")
      }
    } catch (err) {
      setError("Invalid credentials or server error. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md border-white/20 bg-white/5 backdrop-blur-sm">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-2xl text-white">Welcome Back!</CardTitle>
            <CardDescription className="text-white/70">You have successfully logged in</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="flex-shrink-0">
                <div className={`w-16 h-16 rounded-full ${accountType === 'standard' ? 'from-orange-400 to-orange-500' : 'from-blue-400 to-blue-500'} flex items-center justify-center overflow-hidden shadow-md`}>
                  <Image
                    src={accountType === 'standard' ? "/real-account-icon.png" : "/demo-account-icon.png"}
                    alt={accountType === 'standard' ? "Real Account" : "Demo Account"}
                    width={64}
                    height={64}
                    className="w-14 h-14 object-cover"
                  />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{accountType === 'standard' ? "Real Account" : "Demo Account"}</h3>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-2">
              <p className="text-sm text-white/70">Email</p>
              <p className="text-lg font-semibold text-white break-all">{formData.email}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-2">
              <p className="text-sm text-white/70">Account Type</p>
              <p className="text-lg font-semibold text-white">
                {accountType === "demo" ? "Demo Account" : "Real Account"}
              </p>
            </div>
            <Button
              onClick={() => router.push("/dashboard")}
              className="w-full bg-white text-black hover:bg-white/90 font-semibold"
            >
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md border-white/20 bg-white/5 backdrop-blur-sm">
        <CardHeader className="space-y-2">
          <Link href="/" className="inline-flex items-center text-white/70 hover:text-white">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Link>
          <CardTitle className="text-2xl text-white">Log In</CardTitle>
          <CardDescription className="text-white/70">
            {accountType === 'standard' ? "Access your real trading account" : "Practice with your demo account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-shrink-0">
              <div className={`w-10 h-10 rounded-full ${accountType === 'standard' ? 'from-orange-400 to-orange-500' : 'from-blue-400 to-blue-500'} flex items-center justify-center overflow-hidden shadow-md`}>
                <Image
                  src={accountType === 'standard' ? "/real-account-icon.png" : "/demo-account-icon.png"}
                  alt={accountType === 'standard' ? "Real Account" : "Demo Account"}
                  width={64}
                  height={64}
                  className="w-14 h-14 object-cover"
                />
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">{accountType === 'standard' ? "Real Account" : "Demo Account"}</h3>
              <p className="text-sm text-white/70">
                {accountType === 'standard' ? "Trade with real money and earn real profits." : "Practice trading with $10,000 virtual balance."}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAccountType("standard")}
                  className={`flex-1 flex py-2 px-3 rounded-lg font-medium transition-colors ${
                    accountType === "standard"
                      ? "bg-white text-black"
                      : "bg-white/10 text-white border border-white/20 hover:bg-white/20"
                  }`}
                  disabled={isLoading}
                >
                  Real Account
                </button>
                <button
                  type="button"
                  onClick={() => setAccountType("demo")}
                  className={`flex-1 flex py-2 px-3 rounded-lg font-medium transition-colors ${
                    accountType === "demo"
                      ? "bg-white text-black"
                      : "bg-white/10 text-white border border-white/20 hover:bg-white/20"
                  }`}
                  disabled={isLoading}
                >
                  Demo Account
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Email</label>
              <Input
                type="email"
                name="email"
                placeholder="john@example.com"
                value={formData.email}
                onChange={handleChange}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Password</label>
              <Input
                type="password"
                name="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                disabled={isLoading}
              />
            </div>

            <div className="text-right">
              <Link href="#" className="text-sm text-white/70 hover:text-white">
                Forgot password?
              </Link>
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3">
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-white text-black hover:bg-white/90 font-semibold"
              disabled={isLoading}
            >
              {isLoading ? "Logging in..." : "Log In"}
            </Button>

            <p className="text-center text-sm text-white/70">
              Dont have an account?{" "}
              <Link href={`/signup?type=${accountType}`} className="text-white hover:underline font-semibold">
                Sign up
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}