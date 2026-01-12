import { useState, useMemo } from 'react';
import { useDMLab } from '../context/DMLabContext';
import { Search, MoreVertical, Trash2, UserPlus, Linkedin, MessageSquare, Bot } from 'lucide-react';
import type { Lead, LeadStage } from '../types';
import clsx from 'clsx';
import { v4 as uuidv4 } from 'uuid';

const STAGES: { value: LeadStage; label: string; color: string }[] = [
    { value: 'REQUESTED', label: 'Requested', color: 'bg-sky-500/10 text-sky-400' },
    { value: 'CONNECTED', label: 'Connected', color: 'bg-indigo-500/10 text-indigo-400' },
    { value: 'PERMISSION_SENT', label: 'Permission Sent', color: 'bg-purple-500/10 text-purple-400' },
    { value: 'PERMISSION_POSITIVE', label: 'Permission Positive', color: 'bg-pink-500/10 text-pink-400' },
    { value: 'OFFER_POSITIVE', label: 'Offer Positive / Intent', color: 'bg-orange-500/10 text-orange-400' },
    { value: 'BOOKED', label: 'Booked', color: 'bg-emerald-500/10 text-emerald-400' },
    { value: 'ATTENDED', label: 'Attended', color: 'bg-emerald-500/5 text-emerald-300' },
    { value: 'CLOSED', label: 'Closed', color: 'bg-emerald-500/5 text-emerald-200' },
    { value: 'LOST', label: 'Lost', color: 'bg-red-500/10 text-red-400' }
];

export default function Leads() {
    const { state, actions } = useDMLab();
    const { leads, settings } = state;
    const [search, setSearch] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);

    // Available accounts
    const accountList = useMemo(() => settings.accounts || [], [settings.accounts]);
    const defaultAccountId = accountList[0]?.id || 'account_1';

    // Form State
    const [newLead, setNewLead] = useState<Partial<Lead>>({
        name: '',
        linkedinUrl: '',
        stage: 'REQUESTED',
        accountId: defaultAccountId,
        isOldLeadsLane: false,
        notes: ''
    });

    // Conversation View State
    const [activeLeadId, setActiveLeadId] = useState<string | null>(null);
    const activeLead = useMemo(() => leads.find(l => l.id === activeLeadId), [leads, activeLeadId]);
    const [historyEdit, setHistoryEdit] = useState('');

    const openConversation = (lead: Lead) => {
        setActiveLeadId(lead.id);
        setHistoryEdit(lead.conversationHistory || '');
    };

    const saveConversation = () => {
        if (activeLeadId) {
            actions.updateLead(activeLeadId, { conversationHistory: historyEdit });
            setActiveLeadId(null);
        }
    };

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
            stage: (newLead.stage as LeadStage) || 'REQUESTED',
            notes: newLead.notes || '',
            accountId: newLead.accountId || defaultAccountId,
            isOldLeadsLane: newLead.isOldLeadsLane || false,

            dateInitiated: new Date().toISOString().split('T')[0],
            lastInteraction: new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString()
        };
        actions.addLead(lead);
        setNewLead({ name: '', linkedinUrl: '', stage: 'REQUESTED', accountId: defaultAccountId, isOldLeadsLane: false, notes: '' });
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

            {/* Conversation / Edit Modal */}
            {activeLead && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-[var(--bg-card)] w-full max-w-2xl rounded-2xl shadow-2xl border border-border flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b border-border flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-lg text-white">{activeLead.name}</h3>
                                <p className="text-xs text-muted-foreground">Smart Context & History</p>
                            </div>
                            <button onClick={() => setActiveLeadId(null)} className="p-2 hover:bg-secondary rounded">X</button>
                        </div>

                        <div className="flex-1 p-0 flex flex-col overflow-hidden">
                            <div className="p-4 bg-secondary/10 border-b border-border">
                                <div className="flex gap-2 mb-2">
                                    <span className={clsx("text-xs font-bold px-2 py-1 rounded bg-secondary", activeLead.stage === 'BOOKED' ? 'text-emerald-500' : 'text-primary')}>
                                        {activeLead.stage}
                                    </span>
                                    <span className="text-xs font-mono opacity-50 px-2 py-1">{activeLead.accountId}</span>
                                </div>
                                <div className="text-sm italic opacity-70">
                                    {activeLead.notes || "No notes provided."}
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col p-4 gap-2 min-h-[300px]">
                                <label className="text-xs font-bold text-muted-foreground uppercase flex justify-between">
                                    <span>Conversation History</span>
                                    <span className="flex items-center gap-1 text-primary cursor-pointer hover:underline">
                                        <Bot size={12} /> AI Analyze (Coming Soon)
                                    </span>
                                </label>
                                <textarea
                                    className="flex-1 bg-secondary/20 border border-border rounded-lg p-3 text-sm font-mono resize-none focus:ring-1 focus:ring-primary outline-none"
                                    placeholder="Paste LinkedIn conversation here..."
                                    value={historyEdit}
                                    onChange={e => setHistoryEdit(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="p-4 border-t border-border flex justify-between bg-black/20">
                            <button onClick={() => setActiveLeadId(null)} className="btn btn-ghost text-xs">Cancel</button>
                            <button onClick={saveConversation} className="btn text-xs">Save Context</button>
                        </div>
                    </div>
                </div>
            )}

            {showAddForm && (
                <div className="card border-primary/50">
                    <h3 className="mb-4">New Prospect</h3>
                    <form onSubmit={handleAddLead} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                            <span className="text-xs font-bold text-muted-foreground uppercase">Account</span>
                            <select className="input" value={newLead.accountId} onChange={e => setNewLead({ ...newLead, accountId: e.target.value })}>
                                {accountList.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </label>
                        <label className="flex items-center gap-2 mt-6">
                            <input type="checkbox" checked={newLead.isOldLeadsLane} onChange={e => setNewLead({ ...newLead, isOldLeadsLane: e.target.checked })} className="w-4 h-4" />
                            <span className="text-xs font-bold text-muted-foreground uppercase">Old Leads Lane?</span>
                        </label>
                        <label className="flex flex-col gap-1 col-span-full">
                            <span className="text-xs font-bold text-muted-foreground uppercase">Notes</span>
                            <input className="input" value={newLead.notes} onChange={e => setNewLead({ ...newLead, notes: e.target.value })} placeholder="CEO at TechCorp..." />
                        </label>

                        <div className="col-span-full flex justify-end gap-2 mt-2">
                            <button type="button" onClick={() => setShowAddForm(false)} className="btn btn-ghost">Cancel</button>
                            <button type="submit" className="btn">Add Prospect</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="flex overflow-x-auto pb-6 gap-4 min-h-[calc(100vh-200px)]">
                {STAGES.map(stage => {
                    const stageLeads = filteredLeads.filter(l => l.stage === stage.value);
                    return (
                        <div key={stage.value} className="flex-none w-[280px] flex flex-col gap-3">
                            <div className={clsx("p-2 rounded-lg font-bold text-xs uppercase tracking-widest flex justify-between items-center sticky top-0 backdrop-blur-md z-10", stage.color)}>
                                {stage.label}
                                <span className="bg-black/20 px-2 py-0.5 rounded-full">{stageLeads.length}</span>
                            </div>
                            <div className="flex flex-col gap-3 h-full">
                                {stageLeads.map(lead => (
                                    <div key={lead.id} className="card-base p-4 group relative hover:ring-1 hover:ring-primary/50 transition-all">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <div className="font-bold text-white group-hover:text-primary transition-colors cursor-pointer" onClick={() => openConversation(lead)}>{lead.name}</div>
                                        <div className="text-[10px] text-muted-foreground">{accountList.find(a => a.id === lead.accountId)?.name || lead.accountId || defaultAccountId}</div>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => actions.deleteLead(lead.id)} className="p-1 hover:text-red-500"><Trash2 size={14} /></button>
                                            </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{lead.notes || 'No notes'}</p>

                                        {/* Smart Context Indicator */}
                                        {lead.conversationHistory && (
                                            <div className="mb-3 flex items-center gap-1.5 text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded w-fit">
                                                <MessageSquare size={10} /> Has Context
                                            </div>
                                        )}

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
                                        {lead.isOldLeadsLane && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-500" title="Old Leads Lane" />}
                                    </div>
                                ))}
                                {stageLeads.length === 0 && (
                                    <div className="h-full min-h-[100px] border-2 border-dashed border-border rounded-2xl flex items-center justify-center text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-30">
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
