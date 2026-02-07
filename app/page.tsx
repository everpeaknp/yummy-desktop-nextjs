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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Moon, Sun } from "lucide-react";
import apiClient from "@/lib/api-client";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "next-themes";
import { normalizeRoles, getHomeRouteForRoles } from "@/lib/role-permissions";

export default function Home() {
  const [activeTab, setActiveTab] = useState("login");
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();
  const setAuth = useAuth(state => state.setAuth);
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("username", email);
      formData.append("password", password);

      const response = await apiClient.post("/auth/login", formData, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      if (response.data.status === "success") {
        const { access_token, refresh_token, user_id, user_name, email, user_role, user_roles, primary_role, restaurant_id } = response.data.data;
        const roles: string[] = user_roles || (user_role ? [user_role] : []);

        const user = {
          id: user_id,
          full_name: user_name,
          email: email,
          role: user_role,
          roles,
          primary_role: primary_role || user_role || null,
          restaurant_id: restaurant_id
        };

        setAuth(user, access_token, refresh_token);
        router.push(getHomeRouteForRoles(normalizeRoles(roles)));
      }
    } catch (error: any) {
      console.error("Login failed:", error);
      alert(error.response?.data?.detail || "Login failed. Please check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

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

      {/* Animated Login Card */}
      <div className="w-full max-w-md animate-in slide-in-from-bottom-10 fade-in duration-700 delay-200">
        <Tabs defaultValue="login" className="w-full" onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-4 bg-background/50 backdrop-blur-sm border h-11">
            <TabsTrigger value="login" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm">Login</TabsTrigger>
            <TabsTrigger value="register" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm">Register</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="mt-0">
            <Card className="border-none shadow-2xl bg-card/80 backdrop-blur-md">
              <form onSubmit={handleLogin}>
                <CardHeader className="space-y-1">
                  <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
                  <CardDescription>
                    Enter your credentials to access the admin dashboard.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="admin@restaurant.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-background/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      <Link
                        href="/forgot-password"
                        className="ml-auto inline-block text-xs text-primary underline-offset-4 hover:underline"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-background/50"
                    />
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-4">
                  <Button className="w-full h-11 text-base font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all" disabled={isLoading} type="submit">
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
                  <Button variant="outline" className="w-full h-11 bg-background/50" type="button">
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                    Google
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>

          <TabsContent value="register" className="mt-0">
            <Card className="border-none shadow-2xl bg-card/80 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
                <CardDescription>
                  Register your restaurant to get started.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first-name">First name</Label>
                    <Input id="first-name" placeholder="John" required className="bg-background/50" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last-name">Last name</Label>
                    <Input id="last-name" placeholder="Doe" required className="bg-background/50" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="m@example.com" required className="bg-background/50" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" required className="bg-background/50" />
                </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full h-11 text-base font-semibold shadow-lg shadow-primary/25" disabled>
                  Register (Coming Soon)
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

    </main>
  );
}
