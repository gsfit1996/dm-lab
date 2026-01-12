import { DailyLog, KpiTargets, CONSTANTS } from '../types';

export interface KpiResult {
    // Primary
    cr: number;
    prr: number;
    abr: number;
    bookedRate: number;

    // Secondary
    posToAbr: number;
    abrToBooked: number;

    // Statuses (pass/fail/warn)
    crStatus: 'green' | 'yellow' | 'red';
    prrStatus: 'green' | 'yellow' | 'red';
    abrStatus: 'green' | 'yellow' | 'red';
    bookedStatus: 'green' | 'yellow' | 'red';

    bottleneck: string;
}

export interface LogAggregates {
    connectionRequestsSent: number;
    connectionsAccepted: number;
    permissionMessagesSent: number;
    permissionPositives: number;
    offerPositives: number;
    bookedCalls: number;

    // For test validity
    permissionSeen: number;
    offerSeen: number;
}

export const computeAggregates = (logs: DailyLog[]): LogAggregates => {
    return logs.reduce((acc, log) => ({
        connectionRequestsSent: acc.connectionRequestsSent + (log.connectionRequestsSent || 0),
        connectionsAccepted: acc.connectionsAccepted + (log.connectionsAccepted || 0),
        permissionMessagesSent: acc.permissionMessagesSent + (log.permissionMessagesSent || 0),
        permissionPositives: acc.permissionPositives + (log.permissionPositives || 0),
        offerPositives: acc.offerPositives + (log.offerPositives || 0),
        bookedCalls: acc.bookedCalls + (log.bookedCalls || 0),
        permissionSeen: acc.permissionSeen + (log.permissionSeen || 0),
        offerSeen: acc.offerSeen + (log.offerSeen || 0)
    }), {
        connectionRequestsSent: 0,
        connectionsAccepted: 0,
        permissionMessagesSent: 0,
        permissionPositives: 0,
        offerPositives: 0,
        bookedCalls: 0,
        permissionSeen: 0,
        offerSeen: 0
    });
};

const safeDiv = (num: number, den: number): number => {
    if (!den || den === 0) return 0;
    return num / den;
};

const getStatus = (val: number, target: number): 'green' | 'yellow' | 'red' => {
    // These are percentages in 0-100 scale usually from inputs, but our calculations might be 0-1.
    // Let's normalize. The inputs in settings (e.g., 30) usually mean 30%.
    // Our formulas return 0.30.
    // So we assume target is passed as whole number (30) or we convert.
    // Let's assume target is passed as percentage number (30), so we multiply val by 100.

    const pct = val * 100;
    if (pct >= target) return 'green';
    if (pct >= target * 0.8) return 'yellow';
    return 'red';
};

export const computeKpis = (aggregates: LogAggregates, targets: KpiTargets): KpiResult => {
    // Formulas
    const cr = safeDiv(aggregates.connectionsAccepted, aggregates.connectionRequestsSent);
    const prr = safeDiv(aggregates.permissionPositives, aggregates.permissionMessagesSent);
    const abr = safeDiv(aggregates.offerPositives, aggregates.permissionMessagesSent); // Note: Denominator is Permission Sent
    const bookedRate = safeDiv(aggregates.bookedCalls, aggregates.permissionMessagesSent); // Note: Denominator is Permission Sent

    const posToAbr = safeDiv(aggregates.offerPositives, aggregates.permissionPositives);
    const abrToBooked = safeDiv(aggregates.bookedCalls, aggregates.offerPositives);

    // Status
    const crStatus = getStatus(cr, targets.cr);
    const prrStatus = getStatus(prr, targets.prr);
    const abrStatus = getStatus(abr, targets.abr);
    const bookedStatus = getStatus(bookedRate, targets.booked);

    // Bottleneck Logic
    // 1) Booked >= Target? None.
    // 2) ABR >= Target? Booking stage (converting ABR to Booked).
    // 3) PRR >= Target? Offer stage.
    // 4) CR >= Target? Permission stage.
    // 5) Else -> Targeting.

    let bottleneck = 'Targeting / Profile Resonance';

    // Check form "Top" down as per request instructions?
    // "Bottleneck stage based on ... Booked, then ABR, then PRR, then CR"
    // Actually the logic implies: if Booked is bad, is it because ABR is bad? 
    // If Booked is GOOD, then we scale.

    if (getStatus(bookedRate, targets.booked) === 'green') {
        bottleneck = 'None! Scale Volume 🚀';
    } else if (getStatus(abr, targets.abr) === 'green') {
        bottleneck = 'Booking Stage (ABR -> Booked)'; // ABR is good, but Booked is bad
    } else if (getStatus(prr, targets.prr) === 'green') {
        bottleneck = 'Offer Stage (Pos -> ABR)'; // PRR is good, but ABR is bad
    } else if (getStatus(cr, targets.cr) === 'green') {
        bottleneck = 'Permission Stage (Openers)'; // CR is good, but PRR is bad
    }
    // If CR is bad, it stays Targeting/Profile.

    return {
        cr,
        prr,
        abr,
        bookedRate,
        posToAbr,
        abrToBooked,
        crStatus,
        prrStatus,
        abrStatus,
        bookedStatus,
        bottleneck
    };
};
