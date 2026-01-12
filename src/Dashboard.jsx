
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FlaskConical,
  Info,
  LayoutDashboard,
  ListChecks,
  Moon,
  Plus,
  Save,
  Settings,
  Sun,
  Trash2,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const SCHEMA_VERSION = 5;
const STORAGE_KEY = "dm_lab_state_v5";
const LEGACY_STORAGE_KEYS = [
  "dm_experiment_dashboard_v4",
  "dm_experiment_dashboard_v3",
  "dm_experiment_dashboard_v2",
];

const PAGES = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "log", label: "Daily Log", icon: ListChecks },
  { id: "leads", label: "Leads", icon: Users },
  { id: "experiments", label: "Experiments", icon: FlaskConical },
  { id: "settings", label: "Settings", icon: Settings },
];

const FUNNEL_STAGES = [
  { value: "REQUESTED", label: "Requested" },
  { value: "CONNECTED", label: "Connected" },
  { value: "PERMISSION_SENT", label: "Permission Sent" },
  { value: "PERMISSION_POSITIVE", label: "Permission Positive" },
  { value: "OFFER_POSITIVE", label: "Offer Positive / Booking Intent" },
  { value: "BOOKED", label: "Booked" },
  { value: "ATTENDED", label: "Attended" },
  { value: "CLOSED", label: "Closed" },
  { value: "LOST", label: "Lost" },
];

const EXPERIMENT_STAGES = [
  { value: "CONNECTION", label: "Connection" },
  { value: "PERMISSION", label: "Permission" },
  { value: "OFFER", label: "Offer" },
  { value: "BOOKING", label: "Booking" },
];

const PRIMARY_METRICS = [
  { value: "CR", label: "Connection Rate (CR)" },
  { value: "PRR", label: "Positive Reply Rate (PRR)" },
  { value: "ABR", label: "Appointment Booking Rate (ABR)" },
  { value: "BOOKED_KPI", label: "Booked KPI" },
];

const VARIANT_STEP_TYPES = [
  { value: "permission", label: "Permission" },
  { value: "offer", label: "Offer" },
  { value: "booking", label: "Booking CTA" },
  { value: "follow_up", label: "Follow-up" },
];

const KPI_DEFINITIONS = {
  CR: "Connection Rate = connections accepted / connection requests sent.",
  PRR: "Positive Reply Rate = permission positives / permission messages sent.",
  ABR: "Appointment Booking Rate = offer or booking intent positives / permission messages sent.",
  BOOKED_KPI: "Booked KPI = booked calls / permission messages sent.",
  POSITIVE_TO_ABR: "Positive to ABR = offer or booking positives / permission positives.",
  ABR_TO_BOOKED: "ABR to Booked = booked calls / offer or booking positives.",
  SEEN_RATE: "Seen rate = permission seen / permission messages sent.",
  SHOW_UP_RATE: "Show-up rate = attended calls / booked calls.",
  SCR: "Sales Close Rate (SCR) = closed deals / attended calls.",
};

const DEFAULT_TARGETS = {
  CR: 30,
  PRR: 8,
  ABR: 4,
  BOOKED_KPI: 3,
  POSITIVE_TO_ABR: 50,
  ABR_TO_BOOKED: 66,
  SEEN_RATE: 0,
  SHOW_UP_RATE: 0,
  SALES_CLOSE_RATE: 0,
};

const DEFAULT_ACCOUNTS = [
  {
    id: "account_1",
    name: "Account 1",
    goals: {
      connection_requests_sent: 0,
      permission_messages_sent: 0,
      booked_calls: 0,
    },
  },
  {
    id: "account_2",
    name: "Account 2",
    goals: {
      connection_requests_sent: 0,
      permission_messages_sent: 0,
      booked_calls: 0,
    },
  },
];

const DEFAULT_STATE = {
  config: {
    autosave: false,
    excludeOldLeadsFromKpi: true,
    kpiTargets: { ...DEFAULT_TARGETS },
    accounts: DEFAULT_ACCOUNTS,
  },
  logs: [],
  experiments: [],
  prospects: [],
  ui: {
    isDark: true,
  },
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase =
  SUPABASE_URL && SUPABASE_ANON
    ? createClient(SUPABASE_URL, SUPABASE_ANON)
    : null;

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function clampNonNegInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

function clampNonNegNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function safeDivide(n, d) {
  const nn = Number(n) || 0;
  const dd = Number(d) || 0;
  if (dd <= 0) return null;
  return nn / dd;
}

function formatPercent(value, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

function formatPercentNumber(value, digits = 2) {
  if (value == null || !Number.isFinite(value)) return "";
  return (value * 100).toFixed(digits);
}

function formatCount(value) {
  const n = Number(value) || 0;
  return n.toLocaleString();
}

function toISODate(date) {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
}

function parseISODate(value) {
  if (!value) return null;
  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || parts.some((p) => Number.isNaN(p))) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(date) {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function makeId() {
  return typeof crypto !== "undefined" && crypto?.randomUUID
    ? crypto.randomUUID()
    : `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function primaryMetricForStage(stage) {
  switch (stage) {
    case "CONNECTION":
      return "CR";
    case "PERMISSION":
      return "PRR";
    case "OFFER":
      return "ABR";
    case "BOOKING":
      return "BOOKED_KPI";
    default:
      return "PRR";
  }
}

function requiredSeenForStage(stage) {
  if (stage === "PERMISSION") return 60;
  if (stage === "OFFER") return 30;
  return 0;
}
function normalizeConfig(config) {
  const accountsRaw =
    Array.isArray(config?.accounts) && config.accounts.length
      ? config.accounts
      : DEFAULT_ACCOUNTS;
  const accounts = accountsRaw.map((account, index) => ({
    id: String(account?.id || `account_${index + 1}`),
    name: (account?.name || `Account ${index + 1}`).trim(),
    goals: {
      connection_requests_sent: clampNonNegInt(
        account?.goals?.connection_requests_sent
      ),
      permission_messages_sent: clampNonNegInt(
        account?.goals?.permission_messages_sent
      ),
      booked_calls: clampNonNegInt(account?.goals?.booked_calls),
    },
  }));

  const kpiTargets = {
    ...DEFAULT_TARGETS,
    ...(config?.kpiTargets || {}),
  };

  return {
    autosave: Boolean(config?.autosave),
    excludeOldLeadsFromKpi: config?.excludeOldLeadsFromKpi !== false,
    kpiTargets: {
      CR: clampNonNegNumber(kpiTargets.CR),
      PRR: clampNonNegNumber(kpiTargets.PRR),
      ABR: clampNonNegNumber(kpiTargets.ABR),
      BOOKED_KPI: clampNonNegNumber(kpiTargets.BOOKED_KPI),
      POSITIVE_TO_ABR: clampNonNegNumber(kpiTargets.POSITIVE_TO_ABR),
      ABR_TO_BOOKED: clampNonNegNumber(kpiTargets.ABR_TO_BOOKED),
      SEEN_RATE: clampNonNegNumber(kpiTargets.SEEN_RATE),
      SHOW_UP_RATE: clampNonNegNumber(kpiTargets.SHOW_UP_RATE),
      SALES_CLOSE_RATE: clampNonNegNumber(kpiTargets.SALES_CLOSE_RATE),
    },
    accounts,
  };
}

function normalizeLog(log, defaultAccountId) {
  return {
    id: log?.id || makeId(),
    date: log?.date || toISODate(new Date()),
    account_id: log?.account_id || log?.accountId || defaultAccountId,
    is_old_leads_lane: Boolean(
      log?.is_old_leads_lane || log?.isOldLeadsLane || log?.lane === "old"
    ),
    campaign_tag: (log?.campaign_tag || log?.tag || "").trim(),
    notes: (log?.notes || "").trim(),
    experiment_id: log?.experiment_id || log?.experimentId || "",
    variant_id: log?.variant_id || log?.variantId || "",
    connection_requests_sent: clampNonNegInt(log?.connection_requests_sent),
    connections_accepted: clampNonNegInt(
      log?.connections_accepted || log?.accepted
    ),
    permission_messages_sent: clampNonNegInt(
      log?.permission_messages_sent || log?.sent || log?.initiated
    ),
    permission_seen: clampNonNegInt(
      log?.permission_seen || log?.seen || log?.mediaSeen
    ),
    permission_positives: clampNonNegInt(
      log?.permission_positives || log?.positive || log?.engaged
    ),
    offer_messages_sent: clampNonNegInt(log?.offer_messages_sent),
    offer_seen: clampNonNegInt(log?.offer_seen),
    offer_or_booking_intent_positives: clampNonNegInt(
      log?.offer_or_booking_intent_positives || log?.calendly || 0
    ),
    booked_calls: clampNonNegInt(log?.booked_calls || log?.booked),
    attended_calls: clampNonNegInt(log?.attended_calls),
    closed_deals: clampNonNegInt(log?.closed_deals),
  };
}

function normalizeExperiment(experiment) {
  const stage =
    experiment?.funnel_stage_targeted || experiment?.stage || "PERMISSION";
  const primaryMetric =
    experiment?.primary_metric || primaryMetricForStage(stage);
  const requiredSeen = Number.isFinite(
    Number(experiment?.required_sample_size_seen)
  )
    ? clampNonNegInt(experiment?.required_sample_size_seen)
    : requiredSeenForStage(stage);

  let variants = [];
  if (Array.isArray(experiment?.variants) && experiment.variants.length) {
    variants = experiment.variants.map((variant, index) => ({
      id: variant?.id || makeId(),
      name: (variant?.name || `Variant ${index + 1}`).trim(),
      message: variant?.message || variant?.messageText || "",
      step_type: variant?.step_type || variant?.stepType || "",
    }));
  } else if (experiment?.messageText || experiment?.messageLabel) {
    variants = [
      {
        id: makeId(),
        name: (experiment?.messageLabel || "Variant A").trim(),
        message: experiment?.messageText || "",
        step_type: "",
      },
    ];
  } else {
    variants = [
      {
        id: makeId(),
        name: "Variant A",
        message: "",
        step_type: "",
      },
    ];
  }

  return {
    id: experiment?.id || makeId(),
    name: (experiment?.name || "Untitled Experiment").trim(),
    status: experiment?.status || "active",
    hypothesis: (experiment?.hypothesis || "").trim(),
    notes: (experiment?.notes || "").trim(),
    createdAt: experiment?.createdAt || new Date().toISOString(),
    funnel_stage_targeted: stage,
    primary_metric: primaryMetric,
    required_sample_size_seen: requiredSeen,
    variants,
  };
}

function normalizeProspect(prospect, defaultAccountId) {
  const stage = FUNNEL_STAGES.find((s) => s.value === prospect?.stage)?.value
    ? prospect.stage
    : FUNNEL_STAGES[0].value;
  return {
    id: prospect?.id || makeId(),
    name: (prospect?.name || "Untitled").trim(),
    linkedin_url: (prospect?.linkedin_url || prospect?.linkedinUrl || "").trim(),
    notes: (prospect?.notes || "").trim(),
    account_id: prospect?.account_id || prospect?.accountId || defaultAccountId,
    is_old_leads_lane: Boolean(
      prospect?.is_old_leads_lane || prospect?.lane === "old"
    ),
    stage,
  };
}

function normalizeState(state) {
  const config = normalizeConfig(state?.config);
  const defaultAccountId = config.accounts[0]?.id || "account_1";

  return {
    config,
    logs: Array.isArray(state?.logs)
      ? state.logs.map((log) => normalizeLog(log, defaultAccountId))
      : [],
    experiments: Array.isArray(state?.experiments)
      ? state.experiments.map(normalizeExperiment)
      : [],
    prospects: Array.isArray(state?.prospects)
      ? state.prospects.map((p) => normalizeProspect(p, defaultAccountId))
      : [],
    ui: {
      isDark: state?.ui?.isDark !== false,
    },
  };
}

function migrateLegacyState(legacy) {
  const base = normalizeState(DEFAULT_STATE);
  const config = normalizeConfig({
    ...base.config,
    autosave: legacy?.config?.autosave ?? legacy?.autosave,
    excludeOldLeadsFromKpi:
      legacy?.config?.excludeOldLeadsFromKpi ??
      legacy?.excludeOldLeadsFromKpi ??
      base.config.excludeOldLeadsFromKpi,
    accounts: legacy?.config?.accounts || legacy?.accounts || base.config.accounts,
    kpiTargets: legacy?.config?.kpiTargets || base.config.kpiTargets,
  });
  const defaultAccountId = config.accounts[0]?.id || "account_1";

  const legacyLogs =
    (Array.isArray(legacy?.logs) && legacy.logs) ||
    (Array.isArray(legacy?.dailyLogs) && legacy.dailyLogs) ||
    (Array.isArray(legacy?.daily) && legacy.daily) ||
    [];

  const logs = legacyLogs.map((log) =>
    normalizeLog(
      {
        ...log,
        connection_requests_sent: log?.connection_requests_sent || 0,
        offer_or_booking_intent_positives:
          Number(log?.calendly || 0) > 0
            ? log?.calendly
            : log?.offer_or_booking_intent_positives || 0,
      },
      defaultAccountId
    )
  );

  const legacyProspects = Array.isArray(legacy?.prospects)
    ? legacy.prospects
    : Array.isArray(legacy?.leads)
      ? legacy.leads
      : [];

  return normalizeState({
    config,
    logs,
    experiments: Array.isArray(legacy?.experiments) ? legacy.experiments : [],
    prospects: legacyProspects,
    ui: { isDark: legacy?.ui?.isDark ?? legacy?.isDark ?? true },
  });
}
function tryParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function loadState() {
  if (typeof localStorage === "undefined") {
    return { state: normalizeState(DEFAULT_STATE), savedAt: null, source: "default" };
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const parsed = tryParseJson(raw);
    if (parsed?.schemaVersion === SCHEMA_VERSION && parsed?.data) {
      return {
        state: normalizeState(parsed.data),
        savedAt: parsed.savedAt || null,
        source: "storage",
      };
    }
    if (parsed?.schemaVersion && parsed?.data) {
      return {
        state: migrateLegacyState(parsed.data),
        savedAt: parsed.savedAt || null,
        source: "legacy",
      };
    }
    if (parsed?.logs || parsed?.experiments || parsed?.prospects) {
      return { state: migrateLegacyState(parsed), savedAt: null, source: "legacy" };
    }
  }

  for (const key of LEGACY_STORAGE_KEYS) {
    const legacyRaw = localStorage.getItem(key);
    if (!legacyRaw) continue;
    const legacyParsed = tryParseJson(legacyRaw);
    if (legacyParsed) {
      return { state: migrateLegacyState(legacyParsed), savedAt: null, source: "legacy" };
    }
  }

  return { state: normalizeState(DEFAULT_STATE), savedAt: null, source: "default" };
}

function saveState(state) {
  const payload = {
    schemaVersion: SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    data: state,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  return payload.savedAt;
}

function filterLogs(logs, filters = {}) {
  const startDate = parseISODate(filters.start);
  const endDate = parseISODate(filters.end);

  return (logs || []).filter((log) => {
    if (filters.accountId && filters.accountId !== "all") {
      if (log.account_id !== filters.accountId) return false;
    }
    if (filters.campaignTag && filters.campaignTag !== "all") {
      if ((log.campaign_tag || "") !== filters.campaignTag) return false;
    }
    if (filters.onlyOldLeads) {
      if (!log.is_old_leads_lane) return false;
    } else if (filters.excludeOldLeads && log.is_old_leads_lane) {
      return false;
    }

    const logDate = parseISODate(log.date);
    if (startDate && logDate && logDate < startDate) return false;
    if (endDate && logDate && logDate > endDate) return false;
    return true;
  });
}

function computeAggregates(logs) {
  const totals = {
    connection_requests_sent: 0,
    connections_accepted: 0,
    permission_messages_sent: 0,
    permission_seen: 0,
    permission_positives: 0,
    offer_messages_sent: 0,
    offer_seen: 0,
    offer_or_booking_intent_positives: 0,
    booked_calls: 0,
    attended_calls: 0,
    closed_deals: 0,
  };

  for (const log of logs || []) {
    totals.connection_requests_sent += clampNonNegInt(log.connection_requests_sent);
    totals.connections_accepted += clampNonNegInt(log.connections_accepted);
    totals.permission_messages_sent += clampNonNegInt(log.permission_messages_sent);
    totals.permission_seen += clampNonNegInt(log.permission_seen);
    totals.permission_positives += clampNonNegInt(log.permission_positives);
    totals.offer_messages_sent += clampNonNegInt(log.offer_messages_sent);
    totals.offer_seen += clampNonNegInt(log.offer_seen);
    totals.offer_or_booking_intent_positives += clampNonNegInt(
      log.offer_or_booking_intent_positives
    );
    totals.booked_calls += clampNonNegInt(log.booked_calls);
    totals.attended_calls += clampNonNegInt(log.attended_calls);
    totals.closed_deals += clampNonNegInt(log.closed_deals);
  }

  return totals;
}

function statusFor(value, target) {
  if (value == null || target == null || target <= 0) return "neutral";
  if (value >= target) return "good";
  if (value >= target * 0.9) return "warn";
  return "bad";
}

function computeBottleneck(kpis, targets) {
  const booked = kpis.BOOKED_KPI ?? 0;
  const abr = kpis.ABR ?? 0;
  const prr = kpis.PRR ?? 0;
  const cr = kpis.CR ?? 0;

  if (booked >= (targets.BOOKED_KPI || 0)) return "None (scale volume)";
  if (abr >= (targets.ABR || 0)) return "Booking stage";
  if (prr >= (targets.PRR || 0)) return "Offer stage";
  if (cr >= (targets.CR || 0)) return "Permission stage";
  return "Targeting/Profile resonance";
}

function computeKpis(totals, targets) {
  const target = {
    CR: (targets?.CR || 0) / 100,
    PRR: (targets?.PRR || 0) / 100,
    ABR: (targets?.ABR || 0) / 100,
    BOOKED_KPI: (targets?.BOOKED_KPI || 0) / 100,
    POSITIVE_TO_ABR: (targets?.POSITIVE_TO_ABR || 0) / 100,
    ABR_TO_BOOKED: (targets?.ABR_TO_BOOKED || 0) / 100,
    SEEN_RATE: (targets?.SEEN_RATE || 0) / 100,
    SHOW_UP_RATE: (targets?.SHOW_UP_RATE || 0) / 100,
    SALES_CLOSE_RATE: (targets?.SALES_CLOSE_RATE || 0) / 100,
  };

  const CR = safeDivide(
    totals.connections_accepted,
    totals.connection_requests_sent
  );
  const PRR = safeDivide(
    totals.permission_positives,
    totals.permission_messages_sent
  );
  const ABR = safeDivide(
    totals.offer_or_booking_intent_positives,
    totals.permission_messages_sent
  );
  const BOOKED_KPI = safeDivide(
    totals.booked_calls,
    totals.permission_messages_sent
  );

  const POSITIVE_TO_ABR = safeDivide(
    totals.offer_or_booking_intent_positives,
    totals.permission_positives
  );
  const ABR_TO_BOOKED = safeDivide(
    totals.booked_calls,
    totals.offer_or_booking_intent_positives
  );

  const SEEN_RATE = safeDivide(
    totals.permission_seen,
    totals.permission_messages_sent
  );
  const SHOW_UP_RATE = safeDivide(totals.attended_calls, totals.booked_calls);
  const SCR = safeDivide(totals.closed_deals, totals.attended_calls);

  const bottleneck = computeBottleneck({ CR, PRR, ABR, BOOKED_KPI }, target);

  return {
    primary: { CR, PRR, ABR, BOOKED_KPI },
    secondary: { POSITIVE_TO_ABR, ABR_TO_BOOKED },
    diagnostics: { SEEN_RATE, SHOW_UP_RATE, SCR },
    targets: target,
    status: {
      CR: statusFor(CR, target.CR),
      PRR: statusFor(PRR, target.PRR),
      ABR: statusFor(ABR, target.ABR),
      BOOKED_KPI: statusFor(BOOKED_KPI, target.BOOKED_KPI),
      POSITIVE_TO_ABR: statusFor(POSITIVE_TO_ABR, target.POSITIVE_TO_ABR),
      ABR_TO_BOOKED: statusFor(ABR_TO_BOOKED, target.ABR_TO_BOOKED),
      SEEN_RATE: statusFor(SEEN_RATE, target.SEEN_RATE),
      SHOW_UP_RATE: statusFor(SHOW_UP_RATE, target.SHOW_UP_RATE),
      SCR: statusFor(SCR, target.SALES_CLOSE_RATE),
    },
    bottleneck,
  };
}

function buildDailySeries(logs) {
  const byDate = new Map();
  for (const log of logs || []) {
    const date = log.date;
    if (!date) continue;
    if (!byDate.has(date)) {
      byDate.set(date, {
        date,
        connection_requests_sent: 0,
        connections_accepted: 0,
        permission_messages_sent: 0,
        permission_positives: 0,
        offer_or_booking_intent_positives: 0,
        booked_calls: 0,
      });
    }
    const row = byDate.get(date);
    row.connection_requests_sent += clampNonNegInt(log.connection_requests_sent);
    row.connections_accepted += clampNonNegInt(log.connections_accepted);
    row.permission_messages_sent += clampNonNegInt(log.permission_messages_sent);
    row.permission_positives += clampNonNegInt(log.permission_positives);
    row.offer_or_booking_intent_positives += clampNonNegInt(
      log.offer_or_booking_intent_positives
    );
    row.booked_calls += clampNonNegInt(log.booked_calls);
  }

  return Array.from(byDate.values()).sort((a, b) =>
    a.date > b.date ? 1 : -1
  );
}

function buildFunnelSeries(totals) {
  return [
    { stage: "Requested", value: totals.connection_requests_sent },
    { stage: "Connected", value: totals.connections_accepted },
    { stage: "Permission Sent", value: totals.permission_messages_sent },
    { stage: "Permission Positive", value: totals.permission_positives },
    {
      stage: "Offer Positive / Booking Intent",
      value: totals.offer_or_booking_intent_positives,
    },
    { stage: "Booked", value: totals.booked_calls },
    { stage: "Attended", value: totals.attended_calls },
    { stage: "Closed", value: totals.closed_deals },
  ];
}

function metricValueFor(kpis, metric) {
  switch (metric) {
    case "CR":
      return kpis.primary.CR;
    case "PRR":
      return kpis.primary.PRR;
    case "ABR":
      return kpis.primary.ABR;
    case "BOOKED_KPI":
      return kpis.primary.BOOKED_KPI;
    default:
      return null;
  }
}

function getSeenCountForStage(stage, totals) {
  if (stage === "PERMISSION") {
    return totals.permission_seen || totals.permission_messages_sent;
  }
  if (stage === "OFFER") {
    return totals.offer_seen || totals.offer_messages_sent;
  }
  return 0;
}

function computeVariantStats(experiment, logs, filters, config) {
  const stage = experiment.funnel_stage_targeted;
  const primaryMetric = experiment.primary_metric || primaryMetricForStage(stage);
  const required = clampNonNegInt(
    experiment.required_sample_size_seen ?? requiredSeenForStage(stage)
  );

  return experiment.variants.map((variant) => {
    const variantLogs = (logs || []).filter(
      (log) => log.experiment_id === experiment.id && log.variant_id === variant.id
    );
    const filtered = filterLogs(variantLogs, {
      ...filters,
      excludeOldLeads: config.excludeOldLeadsFromKpi,
    });
    const totals = computeAggregates(filtered);
    const kpis = computeKpis(totals, config.kpiTargets);
    const metricValue = metricValueFor(kpis, primaryMetric);
    const seen = getSeenCountForStage(stage, totals);
    const isValid = required === 0 || seen >= required;

    return {
      variant,
      totals,
      kpis,
      metricValue,
      seen,
      required,
      isValid,
    };
  });
}

function computeExperimentStats(experiments, logs, filters, config) {
  return (experiments || []).map((experiment) => {
    const variantStats = computeVariantStats(experiment, logs, filters, config);
    const primaryMetric =
      experiment.primary_metric || primaryMetricForStage(experiment.funnel_stage_targeted);

    const validVariants = variantStats.filter((v) => v.isValid);
    const winner = validVariants.reduce((best, current) => {
      if (!best) return current;
      if ((current.metricValue ?? -1) > (best.metricValue ?? -1)) return current;
      return best;
    }, null);

    return { experiment, variantStats, primaryMetric, winner };
  });
}

function makeLogDraft(accountId) {
  return {
    date: toISODate(new Date()),
    account_id: accountId,
    is_old_leads_lane: false,
    campaign_tag: "",
    experiment_id: "",
    variant_id: "",
    connection_requests_sent: 0,
    connections_accepted: 0,
    permission_messages_sent: 0,
    permission_seen: 0,
    permission_positives: 0,
    offer_messages_sent: 0,
    offer_seen: 0,
    offer_or_booking_intent_positives: 0,
    booked_calls: 0,
    attended_calls: 0,
    closed_deals: 0,
    notes: "",
  };
}

function makeExperimentDraft() {
  const stage = "PERMISSION";
  return {
    name: "",
    hypothesis: "",
    status: "active",
    funnel_stage_targeted: stage,
    primary_metric: primaryMetricForStage(stage),
    required_sample_size_seen: requiredSeenForStage(stage),
    variant_name: "Variant A",
    variant_message: "",
    variant_step_type: "permission",
  };
}

function makeProspectDraft(accountId) {
  return {
    name: "",
    linkedin_url: "",
    notes: "",
    account_id: accountId,
    is_old_leads_lane: false,
    stage: FUNNEL_STAGES[0].value,
  };
}

function csvEscape(value) {
  const str = value == null ? "" : String(value);
  if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsv(logs, config, accounts, experiments) {
  const accountMap = new Map(accounts.map((account) => [account.id, account.name]));
  const experimentMap = new Map(
    experiments.map((experiment) => [experiment.id, experiment])
  );
  const variantMap = new Map();
  experiments.forEach((experiment) => {
    experiment.variants.forEach((variant) => {
      variantMap.set(variant.id, {
        name: variant.name,
        experimentId: experiment.id,
      });
    });
  });

  const header = [
    "date",
    "account_id",
    "account_name",
    "campaign_tag",
    "is_old_leads_lane",
    "experiment_id",
    "experiment_name",
    "variant_id",
    "variant_name",
    "connection_requests_sent",
    "connections_accepted",
    "permission_messages_sent",
    "permission_seen",
    "permission_positives",
    "offer_messages_sent",
    "offer_seen",
    "offer_or_booking_intent_positives",
    "booked_calls",
    "attended_calls",
    "closed_deals",
    "CR",
    "PRR",
    "ABR",
    "BOOKED_KPI",
    "POSITIVE_TO_ABR",
    "ABR_TO_BOOKED",
    "SEEN_RATE",
    "SHOW_UP_RATE",
    "SCR",
    "notes",
  ];

  const rows = logs.map((log) => {
    const totals = computeAggregates([log]);
    const kpis = computeKpis(totals, config.kpiTargets);
    const experiment = experimentMap.get(log.experiment_id);
    const variant = variantMap.get(log.variant_id);

    const row = {
      date: log.date,
      account_id: log.account_id,
      account_name: accountMap.get(log.account_id) || "",
      campaign_tag: log.campaign_tag || "",
      is_old_leads_lane: log.is_old_leads_lane ? "true" : "false",
      experiment_id: log.experiment_id || "",
      experiment_name: experiment?.name || "",
      variant_id: log.variant_id || "",
      variant_name: variant?.name || "",
      connection_requests_sent: log.connection_requests_sent,
      connections_accepted: log.connections_accepted,
      permission_messages_sent: log.permission_messages_sent,
      permission_seen: log.permission_seen,
      permission_positives: log.permission_positives,
      offer_messages_sent: log.offer_messages_sent,
      offer_seen: log.offer_seen,
      offer_or_booking_intent_positives: log.offer_or_booking_intent_positives,
      booked_calls: log.booked_calls,
      attended_calls: log.attended_calls,
      closed_deals: log.closed_deals,
      CR: formatPercentNumber(kpis.primary.CR),
      PRR: formatPercentNumber(kpis.primary.PRR),
      ABR: formatPercentNumber(kpis.primary.ABR),
      BOOKED_KPI: formatPercentNumber(kpis.primary.BOOKED_KPI),
      POSITIVE_TO_ABR: formatPercentNumber(kpis.secondary.POSITIVE_TO_ABR),
      ABR_TO_BOOKED: formatPercentNumber(kpis.secondary.ABR_TO_BOOKED),
      SEEN_RATE: formatPercentNumber(kpis.diagnostics.SEEN_RATE),
      SHOW_UP_RATE: formatPercentNumber(kpis.diagnostics.SHOW_UP_RATE),
      SCR: formatPercentNumber(kpis.diagnostics.SCR),
      notes: log.notes || "",
    };

    return row;
  });

  const csv = [header.join(",")]
    .concat(
      rows.map((row) => header.map((key) => csvEscape(row[key])).join(","))
    )
    .join("\n");

  return csv;
}
function Card({ className, children }) {
  return (
    <div
      className={cx(
        "rounded-2xl border border-zinc-200/70 bg-white/70 shadow-sm backdrop-blur dark:border-zinc-800/60 dark:bg-zinc-950/40",
        className
      )}
    >
      {children}
    </div>
  );
}

function CardHeader({ title, subtitle, right }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-5">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </div>
        {subtitle ? (
          <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            {subtitle}
          </div>
        ) : null}
      </div>
      {right}
    </div>
  );
}

function CardContent({ children }) {
  return <div className="px-5 pb-5 pt-4">{children}</div>;
}

function Button({
  children,
  className,
  variant = "primary",
  size = "md",
  ...props
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-400/40 dark:focus:ring-zinc-500/40 dark:focus:ring-offset-zinc-950 disabled:opacity-50 disabled:pointer-events-none";
  const variants = {
    primary:
      "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white",
    secondary:
      "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800",
    ghost:
      "bg-transparent text-zinc-900 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-900",
    danger:
      "bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500",
  };
  const sizes = {
    sm: "h-9 px-3 text-sm",
    md: "h-10 px-4 text-sm",
    lg: "h-11 px-5 text-sm",
  };
  return (
    <button
      className={cx(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </button>
  );
}

function IconButton({ title, onClick, disabled, children }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white/70 text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-100 dark:hover:bg-zinc-900",
        disabled && "cursor-not-allowed"
      )}
    >
      {children}
    </button>
  );
}

function Input({ className, ...props }) {
  return (
    <input
      className={cx(
        "h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none ring-0 placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500",
        className
      )}
      {...props}
    />
  );
}

function TextArea({ className, ...props }) {
  return (
    <textarea
      className={cx(
        "min-h-[90px] w-full resize-y rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500",
        className
      )}
      {...props}
    />
  );
}

function Select({ className, children, ...props }) {
  return (
    <select
      className={cx(
        "h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white/60 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
        {label}
      </span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cx(
          "relative h-7 w-12 rounded-full border transition",
          checked
            ? "border-zinc-900 bg-zinc-900 dark:border-zinc-100 dark:bg-zinc-100"
            : "border-zinc-300 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900"
        )}
        aria-pressed={checked}
      >
        <span
          className={cx(
            "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition",
            checked ? "left-5" : "left-0.5",
            checked && "dark:bg-zinc-950"
          )}
        />
      </button>
    </label>
  );
}

function Badge({ tone = "neutral", children }) {
  const tones = {
    neutral:
      "border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300",
    good: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
    bad: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300",
    warn: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}

function InfoTip({ text }) {
  return (
    <span title={text} className="inline-flex items-center text-zinc-400">
      <Info size={14} />
    </span>
  );
}

function ProgressBar({ value }) {
  const width = Math.min(100, Math.max(0, value));
  return (
    <div className="h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-800">
      <div
        className="h-2 rounded-full bg-zinc-900 dark:bg-zinc-100"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast?.open) return;
    const t = setTimeout(() => onDismiss(), 2200);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  if (!toast?.open) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div
        className={cx(
          "rounded-2xl border px-4 py-3 text-sm shadow-lg",
          toast.kind === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100"
            : toast.kind === "error"
              ? "border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100"
              : "border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
        )}
      >
        {toast.message}
      </div>
    </div>
  );
}

function Sidebar({ page, setPage, expanded, setExpanded }) {
  return (
    <aside
      className={cx(
        "hidden shrink-0 lg:block transition-all duration-200",
        expanded ? "w-64" : "w-20"
      )}
    >
      <div className="sticky top-0 h-screen p-4">
        <div className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white/70 p-3 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/40">
          <div
            className={cx(
              "flex items-start justify-between gap-2",
              expanded ? "px-1" : "px-0"
            )}
          >
            <div className={cx("min-w-0", !expanded && "w-full text-center")}>
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {expanded ? "DM Lab" : "DL"}
              </div>
              {expanded ? (
                <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  Elite Health KPI system
                </div>
              ) : null}
            </div>
            <IconButton
              title={expanded ? "Collapse" : "Expand"}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </IconButton>
          </div>

          <div className="mt-4 space-y-1">
            {PAGES.map((p) => {
              const Icon = p.icon;
              const active = p.id === page;
              return (
                <button
                  key={p.id}
                  type="button"
                  title={p.label}
                  onClick={() => setPage(p.id)}
                  className={cx(
                    "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition",
                    !expanded && "justify-center px-2",
                    active
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-900"
                  )}
                >
                  <Icon size={16} />
                  {expanded ? <span className="truncate">{p.label}</span> : null}
                </button>
              );
            })}
          </div>

          {expanded ? (
            <div className="mt-auto pt-3 text-[11px] text-zinc-500 dark:text-zinc-400">
              Local storage + optional Supabase sync
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

function MobileNav({ page, setPage }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/60 lg:hidden">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-2 py-2">
        {PAGES.map((p) => {
          const Icon = p.icon;
          const active = p.id === page;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPage(p.id)}
              className={cx(
                "flex w-full flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 text-xs",
                active
                  ? "text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-500 dark:text-zinc-400"
              )}
            >
              <Icon size={18} />
              <span className="leading-none">{p.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Topbar({
  page,
  setPage,
  isDark,
  setIsDark,
  onSave,
  savedAt,
  dirty,
  autosave,
  filters,
  setFilters,
  accounts,
  campaignOptions,
}) {
  return (
    <div className="sticky top-0 z-30 border-b border-zinc-200 bg-white/70 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="mx-auto w-full max-w-7xl px-4 py-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {PAGES.find((p) => p.id === page)?.label || "DM Lab"}
            </div>
            <div className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
              {dirty ? (
                <span>
                  <span className="font-medium text-amber-700 dark:text-amber-300">
                    Unsaved changes
                  </span>
                  {savedAt ? ` - last saved ${new Date(savedAt).toLocaleString()}` : ""}
                </span>
              ) : (
                <span>{savedAt ? `Saved ${new Date(savedAt).toLocaleString()}` : "Not saved yet"}</span>
              )}
              {autosave ? <span className="ml-2">- Autosave on</span> : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={page}
              onChange={(e) => setPage(e.target.value)}
              className="w-[200px] lg:hidden"
            >
              {PAGES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>

            <Button
              variant="secondary"
              onClick={() => setIsDark((v) => !v)}
              className="shrink-0"
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
              {isDark ? "Light" : "Dark"}
            </Button>
            <Button variant="secondary" onClick={onSave}>
              <Save size={16} /> Save
            </Button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
          <div className="rounded-2xl border border-zinc-200 bg-white/60 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
            <div className="text-[11px] text-zinc-600 dark:text-zinc-400">Start</div>
            <Input
              type="date"
              value={filters.start}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, start: e.target.value }))
              }
              className="mt-1"
            />
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white/60 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
            <div className="text-[11px] text-zinc-600 dark:text-zinc-400">End</div>
            <Input
              type="date"
              value={filters.end}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, end: e.target.value }))
              }
              className="mt-1"
            />
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white/60 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
            <div className="text-[11px] text-zinc-600 dark:text-zinc-400">Account</div>
            <Select
              value={filters.accountId}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, accountId: e.target.value }))
              }
              className="mt-1"
            >
              <option value="all">All accounts</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white/60 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
            <div className="text-[11px] text-zinc-600 dark:text-zinc-400">Campaign</div>
            <Select
              value={filters.campaignTag}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, campaignTag: e.target.value }))
              }
              className="mt-1"
            >
              <option value="all">All campaigns</option>
              {campaignOptions.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiTile({ label, value, targetLabel, status, tooltip }) {
  const toneMap = {
    good: "border-emerald-200/80 dark:border-emerald-900/60",
    warn: "border-amber-200/80 dark:border-amber-900/60",
    bad: "border-red-200/80 dark:border-red-900/60",
    neutral: "border-zinc-200/70 dark:border-zinc-800/60",
  };
  return (
    <div
      className={cx(
        "rounded-2xl border bg-white/70 p-5 shadow-sm backdrop-blur dark:bg-zinc-950/40",
        toneMap[status] || toneMap.neutral
      )}
    >
      <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span>{label}</span>
        {tooltip ? <InfoTip text={tooltip} /> : null}
      </div>
      <div className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        {value}
      </div>
      <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        {targetLabel}
      </div>
    </div>
  );
}

function KpiRow({ label, value, status, tooltip }) {
  const toneMap = {
    good: "good",
    warn: "warn",
    bad: "bad",
    neutral: "neutral",
  };
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
        <span>{label}</span>
        {tooltip ? <InfoTip text={tooltip} /> : null}
      </div>
      <Badge tone={toneMap[status] || "neutral"}>{value}</Badge>
    </div>
  );
}

function GoalRow({ label, current, goal }) {
  const pct = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
        <span>{label}</span>
        <span>
          {current} / {goal || 0}
        </span>
      </div>
      <ProgressBar value={pct} />
    </div>
  );
}
export default function Dashboard() {
  const initial = useMemo(() => loadState(), []);
  const initialConfig = initial.state.config;
  const initialUi = initial.state.ui;
  const [state, setState] = useState(initial.state);
  const [savedAt, setSavedAt] = useState(initial.savedAt);
  const [dirty, setDirty] = useState(false);
  const [page, setPage] = useState("dashboard");
  const [toast, setToast] = useState(
    initial.source === "legacy"
      ? {
          open: true,
          kind: "success",
          message: "Migrated legacy local data to Elite Health schema.",
        }
      : null
  );
  const [dataWarning, setDataWarning] = useState("");
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  const accounts = state.config.accounts;
  const defaultAccountId = accounts[0]?.id || "account_1";

  const [filters, setFilters] = useState(() => {
    const end = toISODate(new Date());
    const start = toISODate(new Date(Date.now() - 1000 * 60 * 60 * 24 * 28));
    return { start, end, accountId: "all", campaignTag: "all" };
  });

  const [logDraft, setLogDraft] = useState(() => makeLogDraft(defaultAccountId));
  const [editingLogId, setEditingLogId] = useState(null);

  const [experimentDraft, setExperimentDraft] = useState(() => makeExperimentDraft());
  const [prospectDraft, setProspectDraft] = useState(() => makeProspectDraft(defaultAccountId));

  const autosaveTimer = useRef(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", state.ui.isDark);
  }, [state.ui.isDark]);

  useEffect(() => {
    setLogDraft((prev) => ({ ...prev, account_id: prev.account_id || defaultAccountId }));
    setProspectDraft((prev) => ({
      ...prev,
      account_id: prev.account_id || defaultAccountId,
    }));
  }, [defaultAccountId]);

  useEffect(() => {
    if (!state.config.autosave || !dirty) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      const saved = saveState(state);
      setSavedAt(saved);
      setDirty(false);
    }, 400);
    return () => clearTimeout(autosaveTimer.current);
  }, [state, dirty, state.config.autosave]);

  useEffect(() => {
    if (!supabase || initial.source !== "default") return;
    let mounted = true;

    const loadFromSupabase = async () => {
      setLoadingRemote(true);
      try {
        const [settingsRes, logsRes, experimentsRes, prospectsRes] = await Promise.all([
          supabase.from("dm_settings").select("data").limit(1).maybeSingle(),
          supabase.from("dm_logs").select("*").order("date", { ascending: true }),
          supabase.from("dm_experiments").select("*").order("created_at", { ascending: false }),
          supabase.from("dm_prospects").select("*").order("created_at", { ascending: false }),
        ]);

        const nextState = normalizeState({
          config: settingsRes.data?.data || initialConfig,
          logs: logsRes.data || [],
          experiments: experimentsRes.data || [],
          prospects: prospectsRes.data || [],
          ui: initialUi,
        });

        if (!mounted) return;
        setState(nextState);
        setSavedAt(null);
        setDirty(false);
        if (logsRes.error || experimentsRes.error || prospectsRes.error || settingsRes.error) {
          setDataWarning("Supabase connected with missing tables or rows. Using local defaults.");
        }
      } catch (error) {
        if (!mounted) return;
        setDataWarning("Supabase load failed. Using local data only.");
      } finally {
        if (!mounted) return;
        setLoadingRemote(false);
      }
    };

    loadFromSupabase();
    return () => {
      mounted = false;
    };
  }, [initial.source, initialConfig, initialUi]);

  const campaignOptions = useMemo(() => {
    const set = new Set();
    state.logs.forEach((log) => {
      if (log.campaign_tag) set.add(log.campaign_tag);
    });
    return Array.from(set).sort();
  }, [state.logs]);

  const filteredLogs = useMemo(
    () =>
      filterLogs(state.logs, {
        ...filters,
        excludeOldLeads: state.config.excludeOldLeadsFromKpi,
      }),
    [state.logs, filters, state.config.excludeOldLeadsFromKpi]
  );

  const logsForTable = useMemo(
    () => filterLogs(state.logs, { ...filters, excludeOldLeads: false }),
    [state.logs, filters]
  );

  const oldLeadsLogs = useMemo(
    () => filterLogs(state.logs, { ...filters, onlyOldLeads: true }),
    [state.logs, filters]
  );

  const totals = useMemo(() => computeAggregates(filteredLogs), [filteredLogs]);
  const kpis = useMemo(() => computeKpis(totals, state.config.kpiTargets), [
    totals,
    state.config.kpiTargets,
  ]);
  const oldLeadsTotals = useMemo(
    () => computeAggregates(oldLeadsLogs),
    [oldLeadsLogs]
  );

  const dailySeries = useMemo(() => buildDailySeries(filteredLogs), [filteredLogs]);
  const funnelSeries = useMemo(() => buildFunnelSeries(totals), [totals]);

  const experimentStats = useMemo(
    () => computeExperimentStats(state.experiments, state.logs, filters, state.config),
    [state.experiments, state.logs, filters, state.config]
  );

  const weeklyStart = startOfWeek(new Date());
  const weeklyEnd = endOfWeek(new Date());
  const weeklyLogs = useMemo(
    () =>
      filterLogs(state.logs, {
        start: toISODate(weeklyStart),
        end: toISODate(weeklyEnd),
        excludeOldLeads: state.config.excludeOldLeadsFromKpi,
      }),
    [state.logs, state.config.excludeOldLeadsFromKpi, weeklyStart, weeklyEnd]
  );

  const weeklyTotalsByAccount = useMemo(() => {
    const map = new Map();
    accounts.forEach((account) => {
      const accountLogs = weeklyLogs.filter((log) => log.account_id === account.id);
      map.set(account.id, computeAggregates(accountLogs));
    });
    return map;
  }, [accounts, weeklyLogs]);

  const logDraftTotals = useMemo(
    () => computeAggregates([normalizeLog(logDraft, defaultAccountId)]),
    [logDraft, defaultAccountId]
  );
  const logDraftKpis = useMemo(
    () => computeKpis(logDraftTotals, state.config.kpiTargets),
    [logDraftTotals, state.config.kpiTargets]
  );

  const updateState = (updater) => {
    setState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      return next;
    });
    setDirty(true);
  };

  const handleSave = async () => {
    const normalized = normalizeState(state);
    const saved = saveState(normalized);
    setState(normalized);
    setSavedAt(saved);
    setDirty(false);
    setToast({ open: true, kind: "success", message: "Saved changes." });

    if (supabase) {
      try {
        await Promise.all([
          supabase.from("dm_settings").upsert({ id: "default", data: normalized.config }),
          supabase.from("dm_logs").upsert(normalized.logs),
          supabase.from("dm_experiments").upsert(normalized.experiments),
          supabase.from("dm_prospects").upsert(normalized.prospects),
        ]);
      } catch (error) {
        setToast({ open: true, kind: "error", message: "Supabase sync failed." });
      }
    }
  };

  const handleExportCsv = () => {
    const exportLogs = filterLogs(state.logs, { ...filters, excludeOldLeads: false });
    const csv = buildCsv(exportLogs, state.config, accounts, state.experiments);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "dm-lab-export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSaveLog = () => {
    const entry = normalizeLog(
      { ...logDraft, id: editingLogId || makeId() },
      defaultAccountId
    );
    updateState((prev) => {
      const logs = editingLogId
        ? prev.logs.map((log) => (log.id === editingLogId ? entry : log))
        : [...prev.logs, entry];
      return {
        ...prev,
        logs: logs.sort((a, b) => (a.date > b.date ? -1 : 1)),
      };
    });
    setEditingLogId(null);
    setLogDraft(makeLogDraft(defaultAccountId));
  };

  const handleEditLog = (log) => {
    setEditingLogId(log.id);
    setLogDraft({ ...log });
  };

  const handleDeleteLog = (id) => {
    updateState((prev) => ({
      ...prev,
      logs: prev.logs.filter((log) => log.id !== id),
    }));
  };

  const handleAddExperiment = () => {
    if (!experimentDraft.name.trim()) return;
    const experiment = normalizeExperiment({
      id: makeId(),
      name: experimentDraft.name,
      hypothesis: experimentDraft.hypothesis,
      status: experimentDraft.status,
      funnel_stage_targeted: experimentDraft.funnel_stage_targeted,
      primary_metric: experimentDraft.primary_metric,
      required_sample_size_seen: experimentDraft.required_sample_size_seen,
      variants: [
        {
          id: makeId(),
          name: experimentDraft.variant_name || "Variant A",
          message: experimentDraft.variant_message,
          step_type: experimentDraft.variant_step_type,
        },
      ],
    });

    updateState((prev) => ({
      ...prev,
      experiments: [experiment, ...prev.experiments],
    }));

    setExperimentDraft(makeExperimentDraft());
  };

  const updateExperiment = (id, updates) => {
    updateState((prev) => ({
      ...prev,
      experiments: prev.experiments.map((experiment) => {
        if (experiment.id !== id) return experiment;
        const next = { ...experiment, ...updates };
        if (updates.funnel_stage_targeted) {
          const stage = updates.funnel_stage_targeted;
          next.primary_metric = primaryMetricForStage(stage);
          next.required_sample_size_seen = requiredSeenForStage(stage);
        }
        return next;
      }),
    }));
  };

  const updateVariant = (experimentId, variantId, updates) => {
    updateState((prev) => ({
      ...prev,
      experiments: prev.experiments.map((experiment) => {
        if (experiment.id !== experimentId) return experiment;
        return {
          ...experiment,
          variants: experiment.variants.map((variant) =>
            variant.id === variantId ? { ...variant, ...updates } : variant
          ),
        };
      }),
    }));
  };

  const addVariant = (experimentId) => {
    updateState((prev) => ({
      ...prev,
      experiments: prev.experiments.map((experiment) => {
        if (experiment.id !== experimentId) return experiment;
        const nextIndex = experiment.variants.length + 1;
        return {
          ...experiment,
          variants: [
            ...experiment.variants,
            {
              id: makeId(),
              name: `Variant ${nextIndex}`,
              message: "",
              step_type: "",
            },
          ],
        };
      }),
    }));
  };

  const removeVariant = (experimentId, variantId) => {
    updateState((prev) => ({
      ...prev,
      experiments: prev.experiments.map((experiment) => {
        if (experiment.id !== experimentId) return experiment;
        const variants = experiment.variants.filter((v) => v.id !== variantId);
        return {
          ...experiment,
          variants: variants.length ? variants : experiment.variants,
        };
      }),
    }));
  };

  const deleteExperiment = (id) => {
    updateState((prev) => ({
      ...prev,
      experiments: prev.experiments.filter((experiment) => experiment.id !== id),
    }));
  };

  const handleAddProspect = () => {
    if (!prospectDraft.name.trim()) return;
    const prospect = normalizeProspect({ ...prospectDraft, id: makeId() }, defaultAccountId);
    updateState((prev) => ({
      ...prev,
      prospects: [prospect, ...prev.prospects],
    }));
    setProspectDraft(makeProspectDraft(defaultAccountId));
  };

  const updateProspect = (id, updates) => {
    updateState((prev) => ({
      ...prev,
      prospects: prev.prospects.map((prospect) =>
        prospect.id === id ? { ...prospect, ...updates } : prospect
      ),
    }));
  };

  const deleteProspect = (id) => {
    updateState((prev) => ({
      ...prev,
      prospects: prev.prospects.filter((prospect) => prospect.id !== id),
    }));
  };

  const updateAccountId = (index, nextId) => {
    updateState((prev) => {
      const accountsNext = [...prev.config.accounts];
      const oldId = accountsNext[index].id;
      accountsNext[index] = { ...accountsNext[index], id: nextId };
      const logs = prev.logs.map((log) =>
        log.account_id === oldId ? { ...log, account_id: nextId } : log
      );
      const prospects = prev.prospects.map((prospect) =>
        prospect.account_id === oldId ? { ...prospect, account_id: nextId } : prospect
      );
      return {
        ...prev,
        config: { ...prev.config, accounts: accountsNext },
        logs,
        prospects,
      };
    });
  };
  const dashboardContent = (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Elite Health KPI Snapshot
          </div>
          <div className="text-xs text-zinc-600 dark:text-zinc-400">
            Bottleneck: {kpis.bottleneck}
          </div>
        </div>
        <Button variant="secondary" onClick={handleExportCsv}>
          <Download size={16} /> Export CSV
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <KpiTile
          label="CR"
          value={formatPercent(kpis.primary.CR)}
          targetLabel={`Target >= ${state.config.kpiTargets.CR}%`}
          status={kpis.status.CR}
          tooltip={KPI_DEFINITIONS.CR}
        />
        <KpiTile
          label="PRR"
          value={formatPercent(kpis.primary.PRR)}
          targetLabel={`Target >= ${state.config.kpiTargets.PRR}%`}
          status={kpis.status.PRR}
          tooltip={KPI_DEFINITIONS.PRR}
        />
        <KpiTile
          label="ABR"
          value={formatPercent(kpis.primary.ABR)}
          targetLabel={`Target >= ${state.config.kpiTargets.ABR}%`}
          status={kpis.status.ABR}
          tooltip={KPI_DEFINITIONS.ABR}
        />
        <KpiTile
          label="Booked KPI"
          value={formatPercent(kpis.primary.BOOKED_KPI)}
          targetLabel={`Target >= ${state.config.kpiTargets.BOOKED_KPI}%`}
          status={kpis.status.BOOKED_KPI}
          tooltip={KPI_DEFINITIONS.BOOKED_KPI}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <KpiTile
          label="Positive -> ABR"
          value={formatPercent(kpis.secondary.POSITIVE_TO_ABR)}
          targetLabel={`Target >= ${state.config.kpiTargets.POSITIVE_TO_ABR}%`}
          status={kpis.status.POSITIVE_TO_ABR}
          tooltip={KPI_DEFINITIONS.POSITIVE_TO_ABR}
        />
        <KpiTile
          label="ABR -> Booked"
          value={formatPercent(kpis.secondary.ABR_TO_BOOKED)}
          targetLabel={`Target >= ${state.config.kpiTargets.ABR_TO_BOOKED}%`}
          status={kpis.status.ABR_TO_BOOKED}
          tooltip={KPI_DEFINITIONS.ABR_TO_BOOKED}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <KpiTile
          label="Seen Rate"
          value={formatPercent(kpis.diagnostics.SEEN_RATE)}
          targetLabel={
            state.config.kpiTargets.SEEN_RATE
              ? `Diagnostic target >= ${state.config.kpiTargets.SEEN_RATE}%`
              : "Diagnostic"
          }
          status={kpis.status.SEEN_RATE}
          tooltip={KPI_DEFINITIONS.SEEN_RATE}
        />
        <KpiTile
          label="Show-up Rate"
          value={formatPercent(kpis.diagnostics.SHOW_UP_RATE)}
          targetLabel={
            state.config.kpiTargets.SHOW_UP_RATE
              ? `Diagnostic target >= ${state.config.kpiTargets.SHOW_UP_RATE}%`
              : "Diagnostic"
          }
          status={kpis.status.SHOW_UP_RATE}
          tooltip={KPI_DEFINITIONS.SHOW_UP_RATE}
        />
        <KpiTile
          label="Sales Close Rate (SCR)"
          value={formatPercent(kpis.diagnostics.SCR)}
          targetLabel={
            state.config.kpiTargets.SALES_CLOSE_RATE
              ? `Diagnostic target >= ${state.config.kpiTargets.SALES_CLOSE_RATE}%`
              : "Diagnostic"
          }
          status={kpis.status.SCR}
          tooltip={KPI_DEFINITIONS.SCR}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Weekly goals"
            subtitle={`${toISODate(weeklyStart)} to ${toISODate(weeklyEnd)}`}
          />
          <CardContent>
            <div className="space-y-6">
              {accounts.map((account) => {
                const totals = weeklyTotalsByAccount.get(account.id) || computeAggregates([]);
                return (
                  <div
                    key={account.id}
                    className="rounded-2xl border border-zinc-200/70 bg-white/70 p-4 dark:border-zinc-800/60 dark:bg-zinc-950/40"
                  >
                    <div className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {account.name}
                    </div>
                    <div className="space-y-4">
                      <GoalRow
                        label="Connection requests"
                        current={totals.connection_requests_sent}
                        goal={account.goals.connection_requests_sent}
                      />
                      <GoalRow
                        label="Permission messages"
                        current={totals.permission_messages_sent}
                        goal={account.goals.permission_messages_sent}
                      />
                      <GoalRow
                        label="Booked calls"
                        current={totals.booked_calls}
                        goal={account.goals.booked_calls}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Old Leads Lane" subtitle="Excluded from KPI math" />
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">Permission sent</span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatCount(oldLeadsTotals.permission_messages_sent)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">Permission positives</span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatCount(oldLeadsTotals.permission_positives)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">Booked calls</span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatCount(oldLeadsTotals.booked_calls)}
                </span>
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Old lane volume is tracked separately and not mixed into KPI charts.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Outreach volume" subtitle="Connections and permissions" />
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailySeries}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#71717a", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      background: "#0a0a0a",
                      border: "1px solid #27272a",
                      color: "#fafafa",
                    }}
                    cursor={{ opacity: 0.15 }}
                  />
                  <Bar dataKey="connection_requests_sent" fill="#52525b" />
                  <Bar dataKey="permission_messages_sent" fill="#a1a1aa" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Response and bookings" subtitle="Positive replies to booked" />
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailySeries}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#71717a", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      background: "#0a0a0a",
                      border: "1px solid #27272a",
                      color: "#fafafa",
                    }}
                    cursor={{ opacity: 0.15 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="permission_positives"
                    stroke="#52525b"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="booked_calls"
                    stroke="#a1a1aa"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader title="Conversion funnel" subtitle="Elite Health funnel alignment" />
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelSeries} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis type="number" tick={{ fill: "#71717a", fontSize: 12 }} />
                <YAxis
                  dataKey="stage"
                  type="category"
                  width={200}
                  tick={{ fill: "#71717a", fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    background: "#0a0a0a",
                    border: "1px solid #27272a",
                    color: "#fafafa",
                  }}
                  cursor={{ opacity: 0.15 }}
                />
                <Bar dataKey="value" fill="#52525b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Multivariate Experiment Lab" subtitle="Validity gated by seen volume" />
        <CardContent>
          <div className="space-y-4">
            {experimentStats.length === 0 ? (
              <div className="text-sm text-zinc-500 dark:text-zinc-400">
                No experiments yet. Create one to see variant performance.
              </div>
            ) : (
              experimentStats.map(({ experiment, variantStats, winner, primaryMetric }) => (
                <div
                  key={experiment.id}
                  className="rounded-2xl border border-zinc-200/70 bg-white/70 p-4 dark:border-zinc-800/60 dark:bg-zinc-950/40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {experiment.name}
                      </div>
                      <div className="text-xs text-zinc-600 dark:text-zinc-400">
                        Stage: {EXPERIMENT_STAGES.find((s) => s.value === experiment.funnel_stage_targeted)?.label || experiment.funnel_stage_targeted} - Primary metric: {primaryMetric}
                      </div>
                    </div>
                    {winner ? (
                      <Badge tone="good">Top: {winner.variant.name}</Badge>
                    ) : (
                      <Badge tone="warn">Insufficient sample</Badge>
                    )}
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    {variantStats.map((stat) => (
                      <div
                        key={stat.variant.id}
                        className="rounded-xl border border-zinc-200/70 bg-white/70 p-3 text-sm dark:border-zinc-800/60 dark:bg-zinc-950/40"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {stat.variant.name}
                          </span>
                          {stat.isValid ? (
                            <Badge tone="good">Valid</Badge>
                          ) : (
                            <Badge tone="warn">Needs {stat.required} seen</Badge>
                          )}
                        </div>
                        <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                          Seen: {stat.seen}
                        </div>
                        <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                          {primaryMetric}: {formatPercent(stat.metricValue)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {import.meta.env.DEV ? (
        <Card>
          <CardHeader title="KPI debug" subtitle="Dev-only totals + ratios" />
          <CardContent>
            <pre className="text-xs text-zinc-600 dark:text-zinc-400">
{JSON.stringify({ totals, kpis }, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
  const logContent = (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Daily Log" subtitle="Log Elite Health KPI inputs" />
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Date</label>
                <Input
                  type="date"
                  value={logDraft.date}
                  onChange={(e) => setLogDraft((prev) => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Account</label>
                <Select
                  value={logDraft.account_id}
                  onChange={(e) => setLogDraft((prev) => ({ ...prev, account_id: e.target.value }))}
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Campaign tag</label>
                <Input
                  value={logDraft.campaign_tag}
                  onChange={(e) => setLogDraft((prev) => ({ ...prev, campaign_tag: e.target.value }))}
                  placeholder="e.g. Q2 outbound"
                />
              </div>
              <div className="flex items-end">
                <Toggle
                  checked={logDraft.is_old_leads_lane}
                  onChange={(value) => setLogDraft((prev) => ({ ...prev, is_old_leads_lane: value }))}
                  label="Old Leads Lane (excluded from KPIs)"
                />
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Experiment</label>
                <Select
                  value={logDraft.experiment_id}
                  onChange={(e) =>
                    setLogDraft((prev) => ({
                      ...prev,
                      experiment_id: e.target.value,
                      variant_id: "",
                    }))
                  }
                >
                  <option value="">No experiment</option>
                  {state.experiments.map((experiment) => (
                    <option key={experiment.id} value={experiment.id}>
                      {experiment.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Variant</label>
                <Select
                  value={logDraft.variant_id}
                  onChange={(e) => setLogDraft((prev) => ({ ...prev, variant_id: e.target.value }))}
                  disabled={!logDraft.experiment_id}
                >
                  <option value="">Select variant</option>
                  {state.experiments
                    .find((exp) => exp.id === logDraft.experiment_id)
                    ?.variants.map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {variant.name}
                      </option>
                    ))}
                </Select>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-zinc-500">
                  Connection requests sent
                </label>
                <Input
                  type="number"
                  min="0"
                  value={logDraft.connection_requests_sent}
                  onChange={(e) =>
                    setLogDraft((prev) => ({
                      ...prev,
                      connection_requests_sent: clampNonNegInt(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Connections accepted</label>
                <Input
                  type="number"
                  min="0"
                  value={logDraft.connections_accepted}
                  onChange={(e) =>
                    setLogDraft((prev) => ({
                      ...prev,
                      connections_accepted: clampNonNegInt(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Permission messages sent</label>
                <Input
                  type="number"
                  min="0"
                  value={logDraft.permission_messages_sent}
                  onChange={(e) =>
                    setLogDraft((prev) => ({
                      ...prev,
                      permission_messages_sent: clampNonNegInt(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Permission seen</label>
                <Input
                  type="number"
                  min="0"
                  value={logDraft.permission_seen}
                  onChange={(e) =>
                    setLogDraft((prev) => ({
                      ...prev,
                      permission_seen: clampNonNegInt(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Permission positives</label>
                <Input
                  type="number"
                  min="0"
                  value={logDraft.permission_positives}
                  onChange={(e) =>
                    setLogDraft((prev) => ({
                      ...prev,
                      permission_positives: clampNonNegInt(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Offer messages sent (optional)</label>
                <Input
                  type="number"
                  min="0"
                  value={logDraft.offer_messages_sent}
                  onChange={(e) =>
                    setLogDraft((prev) => ({
                      ...prev,
                      offer_messages_sent: clampNonNegInt(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Offer seen (optional)</label>
                <Input
                  type="number"
                  min="0"
                  value={logDraft.offer_seen}
                  onChange={(e) =>
                    setLogDraft((prev) => ({
                      ...prev,
                      offer_seen: clampNonNegInt(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Offer / booking intent positives</label>
                <Input
                  type="number"
                  min="0"
                  value={logDraft.offer_or_booking_intent_positives}
                  onChange={(e) =>
                    setLogDraft((prev) => ({
                      ...prev,
                      offer_or_booking_intent_positives: clampNonNegInt(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Booked calls</label>
                <Input
                  type="number"
                  min="0"
                  value={logDraft.booked_calls}
                  onChange={(e) =>
                    setLogDraft((prev) => ({
                      ...prev,
                      booked_calls: clampNonNegInt(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Attended calls (optional)</label>
                <Input
                  type="number"
                  min="0"
                  value={logDraft.attended_calls}
                  onChange={(e) =>
                    setLogDraft((prev) => ({
                      ...prev,
                      attended_calls: clampNonNegInt(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Closed deals (optional)</label>
                <Input
                  type="number"
                  min="0"
                  value={logDraft.closed_deals}
                  onChange={(e) =>
                    setLogDraft((prev) => ({
                      ...prev,
                      closed_deals: clampNonNegInt(e.target.value),
                    }))
                  }
                />
              </div>
            </div>

            <div className="mt-5">
              <label className="mb-1 block text-xs text-zinc-500">Notes</label>
              <TextArea
                value={logDraft.notes}
                onChange={(e) => setLogDraft((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Notes for the day"
              />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={handleSaveLog}>
                <Save size={16} /> {editingLogId ? "Update log" : "Add log"}
              </Button>
              {editingLogId ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditingLogId(null);
                    setLogDraft(makeLogDraft(defaultAccountId));
                  }}
                >
                  Cancel edit
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="DM Sorcery Check" subtitle="Live KPI readout" />
          <CardContent>
            <div className="space-y-3">
              <KpiRow
                label="CR"
                value={formatPercent(logDraftKpis.primary.CR)}
                status={logDraftKpis.status.CR}
                tooltip={KPI_DEFINITIONS.CR}
              />
              <KpiRow
                label="PRR"
                value={formatPercent(logDraftKpis.primary.PRR)}
                status={logDraftKpis.status.PRR}
                tooltip={KPI_DEFINITIONS.PRR}
              />
              <KpiRow
                label="ABR"
                value={formatPercent(logDraftKpis.primary.ABR)}
                status={logDraftKpis.status.ABR}
                tooltip={KPI_DEFINITIONS.ABR}
              />
              <KpiRow
                label="Booked KPI"
                value={formatPercent(logDraftKpis.primary.BOOKED_KPI)}
                status={logDraftKpis.status.BOOKED_KPI}
                tooltip={KPI_DEFINITIONS.BOOKED_KPI}
              />
              <div className="pt-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Secondary ratios
              </div>
              <KpiRow
                label="Positive -> ABR"
                value={formatPercent(logDraftKpis.secondary.POSITIVE_TO_ABR)}
                status={logDraftKpis.status.POSITIVE_TO_ABR}
                tooltip={KPI_DEFINITIONS.POSITIVE_TO_ABR}
              />
              <KpiRow
                label="ABR -> Booked"
                value={formatPercent(logDraftKpis.secondary.ABR_TO_BOOKED)}
                status={logDraftKpis.status.ABR_TO_BOOKED}
                tooltip={KPI_DEFINITIONS.ABR_TO_BOOKED}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader title="Saved logs" subtitle="Tap a row to edit" />
        <CardContent>
          <div className="space-y-3">
            {logsForTable.length === 0 ? (
              <div className="text-sm text-zinc-500 dark:text-zinc-400">No logs yet.</div>
            ) : (
              logsForTable.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200/70 bg-white/70 p-3 dark:border-zinc-800/60 dark:bg-zinc-950/40"
                >
                  <div>
                    <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {log.date} - {accounts.find((account) => account.id === log.account_id)?.name || log.account_id}
                    </div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400">
                      Permission sent {log.permission_messages_sent} - Booked {log.booked_calls}
                      {log.is_old_leads_lane ? " - Old lane" : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEditLog(log)}>
                      Edit
                    </Button>
                    <IconButton title="Delete" onClick={() => handleDeleteLog(log.id)}>
                      <Trash2 size={16} />
                    </IconButton>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
  const leadsContent = (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Add prospect" subtitle="Capture LinkedIn prospects" />
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Name</label>
              <Input
                value={prospectDraft.name}
                onChange={(e) => setProspectDraft((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Prospect name"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">LinkedIn URL</label>
              <Input
                value={prospectDraft.linkedin_url}
                onChange={(e) => setProspectDraft((prev) => ({ ...prev, linkedin_url: e.target.value }))}
                placeholder="https://linkedin.com/in/..."
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Account</label>
              <Select
                value={prospectDraft.account_id}
                onChange={(e) => setProspectDraft((prev) => ({ ...prev, account_id: e.target.value }))}
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Initial stage</label>
              <Select
                value={prospectDraft.stage}
                onChange={(e) => setProspectDraft((prev) => ({ ...prev, stage: e.target.value }))}
              >
                {FUNNEL_STAGES.map((stage) => (
                  <option key={stage.value} value={stage.value}>
                    {stage.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs text-zinc-500">Notes</label>
              <TextArea
                value={prospectDraft.notes}
                onChange={(e) => setProspectDraft((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Notes"
              />
            </div>
            <div className="md:col-span-2">
              <Toggle
                checked={prospectDraft.is_old_leads_lane}
                onChange={(value) => setProspectDraft((prev) => ({ ...prev, is_old_leads_lane: value }))}
                label="Old Leads Lane"
              />
            </div>
          </div>

          <div className="mt-4">
            <Button onClick={handleAddProspect}>
              <Plus size={16} /> Add prospect
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {FUNNEL_STAGES.map((stage) => {
          const prospects = state.prospects.filter((p) => p.stage === stage.value);
          return (
            <Card key={stage.value} className="min-w-[240px]">
              <CardHeader
                title={stage.label}
                subtitle={`${prospects.length} prospects`}
              />
              <CardContent>
                <div className="space-y-3">
                  {prospects.length === 0 ? (
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">No prospects</div>
                  ) : (
                    prospects.map((prospect) => (
                      <div
                        key={prospect.id}
                        className="rounded-xl border border-zinc-200/70 bg-white/70 p-3 dark:border-zinc-800/60 dark:bg-zinc-950/40"
                      >
                        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {prospect.name}
                        </div>
                        <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                          {accounts.find((account) => account.id === prospect.account_id)?.name || prospect.account_id}
                          {prospect.is_old_leads_lane ? " - Old lane" : ""}
                        </div>
                        {prospect.linkedin_url ? (
                          <a
                            className="mt-2 block truncate text-xs text-blue-600 hover:underline dark:text-blue-400"
                            href={prospect.linkedin_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {prospect.linkedin_url}
                          </a>
                        ) : null}
                        <div className="mt-2">
                          <Select
                            value={prospect.stage}
                            onChange={(e) => updateProspect(prospect.id, { stage: e.target.value })}
                          >
                            {FUNNEL_STAGES.map((stageOption) => (
                              <option key={stageOption.value} value={stageOption.value}>
                                {stageOption.label}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteProspect(prospect.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
  const experimentsContent = (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Create experiment" subtitle="Stage + KPI-driven testing" />
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Name</label>
              <Input
                value={experimentDraft.name}
                onChange={(e) => setExperimentDraft((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Experiment name"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Status</label>
              <Select
                value={experimentDraft.status}
                onChange={(e) => setExperimentDraft((prev) => ({ ...prev, status: e.target.value }))}
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="archived">Archived</option>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Stage targeted</label>
              <Select
                value={experimentDraft.funnel_stage_targeted}
                onChange={(e) => {
                  const stage = e.target.value;
                  setExperimentDraft((prev) => ({
                    ...prev,
                    funnel_stage_targeted: stage,
                    primary_metric: primaryMetricForStage(stage),
                    required_sample_size_seen: requiredSeenForStage(stage),
                  }));
                }}
              >
                {EXPERIMENT_STAGES.map((stage) => (
                  <option key={stage.value} value={stage.value}>
                    {stage.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Primary metric</label>
              <Select
                value={experimentDraft.primary_metric}
                onChange={(e) =>
                  setExperimentDraft((prev) => ({ ...prev, primary_metric: e.target.value }))
                }
              >
                {PRIMARY_METRICS.map((metric) => (
                  <option key={metric.value} value={metric.value}>
                    {metric.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Required seen</label>
              <Input
                type="number"
                min="0"
                value={experimentDraft.required_sample_size_seen}
                onChange={(e) =>
                  setExperimentDraft((prev) => ({
                    ...prev,
                    required_sample_size_seen: clampNonNegInt(e.target.value),
                  }))
                }
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs text-zinc-500">Hypothesis</label>
              <TextArea
                value={experimentDraft.hypothesis}
                onChange={(e) => setExperimentDraft((prev) => ({ ...prev, hypothesis: e.target.value }))}
                placeholder="Hypothesis"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Variant name</label>
              <Input
                value={experimentDraft.variant_name}
                onChange={(e) => setExperimentDraft((prev) => ({ ...prev, variant_name: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Variant step</label>
              <Select
                value={experimentDraft.variant_step_type}
                onChange={(e) => setExperimentDraft((prev) => ({ ...prev, variant_step_type: e.target.value }))}
              >
                <option value="">Unspecified</option>
                {VARIANT_STEP_TYPES.map((step) => (
                  <option key={step.value} value={step.value}>
                    {step.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs text-zinc-500">Variant message</label>
              <TextArea
                value={experimentDraft.variant_message}
                onChange={(e) => setExperimentDraft((prev) => ({ ...prev, variant_message: e.target.value }))}
                placeholder="Message copy"
              />
            </div>
          </div>

          <div className="mt-4">
            <Button onClick={handleAddExperiment}>
              <Plus size={16} /> Add experiment
            </Button>
          </div>
        </CardContent>
      </Card>

      {experimentStats.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-sm text-zinc-500 dark:text-zinc-400">
              No experiments created yet.
            </div>
          </CardContent>
        </Card>
      ) : (
        experimentStats.map(({ experiment, variantStats, winner, primaryMetric }) => (
          <Card key={experiment.id}>
            <CardHeader
              title={experiment.name}
              subtitle={`Stage: ${EXPERIMENT_STAGES.find((s) => s.value === experiment.funnel_stage_targeted)?.label || experiment.funnel_stage_targeted}`}
              right={
                winner ? (
                  <Badge tone="good">Winner: {winner.variant.name}</Badge>
                ) : (
                  <Badge tone="warn">Insufficient sample</Badge>
                )
              }
            />
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Name</label>
                  <Input
                    value={experiment.name}
                    onChange={(e) => updateExperiment(experiment.id, { name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Status</label>
                  <Select
                    value={experiment.status}
                    onChange={(e) => updateExperiment(experiment.id, { status: e.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="archived">Archived</option>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Stage targeted</label>
                  <Select
                    value={experiment.funnel_stage_targeted}
                    onChange={(e) => updateExperiment(experiment.id, { funnel_stage_targeted: e.target.value })}
                  >
                    {EXPERIMENT_STAGES.map((stage) => (
                      <option key={stage.value} value={stage.value}>
                        {stage.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Primary metric</label>
                  <Select
                    value={experiment.primary_metric}
                    onChange={(e) => updateExperiment(experiment.id, { primary_metric: e.target.value })}
                  >
                    {PRIMARY_METRICS.map((metric) => (
                      <option key={metric.value} value={metric.value}>
                        {metric.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Required seen</label>
                  <Input
                    type="number"
                    min="0"
                    value={experiment.required_sample_size_seen}
                    onChange={(e) => updateExperiment(experiment.id, { required_sample_size_seen: clampNonNegInt(e.target.value) })}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs text-zinc-500">Hypothesis</label>
                  <TextArea
                    value={experiment.hypothesis}
                    onChange={(e) => updateExperiment(experiment.id, { hypothesis: e.target.value })}
                  />
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {variantStats.map((stat) => (
                  <div
                    key={stat.variant.id}
                    className="rounded-xl border border-zinc-200/70 bg-white/70 p-4 dark:border-zinc-800/60 dark:bg-zinc-950/40"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {stat.variant.name}
                      </div>
                      {stat.isValid ? (
                        <Badge tone="good">
                          <CheckCircle2 size={12} className="mr-1" /> Valid
                        </Badge>
                      ) : (
                        <Badge tone="warn">Seen {stat.seen}/{stat.required}</Badge>
                      )}
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs text-zinc-500">Variant name</label>
                        <Input
                          value={stat.variant.name}
                          onChange={(e) => updateVariant(experiment.id, stat.variant.id, { name: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-zinc-500">Step</label>
                        <Select
                          value={stat.variant.step_type}
                          onChange={(e) => updateVariant(experiment.id, stat.variant.id, { step_type: e.target.value })}
                        >
                          <option value="">Unspecified</option>
                          {VARIANT_STEP_TYPES.map((step) => (
                            <option key={step.value} value={step.value}>
                              {step.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="mb-1 block text-xs text-zinc-500">Message copy</label>
                        <TextArea
                          value={stat.variant.message}
                          onChange={(e) => updateVariant(experiment.id, stat.variant.id, { message: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
                      {primaryMetric}: {formatPercent(stat.metricValue)} - Seen {stat.seen}
                    </div>
                    <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                      PRR {formatPercent(stat.kpis.primary.PRR)} - ABR {formatPercent(stat.kpis.primary.ABR)} - Booked KPI {formatPercent(stat.kpis.primary.BOOKED_KPI)}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <IconButton title="Remove variant" onClick={() => removeVariant(experiment.id, stat.variant.id)}>
                        <Trash2 size={16} />
                      </IconButton>
                    </div>
                  </div>
                ))}

                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => addVariant(experiment.id)}>
                    <Plus size={16} /> Add variant
                  </Button>
                  <Button variant="danger" onClick={() => deleteExperiment(experiment.id)}>
                    <Trash2 size={16} /> Delete experiment
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
  const settingsContent = (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Success Thresholds" subtitle="Elite Health KPI targets" />
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 flex items-center gap-2 text-xs text-zinc-500">
                CR target (%)
                <InfoTip text={KPI_DEFINITIONS.CR} />
              </label>
              <Input
                type="number"
                min="0"
                value={state.config.kpiTargets.CR}
                onChange={(e) =>
                  updateState((prev) => ({
                    ...prev,
                    config: {
                      ...prev.config,
                      kpiTargets: {
                        ...prev.config.kpiTargets,
                        CR: clampNonNegNumber(e.target.value),
                      },
                    },
                  }))
                }
              />
            </div>
            <div>
              <label className="mb-1 flex items-center gap-2 text-xs text-zinc-500">
                PRR target (%)
                <InfoTip text={KPI_DEFINITIONS.PRR} />
              </label>
              <Input
                type="number"
                min="0"
                value={state.config.kpiTargets.PRR}
                onChange={(e) =>
                  updateState((prev) => ({
                    ...prev,
                    config: {
                      ...prev.config,
                      kpiTargets: {
                        ...prev.config.kpiTargets,
                        PRR: clampNonNegNumber(e.target.value),
                      },
                    },
                  }))
                }
              />
            </div>
            <div>
              <label className="mb-1 flex items-center gap-2 text-xs text-zinc-500">
                ABR target (%)
                <InfoTip text={KPI_DEFINITIONS.ABR} />
              </label>
              <Input
                type="number"
                min="0"
                value={state.config.kpiTargets.ABR}
                onChange={(e) =>
                  updateState((prev) => ({
                    ...prev,
                    config: {
                      ...prev.config,
                      kpiTargets: {
                        ...prev.config.kpiTargets,
                        ABR: clampNonNegNumber(e.target.value),
                      },
                    },
                  }))
                }
              />
            </div>
            <div>
              <label className="mb-1 flex items-center gap-2 text-xs text-zinc-500">
                Booked KPI target (%)
                <InfoTip text={KPI_DEFINITIONS.BOOKED_KPI} />
              </label>
              <Input
                type="number"
                min="0"
                value={state.config.kpiTargets.BOOKED_KPI}
                onChange={(e) =>
                  updateState((prev) => ({
                    ...prev,
                    config: {
                      ...prev.config,
                      kpiTargets: {
                        ...prev.config.kpiTargets,
                        BOOKED_KPI: clampNonNegNumber(e.target.value),
                      },
                    },
                  }))
                }
              />
            </div>
            <div>
              <label className="mb-1 flex items-center gap-2 text-xs text-zinc-500">
                Positive -> ABR target (%)
                <InfoTip text={KPI_DEFINITIONS.POSITIVE_TO_ABR} />
              </label>
              <Input
                type="number"
                min="0"
                value={state.config.kpiTargets.POSITIVE_TO_ABR}
                onChange={(e) =>
                  updateState((prev) => ({
                    ...prev,
                    config: {
                      ...prev.config,
                      kpiTargets: {
                        ...prev.config.kpiTargets,
                        POSITIVE_TO_ABR: clampNonNegNumber(e.target.value),
                      },
                    },
                  }))
                }
              />
            </div>
            <div>
              <label className="mb-1 flex items-center gap-2 text-xs text-zinc-500">
                ABR -> Booked target (%)
                <InfoTip text={KPI_DEFINITIONS.ABR_TO_BOOKED} />
              </label>
              <Input
                type="number"
                min="0"
                value={state.config.kpiTargets.ABR_TO_BOOKED}
                onChange={(e) =>
                  updateState((prev) => ({
                    ...prev,
                    config: {
                      ...prev.config,
                      kpiTargets: {
                        ...prev.config.kpiTargets,
                        ABR_TO_BOOKED: clampNonNegNumber(e.target.value),
                      },
                    },
                  }))
                }
              />
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 flex items-center gap-2 text-xs text-zinc-500">
                Seen rate (diagnostic)
                <InfoTip text={KPI_DEFINITIONS.SEEN_RATE} />
              </label>
              <Input
                type="number"
                min="0"
                value={state.config.kpiTargets.SEEN_RATE}
                onChange={(e) =>
                  updateState((prev) => ({
                    ...prev,
                    config: {
                      ...prev.config,
                      kpiTargets: {
                        ...prev.config.kpiTargets,
                        SEEN_RATE: clampNonNegNumber(e.target.value),
                      },
                    },
                  }))
                }
              />
            </div>
            <div>
              <label className="mb-1 flex items-center gap-2 text-xs text-zinc-500">
                Show-up rate (SRR)
                <InfoTip text={KPI_DEFINITIONS.SHOW_UP_RATE} />
              </label>
              <Input
                type="number"
                min="0"
                value={state.config.kpiTargets.SHOW_UP_RATE}
                onChange={(e) =>
                  updateState((prev) => ({
                    ...prev,
                    config: {
                      ...prev.config,
                      kpiTargets: {
                        ...prev.config.kpiTargets,
                        SHOW_UP_RATE: clampNonNegNumber(e.target.value),
                      },
                    },
                  }))
                }
              />
            </div>
            <div>
              <label className="mb-1 flex items-center gap-2 text-xs text-zinc-500">
                Sales Close Rate (SCR)
                <InfoTip text={KPI_DEFINITIONS.SCR} />
              </label>
              <Input
                type="number"
                min="0"
                value={state.config.kpiTargets.SALES_CLOSE_RATE}
                onChange={(e) =>
                  updateState((prev) => ({
                    ...prev,
                    config: {
                      ...prev.config,
                      kpiTargets: {
                        ...prev.config.kpiTargets,
                        SALES_CLOSE_RATE: clampNonNegNumber(e.target.value),
                      },
                    },
                  }))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Accounts" subtitle="Manage LinkedIn accounts + weekly goals" />
        <CardContent>
          <div className="space-y-4">
            {state.config.accounts.map((account, index) => (
              <div
                key={account.id}
                className="rounded-2xl border border-zinc-200/70 bg-white/70 p-4 dark:border-zinc-800/60 dark:bg-zinc-950/40"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-zinc-500">Account name</label>
                    <Input
                      value={account.name}
                      onChange={(e) =>
                        updateState((prev) => {
                          const accounts = [...prev.config.accounts];
                          accounts[index] = { ...accounts[index], name: e.target.value };
                          return { ...prev, config: { ...prev.config, accounts } };
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-zinc-500">Account ID</label>
                    <Input
                      value={account.id}
                      onChange={(e) => updateAccountId(index, e.target.value)}
                    />
                  </div>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs text-zinc-500">Connection requests / week</label>
                    <Input
                      type="number"
                      min="0"
                      value={account.goals.connection_requests_sent}
                      onChange={(e) =>
                        updateState((prev) => {
                          const accounts = [...prev.config.accounts];
                          const goals = { ...accounts[index].goals, connection_requests_sent: clampNonNegInt(e.target.value) };
                          accounts[index] = { ...accounts[index], goals };
                          return { ...prev, config: { ...prev.config, accounts } };
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-zinc-500">Permission messages / week</label>
                    <Input
                      type="number"
                      min="0"
                      value={account.goals.permission_messages_sent}
                      onChange={(e) =>
                        updateState((prev) => {
                          const accounts = [...prev.config.accounts];
                          const goals = { ...accounts[index].goals, permission_messages_sent: clampNonNegInt(e.target.value) };
                          accounts[index] = { ...accounts[index], goals };
                          return { ...prev, config: { ...prev.config, accounts } };
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-zinc-500">Booked calls / week</label>
                    <Input
                      type="number"
                      min="0"
                      value={account.goals.booked_calls}
                      onChange={(e) =>
                        updateState((prev) => {
                          const accounts = [...prev.config.accounts];
                          const goals = { ...accounts[index].goals, booked_calls: clampNonNegInt(e.target.value) };
                          accounts[index] = { ...accounts[index], goals };
                          return { ...prev, config: { ...prev.config, accounts } };
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="KPI settings" subtitle="Data inclusion" />
        <CardContent>
          <div className="space-y-3">
            <Toggle
              checked={state.config.excludeOldLeadsFromKpi}
              onChange={(value) =>
                updateState((prev) => ({
                  ...prev,
                  config: { ...prev.config, excludeOldLeadsFromKpi: value },
                }))
              }
              label="Exclude Old Leads Lane from KPIs"
            />
            <Toggle
              checked={state.config.autosave}
              onChange={(value) =>
                updateState((prev) => ({
                  ...prev,
                  config: { ...prev.config, autosave: value },
                }))
              }
              label="Autosave to local storage"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  let pageContent = dashboardContent;
  if (page === "log") pageContent = logContent;
  if (page === "leads") pageContent = leadsContent;
  if (page === "experiments") pageContent = experimentsContent;
  if (page === "settings") pageContent = settingsContent;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <Topbar
        page={page}
        setPage={setPage}
        isDark={state.ui.isDark}
        setIsDark={(value) =>
          updateState((prev) => ({ ...prev, ui: { ...prev.ui, isDark: value } }))
        }
        onSave={handleSave}
        savedAt={savedAt}
        dirty={dirty}
        autosave={state.config.autosave}
        filters={filters}
        setFilters={setFilters}
        accounts={accounts}
        campaignOptions={campaignOptions}
      />

      <div className="mx-auto flex w-full max-w-7xl gap-4 px-4 py-6">
        <Sidebar
          page={page}
          setPage={setPage}
          expanded={sidebarExpanded}
          setExpanded={setSidebarExpanded}
        />
        <main className="min-w-0 flex-1 pb-20 lg:pb-6">
          {dataWarning ? (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertTriangle size={16} />
              {dataWarning}
            </div>
          ) : null}
          {loadingRemote ? (
            <div className="mb-4 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
              Loading Supabase data...
            </div>
          ) : null}
          {pageContent}
        </main>
      </div>

      <MobileNav page={page} setPage={setPage} />
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}


