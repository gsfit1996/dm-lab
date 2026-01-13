import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDMLab } from '../context/DMLabContext';
import { computeAggregates, computeKpis } from '../utils/kpiCalculator';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area
} from 'recharts';
import { format, startOfWeek, parseISO, subDays } from 'date-fns';
import { motion } from 'framer-motion';
import { Download, Target, Info, ArrowUpRight } from 'lucide-react';
import clsx from 'clsx';
import ForecastingWidget from '../components/ForecastingWidget';

const KPI_DEFINITIONS = {
    CR: 'Connection Rate = connections accepted / connection requests sent.',
    PRR: 'Positive Reply Rate = permission positives / permission messages sent.',
    ABR: 'Appointment Booking Rate = offer or booking intent positives / permission messages sent.',
    BOOKED: 'Booked KPI = booked calls / permission messages sent.',
    POS_TO_ABR: 'Positive->ABR = offer or booking intent positives / permission positives.',
    ABR_TO_BOOKED: 'ABR->Booked = booked calls / offer or booking intent positives.',
    SEEN_RATE: 'Seen Rate = permission seen / permission messages sent.',
    SRR: 'Show-up Rate = attended calls / booked calls.',
    SCR: 'Sales Close Rate = closed deals / attended calls.'
};

export default function Dashboard() {
    const { state, actions } = useDMLab();
    const { dailyLogs, experiments, kpiTargets, settings } = state;

    // Filter State
    const [dateFilter, setDateFilter] = useState<'all' | '7d' | '30d' | 'custom'>('all');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [selectedCampaign, setSelectedCampaign] = useState<string>('all');
    const [accountFilter, setAccountFilter] = useState<string>('all');

    // Available campaigns
    const campaigns = useMemo(() => {
        const unique = Array.from(new Set(dailyLogs.map(l => l.campaignTag).filter(Boolean)));
        return ['all', ...unique];
    }, [dailyLogs]);
    const activeCampaignCount = Math.max(campaigns.length - 1, 0);

    // Available accounts
    const accounts = useMemo(() => settings.accounts || [], [settings.accounts]);
    const defaultAccountId = accounts[0]?.id || 'account_1';
    const accountOptions = useMemo(() => ['all', ...accounts.map(a => a.id)], [accounts]);

    // Filtered logs
    const filteredLogs = useMemo(() => {
        let logs = [...dailyLogs];
        const today = new Date();

        if (accountFilter !== 'all') {
            logs = logs.filter(l => (l.accountId || defaultAccountId) === accountFilter);
        }

        if (dateFilter === '7d') {
            const cutoff = format(subDays(today, 7), 'yyyy-MM-dd');
            logs = logs.filter(l => l.date >= cutoff);
        } else if (dateFilter === '30d') {
            const cutoff = format(subDays(today, 30), 'yyyy-MM-dd');
            logs = logs.filter(l => l.date >= cutoff);
        } else if (dateFilter === 'custom' && customStartDate && customEndDate) {
            logs = logs.filter(l => l.date >= customStartDate && l.date <= customEndDate);
        }

        if (selectedCampaign !== 'all') {
            logs = logs.filter(l => l.campaignTag === selectedCampaign);
        }

        const oldLaneLogs = logs.filter(l => l.isOldLeadsLane);
        const mainLogs = settings.excludeOldLeadsFromKpi ? logs.filter(l => !l.isOldLeadsLane) : logs;

        return { main: mainLogs, oldLane: oldLaneLogs, all: logs };
    }, [dailyLogs, dateFilter, customStartDate, customEndDate, selectedCampaign, accountFilter, defaultAccountId, settings.excludeOldLeadsFromKpi]);

    // 1. Aggregates & KPIs
    const aggregates = useMemo(() => computeAggregates(filteredLogs.main), [filteredLogs.main]);
    const kpis = useMemo(() => computeKpis(aggregates, kpiTargets), [aggregates, kpiTargets]);
    const runningExperiments = useMemo(
        () => experiments.filter(exp => exp.status === 'running').length,
        [experiments]
    );
    const summaryStats = useMemo(() => ([
        { label: 'Active campaigns', value: activeCampaignCount, hint: 'campaigns in scope' },
        { label: 'Connection requests', value: aggregates.connectionRequestsSent, hint: 'sent in range' },
        { label: 'Permission messages', value: aggregates.permissionMessagesSent, hint: 'sent in range' },
        { label: 'Booked calls', value: aggregates.bookedCalls, hint: `${runningExperiments} experiments running` }
    ]), [activeCampaignCount, aggregates.connectionRequestsSent, aggregates.permissionMessagesSent, aggregates.bookedCalls, runningExperiments]);

    // 2. Weekly stats for goals (Active logs only)
    const thisWeekStats = useMemo(() => {
        const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
        const weekLogs = filteredLogs.main.filter(l => l.date >= weekStart);
        const totals: Record<string, { connectionRequests: number; permissionSent: number; booked: number }> = {};
        accounts.forEach(acc => {
            totals[acc.id] = { connectionRequests: 0, permissionSent: 0, booked: 0 };
        });

        weekLogs.forEach((log) => {
            const accountId = log.accountId || defaultAccountId;
            if (!totals[accountId]) {
                totals[accountId] = { connectionRequests: 0, permissionSent: 0, booked: 0 };
            }
            totals[accountId].connectionRequests += log.connectionRequestsSent || 0;
            totals[accountId].permissionSent += log.permissionMessagesSent || 0;
            totals[accountId].booked += log.bookedCalls || 0;
        });

        return totals;
    }, [filteredLogs.main, accounts, defaultAccountId]);

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
        { stage: 'Permission Sent', count: aggregates.permissionMessagesSent },
        { stage: 'Permission Positive', count: aggregates.permissionPositives },
        { stage: 'Offer/Intent', count: aggregates.offerOrBookingIntentPositives },
        { stage: 'Booked', count: aggregates.bookedCalls },
        { stage: 'Attended', count: aggregates.attendedCalls },
        { stage: 'Closed', count: aggregates.closedDeals }
    ], [aggregates]);

    // 5. Old Lane Data
    const oldLaneStats = useMemo(() => {
        return filteredLogs.oldLane.reduce((acc, log) => ({
            sent: acc.sent + (log.permissionMessagesSent || 0),
            positives: acc.positives + (log.permissionPositives || 0),
            booked: acc.booked + (log.bookedCalls || 0)
        }), { sent: 0, positives: 0, booked: 0 });
    }, [filteredLogs.oldLane]);

    const experimentSummaries = useMemo(() => {
        return experiments.map((exp) => {
            const expLogs = filteredLogs.main.filter(l => l.experimentId === exp.id);
            const variants = exp.variants.map((variant) => {
                const vLogs = expLogs.filter(l => l.variantId === variant.id);
                const sent = vLogs.reduce((sum, l) => sum + (l.permissionMessagesSent || 0), 0);
                const requests = vLogs.reduce((sum, l) => sum + (l.connectionRequestsSent || 0), 0);
                const accepted = vLogs.reduce((sum, l) => sum + (l.connectionsAccepted || 0), 0);
                const positives = vLogs.reduce((sum, l) => sum + (l.permissionPositives || 0), 0);
                const offers = vLogs.reduce((sum, l) => sum + (l.offerOrBookingIntentPositives || 0), 0);
                const booked = vLogs.reduce((sum, l) => sum + (l.bookedCalls || 0), 0);
                const seen = vLogs.reduce((sum, l) => sum + ((exp.funnelStageTargeted === 'OFFER' ? l.offerSeen : l.permissionSeen) || 0), 0);
                const denom = exp.primaryMetric === 'CR' ? requests : sent;
                const rate = denom > 0
                    ? exp.primaryMetric === 'CR'
                        ? accepted / denom
                        : exp.primaryMetric === 'PRR'
                            ? positives / denom
                            : exp.primaryMetric === 'ABR'
                                ? offers / denom
                                : booked / denom
                    : 0;
                const isValid = exp.requiredSampleSizeSeen > 0 ? seen >= exp.requiredSampleSizeSeen : true;
                return { variant, seen, rate, isValid };
            });

            const validVariants = variants.filter(v => v.isValid);
            const winner = validVariants.length > 0
                ? validVariants.reduce((prev, current) => (prev.rate > current.rate ? prev : current), validVariants[0])
                : null;

            return { exp, variants, winner };
        });
    }, [experiments, filteredLogs.main]);

    // EXPORT
    const exportCSV = () => {
        const headers = [
            'Date',
            'Account',
            'Old Leads Lane',
            'Campaign Tag',
            'Experiment',
            'Variant',
            'Conn Requests Sent',
            'Connections Accepted',
            'Permission Sent',
            'Permission Seen',
            'Permission Positives',
            'Offer Sent',
            'Offer Seen',
            'Offer/Intent Positives',
            'Booked Calls',
            'Attended Calls',
            'Closed Deals',
            'CR (%)',
            'PRR (%)',
            'ABR (%)',
            'Booked KPI (%)',
            'Pos->ABR (%)',
            'ABR->Booked (%)',
            'Notes'
        ];

        const allLogsToExport = [...filteredLogs.all].sort((a, b) => b.date.localeCompare(a.date));
        const pct = (num: number, den: number) => den ? (num / den * 100).toFixed(2) : '';

        const csvData = [
            headers,
            ...allLogsToExport.map(log => {
                const exp = experiments.find(e => e.id === log.experimentId);
                const variant = exp?.variants.find(v => v.id === log.variantId);
                const accountName = accounts.find(a => a.id === log.accountId)?.name || log.accountId || defaultAccountId;
                return [
                    log.date,
                    accountName,
                    log.isOldLeadsLane ? 'Yes' : 'No',
                    log.campaignTag,
                    exp?.name || '',
                    variant?.label || '',
                    log.connectionRequestsSent,
                    log.connectionsAccepted,
                    log.permissionMessagesSent,
                    log.permissionSeen,
                    log.permissionPositives,
                    log.offerMessagesSent || 0,
                    log.offerSeen || 0,
                    log.offerOrBookingIntentPositives,
                    log.bookedCalls,
                    log.attendedCalls || 0,
                    log.closedDeals || 0,
                    pct(log.connectionsAccepted, log.connectionRequestsSent),
                    pct(log.permissionPositives, log.permissionMessagesSent),
                    pct(log.offerOrBookingIntentPositives, log.permissionMessagesSent),
                    pct(log.bookedCalls, log.permissionMessagesSent),
                    pct(log.offerOrBookingIntentPositives, log.permissionPositives),
                    pct(log.bookedCalls, log.offerOrBookingIntentPositives),
                    `"${log.notes}"`
                ];
            })
        ];

        const csvString = csvData.map(row => row.join(',')).join('\n');
        const blob = new Blob([csvString], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dm_lab_export_v3.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col gap-8 pb-10 max-w-[1600px] mx-auto">
            <section className="card-base p-6 md:p-8 relative overflow-hidden">
                <div className="absolute -top-28 right-0 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
                <div className="absolute -bottom-32 left-0 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
                <div className="relative z-10 flex flex-col xl:flex-row gap-6 justify-between">
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-2xl bg-black/70 border border-border/60 flex items-center justify-center overflow-hidden">
                                <img src="/logo.png" alt="Elite Health" className="h-7 w-auto" />
                            </div>
                            <div>
                                <div className="section-kicker">Elite Health</div>
                                <div className="text-sm font-semibold text-foreground">DM Lab KPI Snapshot</div>
                            </div>
                        </div>
                        <h2 className="section-title">Command your LinkedIn DM pipeline</h2>
                        <p className="section-subtitle">
                            Track CR, PRR, ABR, and Booked KPI with Elite Health benchmarks and experiment validity.
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="pill pill-accent">Bottleneck: {kpis.bottleneck}</span>
                            <span className="pill">
                                {settings.excludeOldLeadsFromKpi ? 'Old leads excluded from KPIs' : 'Old leads included in KPIs'}
                            </span>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 items-start">
                        <Link to="/log" className="btn">
                            Log Activity <ArrowUpRight size={16} />
                        </Link>
                        <Link to="/experiments" className="btn-outline">
                            New Experiment <ArrowUpRight size={16} />
                        </Link>
                        <button onClick={exportCSV} className="btn-secondary whitespace-nowrap">
                            <Download size={16} /> Export CSV
                        </button>
                    </div>
                </div>
                <div className="relative z-10 mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    {summaryStats.map((stat) => (
                        <SummaryStat key={stat.label} label={stat.label} value={stat.value} hint={stat.hint} />
                    ))}
                </div>
            </section>

            <section className="card-base p-5">
                <div className="flex flex-col xl:flex-row gap-6">
                    <div className="space-y-2">
                        <div className="section-kicker">Filters</div>
                        <h3 className="section-title text-xl">Scope and segmentation</h3>
                        <p className="section-subtitle">Refine metrics by date range, account, and campaign tags.</p>
                    </div>
                    <div className="flex flex-col gap-3 flex-1">
                        <div className="flex flex-wrap gap-2 items-center">
                            <div className="inline-flex flex-wrap gap-2 rounded-full bg-secondary/40 border border-border/60 p-1">
                                {[
                                    { key: 'all', label: 'All Time' },
                                    { key: '7d', label: '7D' },
                                    { key: '30d', label: '30D' },
                                    { key: 'custom', label: 'Custom' }
                                ].map((option) => (
                                    <button
                                        key={option.key}
                                        type="button"
                                        onClick={() => setDateFilter(option.key as any)}
                                        className={clsx(
                                            "px-3 py-1.5 rounded-full text-xs font-semibold transition",
                                            dateFilter === option.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                            {dateFilter === 'custom' && (
                                <div className="flex flex-wrap gap-2">
                                    <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="filter-input" />
                                    <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="filter-input" />
                                </div>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)} className="filter-select">
                                {accountOptions.map((id) => {
                                    if (id === 'all') return <option key="all" value="all">All Accounts</option>;
                                    const name = accounts.find(a => a.id === id)?.name || id;
                                    return <option key={id} value={id}>{name}</option>;
                                })}
                            </select>

                            <select value={selectedCampaign} onChange={(e) => setSelectedCampaign(e.target.value)} className="filter-select">
                                {campaigns.map(c => <option key={c} value={c}>{c === 'all' ? 'All Campaigns' : c}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            </section>

            {/* Weekly Goals Widget */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="card-base col-span-1 lg:col-span-2 p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <div className="section-kicker flex items-center gap-2">
                                <Target className="text-primary" size={14} />
                                Weekly focus
                            </div>
                            <h3 className="section-title text-xl">Weekly Goals</h3>
                            <p className="section-subtitle">Progress by account for Elite Health activity targets.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        {(accountFilter === 'all' ? accounts : accounts.filter(a => a.id === accountFilter)).map((acc) => {
                            const stats = thisWeekStats[acc.id] || { connectionRequests: 0, permissionSent: 0, booked: 0 };
                            return (
                                <div key={acc.id} className="p-4 bg-secondary/10 rounded-xl border border-border">
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: acc.color || '#3b82f6' }} />
                                        <span className="text-sm font-semibold text-foreground">{acc.name}</span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <GoalProgressBar
                                            label="Requests Sent"
                                            current={stats.connectionRequests}
                                            target={acc.weeklyGoals?.weeklyConnectionRequests || 0}
                                            onUpdate={(v) => actions.updateAccount(acc.id, { weeklyGoals: { ...acc.weeklyGoals, weeklyConnectionRequests: v } })}
                                            accentColor={acc.color}
                                        />
                                        <GoalProgressBar
                                            label="Permission Sent"
                                            current={stats.permissionSent}
                                            target={acc.weeklyGoals?.weeklyPermissionSent || 0}
                                            onUpdate={(v) => actions.updateAccount(acc.id, { weeklyGoals: { ...acc.weeklyGoals, weeklyPermissionSent: v } })}
                                            accentColor={acc.color}
                                        />
                                        <GoalProgressBar
                                            label="Booked Calls"
                                            current={stats.booked}
                                            target={acc.weeklyGoals?.weeklyBooked || 0}
                                            onUpdate={(v) => actions.updateAccount(acc.id, { weeklyGoals: { ...acc.weeklyGoals, weeklyBooked: v } })}
                                            accentColor={acc.color}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Old Lane Mini Panel */}
                <div className="card-base bg-secondary/10 border-dashed border-amber-500/20 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <div className="section-kicker text-amber-400">Reactivation</div>
                            <h3 className="section-title text-xl">Old Leads Lane</h3>
                        </div>
                        <span className="pill pill-strong">Excluded from KPI</span>
                    </div>
                    <div className="flex flex-col gap-4">
                        <div className="flex justify-between items-end">
                            <span className="text-sm text-muted-foreground">Permission Sent</span>
                            <span className="text-2xl font-mono text-foreground">{oldLaneStats.sent}</span>
                        </div>
                        <div className="flex justify-between items-end">
                            <span className="text-sm text-muted-foreground">Permission Positives</span>
                            <span className="text-2xl font-mono text-primary font-bold">{oldLaneStats.positives}</span>
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
            <ForecastingWidget cr={kpis.cr || 0} prr={kpis.prr || 0} abr={kpis.abr || 0} bookedRate={kpis.bookedKpi || 0} />

            {/* KPI Tiles */}
            <div>
                <div className="flex items-end justify-between mb-4">
                    <div>
                        <div className="section-kicker">Primary KPIs</div>
                        <h3 className="section-title text-xl">Primary Efficiency Metrics</h3>
                    </div>
                    <span className="section-subtitle hidden md:inline">Benchmarked to Elite Health targets.</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <RateCard title="Connection Rate (CR)" value={kpis.cr} target={kpiTargets.cr} status={kpis.crStatus} subtitle={`${aggregates.connectionsAccepted} / ${aggregates.connectionRequestsSent}`} tooltip={KPI_DEFINITIONS.CR} onTargetChange={(v) => actions.updateKpiTargets({ cr: v })} />
                    <RateCard title="Positive Reply Rate (PRR)" value={kpis.prr} target={kpiTargets.prr} status={kpis.prrStatus} subtitle={`${aggregates.permissionPositives} / ${aggregates.permissionMessagesSent}`} tooltip={KPI_DEFINITIONS.PRR} onTargetChange={(v) => actions.updateKpiTargets({ prr: v })} />
                    <RateCard title="Appointment Booking Rate (ABR)" value={kpis.abr} target={kpiTargets.abr} status={kpis.abrStatus} subtitle={`${aggregates.offerOrBookingIntentPositives} / ${aggregates.permissionMessagesSent}`} tooltip={KPI_DEFINITIONS.ABR} onTargetChange={(v) => actions.updateKpiTargets({ abr: v })} />
                    <RateCard title="Booked KPI" value={kpis.bookedKpi} target={kpiTargets.booked} status={kpis.bookedStatus} subtitle={`${aggregates.bookedCalls} / ${aggregates.permissionMessagesSent}`} tooltip={KPI_DEFINITIONS.BOOKED} onTargetChange={(v) => actions.updateKpiTargets({ booked: v })} />
                </div>
            </div>

            <div>
                <div className="flex items-end justify-between mb-4">
                    <div>
                        <div className="section-kicker">Diagnostics</div>
                        <h3 className="section-title text-xl">Secondary Diagnostics</h3>
                    </div>
                    <span className="section-subtitle hidden md:inline">Conversion quality between key steps.</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
                    <RateCard title="Positive -> ABR" value={kpis.posToAbr} target={kpiTargets.posToAbr} status={kpis.posToAbrStatus} subtitle={`${aggregates.offerOrBookingIntentPositives} / ${aggregates.permissionPositives}`} tooltip={KPI_DEFINITIONS.POS_TO_ABR} onTargetChange={(v) => actions.updateKpiTargets({ posToAbr: v })} />
                    <RateCard title="ABR -> Booked" value={kpis.abrToBooked} target={kpiTargets.abrToBooked} status={kpis.abrToBookedStatus} subtitle={`${aggregates.bookedCalls} / ${aggregates.offerOrBookingIntentPositives}`} tooltip={KPI_DEFINITIONS.ABR_TO_BOOKED} onTargetChange={(v) => actions.updateKpiTargets({ abrToBooked: v })} />
                </div>
            </div>

            <div>
                <div className="flex items-end justify-between mb-4">
                    <div>
                        <div className="section-kicker">Optional</div>
                        <h3 className="section-title text-xl">Optional Diagnostics</h3>
                    </div>
                    <span className="section-subtitle hidden md:inline">Useful to review show-up and close rates.</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <RateCard title="Seen Rate" value={kpis.seenRate} target={kpiTargets.seenRate} status={kpis.seenRateStatus} subtitle={`${aggregates.permissionSeen} / ${aggregates.permissionMessagesSent}`} tooltip={KPI_DEFINITIONS.SEEN_RATE} onTargetChange={(v) => actions.updateKpiTargets({ seenRate: v })} />
                    <RateCard title="Show-up Rate (SRR)" value={kpis.showUpRate} target={kpiTargets.srr} status={kpis.showUpRateStatus} subtitle={`${aggregates.attendedCalls} / ${aggregates.bookedCalls}`} tooltip={KPI_DEFINITIONS.SRR} onTargetChange={(v) => actions.updateKpiTargets({ srr: v })} />
                    <RateCard title="Sales Close Rate (SCR)" value={kpis.salesCloseRate} target={kpiTargets.scr} status={kpis.salesCloseRateStatus} subtitle={`${aggregates.closedDeals} / ${aggregates.attendedCalls}`} tooltip={KPI_DEFINITIONS.SCR} onTargetChange={(v) => actions.updateKpiTargets({ scr: v })} />
                </div>
            </div>



            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[400px]">
                <div className="card-base flex flex-col p-6">
                    <div className="mb-6">
                        <div className="section-kicker">Outreach volume</div>
                        <h3 className="section-title text-lg">Volume Trend</h3>
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weeklyData}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                            <XAxis dataKey="week" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', color: '#fff' }} />
                            <Bar dataKey="sent" name="Conn. Request" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={30} />
                            <Bar dataKey="permissionSent" name="Perm. Sent" fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={30} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="card-base flex flex-col p-6">
                    <div className="mb-6">
                        <div className="section-kicker">Pipeline flow</div>
                        <h3 className="section-title text-lg">Conversion Funnel</h3>
                    </div>
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

            <div className="card-base p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <div className="section-kicker">Experiments</div>
                        <h3 className="section-title text-lg">Multivariate Experiment Lab</h3>
                    </div>
                    <span className="text-xs text-muted-foreground">Only valid samples show a leader</span>
                </div>

                {experimentSummaries.length === 0 && (
                    <div className="text-sm text-muted-foreground">No experiments yet.</div>
                )}

                <div className="grid grid-cols-1 gap-4">
                    {experimentSummaries.map(({ exp, variants, winner }) => (
                        <div key={exp.id} className="p-4 bg-secondary/10 rounded-xl border border-border">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <div className="text-sm font-semibold text-foreground">{exp.name}</div>
                                    <div className="text-xs text-muted-foreground">{exp.funnelStageTargeted} Stage | Primary: {exp.primaryMetric}</div>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {exp.requiredSampleSizeSeen > 0 ? `Seen target: ${exp.requiredSampleSizeSeen}` : 'No seen threshold'}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {variants.map((variant) => (
                                    <div key={variant.variant.id} className={clsx(
                                        "p-3 rounded-lg border border-[var(--border)]",
                                        winner?.variant.id === variant.variant.id && "border-emerald-500/40 bg-emerald-500/5"
                                    )}>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Variant {variant.variant.label}</span>
                                            {winner?.variant.id === variant.variant.id && (
                                                <span className="text-[10px] bg-emerald-500/20 text-emerald-500 px-2 py-0.5 rounded">Leader</span>
                                            )}
                                        </div>
                                        <div className="text-lg font-bold text-foreground">{(variant.rate * 100).toFixed(1)}%</div>
                                        <div className="text-[10px] text-muted-foreground">Seen: {variant.seen}</div>
                                        <div className={clsx(
                                            "mt-2 inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-1 rounded",
                                            variant.isValid ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                                        )}>
                                            {variant.isValid ? 'Valid' : 'Insufficient sample'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {import.meta.env.DEV && (
                <div className="card-base border-dashed border-border p-6">
                    <h3 className="font-semibold text-white mb-2">Dev KPI Debug</h3>
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                        {JSON.stringify({ aggregates, kpis }, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}

function RateCard({ title, value, target, status, subtitle, tooltip, onTargetChange }: any) {
    const [editing, setEditing] = useState(false);
    const safeVal = typeof value === 'number' ? value : null;
    const color = status === 'green' ? 'text-emerald-400' :
        status === 'yellow' ? 'text-amber-400' :
            status === 'red' ? 'text-red-400' : 'text-muted-foreground';
    const statusRing = status === 'green'
        ? 'border-emerald-500/30 bg-emerald-500/5'
        : status === 'yellow'
            ? 'border-amber-500/30 bg-amber-500/5'
            : status === 'red'
                ? 'border-red-500/30 bg-red-500/5'
                : 'border-border/60';
    const statusLabel = status === 'green' ? 'On track' : status === 'yellow' ? 'Watch' : status === 'red' ? 'At risk' : 'Tracking';
    const targetPct = typeof target === 'number' ? target : 0;
    const progress = safeVal !== null && targetPct > 0 ? Math.min((safeVal * 100) / targetPct, 1) : 0;

    return (
        <div className={clsx("card-base p-5 flex flex-col justify-between min-h-[160px] border", statusRing)}>
            <div>
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{title}</span>
                        {tooltip && <Info size={14} className="text-muted-foreground/70" title={tooltip} />}
                    </div>
                    <span className={clsx("badge", color)}>{statusLabel}</span>
                </div>
                {subtitle && <span className="text-[10px] text-muted-foreground/70 font-mono mt-2 block">{subtitle}</span>}
            </div>

            <div>
                <div className="text-3xl font-semibold text-foreground">{safeVal === null ? '--' : `${(safeVal * 100).toFixed(1)}%`}</div>

                <div className="mt-3">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Target</span>
                        {editing ? (
                            <input
                                autoFocus
                                type="number"
                                className="w-12 bg-secondary px-1 py-0.5 rounded text-foreground text-xs"
                                defaultValue={target}
                                onBlur={(e) => { onTargetChange(parseFloat(e.target.value)); setEditing(false); }}
                            />
                        ) : (
                            <span onClick={() => setEditing(true)} className="hover:text-primary cursor-pointer border-b border-dashed border-muted-foreground/50">{target}%</span>
                        )}
                    </div>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-secondary/60 overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progress * 100}%` }}
                            className={clsx("h-full rounded-full", safeVal === null ? "bg-muted-foreground/40" : "bg-primary")}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

function GoalProgressBar({ label, current, target, onUpdate, accentColor }: any) {
    const [editing, setEditing] = useState(false);
    const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
    const barStyle = accentColor ? { backgroundColor: accentColor } : undefined;

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
                    style={barStyle}
                    className={clsx("h-full rounded-full", pct >= 100 ? "bg-emerald-500" : "bg-primary")}
                />
            </div>
        </div>
    );
}

function SummaryStat({ label, value, hint }: { label: string; value: number; hint?: string }) {
    return (
        <div className="rounded-2xl border border-border/60 bg-secondary/20 px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
            <div className="text-2xl font-semibold text-foreground mt-1">{value}</div>
            {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
        </div>
    );
}
