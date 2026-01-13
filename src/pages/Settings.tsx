import { useState } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import { useDMLab } from '../context/DMLabContext';
import { CONSTANTS } from '../types';
import { CheckCircle, AlertTriangle, Database, Target, Save, Users, Plus, Trash2, Palette } from 'lucide-react';
import clsx from 'clsx';

export default function Settings() {
    const { state, actions } = useDMLab();
    const { kpiTargets, settings } = state;
    const accounts = settings.accounts || CONSTANTS.DEFAULT_ACCOUNTS;

    // Coerce legacy string accounts to Account[] for safe rendering.
    const safeAccounts = Array.isArray(accounts)
        ? (typeof accounts[0] === 'string'
            ? accounts.map((a: any, index: number) => ({
                id: `account_${index + 1}`,
                name: a,
                color: '#3b82f6',
                weeklyGoals: { ...CONSTANTS.DEFAULT_WEEKLY_GOALS }
            }))
            : accounts)
        : [];

    const [newAccountName, setNewAccountName] = useState('');

    const handleAddAccount = (e: React.FormEvent) => {
        e.preventDefault();
        if (newAccountName.trim()) {
            actions.addAccount(newAccountName.trim());
            setNewAccountName('');
        }
    };

    const handleKpiUpdate = (key: string, val: string) => {
        const num = parseFloat(val);
        if (!isNaN(num)) {
            actions.updateKpiTargets({ [key]: num });
        }
    };

    return (
        <div className="flex flex-col gap-6 max-w-2xl pb-20">
            <div>
                <div className="section-kicker">System setup</div>
                <h1 className="section-title">Settings</h1>
                <p className="section-subtitle">Manage accounts, KPI targets, and data sync preferences.</p>
            </div>
            {/* Account Settings */}
            <div className="card">
                <div className="flex items-center gap-2 mb-4">
                    <Users size={20} className="text-primary" />
                    <div>
                        <div className="section-kicker">Accounts</div>
                        <h3 className="section-title text-lg">LinkedIn Accounts</h3>
                    </div>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                    Manage the LinkedIn accounts you are tracking. Affects logging and dashboard filters.
                </p>

                <div className="flex flex-col gap-3 mb-6">
                    {safeAccounts.map((acc: any, idx: number) => (
                        <div key={acc.id || idx} className="p-3 bg-secondary/10 rounded-lg group border border-transparent hover:border-border transition-all">
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-4 h-4 rounded-full"
                                    style={{ backgroundColor: acc.color || '#3b82f6' }}
                                    title="Account Color"
                                />
                                <input
                                    className="input h-8 text-sm font-mono flex-1"
                                    value={acc.name}
                                    onChange={(e) => actions.updateAccount(acc.id, { name: e.target.value })}
                                />

                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <label className="cursor-pointer p-1.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground">
                                        <Palette size={14} />
                                        <input
                                            type="color"
                                            className="sr-only"
                                            value={acc.color || '#3b82f6'}
                                            onChange={(e) => actions.updateAccount(acc.id, { color: e.target.value })}
                                        />
                                    </label>
                                    <button
                                        onClick={() => { if (confirm(`Delete account "${acc.name}"?`)) actions.deleteAccount(acc.id) }}
                                        className="p-1.5 hover:bg-red-500/10 rounded text-muted-foreground hover:text-red-500"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                                <GoalInput
                                    label="Connection Requests / Week"
                                    value={acc.weeklyGoals?.weeklyConnectionRequests ?? 0}
                                    onChange={(value) => actions.updateAccount(acc.id, { weeklyGoals: { ...acc.weeklyGoals, weeklyConnectionRequests: value } })}
                                />
                                <GoalInput
                                    label="Permission Messages / Week"
                                    value={acc.weeklyGoals?.weeklyPermissionSent ?? 0}
                                    onChange={(value) => actions.updateAccount(acc.id, { weeklyGoals: { ...acc.weeklyGoals, weeklyPermissionSent: value } })}
                                />
                                <GoalInput
                                    label="Booked Calls / Week"
                                    value={acc.weeklyGoals?.weeklyBooked ?? 0}
                                    onChange={(value) => actions.updateAccount(acc.id, { weeklyGoals: { ...acc.weeklyGoals, weeklyBooked: value } })}
                                />
                            </div>
                        </div>
                    ))}
                </div>

                <form onSubmit={handleAddAccount} className="flex gap-2">
                    <input
                        className="input flex-1"
                        placeholder="New Account Name (e.g. Gareth Profile)"
                        value={newAccountName}
                        onChange={e => setNewAccountName(e.target.value)}
                    />
                    <button type="submit" className="btn btn-secondary text-xs whitespace-nowrap" disabled={!newAccountName.trim()}>
                        <Plus size={16} /> Add Account
                    </button>
                </form>
            </div>

            <div className="card">
                <div className="flex items-center gap-2 mb-2">
                    <Target size={20} className="text-primary" />
                    <div>
                        <div className="section-kicker">Targets</div>
                        <h3 className="section-title text-lg">Success Thresholds %</h3>
                    </div>
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                    Customize the KPI targets (0-100%). These drive the bottleneck diagnostics and dashboard colors.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                    <div className="col-span-full">
                        <h4 className="text-sm font-bold uppercase tracking-wider text-primary mb-3 border-b border-border pb-1">Primary Metrics</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-2 gap-4">
                            <ThresholdInput label="Connection Rate (CR)" valueKey="cr" targets={kpiTargets} onChange={handleKpiUpdate} tooltip="Connections accepted / connection requests sent." />
                            <ThresholdInput label="Positive Reply Rate (PRR)" valueKey="prr" targets={kpiTargets} onChange={handleKpiUpdate} tooltip="Permission positives / permission messages sent." />
                            <ThresholdInput label="Appointment Booking Rate (ABR)" valueKey="abr" targets={kpiTargets} onChange={handleKpiUpdate} tooltip="Offer or booking intent positives / permission messages sent." />
                            <ThresholdInput label="Booked KPI" valueKey="booked" targets={kpiTargets} onChange={handleKpiUpdate} tooltip="Booked calls / permission messages sent." />
                        </div>
                    </div>

                    <div className="col-span-full">
                        <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 border-b border-border pb-1">Secondary / Diagnostic</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-2 gap-4">
                            <ThresholdInput label="Positive -> ABR" valueKey="posToAbr" targets={kpiTargets} onChange={handleKpiUpdate} tooltip="Offer or booking intent positives / permission positives." />
                            <ThresholdInput label="ABR -> Booked" valueKey="abrToBooked" targets={kpiTargets} onChange={handleKpiUpdate} tooltip="Booked calls / offer or booking intent positives." />
                            <ThresholdInput label="Seen Rate (Optional)" valueKey="seenRate" targets={kpiTargets} onChange={handleKpiUpdate} tooltip="Permission seen / permission messages sent." />
                            <ThresholdInput label="Show-up Rate (SRR)" valueKey="srr" targets={kpiTargets} onChange={handleKpiUpdate} tooltip="Attended calls / booked calls." />
                            <ThresholdInput label="Sales Close Rate (SCR)" valueKey="scr" targets={kpiTargets} onChange={handleKpiUpdate} tooltip="Closed deals / attended calls." />
                        </div>
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="flex items-center gap-2 mb-4">
                    <Target size={20} className="text-primary" />
                    <div>
                        <div className="section-kicker">Exclusions</div>
                        <h3 className="section-title text-lg">KPI Exclusions</h3>
                    </div>
                </div>
                <label className="flex items-center gap-3 text-sm text-muted-foreground">
                    <input
                        type="checkbox"
                        className="w-4 h-4"
                        checked={settings.excludeOldLeadsFromKpi ?? true}
                        onChange={(e) => actions.updateSettings({ excludeOldLeadsFromKpi: e.target.checked })}
                    />
                    Exclude Old Leads Lane from KPI calculations (recommended)
                </label>
            </div>

            <div className="card">
                <div className="flex items-center gap-2 mb-4">
                    <Database size={20} className="text-primary" />
                    <div>
                        <div className="section-kicker">Storage</div>
                        <h3 className="section-title text-lg">Storage & Sync</h3>
                    </div>
                </div>

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
        </div>
    );
}

function ThresholdInput({ label, valueKey, targets, onChange, tooltip }: any) {
    const val = (targets as any)[valueKey] || 0;
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
                {tooltip && <span className="text-[10px] text-muted-foreground opacity-50 hidden sm:block" title={tooltip}>{tooltip}</span>}
            </div>
            <div className="relative">
                <input
                    type="number"
                    step="0.1"
                    className="input w-full pr-10 font-mono"
                    defaultValue={val} // Display "30" for 30
                    onBlur={(e) => onChange(valueKey, e.target.value)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">%</span>
            </div>
        </div>
    );
}

function GoalInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase text-muted-foreground tracking-wider">{label}</span>
            <input
                type="number"
                min="0"
                className="input h-9 text-sm font-mono"
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
            />
        </label>
    );
}
