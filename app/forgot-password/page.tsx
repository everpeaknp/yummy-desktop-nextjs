"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import apiClient from "@/lib/api-client";

type Step = "email" | "otp" | "reset" | "done";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("email");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Email step
  const [email, setEmail] = useState("");

  // OTP step
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // Reset step
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const extractError = (err: any): string => {
    if (err?.response?.data?.detail) return err.response.data.detail;
    if (err?.response?.data?.message) return err.response.data.message;
    if (err?.message) return err.message;
    return "Something went wrong. Please try again.";
  };

  // Step 1: Send OTP to email
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await apiClient.post("/auth/forgot-password", {
        email: email.trim().toLowerCase(),
      });
      setStep("otp");
      setResendCooldown(60);
    } catch (err: any) {
      setError(extractError(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify OTP → get reset_token
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.post("/auth/verify-reset-otp", {
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
      });
      const data = response.data?.data;
      const token = data?.reset_token || data?.resetToken || data?.token || data;
      if (token && typeof token === "string") {
        setResetToken(token);
        setStep("reset");
      } else {
        setError("Failed to get reset token. Please try again.");
      }
    } catch (err: any) {
      setError(extractError(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Set new password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await apiClient.post("/auth/reset-password", {
        reset_token: resetToken,
        new_password: newPassword,
      });
      setStep("done");
    } catch (err: any) {
      setError(extractError(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    try {
      await apiClient.post("/auth/forgot-password", {
        email: email.trim().toLowerCase(),
      });
      setResendCooldown(60);
    } catch (err: any) {
      setError(extractError(err));
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center p-6 bg-gradient-to-br from-blue-50 to-orange-50 dark:from-slate-950 dark:to-slate-900 transition-colors duration-500">
      <div className="w-full max-w-md animate-in slide-in-from-bottom-10 fade-in duration-500">

        {/* ── Step: Enter Email ── */}
        {step === "email" && (
          <Card className="border-none shadow-2xl bg-card/80 backdrop-blur-md">
            <form onSubmit={handleSendOtp}>
              <CardHeader className="space-y-1">
                <Link href="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2 w-fit">
                  <ArrowLeft className="h-4 w-4" /> Back to login
                </Link>
                <CardTitle className="text-2xl font-bold">Forgot Password</CardTitle>
                <CardDescription>
                  Enter your email and we&apos;ll send you a verification code to reset your password.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && (
                  <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium">{error}</div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@restaurant.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-background/50"
                    autoFocus
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full h-11 text-base font-semibold" disabled={isLoading} type="submit">
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isLoading ? "Sending..." : "Send Verification Code"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        )}

        {/* ── Step: Enter OTP ── */}
        {step === "otp" && (
          <Card className="border-none shadow-2xl bg-card/80 backdrop-blur-md">
            <form onSubmit={handleVerifyOtp}>
              <CardHeader className="space-y-1">
                <button type="button" onClick={() => { setStep("email"); setError(null); }} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2 w-fit">
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <CardTitle className="text-2xl font-bold">Enter Code</CardTitle>
                <CardDescription>
                  We sent a verification code to <span className="font-medium text-foreground">{email}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && (
                  <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium">{error}</div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="otp">Verification Code</Label>
                  <Input
                    id="otp"
                    type="text"
                    placeholder="Enter 6-digit code"
                    required
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="bg-background/50 text-center text-lg tracking-[0.3em] font-mono"
                    maxLength={6}
                    autoFocus
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
                <Button className="w-full h-11 text-base font-semibold" disabled={isLoading || otp.length < 4} type="submit">
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isLoading ? "Verifying..." : "Verify Code"}
                </Button>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0}
                  className="text-sm text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
                >
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
                </button>
              </CardFooter>
            </form>
          </Card>
        )}

        {/* ── Step: Set New Password ── */}
        {step === "reset" && (
          <Card className="border-none shadow-2xl bg-card/80 backdrop-blur-md">
            <form onSubmit={handleResetPassword}>
              <CardHeader className="space-y-1">
                <CardTitle className="text-2xl font-bold">New Password</CardTitle>
                <CardDescription>
                  Enter your new password below.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && (
                  <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium">{error}</div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-background/50"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-background/50"
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full h-11 text-base font-semibold" disabled={isLoading} type="submit">
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isLoading ? "Resetting..." : "Reset Password"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        )}

        {/* ── Step: Done ── */}
        {step === "done" && (
          <Card className="border-none shadow-2xl bg-card/80 backdrop-blur-md">
            <CardHeader className="space-y-1 items-center text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-2" />
              <CardTitle className="text-2xl font-bold">Password Reset</CardTitle>
              <CardDescription>
                Your password has been reset successfully. You can now sign in with your new password.
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Link href="/" className="w-full">
                <Button className="w-full h-11 text-base font-semibold">
                  Back to Sign In
                </Button>
              </Link>
            </CardFooter>
          </Card>
        )}

      </div>
    </main>
  );
}
