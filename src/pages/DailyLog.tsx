import { useState, useMemo } from 'react';
import { useDMLab } from '../context/DMLabContext';
import type { DailyLog } from '../types';
import { Edit2, Trash2, Plus, Calculator } from 'lucide-react';
import clsx from 'clsx';

export default function DailyLogPage() {
    const { state, actions } = useDMLab();
    const { dailyLogs, experiments } = state;
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form State
    const initialForm: Omit<DailyLog, 'id'> = {
        date: new Date().toISOString().split('T')[0],
        experimentId: '',
        variantId: '',
        campaign: '',
        channel: 'linkedin',
        sent: 0,
        seen: 0,
        accepted: 0,
        replied: 0,
        positiveReplies: 0,
        calendlySent: 0,
        booked: 0,
        attended: 0,
        closed: 0,
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
        setForm(rest);
    };

    const handleDelete = (id: string) => {
        if (confirm('Delete this log?')) {
            actions.deleteLog(id);
        }
    };

    // DM Sorcery Calcs
    const msr = form.sent ? (form.seen / form.sent) * 100 : 0;
    const prr = form.seen ? (form.positiveReplies / form.seen) * 100 : 0;
    const csr = form.seen ? (form.calendlySent / form.seen) * 100 : 0;

    return (
        <div className="flex flex-col gap-8">

            {/* Form Card */}
            <div className="card">
                <h2 className="flex items-center gap-2">
                    {editingId ? <Edit2 size={24} /> : <Plus size={24} />}
                    {editingId ? 'Edit Daily Log' : 'New Daily Log'}
                </h2>

                <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                            <span className="text-sm font-medium">Channel</span>
                            <select
                                className="input"
                                value={form.channel}
                                onChange={e => setForm({ ...form, channel: e.target.value as any })}
                            >
                                <option value="linkedin">LinkedIn</option>
                                <option value="personalized">Personalized</option>
                                <option value="offer">Offer</option>
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

                    <div className="p-4 bg-[var(--bg-app)] rounded-xl grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
                        {/* Metrics Row */}
                        {[
                            { key: 'sent', label: 'Sent' },
                            { key: 'seen', label: 'Seen (S)' },
                            { key: 'accepted', label: 'Accepted' },
                            { key: 'replied', label: 'Replied' },
                            { key: 'positiveReplies', label: 'Positive (B)' },
                            { key: 'calendlySent', label: 'Calendly (C)' },
                            { key: 'booked', label: 'Booked (D)' },
                            { key: 'attended', label: 'Attended' },
                            { key: 'closed', label: 'Closed' }
                        ].map(({ key, label }) => (
                            <label key={key} className="flex flex-col items-center gap-1">
                                <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-wider">{label}</span>
                                <input
                                    type="number"
                                    min="0"
                                    className="input text-center font-mono w-full"
                                    value={(form as any)[key]}
                                    onChange={e => setForm({ ...form, [key]: Number(e.target.value) })}
                                />
                            </label>
                        ))}
                    </div>

                    <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium">Notes / Campaign Tag</span>
                        <input
                            type="text"
                            className="input"
                            placeholder="e.g. CEOs Jan Campaign"
                            value={form.notes}
                            onChange={e => setForm({ ...form, notes: e.target.value })}
                        />
                    </label>

                    {/* Mini Panel */}
                    <div className="flex flex-wrap items-center gap-6 text-sm text-[var(--text-secondary)] bg-[var(--bg-app)] p-3 rounded border border-[var(--border)] border-dashed">
                        <Calculator size={16} />
                        <span className="font-bold">DM Sorcery Check:</span>
                        <span className={clsx(msr >= 60 ? "text-emerald-500" : "text-amber-500", "font-mono")}>MSR: {msr.toFixed(1)}%</span>
                        <span className={clsx(prr >= 6 ? "text-emerald-500" : "text-amber-500", "font-mono")}>PRR: {prr.toFixed(1)}%</span>
                        <span className={clsx(csr >= 3 ? "text-emerald-500" : "text-amber-500", "font-mono")}>CSR: {csr.toFixed(1)}%</span>
                        <span className={clsx(form.booked && (form.attended / form.booked) >= 0.8 ? "text-emerald-500" : "text-amber-500", "font-mono")}>SRR: {form.booked ? ((form.attended / form.booked) * 100).toFixed(0) : 0}%</span>
                        <span className={clsx(form.attended && (form.closed / form.attended) >= 0.5 ? "text-emerald-500" : "text-amber-500", "font-mono")}>CR: {form.attended ? ((form.closed / form.attended) * 100).toFixed(0) : 0}%</span>
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
                                <th className="p-3 text-center">Sent</th>
                                <th className="p-3 text-center">Seen</th>
                                <th className="p-3 text-center">Positive</th>
                                <th className="p-3 text-center">Booked</th>
                                <th className="p-3 text-center">Closed</th>
                                <th className="p-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...dailyLogs].sort((a, b) => b.date.localeCompare(a.date)).map(log => {
                                const exp = experiments.find(e => e.id === log.experimentId);
                                const variant = exp?.variants.find(v => v.id === log.variantId);
                                return (
                                    <tr key={log.id} className="border-b border-[var(--border)] hover:bg-secondary/5 transition-colors">
                                        <td className="p-3 font-mono opacity-70">{log.date}</td>
                                        <td className="p-3">
                                            <div className="font-medium text-foreground">{log.campaign || log.channel}</div>
                                            {exp && (
                                                <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
                                                    {exp.name} <span className="text-primary font-bold">[{variant?.label || '?'}]</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-3 text-center font-mono">{log.sent}</td>
                                        <td className="p-3 text-center font-mono">{log.seen}</td>
                                        <td className="p-3 text-center font-mono text-primary">{log.positiveReplies}</td>
                                        <td className="p-3 text-center font-mono">{log.booked}</td>
                                        <td className="p-3 text-center font-bold text-emerald-500 font-mono">{log.closed}</td>
                                        <td className="p-3 text-right">
                                            <button onClick={() => handleEdit(log)} className="p-1 hover:text-primary transition-colors"><Edit2 size={16} /></button>
                                            <button onClick={() => handleDelete(log.id)} className="p-1 hover:text-red-500 ml-2 transition-colors"><Trash2 size={16} /></button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {dailyLogs.length === 0 && <tr><td colSpan={7} className="text-center p-8 text-[var(--text-secondary)]">No logs yet.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function SaveIcon() {
    return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>;
}
