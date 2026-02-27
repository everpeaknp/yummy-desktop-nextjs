"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Moon, Sun, Lock, ArrowLeft } from "lucide-react";
import apiClient from "@/lib/api-client";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "next-themes";
import { normalizeRoles, getHomeRouteForRoles } from "@/lib/role-permissions";
import { signInWithGoogle } from "@/lib/firebase";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState("login");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Login fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Register fields
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // OTP verification state (after admin register)
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpEmail, setOtpEmail] = useState("");
  const [otpName, setOtpName] = useState("");
  const [otpPassword, setOtpPassword] = useState("");
  const [otpConfirm, setOtpConfirm] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  const router = useRouter();
  const setAuth = useAuth(state => state.setAuth);
  const setRedirecting = useAuth(state => state.setRedirecting);
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Helper: handle successful auth response (login or google)
  const handleAuthSuccess = useCallback((data: any) => {
    setRedirecting(true);
    const { access_token, refresh_token, user_id, user_name, email: userEmail, user_role, user_roles, primary_role, restaurant_id } = data;
    const roles: string[] = user_roles || (user_role ? [user_role] : []);
    const user = {
      id: user_id,
      full_name: user_name,
      email: userEmail,
      role: user_role,
      roles,
      primary_role: primary_role || user_role || null,
      restaurant_id: restaurant_id,
    };
    setAuth(user, access_token, refresh_token);
    // Use router.push for faster client-side navigation.
    // The GlobalLoaderOverlay will still provide instant visual feedback.
    router.push(getHomeRouteForRoles(normalizeRoles(roles)));
  }, [setAuth, router]);

  // Helper: extract error message
  const extractError = (err: any): string => {
    if (err?.response?.data?.detail) return err.response.data.detail;
    if (err?.response?.data?.message) return err.response.data.message;
    if (err?.message) return err.message;
    return "Something went wrong. Please try again.";
  };

  // ── Login ──────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("username", email.trim().toLowerCase());
      formData.append("password", password);
      const response = await apiClient.post("/auth/login", formData, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      if (response.data.status === "success") {
        handleAuthSuccess(response.data.data);
        // We DO NOT setIsLoading(false) here because we want to keep the loading state active during redirection
        return; 
      }
    } catch (err: any) {
      setError(extractError(err));
      setIsLoading(false);
    }
    // Only reach here if success was not achieved or error occurred
  };

  // ── Google OAuth ──────────────────────────────────
  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setError(null);
    try {
      const idToken = await signInWithGoogle();
      const response = await apiClient.post("/auth/firebase/google", { idToken });
      if (response.data.status === "success") {
        const payload = response.data.data;
        // Backend returns standard login with flat structure or Google auth with nested "user" object
        let flatData;
        if (payload.user) {
          flatData = {
            access_token: payload.access_token,
            refresh_token: payload.access_token, // Backend doesn't return refresh token for Google auth currently, using access token as fallback or empty
            user_id: payload.user.id,
            user_name: payload.user.name,
            email: payload.user.email,
            user_role: payload.user.role,
            user_roles: payload.user.roles,
            primary_role: payload.user.primary_role,
            restaurant_id: payload.user.restaurant_id,
          };
        } else {
          flatData = payload;
        }
        
        handleAuthSuccess(flatData);
        // Keep isGoogleLoading(true) during redirection
        return;
      }
    } catch (err: any) {
      // User closed popup is not an error
      if (err?.code === "auth/popup-closed-by-user") {
        setIsGoogleLoading(false);
        return;
      }
      setError(extractError(err));
      setIsGoogleLoading(false);
    }
  };

  // ── Admin Register ────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (regPassword !== regConfirm) {
      setError("Passwords do not match");
      return;
    }
    if (!acceptedTerms) {
      setError("Please accept the Terms & Conditions to sign up.");
      return;
    }
    setIsLoading(true);
    try {
      const response = await apiClient.post("/users/admin/register", {
        name: regName.trim(),
        email: regEmail.trim().toLowerCase(),
        password: regPassword,
        confirm_password: regConfirm,
      });
      // Success: show OTP screen
      setOtpEmail(regEmail.trim().toLowerCase());
      setOtpName(regName.trim());
      setOtpPassword(regPassword);
      setOtpConfirm(regConfirm);
      setShowOtp(true);
      setResendCooldown(60);
      setError(null);
    } catch (err: any) {
      const msg = extractError(err).toLowerCase();
      // If OTP already sent, still navigate to OTP screen
      if (msg.includes("otp") && (msg.includes("already") || msg.includes("wait"))) {
        setOtpEmail(regEmail.trim().toLowerCase());
        setOtpName(regName.trim());
        setOtpPassword(regPassword);
        setOtpConfirm(regConfirm);
        setShowOtp(true);
        // Try to extract remaining seconds
        const match = msg.match(/(\d+)/);
        setResendCooldown(match ? parseInt(match[1]) : 30);
      }
      setError(extractError(err));
    } finally {
      setIsLoading(false);
    }
  };

  // ── Verify OTP ────────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await apiClient.post("/users/admin/register/verify", {
        name: otpName,
        email: otpEmail,
        password: otpPassword,
        confirm_password: otpConfirm,
        otp: otp.trim(),
      });
      // Auto-login after successful verification (matches Flutter)
      const formData = new FormData();
      formData.append("username", otpEmail);
      formData.append("password", otpPassword);
      const loginRes = await apiClient.post("/auth/login", formData, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      if (loginRes.data.status === "success") {
        handleAuthSuccess(loginRes.data.data);
        // Keep loading state true for redirection
        return;
      }
    } catch (err: any) {
      setError(extractError(err));
      setIsLoading(false);
    }
  };

  // ── Resend OTP ────────────────────────────────────
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    try {
      await apiClient.post("/users/admin/register/resend", { email: otpEmail });
      setResendCooldown(60);
    } catch (err: any) {
      setError(extractError(err));
    }
  };

  // ── OTP Screen ────────────────────────────────────
  if (showOtp) {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center p-6 bg-gradient-to-br from-blue-50 to-orange-50 dark:from-slate-950 dark:to-slate-900 transition-colors duration-500">
        <div className="w-full max-w-md animate-in slide-in-from-bottom-10 fade-in duration-500">
          <Card className="border-none shadow-2xl bg-card/80 backdrop-blur-md">
            <form onSubmit={handleVerifyOtp}>
              <CardHeader className="space-y-1">
                <button type="button" onClick={() => { setShowOtp(false); setError(null); }} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2 w-fit">
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <CardTitle className="text-2xl font-bold">Verify Email</CardTitle>
                <CardDescription>
                  We sent a verification code to <span className="font-medium text-foreground">{otpEmail}</span>
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
                  {isLoading ? "Verifying..." : "Verify & Sign In"}
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
        </div>
      </main>
    );
  }

  // ── Main Auth Screen ──────────────────────────────
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center p-6 bg-gradient-to-br from-blue-50 to-orange-50 dark:from-slate-950 dark:to-slate-900 transition-colors duration-500">

      {/* Direct Theme Toggle */}
      <div className="absolute top-6 right-6 flex items-center gap-2 animate-in fade-in duration-700">
        {mounted && (
          <div className="flex items-center p-1 bg-background/50 backdrop-blur-md rounded-full border shadow-sm">
            <button
              onClick={() => setTheme("light")}
              className={`p-2 rounded-full transition-all duration-300 ${theme === 'light'
                ? 'bg-white text-orange-500 shadow-md scale-110'
                : 'text-muted-foreground hover:text-foreground'
                }`}
              aria-label="Light Mode"
            >
              <Sun className="w-5 h-5" />
            </button>
            <button
              onClick={() => setTheme("dark")}
              className={`p-2 rounded-full transition-all duration-300 ${theme === 'dark'
                ? 'bg-slate-800 text-blue-400 shadow-md scale-110'
                : 'text-muted-foreground hover:text-foreground'
                }`}
              aria-label="Dark Mode"
            >
              <Moon className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Animated Logo Section */}
      <div className="flex flex-col items-center gap-4 mb-8 animate-in slide-in-from-top-10 fade-in duration-700">
        <div className="relative w-20 h-20 transition-transform hover:scale-105 duration-500">
          <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
          <img
            src="/refresh_icon.png"
            alt="Yummy Logo"
            className="relative w-full h-full object-contain drop-shadow-xl"
          />
        </div>
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight">
            <span className="text-primary">Yummy</span> <span className="text-foreground">Kitchen</span>
          </h1>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto">
            Manage your restaurant with ease and style.
          </p>
        </div>
      </div>

      {/* Auth Card */}
      <div className="w-full max-w-md animate-in slide-in-from-bottom-10 fade-in duration-700 delay-200">
        <Tabs defaultValue="login" className="w-full" value={activeTab} onValueChange={(v) => { setActiveTab(v); setError(null); }}>
          <TabsList className="grid w-full grid-cols-2 mb-4 bg-background/50 backdrop-blur-sm border h-11">
            <TabsTrigger value="login" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm">Login</TabsTrigger>
            <TabsTrigger value="register" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm">Register</TabsTrigger>
          </TabsList>

          {/* ── Login Tab ── */}
          <TabsContent value="login" className="mt-0">
            <Card className="border-none shadow-2xl bg-card/80 backdrop-blur-md">
              <form onSubmit={handleLogin}>
                <CardHeader className="space-y-1">
                  <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
                  <CardDescription>
                    Enter your credentials to access the dashboard.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {error && (
                    <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium">{error}</div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="admin@restaurant.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-background/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-background/50"
                    />
                    <div className="flex justify-start">
                      <Link
                        href="/forgot-password"
                        className="text-xs text-primary underline-offset-4 hover:underline font-medium"
                      >
                        Forgot password?
                      </Link>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-4">
                  <Button className="w-full h-11 text-base font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all" disabled={isLoading || isGoogleLoading} type="submit">
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isLoading ? "Signing in..." : "Sign In"}
                  </Button>
                  <div className="relative w-full">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full h-11 bg-background/50"
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading || isGoogleLoading}
                  >
                    {isGoogleLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <GoogleIcon className="mr-2 h-4 w-4" />
                    )}
                    {isGoogleLoading ? "Connecting..." : "Google"}
                  </Button>
                  <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                    <Lock className="h-3 w-3" />
                    <span>Secure & encrypted sign-in</span>
                  </div>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>

          {/* ── Register Tab ── */}
          <TabsContent value="register" className="mt-0">
            <Card className="border-none shadow-2xl bg-card/80 backdrop-blur-md">
              <form onSubmit={handleRegister}>
                <CardHeader className="space-y-1">
                  <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
                  <CardDescription>
                    Register your restaurant to get started.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {error && (
                    <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium">{error}</div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="reg-name">Full Name</Label>
                    <Input
                      id="reg-name"
                      placeholder="John Doe"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      className="bg-background/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-email">Email</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      placeholder="you@restaurant.com"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="bg-background/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-password">Password</Label>
                    <Input
                      id="reg-password"
                      type="password"
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="bg-background/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-confirm">Confirm Password</Label>
                    <Input
                      id="reg-confirm"
                      type="password"
                      required
                      value={regConfirm}
                      onChange={(e) => setRegConfirm(e.target.value)}
                      className="bg-background/50"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="terms"
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                    <label htmlFor="terms" className="text-sm text-muted-foreground">
                      I agree to the <span className="text-primary font-medium cursor-pointer hover:underline">Terms & Conditions</span>
                    </label>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-4">
                  <Button className="w-full h-11 text-base font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all" disabled={isLoading || isGoogleLoading} type="submit">
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isLoading ? "Creating account..." : "Sign Up"}
                  </Button>
                  <div className="relative w-full">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full h-11 bg-background/50"
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading || isGoogleLoading}
                  >
                    {isGoogleLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <GoogleIcon className="mr-2 h-4 w-4" />
                    )}
                    {isGoogleLoading ? "Connecting..." : "Google"}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

    </main>
  );
}
