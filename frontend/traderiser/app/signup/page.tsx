"use client"

import type React from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"
import { useState } from "react"
import Image from "next/image"
import { api } from "@/lib/api"

export default function SignupPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const accountType = searchParams.get("type") === "demo" ? "demo" : "standard"
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    username: "",
    phone: "",
  })
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const isRealAccount = accountType === "standard"
  const accountLabel = isRealAccount ? "Real Account" : "Demo Account"
  const accountDescription = isRealAccount
    ? "Trade with real money and earn real profits"
    : "Practice trading with $10,000 virtual balance"
  const iconPath = isRealAccount ? "/real-account-icon.png" : "/demo-account-icon.png"

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

    if (!formData.email || !formData.password || !formData.username) {
      setError("Please fill in all required fields")
      setIsLoading(false)
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match")
      setIsLoading(false)
      return
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters")
      setIsLoading(false)
      return
    }

    try {
      const response = await api.signup({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
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
      setError("Failed to create account. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md border-white/20 bg-white/5 backdrop-blur-sm">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-2xl text-white">Account Created!</CardTitle>
            <CardDescription className="text-white/70">
              Your {accountLabel} has been successfully created
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-2">
              <p className="text-sm text-white/70">Email</p>
              <p className="text-lg font-semibold text-white break-all">{formData.email}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-2">
              <p className="text-sm text-white/70">Account Type</p>
              <p className="text-lg font-semibold text-white">{accountLabel}</p>
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
          <CardTitle className="text-2xl text-white">Sign Up</CardTitle>
          <CardDescription className="text-white/70">{accountDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-shrink-0">
                <div className="w-14 h-14 rounded-full items-center justify-center overflow-hidden">
                  <Image src={iconPath} alt={accountLabel} width={48} height={48} className="object-cover" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">{accountLabel}</h3>
                <p className="text-sm text-white/70">{accountDescription}</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Username</label>
              <Input
                type="text"
                name="username"
                placeholder="john_doe"
                value={formData.username}
                onChange={handleChange}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                disabled={isLoading}
              />
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
              <label className="text-sm font-medium text-white">Phone (Optional)</label>
              <Input
                type="tel"
                name="phone"
                placeholder="+1 (555) 000-0000"
                value={formData.phone}
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

            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Confirm Password</label>
              <Input
                type="password"
                name="confirmPassword"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                disabled={isLoading}
              />
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
              {isLoading ? "Creating Account..." : "Create Account"}
            </Button>

            <p className="text-center text-sm text-white/70">
              Already have an account?{" "}
              <Link href={`/login?type=${accountType}`} className="text-white hover:underline font-semibold">
                Log in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}