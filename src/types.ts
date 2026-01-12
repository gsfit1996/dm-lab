export type ExperimentStatus = 'planned' | 'running' | 'paused' | 'completed' | 'archived';
export type Channel = 'linkedin' | 'personalized' | 'offer';
export type ExperimentType = 'PERMISSION_MESSAGE' | 'OFFER_MESSAGE' | 'OLD_LEADS_REOFFER';
export type ExperimentStage = 'CONNECTION' | 'PERMISSION' | 'OFFER' | 'BOOKING';
export type PrimaryMetric = 'CR' | 'PRR' | 'ABR' | 'BOOKED_KPI';
export type VariantStep = 'permission' | 'offer' | 'booking_cta' | 'follow_up';

export interface Variant {
    id: string;
    label: string;
    message: string;
    step?: VariantStep | string;
}

export interface Experiment {
    id: string;
    name: string;
    hypothesis: string;
    status: ExperimentStatus;
    channel: Channel;
    funnelStageTargeted: ExperimentStage;
    primaryMetric: PrimaryMetric;
    requiredSampleSizeSeen: number;
    experimentType?: ExperimentType;
    stage?: ExperimentStage;
    createdAt: string;
    startedAt?: string;
    variants: Variant[];
}

export type LeadStage =
    | 'REQUESTED'
    | 'CONNECTED'
    | 'PERMISSION_SENT'
    | 'PERMISSION_POSITIVE'
    | 'OFFER_POSITIVE'
    | 'BOOKED'
    | 'ATTENDED'
    | 'CLOSED'
    | 'LOST';

export type LegacyLeadStage =
    | 'REQUESTED'
    | 'CONNECTED'
    | 'PERMISSION_SENT'
    | 'PERMISSION_POS'
    | 'OFFER_POS'
    | 'ATTENDED'
    | 'CLOSED'
    | 'A'
    | 'S'
    | 'B'
    | 'C'
    | 'D'
    | 'X'
    | 'LOST';

export interface Lead {
    id: string;
    name: string;
    profileLink: string;
    linkedinUrl?: string;
    dateInitiated: string;
    lastInteraction?: string;
    stage: LeadStage;
    accountId?: string;
    isOldLeadsLane?: boolean;
    conversationHistory?: string;
    experimentId?: string;
    variantId?: string;
    notes: string;
    createdAt?: string;
}

export interface DailyLog {
    id: string;
    date: string;
    experimentId: string;
    variantId?: string;
    campaignTag: string;
    channel: Channel;

    accountId?: string;
    isOldLeadsLane?: boolean;

    connectionRequestsSent: number;
    connectionsAccepted: number;

    permissionMessagesSent: number;
    permissionSeen: number;
    permissionPositives: number;

    offerMessagesSent?: number;
    offerSeen?: number;
    offerOrBookingIntentPositives: number;

    bookedCalls: number;

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

export interface WeeklyGoals {
    weeklyConnectionRequests: number;
    weeklyPermissionSent: number;
    weeklyBooked: number;
}

export interface Account {
    id: string;
    name: string;
    weeklyGoals: WeeklyGoals;
    color?: string;
}

export interface KpiTargets {
    cr: number;
    prr: number;
    abr: number;
    booked: number;
    posToAbr: number;
    abrToBooked: number;
    srr?: number;
    scr?: number;
    seenRate?: number;
}

export interface AppState {
    schemaVersion: number;
    experiments: Experiment[];
    dailyLogs: DailyLog[];
    leads: Lead[];
    offers: Offer[];
    goals?: WeeklyGoals;
    kpiTargets: KpiTargets;
    settings: {
        theme: 'dark' | 'light';
        accounts: Account[];
        excludeOldLeadsFromKpi: boolean;
    };
}

export const CONSTANTS = {
    SCHEMA_VERSION: 3,
    KPI_THRESHOLDS: {
        CR: 0.30,
        PRR: 0.08,
        ABR: 0.04,
        BOOKED: 0.03,
        POS_TO_ABR: 0.50,
        ABR_TO_BOOKED: 0.66
    },
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
        scr: 20,
        seenRate: 60
    },
    STORAGE_KEY: 'dm_lab_v2',
    DEFAULT_WEEKLY_GOALS: {
        weeklyConnectionRequests: 100,
        weeklyPermissionSent: 100,
        weeklyBooked: 5
    },
    DEFAULT_ACCOUNTS: [
        {
            id: 'account_1',
            name: 'Account 1',
            weeklyGoals: {
                weeklyConnectionRequests: 100,
                weeklyPermissionSent: 100,
                weeklyBooked: 5
            },
            color: '#3b82f6'
        },
        {
            id: 'account_2',
            name: 'Account 2',
            weeklyGoals: {
                weeklyConnectionRequests: 100,
                weeklyPermissionSent: 100,
                weeklyBooked: 5
            },
            color: '#22c55e'
        }
    ]
};
