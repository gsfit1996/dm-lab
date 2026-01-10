import { useMemo, useState } from 'react';
import { useDMLab } from '../context/DMLabContext';
import { CONSTANTS } from '../types';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line
} from 'recharts';
import { format, startOfWeek, parseISO, subDays, startOfMonth } from 'date-fns';
import { motion } from 'framer-motion';
import { Download, Target, Calendar, TrendingUp } from 'lucide-react';
import clsx from 'clsx';

export default function Dashboard() {
    const { state, actions } = useDMLab();
    const { dailyLogs, experiments, goals } = state;

    // Filter State
    const [dateFilter, setDateFilter] = useState<'all' | '7d' | '30d' | 'custom'>('all');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [selectedCampaign, setSelectedCampaign] = useState<string>('all');

    // Available campaigns
    const campaigns = useMemo(() => {
        const unique = Array.from(new Set(dailyLogs.map(l => l.campaign).filter(Boolean)));
        return ['all', ...unique];
    }, [dailyLogs]);

    // Filtered logs
    const filteredLogs = useMemo(() => {
        let logs = [...dailyLogs];
        const today = new Date();

        // Date filtering
        if (dateFilter === '7d') {
            const cutoff = format(subDays(today, 7), 'yyyy-MM-dd');
            logs = logs.filter(l => l.date >= cutoff);
        } else if (dateFilter === '30d') {
            const cutoff = format(subDays(today, 30), 'yyyy-MM-dd');
            logs = logs.filter(l => l.date >= cutoff);
        } else if (dateFilter === 'custom' && customStartDate && customEndDate) {
            logs = logs.filter(l => l.date >= customStartDate && l.date <= customEndDate);
        }

        // Campaign filtering
        if (selectedCampaign !== 'all') {
            logs = logs.filter(l => l.campaign === selectedCampaign);
        }

        return logs;
    }, [dailyLogs, dateFilter, customStartDate, customEndDate, selectedCampaign]);

    // Weekly stats for goals
    const thisWeekStats = useMemo(() => {
        const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
        const weekLogs = dailyLogs.filter(l => l.date >= weekStart);
        return {
            sent: weekLogs.reduce((sum, l) => sum + l.sent, 0),
            booked: weekLogs.reduce((sum, l) => sum + l.booked, 0)
        };
    }, [dailyLogs]);

    // 1. Aggregates (from filtered logs)
    const stats = useMemo(() => {
        return filteredLogs.reduce((acc, log) => ({
            sent: acc.sent + log.sent,
            seen: acc.seen + (log.seen || 0),
            accepted: acc.accepted + log.accepted,
            replied: acc.replied + log.replied,
            positiveReplies: acc.positiveReplies + log.positiveReplies,
            calendlySent: acc.calendlySent + (log.calendlySent || 0),
            booked: acc.booked + log.booked,
            attended: acc.attended + (log.attended || 0),
            closed: acc.closed + (log.closed || 0),
        }), {
            sent: 0, seen: 0, accepted: 0, replied: 0, positiveReplies: 0, calendlySent: 0, booked: 0, attended: 0, closed: 0
        });
    }, [filteredLogs]);

    // 2. DM Sorcery Rates
    const rates = useMemo(() => {
        const safeDiv = (n: number, d: number) => d === 0 ? 0 : n / d;
        return {
            msr: safeDiv(stats.seen, stats.sent),            // Media Seen Rate
            prr: safeDiv(stats.positiveReplies, stats.seen), // Positive Reply Rate (Seen -> Positive)
            csr: safeDiv(stats.calendlySent, stats.seen),    // Calendly Sent Rate (Seen -> Calendly)
            abr: safeDiv(stats.booked, stats.sent),          // Appointment Booking Rate (Sent -> Booked)
            srr: safeDiv(stats.attended, stats.booked),     // Show up rate (Booked -> Attended)
            cr: safeDiv(stats.closed, stats.attended),       // Close Rate (Attended -> Closed)

            // Secondary Metrics
            msbr: safeDiv(stats.positiveReplies, stats.seen),
            bcr: safeDiv(stats.calendlySent, stats.positiveReplies),
            cdr: safeDiv(stats.booked, stats.calendlySent)
        };
    }, [stats]);

    // 3. Weekly Volume Data
    const weeklyData = useMemo(() => {
        const weeks: Record<string, { week: string; sent: number; seen: number; booked: number }> = {};
        const sortedLogs = [...filteredLogs].sort((a, b) => a.date.localeCompare(b.date));

        sortedLogs.forEach(log => {
            const date = parseISO(log.date);
            const monday = startOfWeek(date, { weekStartsOn: 1 });
            const key = format(monday, 'yyyy-MM-dd');

            if (!weeks[key]) {
                weeks[key] = { week: format(monday, 'MMM dd'), sent: 0, seen: 0, booked: 0 };
            }
            weeks[key].sent += log.sent;
            weeks[key].seen += (log.seen || 0);
            weeks[key].booked += log.booked;
        });

        return Object.values(weeks);
    }, [filteredLogs]);

    // 4. Funnel Data (Initiate -> Seen -> Engaged -> Calendly -> Booked -> Attended -> Closed)
    const funnelData = useMemo(() => [
        { stage: 'A (Initiate)', count: stats.sent },
        { stage: 'S (Seen)', count: stats.seen },
        { stage: 'B (Engaged)', count: stats.positiveReplies },
        { stage: 'C (Calendly)', count: stats.calendlySent },
        { stage: 'D (Booked)', count: stats.booked },
        { stage: 'Attended', count: stats.attended },
        { stage: 'Closed', count: stats.closed },
    ], [stats]);

    // 5. Experiment Summaries (Multivariate)
    const experimentSummaries = useMemo(() => {
        return experiments.map(exp => {
            const logs = filteredLogs.filter(l => l.experimentId === exp.id);

            const variantStats = exp.variants.map(v => {
                const vLogs = logs.filter(l => l.variantId === v.id);
                const seen = vLogs.reduce((s, l) => s + (l.seen || 0), 0);
                const positive = vLogs.reduce((s, l) => s + l.positiveReplies, 0);
                const rate = seen === 0 ? 0 : positive / seen;
                const isValid = seen >= 60;
                return { ...v, seen, positive, rate, isValid };
            });

            const winner = variantStats.reduce((prev, current) => (prev.rate > current.rate) ? prev : current, variantStats[0]);

            return { ...exp, variantStats, winner };
        });
    }, [experiments, filteredLogs]);

    // CSV Export function
    const exportCSV = () => {
        const csvData = [
            ['Date', 'Campaign', 'Channel', 'Sent', 'Seen', 'Accepted', 'Replied', 'Positive Replies', 'Calendly Sent', 'Booked', 'Notes'],
            ...dailyLogs.map(log => [
                log.date,
                log.campaign,
                log.channel,
                log.sent,
                log.seen || 0,
                log.accepted,
                log.replied,
                log.positiveReplies,
                log.calendlySent || 0,
                log.booked,
                log.notes
            ])
        ];

        const csvString = csvData.map(row => row.join(',')).join('\n');
        const blob = new Blob([csvString], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dm_lab_export_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col gap-8 pb-10 max-w-[1600px] mx-auto">
            {/* Filters & Controls */}
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div className="flex flex-wrap gap-3">
                    <select
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value as any)}
                        className="px-4 py-2 bg-card text-foreground rounded-xl border border-border text-sm font-medium hover:bg-secondary/30 transition-colors"
                    >
                        <option value="all">All Time</option>
                        <option value="7d">Last 7 Days</option>
                        <option value="30d">Last 30 Days</option>
                        <option value="custom">Custom Range</option>
                    </select>

                    {dateFilter === 'custom' && (
                        <>
                            <input
                                type="date"
                                value={customStartDate}
                                onChange={(e) => setCustomStartDate(e.target.value)}
                                className="px-4 py-2 bg-card text-foreground rounded-xl border border-border text-sm"
                            />
                            <input
                                type="date"
                                value={customEndDate}
                                onChange={(e) => setCustomEndDate(e.target.value)}
                                className="px-4 py-2 bg-card text-foreground rounded-xl border border-border text-sm"
                            />
                        </>
                    )}

                    <select
                        value={selectedCampaign}
                        onChange={(e) => setSelectedCampaign(e.target.value)}
                        className="px-4 py-2 bg-card text-foreground rounded-xl border border-border text-sm font-medium hover:bg-secondary/30 transition-colors"
                    >
                        {campaigns.map(c => (
                            <option key={c} value={c}>{c === 'all' ? 'All Campaigns' : c}</option>
                        ))}
                    </select>
                </div>

                <button
                    onClick={exportCSV}
                    className="flex items-center gap-2 px-4 py-2 bg-secondary text-foreground rounded-xl font-medium hover:bg-secondary/80 transition-colors text-sm"
                >
                    <Download size={16} />
                    Export CSV
                </button>
            </div>

            {/* Weekly Goals */}
            <div className="card-base">
                <div className="flex items-center gap-2 mb-6">
                    <Target className="text-primary" size={20} />
                    <h3 className="font-semibold text-white">Weekly Goals</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <GoalProgressBar
                        label="DMs Sent"
                        current={thisWeekStats.sent}
                        target={goals.weeklySent}
                        onTargetChange={(val) => actions.updateGoals({ weeklySent: val })}
                    />
                    <GoalProgressBar
                        label="Meetings Booked"
                        current={thisWeekStats.booked}
                        target={goals.weeklyBooked}
                        onTargetChange={(val) => actions.updateGoals({ weeklyBooked: val })}
                    />
                </div>
            </div>

            {/* Primary KPIs (DM Sorcery) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
                <RateCard title="MSR (Media Seen)" value={rates.msr} threshold={state.kpiTargets.msr} subtitle={`${stats.seen} / ${stats.sent}`} onTargetChange={(val: number) => actions.updateKpiTargets({ msr: val })} />
                <RateCard title="PRR (Positive Reply)" value={rates.prr} threshold={state.kpiTargets.prr} subtitle={`${stats.positiveReplies} / ${stats.seen}`} onTargetChange={(val: number) => actions.updateKpiTargets({ prr: val })} />
                <RateCard title="CSR (Calendly Sent)" value={rates.csr} threshold={state.kpiTargets.csr} subtitle={`${stats.calendlySent} / ${stats.seen}`} onTargetChange={(val: number) => actions.updateKpiTargets({ csr: val })} />
                <RateCard title="ABR (Booked Rate)" value={rates.abr} threshold={state.kpiTargets.abr} subtitle={`${stats.booked} / ${stats.sent}`} onTargetChange={(val: number) => actions.updateKpiTargets({ abr: val })} />
                <RateCard title="SRR (Show up Rate)" value={rates.srr} threshold={state.kpiTargets.srr} subtitle={`${stats.attended} / ${stats.booked}`} onTargetChange={(val: number) => actions.updateKpiTargets({ srr: val })} />
                <RateCard title="CR (Close Rate)" value={rates.cr} threshold={state.kpiTargets.cr} subtitle={`${stats.closed} / ${stats.attended}`} onTargetChange={(val: number) => actions.updateKpiTargets({ cr: val })} />
            </div>

            {/* Secondary Row Rates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <RateCard title="MS > B (Engaged)" value={rates.msbr} threshold={state.kpiTargets.msbr} onTargetChange={(val: number) => actions.updateKpiTargets({ msbr: val })} />
                <RateCard title="B > C (Qualified)" value={rates.bcr} threshold={state.kpiTargets.bcr} onTargetChange={(val: number) => actions.updateKpiTargets({ bcr: val })} />
                <RateCard title="C > D (Closing)" value={rates.cdr} threshold={state.kpiTargets.cdr} onTargetChange={(val: number) => actions.updateKpiTargets({ cdr: val })} />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-auto lg:h-[420px]">
                <div className="card-base flex flex-col h-[400px] lg:h-full">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="font-semibold text-white">Weekly volume</h3>
                        <div className="px-3 py-1 rounded-full bg-secondary text-xs text-secondary-foreground font-medium">
                            Sent / Accepted / Replied
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weeklyData} barGap={4}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                            <XAxis dataKey="week" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} tickMargin={10} />
                            <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip
                                cursor={{ fill: '#27272a' }}
                                contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', color: '#fff' }}
                            />
                            <Bar dataKey="sent" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} />
                            <Bar dataKey="accepted" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="card-base flex flex-col h-[400px] lg:h-full">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="font-semibold text-white">Conversion funnel</h3>
                        <div className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-medium border border-emerald-500/20">
                            ABR {(rates.abr * 100).toFixed(0)}% / {(state.kpiTargets.abr * 100).toFixed(0)}%
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={funnelData}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                            <XAxis dataKey="stage" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} tickMargin={10} />
                            <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', color: '#fff' }}
                            />
                            <Line type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 2, stroke: '#18181b' }} activeDot={{ r: 6 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Experiment Summary */}
            <div className="card-base">
                <h3 className="font-semibold mb-6 text-white">Multivariate Experiment Lab</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                                <th className="pb-4 font-medium pl-4">Experiment</th>
                                <th className="pb-4 font-medium">Status</th>
                                <th className="pb-4 font-medium">Top Variant</th>
                                <th className="pb-4 font-medium">Volume (Seen)</th>
                                <th className="pb-4 font-medium">Best PRR</th>
                                <th className="pb-4 font-medium">Validity</th>
                            </tr>
                        </thead>
                        <tbody>
                            {experimentSummaries.map((exp) => (
                                <tr key={exp.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                                    <td className="py-4 pl-4">
                                        <div className="font-medium text-foreground">{exp.name}</div>
                                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">{exp.hypothesis}</div>
                                    </td>
                                    <td className="py-4">
                                        <StatusBadge status={exp.status} />
                                    </td>
                                    <td className="py-4 text-sm font-medium text-primary">
                                        {exp.winner?.label || 'N/A'}
                                    </td>
                                    <td className="py-4 text-sm font-mono text-muted-foreground">
                                        {exp.variantStats.reduce((s, v) => s + v.seen, 0)}
                                    </td>
                                    <td className="py-4 text-sm font-mono text-emerald-400">
                                        {(exp.winner?.rate * 100).toFixed(1)}%
                                    </td>
                                    <td className="py-4">
                                        <div className="flex flex-col gap-1">
                                            {exp.variantStats.map(v => (
                                                <div key={v.id} className="flex items-center gap-2 text-[10px]">
                                                    <span className="w-8 font-bold opacity-70">{v.label}:</span>
                                                    <div className="flex-1 h-1.5 bg-secondary rounded-full max-w-[60px] overflow-hidden">
                                                        <div className={clsx("h-full transition-all", v.isValid ? "bg-emerald-500" : "bg-amber-500")} style={{ width: `${Math.min((v.seen / 60) * 100, 100)}%` }} />
                                                    </div>
                                                    <span className={clsx("font-medium", v.isValid ? "text-emerald-500" : "text-amber-500")}>
                                                        {v.seen}/60
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {experimentSummaries.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-muted-foreground">No experiments run yet.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// Components

function RateCard({ title, value, threshold, subtitle, kpiKey, onTargetChange }: any) {
    const [editing, setEditing] = useState(false);
    const [tempTarget, setTempTarget] = useState((threshold * 100).toFixed(1));
    const safeValue = isNaN(value) ? 0 : value;
    const isGood = safeValue >= threshold;

    const handleSave = () => {
        const num = parseFloat(tempTarget) / 100;
        if (!isNaN(num) && num >= 0) {
            onTargetChange(num);
        }
        setEditing(false);
    };

    return (
        <div className="card-base flex flex-col justify-between h-[140px]">
            <div>
                <span className="text-secondary-foreground text-sm font-medium">{title}</span>
                {subtitle && <div className="text-[10px] text-muted-foreground uppercase tracking-tight mt-0.5">{subtitle}</div>}
            </div>
            <div>
                <div className="text-4xl font-bold text-white">{(safeValue * 100).toFixed(1)}%</div>
                <div className={clsx("text-xs mt-1 font-medium flex items-center gap-1", isGood ? "text-emerald-500" : "text-amber-500")}>
                    <span>Target</span>
                    {editing ? (
                        <div className="flex items-center gap-1">
                            <input
                                type="number"
                                step="0.1"
                                value={tempTarget}
                                onChange={(e) => setTempTarget(e.target.value)}
                                onBlur={handleSave}
                                onKeyPress={(e) => e.key === 'Enter' && handleSave()}
                                className="w-12 h-5 px-1 bg-secondary border border-border rounded text-[10px] text-foreground font-mono"
                                autoFocus
                            />
                            <span>%</span>
                        </div>
                    ) : (
                        <span
                            onClick={() => { setTempTarget((threshold * 100).toFixed(1)); setEditing(true); }}
                            className="cursor-pointer hover:underline underline-offset-2"
                        >
                            {(threshold * 100).toFixed(1)}%
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles = {
        planned: "bg-amber-500/10 text-amber-500 border-amber-500/20",
        running: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
        paused: "bg-slate-500/10 text-slate-500 border-slate-500/20",
        completed: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
        archived: "bg-gray-500/10 text-gray-500 border-gray-500/20"
    };
    return (
        <span className={clsx("px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border", (styles as any)[status] || styles.planned)}>
            {status}
        </span>
    );
}

function GoalProgressBar({ label, current, target, onTargetChange }: { label: string; current: number; target: number; onTargetChange: (val: number) => void }) {
    const [editing, setEditing] = useState(false);
    const [tempTarget, setTempTarget] = useState(target.toString());
    const percentage = Math.min((current / target) * 100, 100);

    const handleSave = () => {
        const num = parseInt(tempTarget);
        if (!isNaN(num) && num > 0) {
            onTargetChange(num);
        }
        setEditing(false);
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">{label}</span>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-muted-foreground">
                        {current} / {editing ? (
                            <input
                                type="number"
                                value={tempTarget}
                                onChange={(e) => setTempTarget(e.target.value)}
                                onBlur={handleSave}
                                onKeyPress={(e) => e.key === 'Enter' && handleSave()}
                                className="w-16 px-1 bg-secondary border border-border rounded text-foreground"
                                autoFocus
                            />
                        ) : (
                            <span onClick={() => setEditing(true)} className="cursor-pointer hover:text-primary transition-colors">
                                {target}
                            </span>
                        )}
                    </span>
                    <span className={clsx("text-xs font-bold", percentage >= 100 ? "text-emerald-500" : "text-amber-500")}>
                        {percentage.toFixed(0)}%
                    </span>
                </div>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    className={clsx("h-full rounded-full", percentage >= 100 ? "bg-emerald-500" : "bg-primary")}
                />
            </div>
        </div>
    );
}
