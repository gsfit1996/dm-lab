import { useState, useMemo } from 'react';
import { useDMLab } from '../context/DMLabContext';
import type { DailyLog } from '../types';
import { computeAggregates, computeKpis } from '../utils/kpiCalculator';
import { Edit2, Trash2, Plus, Calculator } from 'lucide-react';
import clsx from 'clsx';

export default function DailyLogPage() {
    const { state, actions } = useDMLab();
    const { dailyLogs, experiments, kpiTargets, settings } = state;
    const [editingId, setEditingId] = useState<string | null>(null);

    // Get accounts safely
    const accountList = useMemo(() => settings.accounts || [], [settings.accounts]);
    const defaultAccountId = accountList[0]?.id || 'account_1';

    // Form State
    const initialForm: Omit<DailyLog, 'id'> = {
        date: new Date().toISOString().split('T')[0],
        experimentId: '',
        variantId: '',

        campaignTag: '',
        channel: 'linkedin',
        accountId: defaultAccountId,
        isOldLeadsLane: false,

        connectionRequestsSent: 0,
        connectionsAccepted: 0,
        permissionMessagesSent: 0,
        permissionSeen: 0,
        permissionPositives: 0,
        offerMessagesSent: 0,
        offerSeen: 0,
        offerOrBookingIntentPositives: 0,
        bookedCalls: 0,
        attendedCalls: 0,
        closedDeals: 0,

        notes: ''
    };

    const [form, setForm] = useState(initialForm);

    const activeVariants = useMemo(() => {
        const exp = experiments.find(e => e.id === form.experimentId);
        return exp?.variants || [];
    }, [form.experimentId, experiments]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingId) {
            actions.updateLog(editingId, form);
            setEditingId(null);
        } else {
            actions.addLog(form);
        }
        setForm(initialForm);
    };

    const handleEdit = (log: DailyLog) => {
        setEditingId(log.id);
        const { id, ...rest } = log;
        setForm({ ...initialForm, ...rest }); // Merge to ensure new fields
    };

    const handleDelete = (id: string) => {
        if (confirm('Delete this log?')) {
            actions.deleteLog(id);
        }
    };

    // Live KPI Check
    const currentKpis = useMemo(() => {
        const mockLog = { ...form, id: 'temp' } as DailyLog;
        const aggs = computeAggregates([mockLog]);
        return computeKpis(aggs, kpiTargets);
    }, [form, kpiTargets]);

    return (
        <div className="flex flex-col gap-8">

            {/* Form Card */}
            <div className="card">
                <h2 className="flex items-center gap-2">
                    {editingId ? <Edit2 size={24} /> : <Plus size={24} />}
                    {editingId ? 'Edit Daily Log' : 'New Daily Log'}
                </h2>

                <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                    {/* Top Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <label className="flex flex-col gap-1">
                            <span className="text-sm font-medium">Date</span>
                            <input
                                type="date"
                                className="input"
                                value={form.date}
                                onChange={e => setForm({ ...form, date: e.target.value })}
                                required
                            />
                        </label>

                        <label className="flex flex-col gap-1">
                            <span className="text-sm font-medium">Account</span>
                            <select
                                className="input"
                                value={form.accountId || defaultAccountId}
                                onChange={e => setForm({ ...form, accountId: e.target.value })}
                            >
                                {accountList.map(acc => (
                                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                                ))}
                            </select>
                        </label>

                        <label className="flex flex-col gap-1">
                            <span className="text-sm font-medium">Experiment</span>
                            <select
                                className="input"
                                value={form.experimentId}
                                onChange={e => setForm({ ...form, experimentId: e.target.value, variantId: '' })}
                            >
                                <option value="">None</option>
                                {experiments.filter(e => e.status === 'running' || e.status === 'planned').map(e => (
                                    <option key={e.id} value={e.id}>{e.name}</option>
                                ))}
                            </select>
                        </label>

                        <label className="flex flex-col gap-1">
                            <span className="text-sm font-medium">Variant</span>
                            <select
                                className="input"
                                value={form.variantId}
                                onChange={e => setForm({ ...form, variantId: e.target.value })}
                                disabled={!form.experimentId}
                            >
                                <option value="">Select Variant</option>
                                {activeVariants.map(v => (
                                    <option key={v.id} value={v.id}>Variant {v.label}</option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                className="w-4 h-4 rounded border-gray-600 bg-transparent text-primary focus:ring-primary"
                                checked={form.isOldLeadsLane}
                                onChange={e => setForm({ ...form, isOldLeadsLane: e.target.checked })}
                            />
                            <span className="text-sm font-medium text-muted-foreground">Old Leads Lane (excluded from KPIs)</span>
                        </label>
                    </div>

                    {/* Numeric Inputs Grid */}
                    <div className="p-4 bg-[var(--bg-app)] rounded-xl border border-border">
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-12 gap-4 text-center">

                            {/* Connection Stage */}
                            <NumberInput label="Conn. Sent" value={form.connectionRequestsSent} onChange={v => setForm({ ...form, connectionRequestsSent: v })} />
                            <NumberInput label="Conn. Acc." value={form.connectionsAccepted} onChange={v => setForm({ ...form, connectionsAccepted: v })} />

                            <div className="hidden lg:block w-px bg-border mx-auto h-full"></div>

                            {/* Permission Stage */}
                            <NumberInput label="Perm. Sent" value={form.permissionMessagesSent} onChange={v => setForm({ ...form, permissionMessagesSent: v })} />
                            <NumberInput label="Perm. Seen" value={form.permissionSeen} onChange={v => setForm({ ...form, permissionSeen: v })} subLabel="(Diagnostic)" />
                            <NumberInput label="Perm. Pos (+)" value={form.permissionPositives} onChange={v => setForm({ ...form, permissionPositives: v })} highlight />

                            <div className="hidden lg:block w-px bg-border mx-auto h-full"></div>

                            {/* Offer / Booking Stage */}
                            <NumberInput label="Offer Sent" value={form.offerMessagesSent} onChange={v => setForm({ ...form, offerMessagesSent: v })} subLabel="(Optional)" />
                            <NumberInput label="Offer Seen" value={form.offerSeen} onChange={v => setForm({ ...form, offerSeen: v })} subLabel="(Optional)" />
                            <NumberInput label="Offer/Intent (+)" value={form.offerOrBookingIntentPositives} onChange={v => setForm({ ...form, offerOrBookingIntentPositives: v })} highlight />
                            <NumberInput label="Booked Call" value={form.bookedCalls} onChange={v => setForm({ ...form, bookedCalls: v })} highlight color="emerald" />
                            <NumberInput label="Attended" value={form.attendedCalls} onChange={v => setForm({ ...form, attendedCalls: v })} subLabel="(Optional)" />
                            <NumberInput label="Closed" value={form.closedDeals} onChange={v => setForm({ ...form, closedDeals: v })} subLabel="(Optional)" />
                        </div>
                    </div>

                    <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium">Campaign Tag</span>
                        <input
                            type="text"
                            className="input"
                            placeholder="e.g. CEOs Jan Campaign"
                            value={form.campaignTag}
                            onChange={e => setForm({ ...form, campaignTag: e.target.value })}
                        />
                    </label>

                    <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium">Notes</span>
                        <input
                            type="text"
                            className="input"
                            placeholder="Quick context or reminders..."
                            value={form.notes}
                            onChange={e => setForm({ ...form, notes: e.target.value })}
                        />
                    </label>

                    {/* DM Sorcery Check */}
                    <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-4 sm:gap-6 text-sm text-[var(--text-secondary)] bg-[var(--bg-app)] p-3 rounded border border-[var(--border)] border-dashed">
                        <div className="flex items-center gap-2 font-bold text-foreground">
                            <Calculator size={16} />
                            DM Sorcery Check:
                        </div>

                        <KpiReadout label="CR" value={currentKpis.cr} status={currentKpis.crStatus} />
                        <KpiReadout label="PRR" value={currentKpis.prr} status={currentKpis.prrStatus} />
                        <KpiReadout label="ABR" value={currentKpis.abr} status={currentKpis.abrStatus} />
                        <KpiReadout label="Booked KPI" value={currentKpis.bookedKpi} status={currentKpis.bookedStatus} />
                        <KpiReadout label="Pos->ABR" value={currentKpis.posToAbr} status={currentKpis.posToAbrStatus} />
                        <KpiReadout label="ABR->Booked" value={currentKpis.abrToBooked} status={currentKpis.abrToBookedStatus} />

                        <div className="w-px h-4 bg-border hidden sm:block"></div>

                        {form.isOldLeadsLane && (
                            <span className="text-xs font-bold text-amber-500 uppercase tracking-widest ml-auto">
                                Old Lane Excluded
                            </span>
                        )}
                    </div>

                    <div className="flex justify-end gap-3">
                        {editingId && (
                            <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={() => { setEditingId(null); setForm(initialForm); }}
                            >
                                Cancel
                            </button>
                        )}
                        <button type="submit" className="btn">
                            <SaveIcon /> {editingId ? 'Update Log' : 'Add Log'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Logs Table */}
            <div className="card">
                <h3>Recent Logs</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr className="text-[var(--text-secondary)] border-b border-[var(--border)]">
                                <th className="p-3">Date</th>
                                <th className="p-3">Info</th>
                                <th className="p-3 text-center">Req / Acc</th>
                                <th className="p-3 text-center">Perm Sent</th>
                                <th className="p-3 text-center">Perm Pos</th>
                                <th className="p-3 text-center">Offer/Intent</th>
                                <th className="p-3 text-center">Booked</th>
                                <th className="p-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...dailyLogs].sort((a, b) => b.date.localeCompare(a.date)).map(log => {
                                const exp = experiments.find(e => e.id === log.experimentId);
                                const variant = exp?.variants.find(v => v.id === log.variantId);
                                const accountName = accountList.find(acc => acc.id === (log.accountId || defaultAccountId))?.name || defaultAccountId;
                                return (
                                    <tr key={log.id} className={clsx("border-b border-[var(--border)] hover:bg-secondary/5 transition-colors", log.isOldLeadsLane && "opacity-60 bg-secondary/5")}>
                                        <td className="p-3 font-mono opacity-70 whitespace-nowrap">{log.date}</td>
                                        <td className="p-3">
                                            <div className="font-medium text-foreground">{log.campaignTag || log.channel}</div>
                                            <div className="text-[10px] text-muted-foreground flex gap-2">
                                                <span>{accountName}</span>
                                                {log.isOldLeadsLane && <span className="text-amber-500 font-bold uppercase">[Old Lane]</span>}
                                            </div>
                                            {exp && (
                                                <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
                                                    {exp.name} <span className="text-primary font-bold">[{variant?.label || '?'}]</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-3 text-center font-mono text-muted-foreground">
                                            {log.connectionRequestsSent} <span className="opacity-30">/</span> {log.connectionsAccepted}
                                        </td>
                                        <td className="p-3 text-center font-mono">{log.permissionMessagesSent}</td>
                                        <td className="p-3 text-center font-mono text-primary font-bold">{log.permissionPositives}</td>
                                        <td className="p-3 text-center font-mono">{log.offerOrBookingIntentPositives}</td>
                                        <td className="p-3 text-center font-bold text-emerald-500 font-mono text-base">{log.bookedCalls}</td>
                                        <td className="p-3 text-right whitespace-nowrap">
                                            <button onClick={() => handleEdit(log)} className="p-1 hover:text-primary transition-colors"><Edit2 size={16} /></button>
                                            <button onClick={() => handleDelete(log.id)} className="p-1 hover:text-red-500 ml-2 transition-colors"><Trash2 size={16} /></button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {dailyLogs.length === 0 && <tr><td colSpan={8} className="text-center p-8 text-[var(--text-secondary)]">No logs yet.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function NumberInput({ label, value, onChange, highlight, color, subLabel }: any) {
    return (
        <label className="flex flex-col items-center gap-1 group">
            <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-wider group-hover:text-foreground transition-colors">{label}</span>
            <input
                type="number"
                min="0"
                className={clsx(
                    "input text-center font-mono w-full transition-all focus:scale-105",
                    highlight && !color && "border-primary/50 text-primary font-bold bg-primary/5",
                    color === 'emerald' && "border-emerald-500/50 text-emerald-500 font-bold bg-emerald-500/5"
                )}
                value={value}
                onChange={e => onChange(Number(e.target.value))}
                onFocus={e => e.target.select()}
            />
            {subLabel && <span className="text-[9px] text-muted-foreground opacity-50">{subLabel}</span>}
        </label>
    );
}

function KpiReadout({ label, value, status }: any) {
    const colorClass =
        status === 'green' ? 'text-emerald-500' :
            status === 'red' ? 'text-red-500' :
                status === 'yellow' ? 'text-amber-500' :
                    'text-muted-foreground';

    return (
        <span className={clsx("font-mono flex items-center gap-1.5", colorClass)}>
            <span className="text-[10px] font-bold opacity-70 uppercase tracking-wilder text-foreground">{label}:</span>
            {value === null ? '--' : `${(value * 100).toFixed(1)}%`}
        </span>
    );
}

function SaveIcon() {
    return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>;
}
