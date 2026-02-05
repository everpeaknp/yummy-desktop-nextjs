import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChefHat, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-blue-50 to-orange-50 dark:from-slate-950 dark:to-slate-900">
      <div className="flex items-center gap-3 mb-6 animate-in slide-in-from-top-10 fade-in duration-700">
        <div className="p-4 bg-primary rounded-2xl shadow-lg">
             <ChefHat className="w-12 h-12 text-white" />
        </div>
      </div>
      
      <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4 animate-in slide-in-from-bottom-10 fade-in duration-700 delay-100">
        <span className="text-primary">Yummy</span> <span className="text-foreground">Kitchen</span>
      </h1>
      
      <p className="text-xl text-muted-foreground mb-10 max-w-2xl animate-in slide-in-from-bottom-10 fade-in duration-700 delay-200">
        The complete digital partner for your restaurant. Manage orders, tables, and menus with a modern, lightning-fast dashboard.
      </p>
      
      <div className="flex flex-col sm:flex-row gap-4 animate-in slide-in-from-bottom-10 fade-in duration-700 delay-300">
        <Link href="/login">
            <Button size="lg" className="h-12 px-8 text-lg font-semibold shadow-xl hover:shadow-2xl transition-all hover:scale-105">
            Get Started <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
        </Link>
        <Link href="/dashboard">
            <Button variant="outline" size="lg" className="h-12 px-8 text-lg font-semibold bg-background/50 backdrop-blur-sm">
            View Dashboard
            </Button>
        </Link>
      </div>

      <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 text-left max-w-5xl animate-in fade-in duration-1000 delay-500">
         <div className="p-6 bg-white/50 dark:bg-white/5 rounded-xl border shadow-sm backdrop-blur-sm">
            <h3 className="font-bold text-lg mb-2">Real-time Orders</h3>
            <p className="text-muted-foreground">Track incoming orders from dine-in, takeaway, and delivery channels instantly.</p>
         </div>
         <div className="p-6 bg-white/50 dark:bg-white/5 rounded-xl border shadow-sm backdrop-blur-sm">
            <h3 className="font-bold text-lg mb-2">Table Management</h3>
            <p className="text-muted-foreground">Visual floor plan to manage seating, reservations, and occupancy status.</p>
         </div>
         <div className="p-6 bg-white/50 dark:bg-white/5 rounded-xl border shadow-sm backdrop-blur-sm">
            <h3 className="font-bold text-lg mb-2">Menu Control</h3>
            <p className="text-muted-foreground">Update your menu items, prices, and availability across all devices in seconds.</p>
         </div>
      </div>
    </main>
  );
}
