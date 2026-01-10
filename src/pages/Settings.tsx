import { isSupabaseConfigured } from '../lib/supabase';
import { useDMLab } from '../context/DMLabContext';
import { CheckCircle, AlertTriangle, Database, Target, Save } from 'lucide-react';
import clsx from 'clsx';

export default function Settings() {
    const { state, actions } = useDMLab();
    const { kpiTargets } = state;

    const handleKpiUpdate = (key: string, val: string) => {
        const num = parseFloat(val) / 100;
        if (!isNaN(num)) {
            actions.updateKpiTargets({ [key]: num });
        }
    };

    return (
        <div className="flex flex-col gap-6 max-w-2xl pb-20">
            <div className="card">
                <h3 className="flex items-center gap-2 mb-4">
                    <Database size={20} /> Storage & Sync
                </h3>

                <div className={clsx(
                    "p-4 rounded-lg border mb-6",
                    isSupabaseConfigured
                        ? "bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400"
                        : "bg-yellow-500/10 border-yellow-500/30 text-yellow-600 dark:text-yellow-400"
                )}>
                    <div className="flex items-center gap-2 font-bold mb-1">
                        {isSupabaseConfigured ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                        {isSupabaseConfigured ? 'Supabase Configured' : 'Local Mode Only'}
                    </div>
                    <p className="text-sm opacity-90">
                        {isSupabaseConfigured
                            ? "Data is syncing to your Supabase project on save."
                            : "Data is stored in your browser's LocalStorage. To enable sync, configure Supabase environment variables."}
                    </p>
                </div>

                <div className="flex justify-between items-center bg-secondary/20 p-4 rounded-xl border border-border">
                    <div>
                        <div className="font-bold text-sm">Save to Local Backend</div>
                        <p className="text-xs text-muted-foreground">Persist all your data to the local db.json file.</p>
                    </div>
                    <button
                        onClick={() => actions.saveData()}
                        className="btn btn-primary flex items-center gap-2 px-4 h-10"
                    >
                        <Save size={16} /> Save Data
                    </button>
                </div>
            </div>

            <div className="card">
                <h3 className="flex items-center gap-2 mb-2">
                    <Target size={20} /> Success Thresholds
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                    Customize the percentage targets for your DM Sorcery funnel. These affect the Green/Yellow indicators on the dashboard.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                        { key: 'msr', label: 'Media Seen Rate (MSR)' },
                        { key: 'prr', label: 'Positive Reply Rate (PRR)' },
                        { key: 'csr', label: 'Calendly Sent Rate (CSR)' },
                        { key: 'abr', label: 'Booking Rate (ABR)' },
                        { key: 'srr', label: 'Show up Rate (SRR)' },
                        { key: 'cr', label: 'Close Rate (CR)' },
                        { key: 'msbr', label: 'Seen > Engaged (MSBR)' },
                        { key: 'bcr', label: 'Engaged > Calendly (BCR)' },
                        { key: 'cdr', label: 'Calendly > Booked (CDR)' },
                    ].map(({ key, label }) => (
                        <div key={key} className="flex flex-col gap-1.5">
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="0.1"
                                    className="input w-full pr-10 font-mono"
                                    defaultValue={((kpiTargets as any)[key] * 100).toFixed(1)}
                                    onBlur={(e) => handleKpiUpdate(key, e.target.value)}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">%</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
