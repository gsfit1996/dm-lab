export type ExperimentStatus = 'planned' | 'running' | 'paused' | 'completed' | 'archived';
export type Channel = 'linkedin' | 'personalized' | 'offer';

export interface Variant {
    id: string;
    label: string;
    message: string;
}

export interface Experiment {
    id: string;
    name: string;
    hypothesis: string;
    status: ExperimentStatus;
    channel: Channel;
    createdAt: string;
    startedAt?: string;
    variants: Variant[];
}

export type LeadStage = 'A' | 'S' | 'B' | 'C' | 'D' | 'X'; // A: Initiate, S: Seen, B: Engaged, C: Calendly, D: Booked, X: Not Interested

export interface Lead {
    id: string;
    name: string;
    profileLink: string;
    dateInitiated: string;
    stage: LeadStage;
    experimentId?: string;
    variantId?: string;
    notes: string;
}

export interface DailyLog {
    id: string;
    date: string; // YYYY-MM-DD
    experimentId: string;
    variantId?: string; // For multivariate tracking
    campaign: string;
    channel: Channel;
    sent: number;
    seen: number; // Added for DM Sorcery
    accepted: number;
    replied: number;
    positiveReplies: number;
    calendlySent: number; // Renamed from callsSet for DM Sorcery
    booked: number;
    attended: number; // Added for Show up rate (SRR)
    closed: number;   // Added for Close Rate (CR)
    notes: string;
}

export interface Offer {
    id: string;
    date: string;
    label: string;
    audience: string;
    sent: number;
    accepted: number;
    booked: number;
    notes: string;
}

export interface Goals {
    weeklySent: number;
    weeklyBooked: number;
}

export interface KpiTargets {
    msr: number;
    prr: number;
    csr: number;
    abr: number;
    srr: number; // Show up rate
    cr: number;  // Close Rate
    msbr: number;
    bcr: number;
    cdr: number;
}

export interface AppState {
    experiments: Experiment[];
    dailyLogs: DailyLog[];
    leads: Lead[];
    offers: Offer[];
    goals: Goals;
    kpiTargets: KpiTargets;
    settings: {
        theme: 'dark' | 'light';
    };
}

export const CONSTANTS = {
    KPI_THRESHOLDS: {
        MSR: 0.60, // Media Seen Rate
        PRR: 0.06, // Positive Reply Rate
        CSR: 0.03, // Calendly Sent Rate
        ABR: 0.02, // Appointment Booking Rate
        MSBR: 0.10, // Media Seen to Positive Reply
        BCR: 0.50, // Positive Reply to Calendly Sent
        CDR: 0.66  // Calendly Sent to Booking
    },
    DEFAULT_KPI_TARGETS: {
        msr: 0.60,
        prr: 0.06,
        csr: 0.03,
        abr: 0.02,
        srr: 0.80,
        cr: 0.50,
        msbr: 0.10,
        bcr: 0.50,
        cdr: 0.66
    },
    STORAGE_KEY: 'dm_lab_v1'
};
