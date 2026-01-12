export type ExperimentStatus = 'planned' | 'running' | 'paused' | 'completed' | 'archived';
export type Channel = 'linkedin' | 'personalized' | 'offer';
export type ExperimentType = 'PERMISSION_MESSAGE' | 'OFFER_MESSAGE' | 'OLD_LEADS_REOFFER';
export type ExperimentStage = 'CONNECTION' | 'PERMISSION' | 'OFFER' | 'BOOKING';
export type PrimaryMetric = 'CR' | 'PRR' | 'ABR' | 'BOOKED_KPI';

export interface Variant {
    id: string;
    label: string;
    message: string;
    step?: string; // e.g., 'permission_opener', 'offer_cta', etc.
}

export interface Experiment {
    id: string;
    name: string;
    hypothesis: string;
    status: ExperimentStatus;
    channel: Channel;
    experimentType: ExperimentType; // PERMISSION_MESSAGE | OFFER_MESSAGE | OLD_LEADS_REOFFER
    stage: ExperimentStage; // Derived from experimentType
    primaryMetric: PrimaryMetric; // Auto-set based on experimentType
    createdAt: string;
    startedAt?: string;
    variants: Variant[];
}

// Elite Health "Hot Prospects" - only track late-stage leads
export type LeadStage =
    | 'PERMISSION_POSITIVE'  // Permission positive (👍 to permission)
    | 'OFFER_POSITIVE'       // Offer positive / Booking Intent (👍 to offer)
    | 'BOOKED'               // Call booked
    | 'LOST';                // Lost / Not Interested

// Legacy stages for migration compatibility
export type LegacyLeadStage =
    | 'REQUESTED'
    | 'CONNECTED'
    | 'PERMISSION_SENT'
    | 'PERMISSION_POS'
    | 'OFFER_POS'
    | 'ATTENDED'
    | 'CLOSED';

export interface Lead {
    id: string;
    name: string;
    profileLink: string;
    linkedinUrl?: string;
    dateInitiated: string;
    lastInteraction?: string;
    stage: LeadStage; // Updated enum
    accountId?: string; // New field
    isOldLane?: boolean; // New field
    conversationHistory?: string; // Stored as a single text blob for now for ease of editing
    experimentId?: string;
    variantId?: string;
    notes: string;
    createdAt?: string;
}

export interface DailyLog {
    id: string;
    date: string; // YYYY-MM-DD
    experimentId: string;
    variantId?: string;
    campaign: string;
    channel: Channel;

    // Identity & Segmentation
    accountId?: string; // 'Account 1' | 'Account 2'
    isOldLane?: boolean; // If true, exclude from primary KPIs

    // Primary Flow Metrics
    connectionRequestsSent: number;
    connectionsAccepted: number;

    permissionMessagesSent: number;
    permissionSeen: number; // Diagnostic / Test Validity
    permissionPositives: number; // PRR numerator

    offerMessagesSent?: number; // Optional
    offerSeen?: number; // Diagnostic / Test Validity
    offerPositives: number; // ABR numerator (Offer or Booking Intent)

    bookedCalls: number; // Booked KPI numerator

    // Sales / Downstream (Optional)
    attendedCalls?: number;
    closedDeals?: number;

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
    weeklyConnectionRequests: number;
    weeklyPermissionSent: number;
    weeklyBooked: number;
}

export interface KpiTargets {
    cr: number;  // Connection Rate (30%)
    prr: number; // Positive Reply Rate (8%)
    abr: number; // Appointment Booking Rate (4%)
    booked: number; // Booked KPI (3%)

    // Diagnostic / Secondary
    posToAbr: number; // 50%
    abrToBooked: number; // 66%

    // Optional
    srr?: number; // Show up rate
    scr?: number; // Sales Close Rate
    seenRate?: number; // Diagnostic info only, usually 60%
}

export interface AppState {
    experiments: Experiment[];
    dailyLogs: DailyLog[];
    leads: Lead[];
    offers: Offer[];
    goals: Goals; // Account-specific goals can be handled by just summing or generic "per account" logic in UI for now, or updating this structure if needed. User said "per account" in UI, but single settings. Let's stick to simple first.
    kpiTargets: KpiTargets;
    settings: {
        theme: 'dark' | 'light';
        accounts: string[]; // List of account names
    };
}

export const CONSTANTS = {
    KPI_THRESHOLDS: {
        CR: 0.30,
        PRR: 0.08,
        ABR: 0.04,
        BOOKED: 0.03,
        POS_TO_ABR: 0.50,
        ABR_TO_BOOKED: 0.66
    },
    // For test validity
    VALIDITY_THRESHOLDS: {
        PERMISSION_SEEN: 60,
        OFFER_SEEN: 30
    },
    DEFAULT_KPI_TARGETS: {
        cr: 30,
        prr: 8,
        abr: 4,
        booked: 3,
        posToAbr: 50,
        abrToBooked: 66,
        srr: 80,
        scr: 20
    },
    STORAGE_KEY: 'dm_lab_v2', // Bumped version
    ACCOUNTS: ['Account 1', 'Account 2']
};
