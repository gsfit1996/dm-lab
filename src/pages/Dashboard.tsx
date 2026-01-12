import { useMemo, useState } from 'react';
import { useDMLab } from '../context/DMLabContext';
import { computeAggregates, computeKpis } from '../utils/kpiCalculator';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area
} from 'recharts';
import { format, startOfWeek, parseISO, subDays } from 'date-fns';
import { motion } from 'framer-motion';
import { Download, Target, Sliders, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import ForecastingWidget from '../components/ForecastingWidget';

export default function Dashboard() {
    const { state, actions } = useDMLab();
    const { dailyLogs, experiments, goals, kpiTargets, settings } = state;

    // Filter State
    const [dateFilter, setDateFilter] = useState<'all' | '7d' | '30d' | 'custom'>('all');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [selectedCampaign, setSelectedCampaign] = useState<string>('all');
    const [accountFilter, setAccountFilter] = useState<string>('all');

    // Available campaigns
    const campaigns = useMemo(() => {
        const unique = Array.from(new Set(dailyLogs.map(l => l.campaign).filter(Boolean)));
        return ['all', ...unique];
    }, [dailyLogs]);

    // Available accounts
    const accounts = useMemo(() => {
        const raw = settings.accounts || [];
        const names = raw.map((a: any) => typeof a === 'string' ? a : a.name);
        return ['all', ...names];
    }, [settings.accounts]);

    const defaultAccount = accounts[1] || 'Account 1'; // 0 is 'all'

    // Filtered logs
    const filteredLogs = useMemo(() => {
        let logs = [...dailyLogs];
        const today = new Date();

        // Account Filter
        if (accountFilter !== 'all') {
            logs = logs.filter(l => (l.accountId || defaultAccount) === accountFilter);
        }

        // Exclude Old Lane Logs from MAIN KPIs
        const oldLaneLogs = logs.filter(l => l.isOldLane);
        const activeLogs = logs.filter(l => !l.isOldLane);

        // Date filtering on ACTIVE logs
        let resultingLogs = activeLogs;
        if (dateFilter === '7d') {
            const cutoff = format(subDays(today, 7), 'yyyy-MM-dd');
            resultingLogs = resultingLogs.filter(l => l.date >= cutoff);
        } else if (dateFilter === '30d') {
            const cutoff = format(subDays(today, 30), 'yyyy-MM-dd');
            resultingLogs = resultingLogs.filter(l => l.date >= cutoff);
        } else if (dateFilter === 'custom' && customStartDate && customEndDate) {
            resultingLogs = resultingLogs.filter(l => l.date >= customStartDate && l.date <= customEndDate);
        }

        // Campaign filtering
        if (selectedCampaign !== 'all') {
            resultingLogs = resultingLogs.filter(l => l.campaign === selectedCampaign);
        }

        return { main: resultingLogs, oldLane: oldLaneLogs };
    }, [dailyLogs, dateFilter, customStartDate, customEndDate, selectedCampaign, accountFilter, defaultAccount]);

    // 1. Aggregates & KPIs
    const aggregates = useMemo(() => computeAggregates(filteredLogs.main), [filteredLogs.main]);
    const kpis = useMemo(() => computeKpis(aggregates, kpiTargets), [aggregates, kpiTargets]);

    // 2. Weekly stats for goals (Active logs only)
    const thisWeekStats = useMemo(() => {
        const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
        const weekLogs = filteredLogs.main.filter(l => l.date >= weekStart);
        return {
            connectionRequests: weekLogs.reduce((sum, l) => sum + (l.connectionRequestsSent || 0), 0),
            permissionSent: weekLogs.reduce((sum, l) => sum + (l.permissionMessagesSent || 0), 0),
            booked: weekLogs.reduce((sum, l) => sum + (l.bookedCalls || 0), 0)
        };
    }, [filteredLogs.main]);

    // 3. Weekly Volume Chart Data
    const weeklyData = useMemo(() => {
        const weeks: Record<string, { week: string; sent: number; booked: number; permissionSent: number }> = {};
        const sortedLogs = [...filteredLogs.main].sort((a, b) => a.date.localeCompare(b.date));

        sortedLogs.forEach(log => {
            const date = parseISO(log.date);
            const monday = startOfWeek(date, { weekStartsOn: 1 });
            const key = format(monday, 'yyyy-MM-dd');

            if (!weeks[key]) {
                weeks[key] = { week: format(monday, 'MMM dd'), sent: 0, permissionSent: 0, booked: 0 };
            }
            weeks[key].sent += log.connectionRequestsSent;
            weeks[key].permissionSent += log.permissionMessagesSent;
            weeks[key].booked += log.bookedCalls;
        });

        return Object.values(weeks);
    }, [filteredLogs.main]);

    // 4. Funnel Data
    const funnelData = useMemo(() => [
        { stage: 'Requested', count: aggregates.connectionRequestsSent },
        { stage: 'Connected', count: aggregates.connectionsAccepted },
        { stage: 'Perm. Sent', count: aggregates.permissionMessagesSent },
        { stage: 'Perm. Pos (+)', count: aggregates.permissionPositives },
        { stage: 'Offer/Intent', count: aggregates.offerPositives },
        { stage: 'Booked', count: aggregates.bookedCalls },
    ], [aggregates]);

    // 5. Old Lane Data
    const oldLaneStats = useMemo(() => {
        return filteredLogs.oldLane.reduce((acc, log) => ({
            sent: acc.sent + (log.permissionMessagesSent || 0),
            booked: acc.booked + (log.bookedCalls || 0)
        }), { sent: 0, booked: 0 });
    }, [filteredLogs.oldLane]);

    // EXPORT
    const exportCSV = () => {
        const headers = [
            'Date', 'Account', 'Old Lane', 'Campaign',
            'Conn. Sent', 'Conn. Acc',
            'Perm. Sent', 'Perm. Seen', 'Perm. Pos',
            'Offer Pos', 'Booked Call', 'Notes'
        ];

        const allLogsToExport = [...filteredLogs.main, ...filteredLogs.oldLane].sort((a, b) => b.date.localeCompare(a.date));

        const csvData = [
            headers,
            ...allLogsToExport.map(log => [
                log.date,
                log.accountId || defaultAccount,
                log.isOldLane ? 'Yes' : 'No',
                log.campaign,
                log.connectionRequestsSent,
                log.connectionsAccepted,
                log.permissionMessagesSent,
                log.permissionSeen,
                log.permissionPositives,
                log.offerPositives,
                log.bookedCalls,
                `"${log.notes}"`
            ])
        ];

        const csvString = csvData.map(row => row.join(',')).join('\n');
        const blob = new Blob([csvString], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dm_lab_export_v2.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col gap-8 pb-10 max-w-[1600px] mx-auto">
            {/* Filters */}
            <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center">
                <div className="flex flex-wrap gap-3">
                    <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as any)} className="filter-select">
                        <option value="all">All Time</option>
                        <option value="7d">Last 7 Days</option>
                        <option value="30d">Last 30 Days</option>
                        <option value="custom">Custom</option>
                    </select>

                    {dateFilter === 'custom' && (
                        <>
                            <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="filter-input" />
                            <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="filter-input" />
                        </>
                    )}

                    <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)} className="filter-select">
                        {accounts.map(a => <option key={a} value={a}>{a === 'all' ? 'All Accounts' : a}</option>)}
                    </select>

                    <select value={selectedCampaign} onChange={(e) => setSelectedCampaign(e.target.value)} className="filter-select">
                        {campaigns.map(c => <option key={c} value={c}>{c === 'all' ? 'All Campaigns' : c}</option>)}
                    </select>
                </div>

                <div className="flex gap-4 items-center w-full xl:w-auto">
                    {/* Bottleneck Badge */}
                    <div className="flex-1 xl:flex-none flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--bg-app)] border border-[var(--border)] text-sm shadow-sm">
                        <span className="text-muted-foreground font-medium whitespace-nowrap">Bottleneck:</span>
                        <span className="font-bold text-foreground text-ellipsis overflow-hidden whitespace-nowrap">{kpis.bottleneck}</span>
                    </div>

                    <button onClick={exportCSV} className="btn-secondary whitespace-nowrap">
                        <Download size={16} /> Export
                    </button>
                </div>
            </div>

            {/* Weekly Goals Widget */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="card-base col-span-1 lg:col-span-2">
                    <div className="flex items-center gap-2 mb-6">
                        <Target className="text-primary" size={20} />
                        <h3 className="font-semibold text-white">Weekly Goals ({accountFilter === 'all' ? 'Combined' : accountFilter})</h3>
                    </div>

                    {/* Goals Progress Bars */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <GoalProgressBar
                            label="Requests Sent"
                            current={thisWeekStats.connectionRequests}
                            target={goals.weeklyConnectionRequests}
                            onUpdate={(v) => actions.updateGoals({ weeklyConnectionRequests: v })}
                        />
                        <GoalProgressBar
                            label="Permission Sent"
                            current={thisWeekStats.permissionSent}
                            target={goals.weeklyPermissionSent}
                            onUpdate={(v) => actions.updateGoals({ weeklyPermissionSent: v })}
                        />
                        <GoalProgressBar
                            label="Booked Calls"
                            current={thisWeekStats.booked}
                            target={goals.weeklyBooked}
                            onUpdate={(v) => actions.updateGoals({ weeklyBooked: v })}
                        />
                    </div>
                </div>

                {/* Old Lane Mini Panel */}
                <div className="card-base bg-secondary/5 border-dashed border-amber-500/20">
                    <h3 className="font-semibold text-amber-500 mb-4 flex items-center gap-2">
                        Old Leads Lane
                        <span className="text-[10px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded border border-amber-500/20">Excluded from KPI</span>
                    </h3>
                    <div className="flex flex-col gap-4">
                        <div className="flex justify-between items-end">
                            <span className="text-sm text-muted-foreground">Permission Sent</span>
                            <span className="text-2xl font-mono text-foreground">{oldLaneStats.sent}</span>
                        </div>
                        <div className="flex justify-between items-end">
                            <span className="text-sm text-muted-foreground">Booked</span>
                            <span className="text-2xl font-mono text-emerald-500 font-bold">{oldLaneStats.booked}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 opacity-60">
                            Track old lead reactivation separately to avoid skewing primary efficiency metrics.
                        </p>
                    </div>
                </div>
            </div>

            {/* Forecasting Widget */}
            <ForecastingWidget cr={kpis.cr} prr={kpis.prr} abr={kpis.abr} bookedRate={kpis.bookedRate} />

            {/* KPI Tiles */}
            <div>
                <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Primary Efficiency Metrics</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <RateCard title="Connection Rate (CR)" value={kpis.cr} target={kpiTargets.cr} status={kpis.crStatus} subtitle={`${aggregates.connectionsAccepted} / ${aggregates.connectionRequestsSent}`} onTargetChange={(v) => actions.updateKpiTargets({ cr: v })} />
                    <RateCard title="Positive Reply (PRR)" value={kpis.prr} target={kpiTargets.prr} status={kpis.prrStatus} subtitle={`${aggregates.permissionPositives} / ${aggregates.permissionMessagesSent}`} onTargetChange={(v) => actions.updateKpiTargets({ prr: v })} />
                    <RateCard title="Appt Booking (ABR)" value={kpis.abr} target={kpiTargets.abr} status={kpis.abrStatus} subtitle={`${aggregates.offerPositives} / ${aggregates.permissionMessagesSent}`} onTargetChange={(v) => actions.updateKpiTargets({ abr: v })} />
                    <RateCard title="Booked KPI" value={kpis.bookedRate} target={kpiTargets.booked} status={kpis.bookedStatus} subtitle={`${aggregates.bookedCalls} / ${aggregates.permissionMessagesSent}`} onTargetChange={(v) => actions.updateKpiTargets({ booked: v })} />
                </div>
            </div>

            {/* Diagnostic Tiles */}
            <div>
                <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Diagnostic Ratios</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <RateCard title="Pos -> ABR Ratio" value={kpis.posToAbr} target={kpiTargets.posToAbr} status="neutral" subtitle={`${aggregates.offerPositives} / ${aggregates.permissionPositives}`} onTargetChange={(v) => actions.updateKpiTargets({ posToAbr: v })} />
                    <RateCard title="ABR -> Booked" value={kpis.abrToBooked} target={kpiTargets.abrToBooked} status="neutral" subtitle={`${aggregates.bookedCalls} / ${aggregates.offerPositives}`} onTargetChange={(v) => actions.updateKpiTargets({ abrToBooked: v })} />
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[400px]">
                <div className="card-base flex flex-col">
                    <h3 className="font-semibold text-white mb-6">Volume Trend</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weeklyData}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                            <XAxis dataKey="week" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', color: '#fff' }} />
                            <Bar dataKey="sent" name="Conn. Request" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={30} />
                            <Bar dataKey="permissionSent" name="Perm. Sent" fill="#a855f7" radius={[4, 4, 0, 0]} maxBarSize={30} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="card-base flex flex-col">
                    <h3 className="font-semibold text-white mb-6">Conversion Funnel</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={funnelData}>
                            <defs>
                                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                            <XAxis dataKey="stage" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', color: '#fff' }} />
                            <Area type="monotone" dataKey="count" stroke="#10b981" fillOpacity={1} fill="url(#colorCount)" strokeWidth={3} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}

function RateCard({ title, value, target, status, subtitle, onTargetChange }: any) {
    const [editing, setEditing] = useState(false);
    const safeVal = isNaN(value) ? 0 : value;
    const color = status === 'green' ? 'text-emerald-500' :
        status === 'yellow' ? 'text-amber-500' :
            status === 'red' ? 'text-red-500' : 'text-muted-foreground';

    return (
        <div className="card-base flex flex-col justify-between min-h-[140px]">
            <div>
                <span className="text-muted-foreground text-sm font-medium block">{title}</span>
                {subtitle && <span className="text-[10px] text-muted-foreground opacity-50 font-mono mt-1 block">{subtitle}</span>}
            </div>

            <div>
                <div className="text-3xl font-bold text-foreground">{(safeVal * 100).toFixed(1)}%</div>

                <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                    <span className={clsx("text-xs font-bold uppercase tracking-wider", color)}>{status === 'neutral' ? 'Ratio' : status}</span>
                    <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        <span>Goal:</span>
                        {editing ? (
                            <input
                                autoFocus
                                type="number"
                                className="w-10 bg-secondary px-1 py-0.5 rounded text-foreground text-xs"
                                defaultValue={target}
                                onBlur={(e) => { onTargetChange(parseFloat(e.target.value)); setEditing(false); }}
                            />
                        ) : (
                            <span onClick={() => setEditing(true)} className="hover:text-primary cursor-pointer border-b border-dashed border-muted-foreground/50">{target}%</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function GoalProgressBar({ label, current, target, onUpdate }: any) {
    const [editing, setEditing] = useState(false);
    const pct = Math.min((current / target) * 100, 100);

    return (
        <div>
            <div className="flex justify-between text-sm mb-1.5">
                <span className="font-medium text-foreground">{label}</span>
                <span className="font-mono text-muted-foreground text-xs">
                    {current} /
                    {editing ? (
                        <input
                            autoFocus
                            type="number"
                            className="w-12 bg-secondary px-1 ml-1 rounded text-foreground"
                            defaultValue={target}
                            onBlur={(e) => { onUpdate(parseInt(e.target.value)); setEditing(false); }}
                        />
                    ) : (
                        <span onClick={() => setEditing(true)} className="hover:text-primary cursor-pointer ml-1">{target}</span>
                    )}
                </span>
            </div>
            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    className={clsx("h-full rounded-full", pct >= 100 ? "bg-emerald-500" : "bg-primary")}
                />
            </div>
        </div>
    );
}
