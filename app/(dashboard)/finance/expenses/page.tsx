"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import { ExpenseApis } from "@/lib/api/endpoints";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TrendingDown, Receipt, Download, ArrowLeft, Plus, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { startOfMonth, startOfWeek, endOfDay, subDays } from "date-fns";
import * as XLSX from "xlsx";
import Link from "next/link";

export default function ExpensesPage() {
  const [loading, setLoading] = useState(false);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [dateFilter, setDateFilter] = useState("this_month");
  const [selectedStation, setSelectedStation] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newExpense, setNewExpense] = useState({
    amount: "",
    description: "",
    station: "other",
    category_id: "",
    payment_method: "cash"
  });

  const user = useAuth(state => state.user);
  const me = useAuth(state => state.me);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (!user && token) await me();
      if (!user && !token) router.push('/');

      if (user?.restaurant_id) {
        try {
          const res = await apiClient.get(ExpenseApis.expenseCategories, {
            params: { restaurant_id: user.restaurant_id }
          });
          if (res.data.status === 'success') {
            setCategories(res.data.data);
          }
        } catch (e) { console.error("Failed to load categories", e); }
      }
    };
    checkAuth();
  }, [user, me, router]);

  const getDateRange = () => {
    const now = new Date();
    let start = "";
    let end = endOfDay(now).toISOString().split('T')[0];

    if (dateFilter === 'today') {
      start = now.toISOString().split('T')[0];
    } else if (dateFilter === 'this_week') {
      start = startOfWeek(now, { weekStartsOn: 1 }).toISOString().split('T')[0];
    } else if (dateFilter === 'this_month') {
      start = startOfMonth(now).toISOString().split('T')[0];
    } else {
      start = subDays(now, 365).toISOString().split('T')[0];
    }
    return { start, end };
  };

  const fetchData = async () => {
    if (!user?.restaurant_id) return;
    setLoading(true);
    const { start, end } = getDateRange();
    const stationParam = selectedStation === 'all' ? undefined : selectedStation;

    try {
      const res = await apiClient.get(ExpenseApis.list, {
        params: {
          restaurant_id: user.restaurant_id,
          date_from: start,
          date_to: end,
          station: stationParam,
          category_id: selectedCategory === 'all' ? undefined : selectedCategory
        }
      });
      if (res.data.status === 'success') {
        setExpenses(res.data.data.expenses || []);
      }
    } catch (err) {
      console.error("Failed to fetch expenses:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = async () => {
    if (!user?.restaurant_id || !newExpense.amount || !newExpense.category_id) {
        toast.error("Please fill in required fields");
        return;
    }

    setSaving(true);
    try {
        const payload = {
            restaurant_id: user.restaurant_id,
            amount: parseFloat(newExpense.amount),
            description: newExpense.description,
            category_id: parseInt(newExpense.category_id),
            payment_method: newExpense.payment_method,
            // Station is inferred from category on backend, but we can pass vendor if we had it.
            // Based on backend ExpenseCreate, it takes restaurant_id, category_id, amount, description, vendor, payment_method, paid_on
        };

        const res = await apiClient.post(ExpenseApis.list, payload);
        if (res.data.status === 'success') {
            toast.success("Expense recorded successfully");
            setIsAddDialogOpen(false);
            setNewExpense({
                amount: "",
                description: "",
                station: "other",
                category_id: "",
                payment_method: "cash"
            });
            fetchData();
        }
    } catch (err) {
        toast.error("Failed to record expense");
    } finally {
        setSaving(false);
    }
  };

  useEffect(() => {
    if (user?.restaurant_id) {
      fetchData();
    }
  }, [user, selectedStation, dateFilter, selectedCategory]);

  const handleExport = () => {
    if (!expenses.length) return;
    const dataToExport = expenses.map((expense: any) => ({
      "Description": expense.description || "Untitled",
      "Category": expense.category?.name || "General",
      "Amount": expense.amount,
      "Date": new Date(expense.expense_date || expense.paid_on).toLocaleDateString(),
      "Status": expense.status || "Completed"
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Expenses");
    XLSX.writeFile(wb, `Expense_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="flex flex-col gap-8 max-w-[1600px] mx-auto p-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/manage">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-red-600 dark:text-red-500">Expenses</h1>
            <p className="text-muted-foreground">Manage and track your operational costs.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedStation} onValueChange={setSelectedStation}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Station" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stations</SelectItem>
              <SelectItem value="kitchen">Kitchen</SelectItem>
              <SelectItem value="bar">Bar</SelectItem>
              <SelectItem value="cafe">Cafe</SelectItem>
              <SelectItem value="general">General</SelectItem>
            </SelectContent>
          </Select>

          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Category:</span>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat: any) => (
                <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport} disabled={!expenses.length}>
            <Download className="w-4 h-4 mr-2" /> Export Excel
          </Button>
          <Button 
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            onClick={() => setIsAddDialogOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" /> Add Expense
          </Button>
        </div>
      </div>

      {/* Add Expense Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
                <DialogTitle>Add New Expense</DialogTitle>
                <DialogDescription>
                    Record a new business expense. Required fields are marked with *.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="amount" className="text-right">Amount*</Label>
                    <Input
                        id="amount"
                        type="number"
                        placeholder="0.00"
                        className="col-span-3"
                        value={newExpense.amount}
                        onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
                    />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="station" className="text-right">Station</Label>
                    <Select 
                        value={newExpense.station} 
                        onValueChange={(val) => setNewExpense({...newExpense, station: val, category_id: ""})}
                    >
                        <SelectTrigger className="col-span-3">
                            <SelectValue placeholder="Select Station" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="kitchen">Kitchen</SelectItem>
                            <SelectItem value="bar">Bar</SelectItem>
                            <SelectItem value="cafe">Cafe</SelectItem>
                            <SelectItem value="other">General / Other</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="category" className="text-right">Category*</Label>
                    <Select 
                        value={newExpense.category_id} 
                        onValueChange={(val) => setNewExpense({...newExpense, category_id: val})}
                    >
                        <SelectTrigger className="col-span-3">
                            <SelectValue placeholder="Select Category" />
                        </SelectTrigger>
                        <SelectContent>
                            {categories
                                .filter((cat: any) => cat.type === newExpense.station || (!cat.type && newExpense.station === 'other'))
                                .map((cat: any) => (
                                    <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
                                ))
                            }
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="method" className="text-right">Payment</Label>
                    <Select 
                        value={newExpense.payment_method} 
                        onValueChange={(val) => setNewExpense({...newExpense, payment_method: val})}
                    >
                        <SelectTrigger className="col-span-3">
                            <SelectValue placeholder="Method" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="card">Card</SelectItem>
                            <SelectItem value="digital">Digital (FonePay/Esewa)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="desc" className="text-right">Notes</Label>
                    <Textarea
                        id="desc"
                        placeholder="What was this for?"
                        className="col-span-3"
                        value={newExpense.description}
                        onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                    />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                <Button 
                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                    onClick={handleAddExpense}
                    disabled={saving}
                >
                    {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Record Expense
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-red-500" />
        </div>
      ) : expenses.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-xl bg-muted/20">
          <Receipt className="w-12 h-12 mb-4 opacity-20" />
          <p>No expenses found for the selected period.</p>
        </div>
      ) : (
        <Card className="border-border">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
                  <tr>
                    <th className="px-6 py-4">Description</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Amount</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {expenses.map((expense: any) => (
                    <tr key={expense.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-medium">{expense.description || "Untitled"}</td>
                      <td className="px-6 py-4 text-muted-foreground">{expense.category?.name || "General"}</td>
                      <td className="px-6 py-4 font-bold text-red-600 dark:text-red-500">- Rs. {Number(expense.amount).toLocaleString()}</td>
                      <td className="px-6 py-4 text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(expense.expense_date || expense.paid_on).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className="border-border text-muted-foreground capitalize">
                          {expense.status || "Completed"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
