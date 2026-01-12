import { AppState, DailyLog, Lead, LeadStage } from '../types';

export const migrateData = (oldData: any): AppState => {
    console.log("Migrating data to v2 schema...");

    // 1. Migrate Daily Logs
    const migratedLogs: DailyLog[] = (oldData.dailyLogs || []).map((log: any) => {
        // If it already has new fields, assume it's fine (or partial). 
        // We check for signature field 'bookedCalls' to see if migration needed.
        if (log.bookedCalls !== undefined) return log as DailyLog;

        const isKnownLegacy = log.sent !== undefined; // Old structure had 'sent'

        if (!isKnownLegacy) return log as DailyLog;

        return {
            id: log.id,
            date: log.date,
            experimentId: log.experimentId,
            variantId: log.variantId,
            campaign: log.campaign || '',
            channel: log.channel || 'linkedin',
            accountId: 'Account 1', // Default to primary
            isOldLane: false, // Default to main
            notes: log.notes || '',

            // Mapping rules
            connectionRequestsSent: 0, // No data in old logs
            connectionsAccepted: log.accepted || 0,

            permissionMessagesSent: log.sent || 0, // 'sent' was usually permission sent
            permissionSeen: log.seen || 0,
            permissionPositives: log.positiveReplies || 0,

            offerMessagesSent: 0,
            offerSeen: 0,
            // 'calendlySent' or 'positiveReplies' might have meant offer positive in some contexts, 
            // but user said: "set offer_or_booking_intent_positives = calendly if calendly > 0 else 0"
            offerPositives: (log.calendlySent && log.calendlySent > 0) ? log.calendlySent : 0,

            bookedCalls: log.booked || 0,
            attendedCalls: log.attended || 0,
            closedDeals: log.closed || 0
        };
    });

    // 2. Migrate Leads
    const migratedLeads: Lead[] = (oldData.leads || []).map((lead: any) => {
        if (lead.accountId !== undefined) return lead as Lead;

        // Map old stages A/S/B/C/D to new enums
        let newStage: LeadStage = 'REQUESTED';
        switch (lead.stage) {
            case 'A': newStage = 'PERMISSION_SENT'; break; // 'Initiated' mapped to Permission Sent per spec
            case 'S': newStage = 'PERMISSION_SENT'; break; // Seen is diagnostic, keep at sent or move to Connected? Spec said "A = Permission Sent".
            case 'B': newStage = 'PERMISSION_POS'; break; // Engaged -> Positive
            case 'C': newStage = 'OFFER_POS'; break; // Calendly -> Booking Intent
            case 'D': newStage = 'BOOKED'; break; // Booked
            case 'X': newStage = 'LOST'; break;
            default: newStage = 'REQUESTED';
        }

        return {
            ...lead,
            stage: newStage,
            accountId: 'Account 1',
            isOldLane: false
        };
    });

    // 3. Migrate Settings/Targets
    // Merge defaults onto existing targets if they are missing
    const mergedTargets = {
        ...oldData.kpiTargets,
        // Ensure new keys exist if they weren't there
        cr: oldData.kpiTargets?.cr !== undefined ? oldData.kpiTargets.cr : 30,
        prr: oldData.kpiTargets?.prr !== undefined ? oldData.kpiTargets.prr : 8,
        abr: oldData.kpiTargets?.abr !== undefined ? oldData.kpiTargets.abr : 4,
        booked: oldData.kpiTargets?.booked !== undefined ? oldData.kpiTargets.booked : 3, // mapped from something?
        posToAbr: 50,
        abrToBooked: 66
    };

    return {
        ...oldData,
        dailyLogs: migratedLogs,
        leads: migratedLeads,
        kpiTargets: mergedTargets,
        settings: {
            ...oldData.settings,
            accounts: oldData.settings?.accounts || ['Account 1', 'Account 2']
        }
    };
};
