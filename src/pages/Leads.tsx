import { useState } from 'react';
import { useDMLab } from '../context/DMLabContext';
import { Plus, Search, MoreVertical, Trash2, UserPlus, Linkedin, ExternalLink } from 'lucide-react';
import type { Lead, LeadStage } from '../types';
import clsx from 'clsx';
import { v4 as uuidv4 } from 'uuid';

const STAGES: { value: LeadStage; label: string; color: string }[] = [
    { value: 'A', label: 'Initiated (A)', color: 'bg-blue-500/10 text-blue-400' },
    { value: 'S', label: 'Seen (S)', color: 'bg-indigo-500/10 text-indigo-400' },
    { value: 'B', label: 'Engaged (B)', color: 'bg-purple-500/10 text-purple-400' },
    { value: 'C', label: 'Calendly (C)', color: 'bg-pink-500/10 text-pink-400' },
    { value: 'D', label: 'Booked (D)', color: 'bg-emerald-500/10 text-emerald-400' },
    { value: 'X', label: 'Lost (X)', color: 'bg-red-500/10 text-red-400' },
];

export default function Leads() {
    const { state, actions } = useDMLab();
    const { leads } = state;
    const [search, setSearch] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [newLead, setNewLead] = useState<Partial<Lead>>({
        name: '',
        linkedinUrl: '',
        stage: 'A',
        notes: ''
    });

    const filteredLeads = leads.filter(l =>
        l.name.toLowerCase().includes(search.toLowerCase()) ||
        (l.notes?.toLowerCase() || '').includes(search.toLowerCase())
    );

    const handleAddLead = (e: React.FormEvent) => {
        e.preventDefault();
        const lead: Lead = {
            id: uuidv4(),
            name: newLead.name || 'Unknown',
            linkedinUrl: newLead.linkedinUrl || '',
            stage: newLead.stage as LeadStage || 'A',
            notes: newLead.notes || '',
            lastInteraction: new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString()
        };
        actions.addLead(lead);
        setNewLead({ name: '', linkedinUrl: '', stage: 'A', notes: '' });
        setShowAddForm(false);
    };

    const updateStage = (id: string, stage: LeadStage) => {
        actions.updateLead(id, { stage, lastInteraction: new Date().toISOString().split('T')[0] });
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Prospect CRM</h1>
                    <p className="text-muted-foreground text-sm">Track your LinkedIn leads through the DM Sorcery funnel.</p>
                </div>
                <button
                    onClick={() => setShowAddForm(true)}
                    className="btn flex items-center gap-2"
                >
                    <UserPlus size={18} /> Add Prospect
                </button>
            </div>

            <div className="flex items-center gap-3 bg-secondary/20 p-3 rounded-xl border border-border">
                <Search size={18} className="text-muted-foreground" />
                <input
                    type="text"
                    placeholder="Search prospects..."
                    className="bg-transparent border-none outline-none text-sm w-full"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {showAddForm && (
                <div className="card border-primary/50">
                    <h3 className="mb-4">New Prospect</h3>
                    <form onSubmit={handleAddLead} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="flex flex-col gap-1">
                            <span className="text-xs font-bold text-muted-foreground uppercase">Name</span>
                            <input className="input" value={newLead.name} onChange={e => setNewLead({ ...newLead, name: e.target.value })} required placeholder="John Doe" />
                        </label>
                        <label className="flex flex-col gap-1">
                            <span className="text-xs font-bold text-muted-foreground uppercase">LinkedIn URL</span>
                            <input className="input" value={newLead.linkedinUrl} onChange={e => setNewLead({ ...newLead, linkedinUrl: e.target.value })} placeholder="https://linkedin.com/in/..." />
                        </label>
                        <label className="flex flex-col gap-1">
                            <span className="text-xs font-bold text-muted-foreground uppercase">Initial Stage</span>
                            <select className="input" value={newLead.stage} onChange={e => setNewLead({ ...newLead, stage: e.target.value as LeadStage })}>
                                {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                        </label>
                        <label className="flex flex-col gap-1">
                            <span className="text-xs font-bold text-muted-foreground uppercase">Notes</span>
                            <input className="input" value={newLead.notes} onChange={e => setNewLead({ ...newLead, notes: e.target.value })} placeholder="CEO at TechCorp..." />
                        </label>
                        <div className="md:col-span-2 flex justify-end gap-2 mt-2">
                            <button type="button" onClick={() => setShowAddForm(false)} className="btn btn-ghost">Cancel</button>
                            <button type="submit" className="btn">Add Prospect</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {STAGES.map(stage => {
                    const stageLeads = filteredLeads.filter(l => l.stage === stage.value);
                    return (
                        <div key={stage.value} className="flex flex-col gap-3">
                            <div className={clsx("p-2 rounded-lg font-bold text-xs uppercase tracking-widest flex justify-between items-center", stage.color)}>
                                {stage.label}
                                <span className="bg-black/20 px-2 py-0.5 rounded-full">{stageLeads.length}</span>
                            </div>
                            <div className="flex flex-col gap-3 min-h-[100px]">
                                {stageLeads.map(lead => (
                                    <div key={lead.id} className="card-base p-4 group">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="font-bold text-white group-hover:text-primary transition-colors">{lead.name}</div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => actions.deleteLead(lead.id)} className="p-1 hover:text-red-500"><Trash2 size={14} /></button>
                                            </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{lead.notes || 'No notes'}</p>
                                        <div className="flex items-center justify-between mt-auto">
                                            <div className="text-[10px] text-muted-foreground opacity-50">Last: {lead.lastInteraction}</div>
                                            <div className="flex gap-2">
                                                {lead.linkedinUrl && (
                                                    <a href={lead.linkedinUrl} target="_blank" rel="noreferrer" className="p-1.5 bg-secondary/50 rounded-lg hover:bg-primary/20 hover:text-primary transition-all">
                                                        <Linkedin size={12} />
                                                    </a>
                                                )}
                                                <div className="relative group/menu">
                                                    <button className="p-1.5 bg-secondary/50 rounded-lg hover:bg-primary/20 hover:text-primary transition-all">
                                                        <MoreVertical size={12} />
                                                    </button>
                                                    <div className="absolute right-0 bottom-full mb-2 hidden group-hover/menu:block bg-secondary border border-border rounded-xl shadow-2xl z-20 w-40 overflow-hidden">
                                                        {STAGES.map(s => (
                                                            <button
                                                                key={s.value}
                                                                onClick={() => updateStage(lead.id, s.value)}
                                                                className={clsx(
                                                                    "w-full text-left px-3 py-2 text-[10px] font-bold uppercase transition-colors hover:bg-white/5",
                                                                    lead.stage === s.value ? "text-primary bg-primary/10" : "text-muted-foreground"
                                                                )}
                                                            >
                                                                Move to {s.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {stageLeads.length === 0 && (
                                    <div className="h-20 border-2 border-dashed border-border rounded-2xl flex items-center justify-center text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-30">
                                        Empty
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
