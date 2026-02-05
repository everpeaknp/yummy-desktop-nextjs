"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import { ExpenseApis, IncomeApis } from "@/lib/api/endpoints";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, TrendingUp, TrendingDown, DollarSign, Plus, Receipt, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState("income");
  const [loading, setLoading] = useState(false);
  const [incomeData, setIncomeData] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  
  const user = useAuth(state => state.user);
  const me = useAuth(state => state.me);
  const router = useRouter();

  // 1. Session Restoration
  useEffect(() => {
    const checkAuth = async () => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
        if (!user && token) await me();
        if (!user && !token) router.push('/auth');
    };
    const timer = setTimeout(checkAuth, 500);
    return () => clearTimeout(timer);
  }, [user, me, router]);

  // 2. Fetch Data based on Tab
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.restaurant_id) return;
      setLoading(true);
      
      try {
        if (activeTab === 'income') {
             // Default to this month
             const now = new Date();
             const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
             const endOfMonth = now.toISOString().split('T')[0];
             
             const url = IncomeApis.dashboard({
                 restaurantId: user.restaurant_id,
                 dateFrom: startOfMonth,
                 dateTo: endOfMonth
             });
             const res = await apiClient.get(url);
             if (res.data.status === 'success') {
                 setIncomeData(res.data.data);
             }
        } else {
             const res = await apiClient.get(ExpenseApis.list);
             if (res.data.status === 'success') {
                 setExpenses(res.data.data.data || res.data.data);
             }
        }
      } catch (err) {
        console.error("Failed to fetch finance data:", err);
      } finally {
        setLoading(false);
      }
    };

    if (user?.restaurant_id) {
        fetchData();
    }
  }, [user, activeTab]);

  return (
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto p-6">
      <div className="flex items-center justify-between">
         <div>
            <h1 className="text-2xl font-bold tracking-tight">Finance</h1>
            <p className="text-muted-foreground">Manage expenses and track income.</p>
         </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-muted border border-border mb-6">
              <TabsTrigger value="income" className="data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-700 dark:data-[state=active]:bg-emerald-950 dark:data-[state=active]:text-emerald-500">
                  <TrendingUp className="w-4 h-4 mr-2" /> Income
              </TabsTrigger>
              <TabsTrigger value="expenses" className="data-[state=active]:bg-red-100 data-[state=active]:text-red-700 dark:data-[state=active]:bg-red-950 dark:data-[state=active]:text-red-500">
                  <TrendingDown className="w-4 h-4 mr-2" /> Expenses
              </TabsTrigger>
          </TabsList>

          <TabsContent value="income">
              {loading ? <LoadingState /> : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <MetricCard 
                        label="Total Revenue" 
                        value={incomeData?.total_revenue || 0} 
                        icon={<DollarSign className="w-5 h-5" />}
                        color="text-emerald-500"
                        borderColor="border-emerald-500/50"
                      />
                      <MetricCard 
                        label="Net Profit" 
                        value={incomeData?.net_profit || 0} 
                        icon={<TrendingUp className="w-5 h-5" />}
                        color="text-blue-500"
                        borderColor="border-blue-500/50"
                      />
                      {/* Add more metrics as API structure clarifies */}
                  </div>
              )}
          </TabsContent>

          <TabsContent value="expenses">
              <div className="flex justify-end mb-4">
                  <Button className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                      <Plus className="w-4 h-4 mr-2" /> Add Expense
                  </Button>
              </div>
              {loading ? <LoadingState /> : expenses.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-lg">
                      <Receipt className="w-12 h-12 mb-4 opacity-20" />
                      <p>No expenses recorded.</p>
                  </div>
              ) : (
                  <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
                      <table className="w-full text-sm text-left">
                          <thead className="bg-muted text-muted-foreground font-medium border-b border-border">
                              <tr>
                                  <th className="px-6 py-4">Title</th>
                                  <th className="px-6 py-4">Category</th>
                                  <th className="px-6 py-4">Amount</th>
                                  <th className="px-6 py-4">Date</th>
                                  <th className="px-6 py-4">Status</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                              {expenses.map((expense: any) => (
                                  <tr key={expense.id} className="hover:bg-muted/50 transition-colors">
                                      <td className="px-6 py-4 font-medium text-foreground">{expense.title || "Untitled"}</td>
                                      <td className="px-6 py-4 text-muted-foreground">{expense.category_name || "General"}</td>
                                      <td className="px-6 py-4 font-bold text-destructive">- Rs. {expense.amount}</td>
                                      <td className="px-6 py-4 text-muted-foreground">
                                          <div className="flex items-center gap-2">
                                              <Calendar className="w-3 h-3" />
                                              {new Date(expense.created_at).toLocaleDateString()}
                                          </div>
                                      </td>
                                      <td className="px-6 py-4">
                                          <Badge variant="outline" className="border-border text-muted-foreground">
                                              {expense.status || "Completed"}
                                          </Badge>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              )}
          </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({ label, value, icon, color, borderColor }: any) {
    return (
        <Card className={`bg-card border-l-4 shadow-sm ${borderColor} ${color}`}>
            <CardContent className="p-6 flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1 uppercase tracking-wider">{label}</p>
                    <h3 className="text-3xl font-bold text-foreground">Rs. {value.toLocaleString()}</h3>
                </div>
                <div className={`p-3 rounded-lg bg-muted text-card-foreground ${color}`}>
                    {icon}
                </div>
            </CardContent>
        </Card>
    )
}

function LoadingState() {
    return (
        <div className="h-64 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
    )
}
