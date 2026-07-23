"use client";

import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { getHomeRouteForUser } from "@/lib/role-permissions";

export default function WelcomePage() {
  const user = useAuth((state) => state.user);
  const logout = useAuth((state) => state.logout);
  const router = useRouter();

  // Restaurant owners (and anyone with a real dashboard role) should never stay here.
  useEffect(() => {
    if (!user) return;
    if (user.restaurant_id) {
      router.replace(getHomeRouteForUser(user));
    }
  }, [user, router]);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  if (user?.restaurant_id) {
    return null;
  }

  return (
    <div className="flex h-full w-full items-center justify-center p-6">
      <Card className="max-w-md border-none shadow-2xl bg-card/80 backdrop-blur-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-orange-500/10">
            <ShieldAlert className="h-10 w-10 text-orange-500" />
          </div>
          <CardTitle className="text-2xl font-bold">Welcome, {user?.full_name || "User"}!</CardTitle>
          <CardDescription className="text-base">
            Your account is currently waiting for role assignment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <p className="text-sm text-muted-foreground">
            You have successfully signed in, but your account does not have a specific role assigned (like Cashier, Kitchen, or Waiter) to access the POS system.
          </p>
          <div className="rounded-lg bg-muted p-4 text-sm font-medium">
            Please ask your Restaurant Manager to assign you a role in the Staff Management settings.
          </div>
          <Button 
            onClick={handleLogout} 
            variant="outline" 
            className="w-full h-12 font-bold uppercase tracking-widest text-xs"
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
