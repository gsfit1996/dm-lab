import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { migrateData } from '../utils/migrations';
import { AppState, Experiment, DailyLog, Offer, Lead, KpiTargets, CONSTANTS, Account } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Initial Empty State
const initialState: AppState = {
    experiments: [],
    dailyLogs: [],
    leads: [],
    offers: [],
    goals: {
        weeklyConnectionRequests: 100,
        weeklyPermissionSent: 100,
        weeklyBooked: 5
    },
    kpiTargets: CONSTANTS.DEFAULT_KPI_TARGETS,
    settings: {
        theme: 'dark',
        accounts: CONSTANTS.ACCOUNTS
    },
};

interface DMLabContextType {
    state: AppState;
    dispatch: React.Dispatch<Action>;
    actions: {
        addExperiment: (experiment: Omit<Experiment, 'id' | 'createdAt'>) => void;
        updateExperiment: (id: string, updates: Partial<Experiment>) => void;
        deleteExperiment: (id: string) => void;
        addLog: (log: Omit<DailyLog, 'id'>) => void;
        updateLog: (id: string, updates: Partial<DailyLog>) => void;
        deleteLog: (id: string) => void;
        addLead: (lead: Omit<Lead, 'id'>) => void;
        updateLead: (id: string, updates: Partial<Lead>) => void;
        deleteLead: (id: string) => void;
        addOffer: (offer: Omit<Offer, 'id'>) => void;
        updateOffer: (id: string, updates: Partial<Offer>) => void;
        deleteOffer: (id: string) => void;
        updateGoals: (goals: Partial<AppState['goals']>) => void;
        updateKpiTargets: (targets: Partial<KpiTargets>) => void;

        // Account Actions
        addAccount: (name: string) => void;
        updateAccount: (id: string, updates: Partial<Account>) => void;
        deleteAccount: (id: string) => void;

        saveData: () => Promise<void>;
        toggleTheme: () => void;
    };
    loading: boolean;
}

// Action Types (Simple Reducer Pattern)
type Action =
    | { type: 'SET_STATE'; payload: AppState }
    | { type: 'ADD_EXPERIMENT'; payload: Experiment }
    | { type: 'UPDATE_EXPERIMENT'; payload: { id: string; updates: Partial<Experiment> } }
    | { type: 'DELETE_EXPERIMENT'; payload: string }
    | { type: 'ADD_LOG'; payload: DailyLog }
    | { type: 'UPDATE_LOG'; payload: { id: string; updates: Partial<DailyLog> } }
    | { type: 'DELETE_LOG'; payload: string }
    | { type: 'ADD_LEAD'; payload: Lead }
    | { type: 'UPDATE_LEAD'; payload: { id: string; updates: Partial<Lead> } }
    | { type: 'DELETE_LEAD'; payload: string }
    | { type: 'ADD_OFFER'; payload: Offer }
    | { type: 'UPDATE_OFFER'; payload: { id: string; updates: Partial<Offer> } }
    | { type: 'DELETE_OFFER'; payload: string }
    | { type: 'UPDATE_GOALS'; payload: Partial<AppState['goals']> }
    | { type: 'UPDATE_KPI_TARGETS'; payload: Partial<KpiTargets> }
    | { type: 'TOGGLE_THEME' }
    | { type: 'ADD_ACCOUNT'; payload: Account }
    | { type: 'UPDATE_ACCOUNT'; payload: { id: string; updates: Partial<Account> } }
    | { type: 'DELETE_ACCOUNT'; payload: string };

function reducer(state: AppState, action: Action): AppState {
    switch (action.type) {
        case 'SET_STATE':
            // Ensure accounts exist if loading old data
            const settingsWithAccounts = {
                ...action.payload.settings,
                accounts: (action.payload.settings.accounts && action.payload.settings.accounts.length > 0 && typeof action.payload.settings.accounts[0] === 'object') ? action.payload.settings.accounts : CONSTANTS.ACCOUNTS
            };
            return { ...action.payload, settings: settingsWithAccounts as any };
        case 'ADD_EXPERIMENT':
            return { ...state, experiments: [...state.experiments, action.payload] };
        case 'UPDATE_EXPERIMENT':
            return {
                ...state,
                experiments: state.experiments.map(e => e.id === action.payload.id ? { ...e, ...action.payload.updates } : e)
            };
        case 'DELETE_EXPERIMENT':
            return {
                ...state,
                experiments: state.experiments.filter(e => e.id !== action.payload),
                dailyLogs: state.dailyLogs.map(l => l.experimentId === action.payload ? { ...l, experimentId: '', variantId: undefined } : l)
            };
        case 'ADD_LOG':
            return { ...state, dailyLogs: [...state.dailyLogs, action.payload] };
        case 'UPDATE_LOG':
            return {
                ...state,
                dailyLogs: state.dailyLogs.map(l => l.id === action.payload.id ? { ...l, ...action.payload.updates } : l)
            };
        case 'DELETE_LOG':
            return { ...state, dailyLogs: state.dailyLogs.filter(l => l.id !== action.payload) };
        case 'ADD_LEAD':
            return { ...state, leads: [...state.leads, action.payload] };
        case 'UPDATE_LEAD':
            return {
                ...state,
                leads: state.leads.map(l => l.id === action.payload.id ? { ...l, ...action.payload.updates } : l)
            };
        case 'DELETE_LEAD':
            return { ...state, leads: state.leads.filter(l => l.id !== action.payload) };
        case 'ADD_OFFER':
            return { ...state, offers: [...state.offers, action.payload] };
        case 'UPDATE_OFFER':
            return {
                ...state,
                offers: state.offers.map(o => o.id === action.payload.id ? { ...o, ...action.payload.updates } : o)
            };
        case 'DELETE_OFFER':
            return { ...state, offers: state.offers.filter(o => o.id !== action.payload) };
        case 'UPDATE_GOALS':
            return { ...state, goals: { ...state.goals, ...action.payload } };
        case 'UPDATE_KPI_TARGETS':
            return { ...state, kpiTargets: { ...state.kpiTargets, ...action.payload } };
        case 'TOGGLE_THEME':
            return { ...state, settings: { ...state.settings, theme: state.settings.theme === 'light' ? 'dark' : 'light' } };

        // Account Reducers
        case 'ADD_ACCOUNT':
            return { ...state, settings: { ...state.settings, accounts: [...state.settings.accounts, action.payload] } };
        case 'UPDATE_ACCOUNT':
            return {
                ...state,
                settings: {
                    ...state.settings,
                    accounts: state.settings.accounts.map(a => a.id === action.payload.id ? { ...a, ...action.payload.updates } : a)
                }
            };
        case 'DELETE_ACCOUNT':
            // Prevent deleting if it's the last one? Or just allow it.
            return {
                ...state,
                settings: {
                    ...state.settings,
                    accounts: state.settings.accounts.filter(a => a.id !== action.payload)
                }
            };

        default:
            return state;
    }
}

const DMLabContext = createContext<DMLabContextType | undefined>(undefined);

export function DMLabProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = React.useReducer(reducer, initialState);
    const [loading, setLoading] = useState(true);

    // Load from LocalStorage & Backend on Mount
    useEffect(() => {
        const load = async () => {
            // 1. LocalStorage as Fallback
            const local = localStorage.getItem(CONSTANTS.STORAGE_KEY);
            if (local) {
                try {
                    const parsed = JSON.parse(local);
                    // Migration is handled, but simplified for context here - the reducer SET_STATE does a check for accounts
                    const migrated = migrateData(parsed);
                    dispatch({ type: 'SET_STATE', payload: { ...initialState, ...migrated } });
                } catch (e) {
                    console.error("Failed to parse local storage", e);
                }
            }

            // 2. Load from Supabase (Cloud)
            if (isSupabaseConfigured && supabase) {
                try {
                    const { data, error } = await supabase
                        .from('user_data')
                        .select('data')
                        .eq('id', '1')
                        .single();

                    if (data?.data) {
                        const migrated = migrateData(data.data);
                        dispatch({ type: 'SET_STATE', payload: { ...initialState, ...migrated } });
                        console.log("Loaded data from Supabase Cloud");
                        setLoading(false);
                        return; // Exit if cloud load successful
                    }
                } catch (e) {
                    console.error("Failed to load from Supabase", e);
                }
            }

            // 3. Local Backend
            try {
                const res = await fetch('http://localhost:3001/api/data');
                if (res.ok) {
                    const data = await res.json();
                    if (data && (data.experiments || data.dailyLogs)) {
                        const migrated = migrateData(data);
                        dispatch({ type: 'SET_STATE', payload: { ...initialState, ...migrated } });
                        console.log("Loaded data from local backend");
                    }
                }
            } catch (e) {
                console.log("Local backend not available, running in offline mode");
            }
            setLoading(false);
        };
        load();
    }, []);

    // Sync to LocalStorage
    useEffect(() => {
        if (!loading) {
            localStorage.setItem(CONSTANTS.STORAGE_KEY, JSON.stringify(state));
            document.documentElement.setAttribute('data-theme', state.settings.theme);
        }
    }, [state, loading]);

    const actions = {
        addExperiment: (ex: Omit<Experiment, 'id' | 'createdAt'>) => {
            dispatch({ type: 'ADD_EXPERIMENT', payload: { ...ex, id: uuidv4(), createdAt: new Date().toISOString().split('T')[0] } });
        },
        updateExperiment: (id: string, updates: Partial<Experiment>) => dispatch({ type: 'UPDATE_EXPERIMENT', payload: { id, updates } }),
        deleteExperiment: (id: string) => dispatch({ type: 'DELETE_EXPERIMENT', payload: id }),

        addLog: (log: Omit<DailyLog, 'id'>) => dispatch({ type: 'ADD_LOG', payload: { ...log, id: uuidv4() } }),
        updateLog: (id: string, updates: Partial<DailyLog>) => dispatch({ type: 'UPDATE_LOG', payload: { id, updates } }),
        deleteLog: (id: string) => dispatch({ type: 'DELETE_LOG', payload: id }),

        addLead: (lead: Omit<Lead, 'id'>) => dispatch({ type: 'ADD_LEAD', payload: { ...lead, id: uuidv4() } }),
        updateLead: (id: string, updates: Partial<Lead>) => dispatch({ type: 'UPDATE_LEAD', payload: { id, updates } }),
        deleteLead: (id: string) => dispatch({ type: 'DELETE_LEAD', payload: id }),

        addOffer: (offer: Omit<Offer, 'id'>) => dispatch({ type: 'ADD_OFFER', payload: { ...offer, id: uuidv4() } }),
        updateOffer: (id: string, updates: Partial<Offer>) => dispatch({ type: 'UPDATE_OFFER', payload: { id, updates } }),
        deleteOffer: (id: string) => dispatch({ type: 'DELETE_OFFER', payload: id }),

        updateGoals: (goals: Partial<AppState['goals']>) => dispatch({ type: 'UPDATE_GOALS', payload: goals }),
        updateKpiTargets: (targets: Partial<KpiTargets>) => dispatch({ type: 'UPDATE_KPI_TARGETS', payload: targets }),
        toggleTheme: () => dispatch({ type: 'TOGGLE_THEME' }),

        addAccount: (name: string) => dispatch({ type: 'ADD_ACCOUNT', payload: { id: uuidv4(), name } }),
        updateAccount: (id: string, updates: Partial<Account>) => dispatch({ type: 'UPDATE_ACCOUNT', payload: { id, updates } }),
        deleteAccount: (id: string) => dispatch({ type: 'DELETE_ACCOUNT', payload: id }),

        saveData: async () => {
            // 1. Sync to Supabase if Configured
            if (isSupabaseConfigured && supabase) {
                try {
                    const { error } = await supabase
                        .from('user_data')
                        .upsert(
                            { id: '1', data: state },
                            { onConflict: 'id' }
                        );

                    if (error) throw error;
                    alert("Synced to Supabase Cloud!");
                    return; // Return early if successful cloud sync
                } catch (e) {
                    console.error("Supabase Sync Failed:", e);
                    alert("Supabase Sync Failed. Falling back to local...");
                }
            }

            // 2. Save to Local Backend (Fallback)
            try {
                const res = await fetch('http://localhost:3001/api/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(state)
                });
                if (res.ok) {
                    alert("Saved to Local Backend!");
                } else {
                    alert("Failed to save to local backend.");
                }
            } catch (e) {
                console.error(e);
                alert("Backend not reachable. Saved locally.");
            }
        }
    };

    return (
        <DMLabContext.Provider value={{ state, dispatch, actions, loading }}>
            {children}
        </DMLabContext.Provider>
    );
}

export function useDMLab() {
    const context = useContext(DMLabContext);
    if (!context) throw new Error('useDMLab must be used within DMLabProvider');
    return context;
}
