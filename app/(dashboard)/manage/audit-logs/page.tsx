"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { 
    ChevronLeft,
    Search,
    RefreshCw,
    User,
    Calendar,
    Info,
    SearchX,
    AlertCircle,
    Layers,
    FileText,
    Shield,
    Clock,
    Monitor,
    ArrowRight,
    X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import { HistoryApis } from "@/lib/api/endpoints";
import { useRouter } from "next/navigation";

function formatLogDateTime(dateStr: string | Date) {
    if (!dateStr) return "";
    const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }) + " " + date.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });
}

function getEventTitle(log: any) {
    const event = (log.event || '').toLowerCase();
    const entity = log.entity_type || 'Entity';
    if (event.includes('status_changed')) return `${entity} Status changed`;
    if (event.includes('create')) return `${entity} Created`;
    if (event.includes('update')) return `${entity} Updated`;
    if (event.includes('delete')) return `${entity} Deleted`;
    return log.event || 'Unknown Event';
}

export default function AuditLogsPage() {
    const user = useAuth(state => state.user);
    const router = useRouter();
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [entityFilter, setEntityFilter] = useState("all");
    const [actionFilter, setActionFilter] = useState("all");
    const [selectedLog, setSelectedLog] = useState<any>(null);

    const fetchLogs = useCallback(async () => {
        if (!user?.restaurant_id) return;
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('restaurant_id', user.restaurant_id.toString());
            params.set('limit', '100');
            if (entityFilter !== 'all') params.set('entity_type', entityFilter);
            if (actionFilter !== 'all') params.set('event', actionFilter);
            
            const res = await apiClient.get(HistoryApis.listAuditLogs(params.toString()));
            if (res.data.status === "success") {
                setLogs(res.data.data.items || []);
            }
        } catch (error) {
            console.error("Failed to fetch logs:", error);
            toast.error("Failed to load audit logs");
        } finally {
            setLoading(false);
        }
    }, [user?.restaurant_id, entityFilter, actionFilter]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const getActionBadge = (event: string) => {
        const e = (event || '').toLowerCase();
        if (e.includes('create')) return <Badge variant="default" className="bg-emerald-600">CREATE</Badge>;
        if (e.includes('update') || e.includes('change')) return <Badge variant="default" className="bg-blue-600">UPDATE</Badge>;
        if (e.includes('delete')) return <Badge variant="destructive">DELETE</Badge>;
        if (e.includes('login')) return <Badge variant="secondary">LOGIN</Badge>;
        return <Badge variant="outline" className="uppercase">{event || 'UNKNOWN'}</Badge>;
    };

    const formatValue = (val: any): string => {
        if (val === null || val === undefined) return '—';
        if (typeof val === 'object') {
            const keys = Object.keys(val);
            if (keys.length === 0) return '—';
            if (keys.length <= 3) {
                return keys.map(k => `${k}: ${val[k]}`).join(', ');
            }
            return keys.slice(0, 3).map(k => `${k}: ${val[k]}`).join(', ') + ` (+${keys.length - 3} more)`;
        }
        const str = String(val);
        return str.length > 60 ? str.slice(0, 57) + '...' : str;
    };

    const getLogSummary = (log: any) => {
        const event = (log.event || '').toLowerCase();
        if (event.includes('create')) return `Created ${log.entity_type} #${log.entity_id}`;
        if (event.includes('delete')) return `Deleted ${log.entity_type} #${log.entity_id}`;
        if (log.change_field) return `Changed: ${log.change_field}`;
        if (event.includes('update')) return `Updated ${log.entity_type} #${log.entity_id}`;
        return log.event || 'Action performed';
    };

    const filteredLogs = logs.filter(log => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            log.event?.toLowerCase().includes(q) ||
            log.actor_name?.toLowerCase().includes(q) ||
            log.entity_type?.toLowerCase().includes(q) ||
            log.entity_id?.toString().includes(q) ||
            log.change_field?.toLowerCase().includes(q)
        );
    });

    return (
        <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <button 
                        onClick={() => router.push('/manage')}
                        className="flex items-center text-sm text-muted-foreground hover:text-primary transition-colors mb-2"
                    >
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        Back to Manage
                    </button>
                    <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
                    <p className="text-muted-foreground text-sm">
                        Track all administrative changes and system activity for compliance.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={fetchLogs} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card className="p-4 flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search by event, actor, entity, or ID..." 
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <Select value={entityFilter} onValueChange={setEntityFilter}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Entity Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Entities</SelectItem>
                            <SelectItem value="order">Orders</SelectItem>
                            <SelectItem value="menu_item">Menu Items</SelectItem>
                            <SelectItem value="staff">Staff</SelectItem>
                            <SelectItem value="restaurant">Restaurant</SelectItem>
                            <SelectItem value="inventory">Inventory</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={actionFilter} onValueChange={setActionFilter}>
                        <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Action" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Actions</SelectItem>
                            <SelectItem value="create">Create</SelectItem>
                            <SelectItem value="update">Update</SelectItem>
                            <SelectItem value="delete">Delete</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </Card>

            {/* Table */}
            <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[180px]">Timestamp</TableHead>
                            <TableHead className="w-[150px]">Actor</TableHead>
                            <TableHead className="w-[120px]">Target</TableHead>
                            <TableHead className="w-[100px]">Action</TableHead>
                            <TableHead>Details</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-48 text-center text-muted-foreground">
                                    <div className="flex items-center justify-center gap-2">
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        Fetching security logs...
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : filteredLogs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-48 text-center text-muted-foreground">
                                    <div className="flex flex-col items-center gap-2">
                                        <SearchX className="w-8 h-8 text-muted-foreground/50" />
                                        <p>No activity logs found matching your criteria.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredLogs.map((log) => (
                                <TableRow 
                                    key={log.id} 
                                    className="hover:bg-slate-50/50 cursor-pointer"
                                    onClick={() => setSelectedLog(log)}
                                >
                                    <TableCell className="text-xs font-mono text-muted-foreground">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-3 h-3 text-slate-400" />
                                            {formatLogDateTime(log.created_at)}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center">
                                                <User className="w-3 h-3 text-primary" />
                                            </div>
                                            <span className="text-sm font-medium">{log.actor_name || "System"}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-slate-700">{log.entity_type}</span>
                                            <span className="text-[10px] text-muted-foreground">ID: #{log.entity_id}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {getActionBadge(log.event)}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-slate-600 line-clamp-1">
                                                {getLogSummary(log)}
                                            </span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </Card>

            {/* Detail Dialog */}
            <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
                <DialogContent className="max-w-[600px] max-h-[85vh] overflow-y-auto">
                    {selectedLog && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-lg">
                                    <ChevronLeft className="w-4 h-4 cursor-pointer hover:text-primary" onClick={() => setSelectedLog(null)} />
                                    Audit Log Details
                                </DialogTitle>
                            </DialogHeader>

                            {/* Summary Card */}
                            <Card className="border-slate-200">
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mt-0.5">
                                                <RefreshCw className="w-5 h-5 text-slate-500" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-base">{getEventTitle(selectedLog)}</h3>
                                                {selectedLog.change_field && (
                                                    <p className="text-sm text-emerald-600 font-medium">Changed: {selectedLog.change_field}</p>
                                                )}
                                                <p className="text-sm text-muted-foreground">{selectedLog.entity_type}</p>
                                                <p className="text-xs text-muted-foreground">{formatLogDateTime(selectedLog.created_at)}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-semibold">{selectedLog.actor_name || 'System'}</p>
                                            <Badge variant="outline" className="text-[10px] uppercase">
                                                {selectedLog.actor_role || 'SYSTEM'}
                                            </Badge>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Action Information */}
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-bold">Action Information</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                                        <div>
                                            <p className="text-xs text-muted-foreground">Event</p>
                                            <p className="text-sm font-medium">{selectedLog.event}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Layers className="w-5 h-5 text-orange-500 shrink-0" />
                                        <div>
                                            <p className="text-xs text-muted-foreground">Entity Type</p>
                                            <p className="text-sm font-medium">{selectedLog.entity_type}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <FileText className="w-5 h-5 text-blue-500 shrink-0" />
                                        <div>
                                            <p className="text-xs text-muted-foreground">Entity ID</p>
                                            <p className="text-sm font-medium">#{selectedLog.entity_id}</p>
                                        </div>
                                    </div>
                                    {selectedLog.change_field && (
                                        <div className="flex items-center gap-3">
                                            <FileText className="w-5 h-5 text-purple-500 shrink-0" />
                                            <div>
                                                <p className="text-xs text-muted-foreground">Changed Field</p>
                                                <p className="text-sm font-medium">{selectedLog.change_field}</p>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Actor Information */}
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-bold">Actor Information</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <User className="w-5 h-5 text-red-500 shrink-0" />
                                        <div>
                                            <p className="text-xs text-muted-foreground">Actor</p>
                                            <p className="text-sm font-medium">{selectedLog.actor_name || 'System'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Shield className="w-5 h-5 text-red-500 shrink-0" />
                                        <div>
                                            <p className="text-xs text-muted-foreground">Role</p>
                                            <p className="text-sm font-medium uppercase">{selectedLog.actor_role || 'SYSTEM'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Clock className="w-5 h-5 text-red-500 shrink-0" />
                                        <div>
                                            <p className="text-xs text-muted-foreground">Timestamp</p>
                                            <p className="text-sm font-medium">{formatLogDateTime(selectedLog.created_at)}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Monitor className="w-5 h-5 text-red-500 shrink-0" />
                                        <div>
                                            <p className="text-xs text-muted-foreground">Source</p>
                                            <p className="text-sm font-medium uppercase">{selectedLog.source || 'UNKNOWN'}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Changes */}
                            {(selectedLog.old_value || selectedLog.new_value) && (() => {
                                const oldVal = selectedLog.old_value || {};
                                const newVal = selectedLog.new_value || {};
                                const isObjOld = typeof oldVal === 'object' && oldVal !== null;
                                const isObjNew = typeof newVal === 'object' && newVal !== null;

                                // Simple value change (not objects)
                                if (!isObjOld && !isObjNew) {
                                    return (
                                        <Card>
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-sm font-bold flex items-center gap-2">
                                                    <ArrowRight className="w-4 h-4 text-purple-500" />
                                                    Changes
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                                                    <div className="flex-1 text-center">
                                                        <p className="text-[10px] uppercase text-muted-foreground mb-1">Before</p>
                                                        <p className="text-sm font-medium text-red-600 bg-red-50 rounded px-2 py-1">{String(oldVal || '—')}</p>
                                                    </div>
                                                    <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                                                    <div className="flex-1 text-center">
                                                        <p className="text-[10px] uppercase text-muted-foreground mb-1">After</p>
                                                        <p className="text-sm font-medium text-emerald-600 bg-emerald-50 rounded px-2 py-1">{String(newVal || '—')}</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                }

                                // Object change — show as a key-value comparison table
                                const allKeys = Array.from(new Set([
                                    ...(isObjOld ? Object.keys(oldVal) : []),
                                    ...(isObjNew ? Object.keys(newVal) : []),
                                ]));

                                const formatCellValue = (v: any): string => {
                                    if (v === null || v === undefined) return '—';
                                    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
                                    if (typeof v === 'object') return JSON.stringify(v);
                                    return String(v);
                                };

                                const formatFieldName = (key: string): string => {
                                    return key
                                        .replace(/_/g, ' ')
                                        .replace(/\b\w/g, c => c.toUpperCase());
                                };

                                return (
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                                <ArrowRight className="w-4 h-4 text-purple-500" />
                                                Changes
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b bg-slate-50">
                                                        <th className="text-left py-2 px-4 text-xs font-semibold text-muted-foreground">Field</th>
                                                        <th className="text-left py-2 px-4 text-xs font-semibold text-red-500">Before</th>
                                                        <th className="text-left py-2 px-4 text-xs font-semibold text-emerald-600">After</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {allKeys.map((key) => {
                                                        const oldV = isObjOld ? formatCellValue(oldVal[key]) : '—';
                                                        const newV = isObjNew ? formatCellValue(newVal[key]) : '—';
                                                        const changed = oldV !== newV;
                                                        return (
                                                            <tr key={key} className={`border-b last:border-0 ${changed ? 'bg-amber-50/30' : ''}`}>
                                                                <td className="py-2 px-4 font-medium text-slate-700 text-xs">{formatFieldName(key)}</td>
                                                                <td className={`py-2 px-4 text-xs ${changed ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                                                                    {oldV}
                                                                </td>
                                                                <td className={`py-2 px-4 text-xs ${changed ? 'text-emerald-600 font-medium' : 'text-muted-foreground'}`}>
                                                                    {newV}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </CardContent>
                                    </Card>
                                );
                            })()}

                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
