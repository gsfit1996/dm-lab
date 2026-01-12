import { AppState, DailyLog, Lead, LeadStage, LegacyLeadStage, Experiment, ExperimentType } from '../types';

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

    // 2. Migrate Leads - map legacy stages to simplified hot prospects
    const migratedLeads: Lead[] = (oldData.leads || []).map((lead: any) => {
        // Already migrated if has new simple stages
        if (lead.stage === 'PERMISSION_POSITIVE' || lead.stage === 'OFFER_POSITIVE' || lead.stage === 'BOOKED' || lead.stage === 'LOST') {
            return {
                ...lead,
                accountId: lead.accountId || 'Account 1',
                isOldLane: lead.isOldLane || false
            };
        }

        // Map old stages to hot prospects only
        // Rule: Only track Permission Positive, Offer Positive, Booked, Lost
        // Earlier stages (Requested, Connected, Permission Sent) should NOT be tracked as named leads
        let newStage: LeadStage = 'PERMISSION_POSITIVE'; // Default for hot prospects

        switch (lead.stage) {
            // Legacy full funnel stages - map to hot prospects
            case 'REQUESTED':
            case 'CONNECTED':
            case 'PERMISSION_SENT':
                // These are NOT hot prospects - should not be in the simplified CRM
                // Skip or map to Permission Positive if they exist
                return null; // Filter these out
            case 'PERMISSION_POS':
                newStage = 'PERMISSION_POSITIVE';
                break;
            case 'OFFER_POS':
                newStage = 'OFFER_POSITIVE';
                break;
            case 'BOOKED':
                newStage = 'BOOKED';
                break;
            case 'ATTENDED':
            case 'CLOSED':
                // These converted successfully, keep as Booked
                newStage = 'BOOKED';
                break;
            case 'LOST':
            case 'X':
                newStage = 'LOST';
                break;
            // Old A/S/B/C/D notation
            case 'A': // Permission Sent - NOT a hot prospect
            case 'S': // Seen - NOT a hot prospect
                return null; // Filter out
            case 'B': // Engaged - Permission Positive
                newStage = 'PERMISSION_POSITIVE';
                break;
            case 'C': // Calendly - Offer Positive
                newStage = 'OFFER_POSITIVE';
                break;
            case 'D': // Booked
                newStage = 'BOOKED';
                break;
            default:
                // Unknown stage - filter out
                return null;
        }

        return {
            ...lead,
            stage: newStage,
            accountId: lead.accountId || 'Account 1',
            isOldLane: lead.isOldLane || false
        };
    }).filter((lead): lead is Lead => lead !== null); // Remove nulls

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
