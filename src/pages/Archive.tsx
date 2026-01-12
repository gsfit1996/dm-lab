import { useDMLab } from '../context/DMLabContext';
import { Archive as ArchiveIcon } from 'lucide-react';

export default function Archive() {
    const { state, actions } = useDMLab();
    const archived = state.experiments.filter(e => e.status === 'archived');

    return (
        <div className="flex flex-col gap-6">
            <div className="card">
                <h3 className="flex items-center gap-2">
                    <ArchiveIcon size={20} /> Archived Experiments
                </h3>
                <p className="text-[var(--text-secondary)] mb-4">Experiments that have been hidden from the main view.</p>

                {archived.length === 0 ? (
                    <div className="text-center py-8 text-[var(--text-secondary)] italic">No archived experiments.</div>
                ) : (
                    <div className="grid gap-4">
                        {archived.map(exp => (
                            <div key={exp.id} className="border border-[var(--border)] p-4 rounded-lg flex justify-between items-center opacity-75 hover:opacity-100">
                                <div>
                                    <div className="font-bold">{exp.name}</div>
                                    <div className="text-sm text-[var(--text-secondary)]">{exp.hypothesis}</div>
                                </div>
                                <div className="flex gap-2">
                                    <span className="badge archived">Archived</span>
                                    <button
                                        onClick={() => actions.updateExperiment(exp.id, { status: 'completed' })}
                                        className="text-sm underline text-[var(--text-secondary)] hover:text-[var(--accent)]"
                                    >
                                        Unarchive
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
