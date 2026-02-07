"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import { ReservationApis } from "@/lib/api/endpoints";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Calendar, Clock, User, Phone, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const user = useAuth(state => state.user);
  const me = useAuth(state => state.me);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (!user && token) await me();
      if (!user && !token) router.push('/auth');
    };
    const timer = setTimeout(checkAuth, 500);
    return () => clearTimeout(timer);
  }, [user, me, router]);

  useEffect(() => {
    const fetchReservations = async () => {
      if (!user?.restaurant_id) return;
      setLoading(true);

      try {
        const response = await apiClient.get(ReservationApis.listReservations);
        if (response.data.status === "success") {
          setReservations(response.data.data.reservations || response.data.data || []);
        }
      } catch (err) {
        console.error("Failed to fetch reservations:", err);
      } finally {
        setLoading(false);
      }
    };

    if (user?.restaurant_id) {
      fetchReservations();
    }
  }, [user]);

  return (
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reservations</h1>
          <p className="text-muted-foreground">Manage table bookings and schedules.</p>
        </div>
        <Button className="bg-orange-600 hover:bg-orange-700 text-white">
          <Plus className="w-4 h-4 mr-2" /> New Reservation
        </Button>
      </div>

      <div className="relative w-full md:w-64">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-8 bg-muted/50 border-border" placeholder="Search reservations..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : reservations.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-slate-800 rounded-lg">
          <Calendar className="w-12 h-12 mb-4 opacity-20" />
          <p>No upcoming reservations.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reservations.filter((r) => {
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return (r.customer_name || "").toLowerCase().includes(q) || (r.phone || "").toLowerCase().includes(q) || (r.notes || "").toLowerCase().includes(q);
          }).map((res) => (
            <Card key={res.id} className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 font-bold">
                      {res.customer_name?.[0] || <User className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-white">{res.customer_name || "Guest"}</h3>
                      <p className="text-xs text-slate-400 flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {res.phone || "N/A"}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="border-blue-900/50 bg-blue-950/20 text-blue-500">
                    {res.status || "Confirmed"}
                  </Badge>
                </div>

                <div className="space-y-3 text-sm text-slate-300 border-t border-slate-800 pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-500" />
                      <span>{new Date(res.scheduled_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-500" />
                      <span>{new Date(res.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Guests:</span>
                    <span className="font-semibold">{res.party_size} People</span>
                  </div>
                  {res.notes && (
                    <div className="bg-slate-950/50 p-2 rounded text-xs italic text-slate-500">
                      "{res.notes}"
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
