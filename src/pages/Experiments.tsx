import { useState } from 'react';
import { useDMLab } from '../context/DMLabContext';
import { Experiment, ExperimentStage, PrimaryMetric, CONSTANTS } from '../types';
import { Play, Pause, Archive as ArchiveIcon, Trash2, Copy, Plus, Edit2, X, AlertTriangle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import clsx from 'clsx';

export default function Experiments() {
    const { state, actions } = useDMLab();
    const { experiments, dailyLogs } = state;
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const initialForm: Omit<Experiment, 'id' | 'createdAt'> = {
        name: '',
        hypothesis: '',
        status: 'planned',
        channel: 'linkedin',
        stage: 'PERMISSION', // Default
        primaryMetric: 'PRR', // Default based on permission
        variants: [
            { id: uuidv4(), label: 'A', message: '' },
            { id: uuidv4(), label: 'B', message: '' }
        ],
        startedAt: ''
    };

    const [form, setForm] = useState(initialForm);

    const addVariant = () => {
        const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
        const nextLabel = labels[form.variants.length % labels.length];
        setForm({
            ...form,
            variants: [...form.variants, { id: uuidv4(), label: nextLabel, message: '' }]
        });
    };

    const removeVariant = (id: string) => {
        if (form.variants.length <= 1) return;
        setForm({
            ...form,
            variants: form.variants.filter(v => v.id !== id)
        });
    };

    const updateVariant = (id: string, message: string) => {
        setForm({
            ...form,
            variants: form.variants.map(v => v.id === id ? { ...v, message } : v)
        });
    };

    // Auto-update primary metric when stage changes
    const handleStageChange = (stage: ExperimentStage) => {
        let metric: PrimaryMetric = 'PRR';
        switch (stage) {
            case 'CONNECTION': metric = 'CR'; break;
            case 'PERMISSION': metric = 'PRR'; break;
            case 'OFFER': metric = 'ABR'; break;
            case 'BOOKING': metric = 'BOOKED_KPI'; break;
        }
        setForm({ ...form, stage, primaryMetric: metric });
    };

    // Helper to get metrics for an experiment
    const getMetrics = (expId: string) => {
        const logs = dailyLogs.filter(l => l.experimentId === expId);
        const exp = experiments.find(e => e.id === expId);
        if (!exp) return { variants: [], totalLogs: 0 };

        const threshold = exp.stage === 'OFFER' ? CONSTANTS.VALIDITY_THRESHOLDS.OFFER_SEEN : CONSTANTS.VALIDITY_THRESHOLDS.PERMISSION_SEEN;

        const variantStats = exp.variants.map(v => {
            const vLogs = logs.filter(l => l.variantId === v.id);

            // Calculate base metrics (simplified aggregate for this view)
            const sent = vLogs.reduce((s, l) => s + (l.permissionMessagesSent || 0), 0); // Denom for PRR/ABR
            const seen = vLogs.reduce((s, l) => s + (l.permissionSeen || l.offerSeen || 0), 0); // Validity denom
            const positives = vLogs.reduce((s, l) => s + l.permissionPositives, 0);
            const offers = vLogs.reduce((s, l) => s + l.offerPositives, 0);
            const booked = vLogs.reduce((s, l) => s + l.bookedCalls, 0);

            // Determine rate based on Primary Metric
            let rate = 0;
            const denom = exp.primaryMetric === 'CR' ? vLogs.reduce((s, l) => s + l.connectionRequestsSent, 0)
                : (exp.primaryMetric === 'PRR' || exp.primaryMetric === 'ABR' || exp.primaryMetric === 'BOOKED_KPI') ? sent
                    : 1;

            if (denom > 0) {
                if (exp.primaryMetric === 'CR') rate = vLogs.reduce((s, l) => s + l.connectionsAccepted, 0) / denom;
                else if (exp.primaryMetric === 'PRR') rate = positives / denom;
                else if (exp.primaryMetric === 'ABR') rate = offers / denom;
                else if (exp.primaryMetric === 'BOOKED_KPI') rate = booked / denom;

                // Fallback logic if denominator is 0 but we want to show something? No, secure check.
            }

            // Validity Check
            // "Permission tests require >= 60 SEEN", "Offer tests require >= 30 SEEN"
            // We use 'seen' field which aggregates permissionSeen or offerSeen.
            const isValid = seen >= threshold;

            return { ...v, sent, seen, rate, isValid, positives, offers, booked };
        });

        return { variants: variantStats, totalLogs: logs.length };
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingId) {
            actions.updateExperiment(editingId, form);
            setEditingId(null);
        } else {
            const finalForm = {
                ...form,
                startedAt: form.status === 'running' && !form.startedAt ? new Date().toISOString().split('T')[0] : form.startedAt
            };
            actions.addExperiment(finalForm);
        }
        setForm(initialForm);
        setShowForm(false);
    };

    const startEdit = (exp: Experiment) => {
        setEditingId(exp.id);
        const { id, createdAt, ...rest } = exp;
        setForm(rest);
        setShowForm(true);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const toggleStatus = (exp: Experiment) => {
        const newStatus = exp.status === 'running' ? 'paused' : 'running';
        const updates: Partial<Experiment> = { status: newStatus };
        if (newStatus === 'running' && !exp.startedAt) {
            updates.startedAt = new Date().toISOString().split('T')[0];
        }
        actions.updateExperiment(exp.id, updates);
    };

    const activeExperiments = experiments.filter(e => e.status !== 'archived').sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return (
        <div className="flex flex-col gap-6">

            {!showForm && (
                <button onClick={() => setShowForm(true)} className="btn w-fit">
                    <Plus size={18} /> New Multivariate Experiment
                </button>
            )}

            {showForm && (
                <div className="card border-[var(--accent)]">
                    <h3>{editingId ? 'Edit Experiment' : 'New Experiment'}</h3>
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <label className="flex flex-col gap-1">
                                <span className="text-sm">Name</span>
                                <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Permission Opener Test" />
                            </label>

                            <div className="grid grid-cols-2 gap-2">
                                <label className="flex flex-col gap-1">
                                    <span className="text-sm">Stage Targeted</span>
                                    <select
                                        className="input"
                                        value={form.stage}
                                        onChange={e => handleStageChange(e.target.value as ExperimentStage)}
                                    >
                                        <option value="CONNECTION">Connection</option>
                                        <option value="PERMISSION">Permission</option>
                                        <option value="OFFER">Offer</option>
                                        <option value="BOOKING">Booking</option>
                                    </select>
                                </label>
                                <label className="flex flex-col gap-1">
                                    <span className="text-sm">Primary Metric</span>
                                    <select
                                        className="input"
                                        value={form.primaryMetric}
                                        onChange={e => setForm({ ...form, primaryMetric: e.target.value as PrimaryMetric })}
                                    >
                                        <option value="CR">CR</option>
                                        <option value="PRR">PRR</option>
                                        <option value="ABR">ABR</option>
                                        <option value="BOOKED_KPI">Booked KPI</option>
                                    </select>
                                </label>
                            </div>
                        </div>

                        <label className="flex flex-col gap-1">
                            <span className="text-sm">Hypothesis</span>
                            <input className="input" value={form.hypothesis} onChange={e => setForm({ ...form, hypothesis: e.target.value })} placeholder="Shorter opener increases reply rate" />
                        </label>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between border-b border-border pb-2">
                                <span className="text-sm font-semibold">Message Variants</span>
                                <button type="button" onClick={addVariant} className="flex items-center gap-1 text-xs text-primary hover:underline">
                                    <Plus size={14} /> Add Variant
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {form.variants.map((v) => (
                                    <div key={v.id} className="p-4 bg-secondary/20 border border-border rounded-xl relative">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-bold text-xs uppercase tracking-wider text-primary">Variant {v.label}</span>
                                            {form.variants.length > 1 && (
                                                <button type="button" onClick={() => removeVariant(v.id)} className="text-muted-foreground hover:text-red-500">
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>
                                        <textarea
                                            className="input h-24 text-sm font-mono"
                                            value={v.message}
                                            onChange={e => updateVariant(v.id, e.target.value)}
                                            placeholder={`Paste variant ${v.label} copy here...`}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-4 border-t pt-4 mt-2 border-[var(--border)]">
                            <label className="flex flex-col gap-1 w-1/4">
                                <span className="text-sm">Initial Status</span>
                                <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value as any })}>
                                    <option value="planned">Planned</option>
                                    <option value="running">Running</option>
                                    <option value="completed">Completed</option>
                                </select>
                            </label>
                        </div>

                        <div className="flex justify-end gap-2">
                            <button type="button" className="btn btn-ghost" onClick={() => { setShowForm(false); setForm(initialForm); setEditingId(null); }}>Cancel</button>
                            <button type="submit" className="btn">Save Experiment</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4">
                {activeExperiments.map(exp => {
                    const { variants: vStats, totalLogs } = getMetrics(exp.id);
                    // Only declare winner if valid
                    const validVariants = vStats.filter(v => v.isValid);
                    const winner = validVariants.length > 0
                        ? validVariants.reduce((prev, current) => (prev.rate > current.rate) ? prev : current, validVariants[0])
                        : null;

                    return (
                        <div key={exp.id} className="card relative group">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <h3 className="text-lg">{exp.name}</h3>
                                        <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-secondary text-muted-foreground uppercase">{exp.stage} Stage</span>
                                    </div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <StatusBadge status={exp.status} />
                                        <span className="text-xs text-muted-foreground">Started: {exp.startedAt || 'Not started'}</span>
                                    </div>
                                    <p className="text-sm text-[var(--text-secondary)]">{exp.hypothesis}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => toggleStatus(exp)} className="btn btn-outline text-xs px-2 py-1 h-8">
                                        {exp.status === 'running' ? <Pause size={14} /> : <Play size={14} />}
                                        {exp.status === 'running' ? 'Pause' : 'Run'}
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                                {vStats.map((v) => (
                                    <div key={v.id} className={clsx(
                                        "p-3 rounded-xl border border-[var(--border)] relative",
                                        winner?.id === v.id && "bg-emerald-500/5 border-emerald-500/30 outline outline-1 outline-emerald-500/20"
                                    )}>
                                        <div className="flex justify-between mb-2">
                                            <span className="font-bold text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                                Variant {v.label}
                                                {winner?.id === v.id && <span className="text-[10px] bg-emerald-500/20 text-emerald-500 px-1.5 py-0.5 rounded">Leader</span>}
                                            </span>
                                            <button onClick={() => copyToClipboard(v.message)} className="text-[var(--text-secondary)] hover:text-[var(--accent)]"><Copy size={14} /></button>
                                        </div>

                                        <div className="flex items-baseline gap-1 mb-1">
                                            <span className="text-2xl font-bold">{(v.rate * 100).toFixed(1)}%</span>
                                            <span className="text-xs font-bold text-muted-foreground">{exp.primaryMetric}</span>
                                        </div>

                                        <div className="text-xs text-muted-foreground mb-3 flex gap-3">
                                            <span>{v.positives} Positives</span>
                                            <span>{v.seen} Seen</span>
                                        </div>

                                        <div className={clsx("flex items-center gap-1.5 text-[10px] font-bold uppercase p-1.5 rounded", v.isValid ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500")}>
                                            {v.isValid ? <span className="flex items-center gap-1">✓ Valid Sample</span> : <span className="flex items-center gap-1"><AlertTriangle size={10} /> Insufficient Data ({Math.max(0, (exp.stage === 'OFFER' ? 30 : 60) - v.seen)} left)</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-between items-center text-sm text-[var(--text-secondary)] border-t border-[var(--border)] pt-3">
                                <span>{totalLogs} daily logs attached</span>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => startEdit(exp)} className="p-1 hover:text-[var(--accent)]"><Edit2 size={16} /></button>
                                    <button onClick={() => actions.updateExperiment(exp.id, { status: 'archived' })} className="p-1 hover:text-orange-500" title="Archive"><ArchiveIcon size={16} /></button>
                                    <button onClick={() => { if (confirm('Delete ' + exp.name + '?')) actions.deleteExperiment(exp.id) }} className="p-1 hover:text-red-500" title="Delete"><Trash2 size={16} /></button>
                                </div>
                            </div>
                        </div>
                    );
                })}
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
