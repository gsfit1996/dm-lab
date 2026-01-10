import { useState } from 'react';
import { useDMLab } from '../context/DMLabContext';
import type { Offer } from '../types';
import { Edit2, Trash2, Gift } from 'lucide-react';

export default function Offers() {
    const { state, actions } = useDMLab();
    const { offers } = state;
    const [editingId, setEditingId] = useState<string | null>(null);

    const initialForm: Omit<Offer, 'id'> = {
        date: new Date().toISOString().split('T')[0],
        label: '',
        audience: '',
        sent: 0,
        accepted: 0,
        booked: 0,
        notes: ''
    };

    const [form, setForm] = useState(initialForm);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingId) {
            actions.updateOffer(editingId, form);
            setEditingId(null);
        } else {
            actions.addOffer(form);
        }
        setForm(initialForm);
    };

    const handleEdit = (offer: Offer) => {
        setEditingId(offer.id);
        const { id, ...rest } = offer;
        setForm(rest);
    };

    const handleDelete = (id: string) => {
        if (confirm('Delete this offer log?')) actions.deleteOffer(id);
    };

    return (
        <div className="flex flex-col gap-8">

            {/* Overview Cards */}
            <div className="grid grid-cols-3 gap-4">
                <div className="card bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-indigo-500/20">
                    <h4 className="text-[var(--text-secondary)] text-sm mb-1">Total Offers Sent</h4>
                    <div className="text-3xl font-bold">{offers.reduce((a, b) => a + b.sent, 0)}</div>
                </div>
                <div className="card bg-green-500/10 border-green-500/20">
                    <h4 className="text-[var(--text-secondary)] text-sm mb-1">Total Booked</h4>
                    <div className="text-3xl font-bold text-green-500">{offers.reduce((a, b) => a + b.booked, 0)}</div>
                </div>
            </div>

            <div className="card">
                <h2 className="flex items-center gap-2 mb-4">
                    {editingId ? <Edit2 size={24} /> : <Gift size={24} />}
                    {editingId ? 'Edit Offer Log' : 'Log New Offer'}
                </h2>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="grid grid-cols-3 gap-4">
                        <label className="flex flex-col gap-1">
                            <span className="text-sm">Date</span>
                            <input type="date" className="input" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
                        </label>
                        <label className="flex flex-col gap-1">
                            <span className="text-sm">Offer Label</span>
                            <input className="input" placeholder="e.g. Black Friday Audit" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} required />
                        </label>
                        <label className="flex flex-col gap-1">
                            <span className="text-sm">Audience</span>
                            <input className="input" placeholder="e.g. SaaS Founders" value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value })} />
                        </label>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <label className="flex flex-col gap-1">
                            <span className="text-sm">Sent</span>
                            <input type="number" min="0" className="input" value={form.sent} onChange={e => setForm({ ...form, sent: Number(e.target.value) })} />
                        </label>
                        <label className="flex flex-col gap-1">
                            <span className="text-sm">Accepted</span>
                            <input type="number" min="0" className="input" value={form.accepted} onChange={e => setForm({ ...form, accepted: Number(e.target.value) })} />
                        </label>
                        <label className="flex flex-col gap-1">
                            <span className="text-sm">Booked</span>
                            <input type="number" min="0" className="input" value={form.booked} onChange={e => setForm({ ...form, booked: Number(e.target.value) })} />
                        </label>
                    </div>

                    <label className="flex flex-col gap-1">
                        <span className="text-sm">Notes</span>
                        <input className="input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                    </label>

                    <div className="flex justify-end gap-2">
                        {editingId && <button type="button" className="btn btn-ghost" onClick={() => { setEditingId(null); setForm(initialForm) }}>Cancel</button>}
                        <button type="submit" className="btn">{editingId ? 'Update Offer' : 'Add Offer'}</button>
                    </div>
                </form>
            </div>

            <div className="card">
                <h3>Offer History</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="text-[var(--text-secondary)] border-b border-[var(--border)]">
                                <th className="p-3">Date</th>
                                <th className="p-3">Label</th>
                                <th className="p-3">Audience</th>
                                <th className="p-3 text-center">Sent</th>
                                <th className="p-3 text-center">Acc %</th>
                                <th className="p-3 text-center">Book %</th>
                                <th className="p-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...offers].sort((a, b) => b.date.localeCompare(a.date)).map(o => {
                                const accRate = o.sent ? (o.accepted / o.sent * 100).toFixed(1) : '0.0';
                                const bookRate = o.sent ? (o.booked / o.sent * 100).toFixed(1) : '0.0';
                                return (
                                    <tr key={o.id} className="border-b border-[var(--border)] hover:bg-[rgba(128,128,128,0.05)]">
                                        <td className="p-3 font-mono">{o.date}</td>
                                        <td className="p-3 font-medium">{o.label}</td>
                                        <td className="p-3 text-[var(--text-secondary)]">{o.audience}</td>
                                        <td className="p-3 text-center">{o.sent}</td>
                                        <td className="p-3 text-center">{accRate}%</td>
                                        <td className="p-3 text-center font-bold text-green-500">{bookRate}%</td>
                                        <td className="p-3 text-right">
                                            <button onClick={() => handleEdit(o)} className="p-1 hover:text-[var(--accent)]"><Edit2 size={16} /></button>
                                            <button onClick={() => handleDelete(o.id)} className="p-1 hover:text-red-500 ml-1"><Trash2 size={16} /></button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {offers.length === 0 && <tr><td colSpan={7} className="text-center p-8 text-[var(--text-secondary)]">No offers logged.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
