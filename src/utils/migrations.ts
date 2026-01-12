import {
    AppState,
    DailyLog,
    Lead,
    LeadStage,
    LegacyLeadStage,
    Experiment,
    ExperimentStage,
    PrimaryMetric,
    Account,
    WeeklyGoals,
    CONSTANTS
} from '../types';

const normalizeGoals = (goals?: Partial<WeeklyGoals>): WeeklyGoals => ({
    weeklyConnectionRequests: goals?.weeklyConnectionRequests ?? CONSTANTS.DEFAULT_WEEKLY_GOALS.weeklyConnectionRequests,
    weeklyPermissionSent: goals?.weeklyPermissionSent ?? CONSTANTS.DEFAULT_WEEKLY_GOALS.weeklyPermissionSent,
    weeklyBooked: goals?.weeklyBooked ?? CONSTANTS.DEFAULT_WEEKLY_GOALS.weeklyBooked
});

const coerceAccounts = (rawAccounts: any, fallbackGoals?: WeeklyGoals): Account[] => {
    const goals = normalizeGoals(fallbackGoals);
    if (Array.isArray(rawAccounts) && rawAccounts.length > 0) {
        if (typeof rawAccounts[0] === 'string') {
            return rawAccounts.map((name: string, index: number) => ({
                id: `account_${index + 1}`,
                name,
                weeklyGoals: { ...goals },
                color: index % 2 === 0 ? '#3b82f6' : '#22c55e'
            }));
        }
        return rawAccounts.map((acc: any, index: number) => ({
            id: acc.id || `account_${index + 1}`,
            name: acc.name || `Account ${index + 1}`,
            weeklyGoals: normalizeGoals(acc.weeklyGoals || acc.goals || goals),
            color: acc.color || (index % 2 === 0 ? '#3b82f6' : '#22c55e')
        }));
    }
    return CONSTANTS.DEFAULT_ACCOUNTS.map((acc) => ({
        ...acc,
        weeklyGoals: normalizeGoals(acc.weeklyGoals || goals)
    }));
};

const deriveStageFromExperimentType = (experimentType?: string): ExperimentStage => {
    switch (experimentType) {
        case 'OFFER_MESSAGE':
        case 'OLD_LEADS_REOFFER':
            return 'OFFER';
        case 'PERMISSION_MESSAGE':
            return 'PERMISSION';
        default:
            return 'PERMISSION';
    }
};

const primaryMetricForStage = (stage: ExperimentStage): PrimaryMetric => {
    switch (stage) {
        case 'CONNECTION':
            return 'CR';
        case 'PERMISSION':
            return 'PRR';
        case 'OFFER':
            return 'ABR';
        case 'BOOKING':
            return 'BOOKED_KPI';
        default:
            return 'PRR';
    }
};

const requiredSeenForStage = (stage: ExperimentStage): number => {
    if (stage === 'PERMISSION') return CONSTANTS.VALIDITY_THRESHOLDS.PERMISSION_SEEN;
    if (stage === 'OFFER') return CONSTANTS.VALIDITY_THRESHOLDS.OFFER_SEEN;
    return 0;
};

const normalizeLeadStage = (stage: LeadStage | LegacyLeadStage | string): LeadStage => {
    if (!stage) return 'REQUESTED';
    if (
        stage === 'REQUESTED' ||
        stage === 'CONNECTED' ||
        stage === 'PERMISSION_SENT' ||
        stage === 'PERMISSION_POSITIVE' ||
        stage === 'OFFER_POSITIVE' ||
        stage === 'BOOKED' ||
        stage === 'ATTENDED' ||
        stage === 'CLOSED' ||
        stage === 'LOST'
    ) {
        return stage as LeadStage;
    }

    switch (stage) {
        case 'PERMISSION_POS':
        case 'B':
            return 'PERMISSION_POSITIVE';
        case 'OFFER_POS':
        case 'C':
            return 'OFFER_POSITIVE';
        case 'D':
            return 'BOOKED';
        case 'A':
        case 'S':
            return 'PERMISSION_SENT';
        case 'ATTENDED':
            return 'ATTENDED';
        case 'CLOSED':
            return 'CLOSED';
        case 'X':
            return 'LOST';
        default:
            return 'REQUESTED';
    }
};

const normalizeLog = (log: any, defaultAccountName: string): DailyLog => {
    const calendlyValue = log.calendly ?? log.calendlySent ?? 0;

    return {
        id: log.id,
        date: log.date,
        experimentId: log.experimentId || '',
        variantId: log.variantId,
        campaignTag: log.campaignTag || log.campaign || log.tag || '',
        channel: log.channel || 'linkedin',
        accountId: log.accountId || log.account_id || defaultAccountName,
        isOldLeadsLane: log.isOldLeadsLane ?? log.isOldLane ?? false,
        connectionRequestsSent: log.connectionRequestsSent ?? log.connection_requests_sent ?? 0,
        connectionsAccepted: log.connectionsAccepted ?? log.accepted ?? 0,
        permissionMessagesSent: log.permissionMessagesSent ?? log.sent ?? 0,
        permissionSeen: log.permissionSeen ?? log.seen ?? 0,
        permissionPositives: log.permissionPositives ?? log.positive ?? log.positiveReplies ?? 0,
        offerMessagesSent: log.offerMessagesSent ?? 0,
        offerSeen: log.offerSeen ?? 0,
        offerOrBookingIntentPositives: log.offerOrBookingIntentPositives ?? log.offerPositives ?? (calendlyValue > 0 ? calendlyValue : 0),
        bookedCalls: log.bookedCalls ?? log.booked ?? 0,
        attendedCalls: log.attendedCalls ?? log.attended ?? 0,
        closedDeals: log.closedDeals ?? log.closed ?? 0,
        notes: log.notes || ''
    };
};

export const migrateData = (oldData: any): AppState => {
    const schemaVersion = oldData?.schemaVersion ?? 1;

    const legacyGoals = normalizeGoals(oldData?.goals);
    const accounts = coerceAccounts(oldData?.settings?.accounts, legacyGoals);
    const defaultAccountName = accounts[0]?.name || 'Account 1';

    const migratedLogs: DailyLog[] = (oldData?.dailyLogs || []).map((log: any) => normalizeLog(log, defaultAccountName));

    const migratedLeads: Lead[] = (oldData?.leads || []).map((lead: any) => ({
        ...lead,
        stage: normalizeLeadStage(lead.stage),
        accountId: lead.accountId || defaultAccountName,
        isOldLeadsLane: lead.isOldLeadsLane ?? lead.isOldLane ?? false
    }));

    const migratedExperiments: Experiment[] = (oldData?.experiments || []).map((exp: any) => {
        const funnelStageTargeted = exp.funnelStageTargeted || exp.stage || deriveStageFromExperimentType(exp.experimentType);
        const primaryMetric = exp.primaryMetric || primaryMetricForStage(funnelStageTargeted);
        return {
            ...exp,
            funnelStageTargeted,
            primaryMetric,
            requiredSampleSizeSeen: exp.requiredSampleSizeSeen ?? requiredSeenForStage(funnelStageTargeted)
        };
    });

    const mergedTargets = {
        ...CONSTANTS.DEFAULT_KPI_TARGETS,
        ...(oldData?.kpiTargets || {})
    };

    const migratedState: AppState = {
        schemaVersion: schemaVersion >= CONSTANTS.SCHEMA_VERSION ? schemaVersion : CONSTANTS.SCHEMA_VERSION,
        experiments: migratedExperiments,
        dailyLogs: migratedLogs,
        leads: migratedLeads,
        offers: oldData?.offers || [],
        goals: oldData?.goals || legacyGoals,
        kpiTargets: mergedTargets,
        settings: {
            theme: oldData?.settings?.theme || 'dark',
            accounts,
            excludeOldLeadsFromKpi: oldData?.settings?.excludeOldLeadsFromKpi ?? true
        }
    };

    return migratedState;
};
