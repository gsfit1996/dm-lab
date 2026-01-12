import { DailyLog, KpiTargets } from '../types';

export type KpiStatus = 'green' | 'yellow' | 'red' | 'neutral';

export interface LogAggregates {
    connectionRequestsSent: number;
    connectionsAccepted: number;
    permissionMessagesSent: number;
    permissionPositives: number;
    permissionSeen: number;
    offerOrBookingIntentPositives: number;
    bookedCalls: number;
    offerMessagesSent: number;
    offerSeen: number;
    attendedCalls: number;
    closedDeals: number;
}

export interface LogFilters {
    accountId?: string;
    campaignTag?: string;
    experimentId?: string;
    variantId?: string;
    includeOldLeads?: boolean;
    dateRange?: { start?: string; end?: string };
}

export interface KpiResult {
    cr: number | null;
    prr: number | null;
    abr: number | null;
    bookedKpi: number | null;
    posToAbr: number | null;
    abrToBooked: number | null;
    seenRate: number | null;
    showUpRate: number | null;
    salesCloseRate: number | null;
    crStatus: KpiStatus;
    prrStatus: KpiStatus;
    abrStatus: KpiStatus;
    bookedStatus: KpiStatus;
    posToAbrStatus: KpiStatus;
    abrToBookedStatus: KpiStatus;
    seenRateStatus: KpiStatus;
    showUpRateStatus: KpiStatus;
    salesCloseRateStatus: KpiStatus;
    bottleneck: string;
}

const safeDiv = (num: number, den: number): number | null => {
    if (!den || den === 0) return null;
    return num / den;
};

const getStatus = (val: number | null, target?: number): KpiStatus => {
    if (val === null || target === undefined || target === null) return 'neutral';
    const pct = val * 100;
    if (pct >= target) return 'green';
    if (pct >= target * 0.8) return 'yellow';
    return 'red';
};

const applyFilters = (logs: DailyLog[], filters?: LogFilters): DailyLog[] => {
    if (!filters) return logs;
    return logs.filter((log) => {
        if (!filters.includeOldLeads && log.isOldLeadsLane) return false;
        if (filters.accountId && log.accountId !== filters.accountId) return false;
        if (filters.campaignTag && log.campaignTag !== filters.campaignTag) return false;
        if (filters.experimentId && log.experimentId !== filters.experimentId) return false;
        if (filters.variantId && log.variantId !== filters.variantId) return false;
        if (filters.dateRange?.start && log.date < filters.dateRange.start) return false;
        if (filters.dateRange?.end && log.date > filters.dateRange.end) return false;
        return true;
    });
};

export const computeAggregates = (logs: DailyLog[], filters?: LogFilters): LogAggregates => {
    const filtered = applyFilters(logs, filters);
    return filtered.reduce((acc, log) => ({
        connectionRequestsSent: acc.connectionRequestsSent + (log.connectionRequestsSent || 0),
        connectionsAccepted: acc.connectionsAccepted + (log.connectionsAccepted || 0),
        permissionMessagesSent: acc.permissionMessagesSent + (log.permissionMessagesSent || 0),
        permissionPositives: acc.permissionPositives + (log.permissionPositives || 0),
        permissionSeen: acc.permissionSeen + (log.permissionSeen || 0),
        offerOrBookingIntentPositives: acc.offerOrBookingIntentPositives + (log.offerOrBookingIntentPositives || 0),
        bookedCalls: acc.bookedCalls + (log.bookedCalls || 0),
        offerMessagesSent: acc.offerMessagesSent + (log.offerMessagesSent || 0),
        offerSeen: acc.offerSeen + (log.offerSeen || 0),
        attendedCalls: acc.attendedCalls + (log.attendedCalls || 0),
        closedDeals: acc.closedDeals + (log.closedDeals || 0)
    }), {
        connectionRequestsSent: 0,
        connectionsAccepted: 0,
        permissionMessagesSent: 0,
        permissionPositives: 0,
        permissionSeen: 0,
        offerOrBookingIntentPositives: 0,
        bookedCalls: 0,
        offerMessagesSent: 0,
        offerSeen: 0,
        attendedCalls: 0,
        closedDeals: 0
    });
};

export const computeKpis = (aggregates: LogAggregates, targets: KpiTargets): KpiResult => {
    const cr = safeDiv(aggregates.connectionsAccepted, aggregates.connectionRequestsSent);
    const prr = safeDiv(aggregates.permissionPositives, aggregates.permissionMessagesSent);
    const abr = safeDiv(aggregates.offerOrBookingIntentPositives, aggregates.permissionMessagesSent);
    const bookedKpi = safeDiv(aggregates.bookedCalls, aggregates.permissionMessagesSent);

    const posToAbr = safeDiv(aggregates.offerOrBookingIntentPositives, aggregates.permissionPositives);
    const abrToBooked = safeDiv(aggregates.bookedCalls, aggregates.offerOrBookingIntentPositives);
    const seenRate = safeDiv(aggregates.permissionSeen, aggregates.permissionMessagesSent);
    const showUpRate = safeDiv(aggregates.attendedCalls, aggregates.bookedCalls);
    const salesCloseRate = safeDiv(aggregates.closedDeals, aggregates.attendedCalls);

    const crStatus = getStatus(cr, targets.cr);
    const prrStatus = getStatus(prr, targets.prr);
    const abrStatus = getStatus(abr, targets.abr);
    const bookedStatus = getStatus(bookedKpi, targets.booked);
    const posToAbrStatus = getStatus(posToAbr, targets.posToAbr);
    const abrToBookedStatus = getStatus(abrToBooked, targets.abrToBooked);
    const seenRateStatus = getStatus(seenRate, targets.seenRate);
    const showUpRateStatus = getStatus(showUpRate, targets.srr);
    const salesCloseRateStatus = getStatus(salesCloseRate, targets.scr);

    const crVal = cr ?? 0;
    const prrVal = prr ?? 0;
    const abrVal = abr ?? 0;
    const bookedVal = bookedKpi ?? 0;

    let bottleneck = 'Targeting/Profile resonance';
    if (bookedVal * 100 >= targets.booked) {
        bottleneck = 'None (scale volume)';
    } else if (abrVal * 100 >= targets.abr) {
        bottleneck = 'Booking stage';
    } else if (prrVal * 100 >= targets.prr) {
        bottleneck = 'Offer stage';
    } else if (crVal * 100 >= targets.cr) {
        bottleneck = 'Permission stage';
    }

    return {
        cr,
        prr,
        abr,
        bookedKpi,
        posToAbr,
        abrToBooked,
        seenRate,
        showUpRate,
        salesCloseRate,
        crStatus,
        prrStatus,
        abrStatus,
        bookedStatus,
        posToAbrStatus,
        abrToBookedStatus,
        seenRateStatus,
        showUpRateStatus,
        salesCloseRateStatus,
        bottleneck
    };
};
