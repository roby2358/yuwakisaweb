// The fixed sample dataset: ~30 payroll-domain job classes, their
// normalization into ~a dozen queues, named scenarios, policy inputs
// (affinity, demotion, tenant isolation, DB budgets), and the three demo
// stages. All numbers are synthetic but carry provenance annotations in
// the style of SOLVER.md §2 step 1, because the discipline is the point.
//
// Validation runs at module load and throws on any dangling name.

import { LATENCY_CLASSES } from './config.js';

// ── Scenarios ──────────────────────────────────────────────────────────
// Rates differ deliberately: steady and peak-hour fit three shards' worth
// of Redis budget; quarter-close does not. Averages lie.

export const SCENARIOS = [
  { id: 'steady', label: 'steady', description: 'Ordinary weekday afternoon. Nothing special is happening.' },
  { id: 'peak', label: 'peak-hour', description: 'Top of the hour: payroll runs, payments, and webhooks cluster.' },
  { id: 'qclose', label: 'quarter-close', description: 'Quarter close: filings, recalcs, reports, and exports burst at once.' },
];

// ── Downstream databases and connection budgets ───────────────────────

export const DATABASES = [
  { id: 'payments_db', label: 'payments', maxConnections: 120 },
  { id: 'risk_db', label: 'risk', maxConnections: 100 },
  { id: 'payroll_db', label: 'payroll', maxConnections: 220 },
  { id: 'ledger_db', label: 'ledger', maxConnections: 220 },
  { id: 'reporting_db', label: 'reporting', maxConnections: 100 },
];

export const DB_PROVENANCE = {
  source: 'pgbouncer pool_size minus reserved superuser slots',
  freshness: 'config as of 2026-07-15',
  confidence: 'declared',
  owner: 'Infra / Databases',
};

// ── Queues (the unit of placement) ────────────────────────────────────
// Job classes are the unit of code; queues are the unit of placement.
// The grouping below is SOLVER.md §2 step 2 made visible.

export const QUEUES = [
  { id: 'q_payments', label: 'payments', latencyClass: 'urgent', description: 'Money movement with bank-cutoff SLOs.' },
  { id: 'q_fraud', label: 'fraud', latencyClass: 'urgent', description: 'Pre-dispatch risk decisions on the payment path.' },
  { id: 'q_notifications', label: 'notifications', latencyClass: 'fast', description: 'User-facing alerts about money events.' },
  { id: 'q_payroll_run', label: 'payroll-run', latencyClass: 'fast', description: 'Gross-to-net computation for pay groups.' },
  { id: 'q_webhooks', label: 'webhooks', latencyClass: 'fast', description: 'Outbound event delivery to partner systems.' },
  { id: 'q_tax_calc', label: 'tax-calc', latencyClass: 'default', description: 'Withholding and garnishment computation.' },
  { id: 'q_ledger', label: 'ledger', latencyClass: 'default', description: 'Double-entry postings and journal sync.' },
  { id: 'q_integrations', label: 'integrations', latencyClass: 'default', description: 'Accounting exports and external feed imports.' },
  { id: 'q_documents', label: 'documents', latencyClass: 'default', description: 'PDF rendering: tax forms, W-2s, payslips.' },
  { id: 'q_nightly_ledger', label: 'nightly-ledger', latencyClass: 'batch', description: 'Overnight ledger reconciliation window.' },
  { id: 'q_reports', label: 'reports', latencyClass: 'batch', description: 'Quarter-end reporting and YTD rebuilds.' },
  { id: 'q_tenant_bulk', label: 'tenant-bulk', latencyClass: 'batch', description: 'Per-tenant bulk operations. Home of the noisy tenant.' },
  { id: 'q_quarterly_recalc', label: 'quarterly-recalc', latencyClass: 'batch', description: 'The new quarter-close filing recalc fan-out (stage 2).' },
];

// ── Co-location policies ──────────────────────────────────────────────

export const AFFINITY_GROUPS = [
  {
    id: 'payment-ordering',
    description: 'Fraud verdicts must post before payment dispatch reads them; the queues must share a shard to keep ordering cheap.',
  },
];

export const DEMOTION_PATHS = [
  {
    from: 'q_ledger',
    to: 'q_integrations',
    description: 'Incident escape valve: posting floods get bulk-demoted into the slower integrations queue. Same shard keeps that a cheap same-instance list op.',
  },
];

export const NOISY_TENANT = 'Globochem Staffing';

// ── Provenance templates (source + freshness per parameter kind) ──────

export const PROVENANCE = {
  arrivalRate: {
    source: 'Datadog: sidekiq.jobs.enqueued per class; batch classes use required sustained drain rate',
    freshness: 'trailing 90d, per-scenario envelope, pulled 2026-07-18',
    confidence: 'measured',
    owner: 'Queue Platform',
  },
  cmdLoad: {
    source: 'Datadog: redis.commands with per-queue attribution (includes burst enqueue storms)',
    freshness: 'trailing 90d scenario peak, pulled 2026-07-18',
    confidence: 'measured',
    owner: 'Infra / Datastores',
  },
  p99Sec: {
    source: 'Datadog: sidekiq.job.duration p99 per class',
    freshness: 'trailing 30d, pulled 2026-07-18',
    confidence: 'measured',
    owner: 'owning team (per class)',
  },
  payloadKB: {
    source: 'Redis MEMORY USAGE sampling per queue, avg serialized job size',
    freshness: 'sampled 2026-07-10',
    confidence: 'measured',
    owner: 'Queue Platform',
  },
  backlogDepth: {
    source: 'worst observed queue depth + incident-retro worst case, owner-reviewed',
    freshness: 'reviewed 2026-07-05',
    confidence: 'declared',
    owner: 'owning team (per class)',
  },
  slo: {
    source: 'SLO registry (bank cutoff windows); burst backlog from incident retro 2026-04-02',
    freshness: 'reviewed 2026-07-01',
    confidence: 'declared',
    owner: 'Payments Platform',
  },
};

// ── Job classes ───────────────────────────────────────────────────────
// arrivalRate: jobs/sec per scenario (sustained drain rate for batch).
// cmdLoad: Redis commands/sec attributed to this class per scenario.
// slo (urgent only): burst backlog that must drain within windowSec.

export const JOB_CLASSES = [
  // — q_payments (urgent) —
  {
    name: 'PaymentDispatchJob', queue: 'q_payments', latencyClass: 'urgent',
    description: 'Sends an approved payment to the banking rails before the cutoff window.',
    arrivalRate: { steady: 30, peak: 105, qclose: 90 },
    cmdLoad: { steady: 350, peak: 1300, qclose: 1100 },
    p99Sec: 0.12, payloadKB: 6, backlogDepth: 6000, db: 'payments_db',
    affinityGroups: ['payment-ordering'],
    tenant: { profile: 'shared', noisy: false, protected: true },
    slo: { burstBacklog: 250, windowSec: 5 },
  },
  {
    name: 'AchReturnProcessingJob', queue: 'q_payments', latencyClass: 'urgent',
    description: 'Applies ACH returns and reversal codes to in-flight payments.',
    arrivalRate: { steady: 12, peak: 37, qclose: 35 },
    cmdLoad: { steady: 150, peak: 400, qclose: 400 },
    p99Sec: 0.15, payloadKB: 4, backlogDepth: 4000, db: 'payments_db',
    affinityGroups: [],
    tenant: { profile: 'shared', noisy: false, protected: true },
    slo: { burstBacklog: 100, windowSec: 5 },
  },
  {
    name: 'PaymentReversalJob', queue: 'q_payments', latencyClass: 'urgent',
    description: 'Unwinds a dispatched payment when a downstream check fails.',
    arrivalRate: { steady: 8, peak: 25, qclose: 25 },
    cmdLoad: { steady: 100, peak: 300, qclose: 300 },
    p99Sec: 0.10, payloadKB: 3, backlogDepth: 3000, db: 'payments_db',
    affinityGroups: [],
    tenant: { profile: 'shared', noisy: false, protected: true },
    slo: { burstBacklog: 50, windowSec: 5 },
  },

  // — q_fraud (urgent) —
  {
    name: 'FraudScoringJob', queue: 'q_fraud', latencyClass: 'urgent',
    description: 'Scores a payment for fraud risk; dispatch reads the verdict.',
    arrivalRate: { steady: 20, peak: 65, qclose: 65 },
    cmdLoad: { steady: 250, peak: 800, qclose: 800 },
    p99Sec: 0.08, payloadKB: 2, backlogDepth: 3000, db: 'risk_db',
    affinityGroups: ['payment-ordering'],
    tenant: { profile: 'shared', noisy: false, protected: true },
    slo: { burstBacklog: 150, windowSec: 5 },
  },
  {
    name: 'VelocityCheckJob', queue: 'q_fraud', latencyClass: 'urgent',
    description: 'Rolling-window velocity checks on account activity.',
    arrivalRate: { steady: 13, peak: 43, qclose: 43 },
    cmdLoad: { steady: 150, peak: 500, qclose: 500 },
    p99Sec: 0.06, payloadKB: 1, backlogDepth: 2000, db: 'risk_db',
    affinityGroups: [],
    tenant: { profile: 'shared', noisy: false, protected: true },
    slo: { burstBacklog: 100, windowSec: 5 },
  },

  // — q_notifications (fast) —
  {
    name: 'PayslipNotificationJob', queue: 'q_notifications', latencyClass: 'fast',
    description: 'Emails and pushes "your payslip is ready" notices.',
    arrivalRate: { steady: 15, peak: 45, qclose: 45 },
    cmdLoad: { steady: 200, peak: 600, qclose: 600 },
    p99Sec: 0.09, payloadKB: 2, backlogDepth: 8000, db: null,
    affinityGroups: [],
    tenant: { profile: 'shared', noisy: false, protected: false },
  },
  {
    name: 'DirectDepositAlertJob', queue: 'q_notifications', latencyClass: 'fast',
    description: 'Alerts employees when a direct deposit lands.',
    arrivalRate: { steady: 8, peak: 25, qclose: 25 },
    cmdLoad: { steady: 100, peak: 300, qclose: 300 },
    p99Sec: 0.12, payloadKB: 2, backlogDepth: 5000, db: null,
    affinityGroups: [],
    tenant: { profile: 'shared', noisy: false, protected: false },
  },

  // — q_payroll_run (fast) —
  {
    name: 'PayrollRunJob', queue: 'q_payroll_run', latencyClass: 'fast',
    description: 'Computes gross-to-net for one pay group.',
    arrivalRate: { steady: 12, peak: 55, qclose: 48 },
    cmdLoad: { steady: 150, peak: 700, qclose: 600 },
    p99Sec: 0.25, payloadKB: 10, backlogDepth: 6000, db: 'payroll_db',
    affinityGroups: [],
    tenant: { profile: 'shared', noisy: false, protected: true },
  },
  {
    name: 'OffCyclePayrollJob', queue: 'q_payroll_run', latencyClass: 'fast',
    description: 'One-off payroll runs: corrections, bonuses, terminations.',
    arrivalRate: { steady: 6, peak: 20, qclose: 24 },
    cmdLoad: { steady: 80, peak: 250, qclose: 300 },
    p99Sec: 0.20, payloadKB: 8, backlogDepth: 3000, db: 'payroll_db',
    affinityGroups: [],
    tenant: { profile: 'shared', noisy: false, protected: true },
  },
  {
    name: 'ContractorPayoutJob', queue: 'q_payroll_run', latencyClass: 'fast',
    description: 'Computes and stages 1099 contractor payouts.',
    arrivalRate: { steady: 6, peak: 20, qclose: 24 },
    cmdLoad: { steady: 70, peak: 250, qclose: 300 },
    p99Sec: 0.15, payloadKB: 6, backlogDepth: 3000, db: 'payroll_db',
    affinityGroups: [],
    tenant: { profile: 'shared', noisy: false, protected: true },
  },

  // — q_webhooks (fast) —
  {
    name: 'WebhookDeliveryJob', queue: 'q_webhooks', latencyClass: 'fast',
    description: 'Delivers signed event payloads to customer endpoints.',
    arrivalRate: { steady: 30, peak: 70, qclose: 70 },
    cmdLoad: { steady: 350, peak: 850, qclose: 850 },
    p99Sec: 0.15, payloadKB: 5, backlogDepth: 20000, db: null,
    affinityGroups: [],
    tenant: { profile: 'shared', noisy: false, protected: false },
  },
  {
    name: 'PartnerCallbackJob', queue: 'q_webhooks', latencyClass: 'fast',
    description: 'Callbacks to banking and benefits partners.',
    arrivalRate: { steady: 12, peak: 30, qclose: 30 },
    cmdLoad: { steady: 150, peak: 350, qclose: 350 },
    p99Sec: 0.18, payloadKB: 4, backlogDepth: 10000, db: null,
    affinityGroups: [],
    tenant: { profile: 'shared', noisy: false, protected: false },
  },

  // — q_tax_calc (default) —
  {
    name: 'TaxWithholdingCalcJob', queue: 'q_tax_calc', latencyClass: 'default',
    description: 'Recomputes federal and state withholding for a worker.',
    arrivalRate: { steady: 10, peak: 25, qclose: 85 },
    cmdLoad: { steady: 120, peak: 300, qclose: 1000 },
    p99Sec: 0.15, payloadKB: 4, backlogDepth: 15000, db: 'payroll_db',
    affinityGroups: [],
    tenant: { profile: 'shared', noisy: false, protected: false },
  },
  {
    name: 'GarnishmentCalcJob', queue: 'q_tax_calc', latencyClass: 'default',
    description: 'Applies garnishment orders to computed pay.',
    arrivalRate: { steady: 7, peak: 17, qclose: 50 },
    cmdLoad: { steady: 80, peak: 200, qclose: 600 },
    p99Sec: 0.12, payloadKB: 3, backlogDepth: 8000, db: 'payroll_db',
    affinityGroups: [],
    tenant: { profile: 'shared', noisy: false, protected: false },
  },

  // — q_ledger (default) —
  {
    name: 'LedgerPostingJob', queue: 'q_ledger', latencyClass: 'default',
    description: 'Writes double-entry postings for money events.',
    arrivalRate: { steady: 20, peak: 42, qclose: 62 },
    cmdLoad: { steady: 250, peak: 500, qclose: 750 },
    p99Sec: 0.20, payloadKB: 6, backlogDepth: 20000, db: 'ledger_db',
    affinityGroups: [],
    tenant: { profile: 'shared', noisy: false, protected: false },
  },
  {
    name: 'JournalEntrySyncJob', queue: 'q_ledger', latencyClass: 'default',
    description: 'Mirrors journal entries into the general ledger.',
    arrivalRate: { steady: 12, peak: 25, qclose: 38 },
    cmdLoad: { steady: 150, peak: 300, qclose: 450 },
    p99Sec: 0.18, payloadKB: 5, backlogDepth: 12000, db: 'ledger_db',
    affinityGroups: [],
    tenant: { profile: 'shared', noisy: false, protected: false },
  },

  // — q_integrations (default) —
  {
    name: 'AccountingExportJob', queue: 'q_integrations', latencyClass: 'default',
    description: 'Exports journals to customer accounting systems.',
    arrivalRate: { steady: 10, peak: 20, qclose: 28 },
    cmdLoad: { steady: 120, peak: 250, qclose: 350 },
    p99Sec: 0.30, payloadKB: 8, backlogDepth: 8000, db: 'ledger_db',
    affinityGroups: [],
    tenant: { profile: 'shared', noisy: false, protected: false },
  },
  {
    name: 'BankFeedImportJob', queue: 'q_integrations', latencyClass: 'default',
    description: 'Imports bank transaction feeds for reconciliation.',
    arrivalRate: { steady: 8, peak: 16, qclose: 20 },
    cmdLoad: { steady: 100, peak: 200, qclose: 250 },
    p99Sec: 0.25, payloadKB: 12, backlogDepth: 5000, db: 'ledger_db',
    affinityGroups: [],
    tenant: { profile: 'shared', noisy: false, protected: false },
  },
  {
    name: 'HrisSyncJob', queue: 'q_integrations', latencyClass: 'default',
    description: 'Syncs employee records from HRIS providers.',
    arrivalRate: { steady: 7, peak: 12, qclose: 17 },
    cmdLoad: { steady: 80, peak: 150, qclose: 200 },
    p99Sec: 0.20, payloadKB: 6, backlogDepth: 4000, db: 'ledger_db',
    affinityGroups: [],
    tenant: { profile: 'shared', noisy: false, protected: false },
  },

  // — q_documents (default) —
  {
    name: 'TaxFormRenderJob', queue: 'q_documents', latencyClass: 'default',
    description: 'Renders a completed tax form PDF.',
    arrivalRate: { steady: 7, peak: 12, qclose: 50 },
    cmdLoad: { steady: 80, peak: 150, qclose: 600 },
    p99Sec: 0.18, payloadKB: 30, backlogDepth: 6000, db: null,
    affinityGroups: [],
    tenant: { profile: 'shared', noisy: false, protected: false },
  },
  {
    name: 'W2RenderJob', queue: 'q_documents', latencyClass: 'default',
    description: 'Renders W-2s during filing seasons.',
    arrivalRate: { steady: 4, peak: 8, qclose: 30 },
    cmdLoad: { steady: 50, peak: 100, qclose: 350 },
    p99Sec: 0.15, payloadKB: 25, backlogDepth: 4000, db: null,
    affinityGroups: [],
    tenant: { profile: 'shared', noisy: false, protected: false },
  },
  {
    name: 'PayslipPdfJob', queue: 'q_documents', latencyClass: 'default',
    description: 'Renders payslip PDFs after each payroll run.',
    arrivalRate: { steady: 6, peak: 12, qclose: 20 },
    cmdLoad: { steady: 70, peak: 150, qclose: 250 },
    p99Sec: 0.12, payloadKB: 15, backlogDepth: 6000, db: null,
    affinityGroups: [],
    tenant: { profile: 'shared', noisy: false, protected: false },
  },

  // — q_nightly_ledger (batch) —
  {
    name: 'NightlyLedgerSyncJob', queue: 'q_nightly_ledger', latencyClass: 'batch',
    description: 'Reconciles the day\'s ledger against the bank feed overnight.',
    arrivalRate: { steady: 1.0, peak: 0.6, qclose: 1.4 },
    cmdLoad: { steady: 400, peak: 250, qclose: 800 },
    p99Sec: 8, payloadKB: 12, backlogDepth: 25000, db: 'ledger_db',
    affinityGroups: [],
    tenant: { profile: 'shared', noisy: false, protected: false },
  },
  {
    name: 'LedgerReconciliationBatchJob', queue: 'q_nightly_ledger', latencyClass: 'batch',
    description: 'Deep reconciliation pass over unmatched postings.',
    arrivalRate: { steady: 0.5, peak: 0.4, qclose: 0.8 },
    cmdLoad: { steady: 200, peak: 150, qclose: 400 },
    p99Sec: 6, payloadKB: 10, backlogDepth: 12000, db: 'ledger_db',
    affinityGroups: [],
    tenant: { profile: 'shared', noisy: false, protected: false },
  },

  // — q_reports (batch) —
  {
    name: 'QuarterEndReportJob', queue: 'q_reports', latencyClass: 'batch',
    description: 'Builds quarter-end summaries per customer.',
    arrivalRate: { steady: 0.3, peak: 0.3, qclose: 0.8 },
    cmdLoad: { steady: 80, peak: 100, qclose: 700 },
    p99Sec: 12, payloadKB: 20, backlogDepth: 10000, db: 'reporting_db',
    affinityGroups: [],
    tenant: { profile: 'shared', noisy: false, protected: false },
  },
  {
    name: 'YtdSummaryRebuildJob', queue: 'q_reports', latencyClass: 'batch',
    description: 'Rebuilds year-to-date aggregates after corrections.',
    arrivalRate: { steady: 0.3, peak: 0.4, qclose: 0.6 },
    cmdLoad: { steady: 70, peak: 120, qclose: 500 },
    p99Sec: 8, payloadKB: 12, backlogDepth: 8000, db: 'reporting_db',
    affinityGroups: [],
    tenant: { profile: 'shared', noisy: false, protected: false },
  },
  {
    name: 'AuditTrailCompactionJob', queue: 'q_reports', latencyClass: 'batch',
    description: 'Compacts audit event streams into cold storage.',
    arrivalRate: { steady: 0.2, peak: 0.3, qclose: 0.4 },
    cmdLoad: { steady: 50, peak: 80, qclose: 200 },
    p99Sec: 5, payloadKB: 8, backlogDepth: 6000, db: 'reporting_db',
    affinityGroups: [],
    tenant: { profile: 'shared', noisy: false, protected: false },
  },

  // — q_tenant_bulk (batch, noisy tenant) —
  {
    name: 'TenantDataExportJob', queue: 'q_tenant_bulk', latencyClass: 'batch',
    description: `Fans out a full data export per tenant. ${NOISY_TENANT} runs one weekly — the large fan-out.`,
    arrivalRate: { steady: 0.5, peak: 0.8, qclose: 1.2 },
    cmdLoad: { steady: 200, peak: 350, qclose: 700 },
    p99Sec: 7, payloadKB: 40, backlogDepth: 8000, db: 'payroll_db',
    affinityGroups: [],
    tenant: { profile: 'mega', noisy: true, protected: false },
  },
  {
    name: 'BulkTimecardImportJob', queue: 'q_tenant_bulk', latencyClass: 'batch',
    description: `Imports timecard files. ${NOISY_TENANT} uploads theirs in one 90k-row batch.`,
    arrivalRate: { steady: 0.6, peak: 1.0, qclose: 1.5 },
    cmdLoad: { steady: 120, peak: 250, qclose: 500 },
    p99Sec: 4, payloadKB: 25, backlogDepth: 6000, db: 'payroll_db',
    affinityGroups: [],
    tenant: { profile: 'mega', noisy: true, protected: false },
  },
  {
    name: 'TenantOffboardingSweepJob', queue: 'q_tenant_bulk', latencyClass: 'batch',
    description: 'Sweeps and archives a departing tenant\'s records.',
    arrivalRate: { steady: 0.2, peak: 0.3, qclose: 0.5 },
    cmdLoad: { steady: 80, peak: 100, qclose: 200 },
    p99Sec: 6, payloadKB: 10, backlogDepth: 3000, db: 'payroll_db',
    affinityGroups: [],
    tenant: { profile: 'mega', noisy: true, protected: false },
  },

  // — q_quarterly_recalc (batch) — held out of the baseline; stage 2 adds it.
  {
    name: 'QuarterlyFilingRecalcJob', queue: 'q_quarterly_recalc', latencyClass: 'batch',
    description: 'Recomputes quarterly filings for every tenant: ~40k jobs in a burst at quarter close, hits Postgres hard.',
    arrivalRate: { steady: 0.2, peak: 0.3, qclose: 1.9 },
    cmdLoad: { steady: 50, peak: 100, qclose: 1900 },
    p99Sec: 12, payloadKB: 18, backlogDepth: 40000, db: 'payroll_db',
    affinityGroups: [],
    tenant: { profile: 'shared', noisy: false, protected: false },
    heldOut: true,
  },
];

// ── Stages ────────────────────────────────────────────────────────────
// The tightening in stage 3 and the suggested relaxation are fixed here,
// as part of the shipped dataset.

export const STAGES = [
  {
    id: 1,
    label: '1 · Baseline plan',
    shardCap: 6,
    strictTenantIsolation: false,
    includeHeldOut: false,
    useBaseline: false,
    narration: 'The solver is asked to place all twelve queues and size every worker pool from scratch, minimizing the number of shards used. Steady and peak-hour traffic would fit three shards’ Redis budget — quarter-close does not, and the model enforces every scenario at once. Averages lie; the certified answer below uses four of the six candidate shards.',
  },
  {
    id: 2,
    label: '2 · Add a job',
    shardCap: 6,
    strictTenantIsolation: false,
    includeHeldOut: true,
    useBaseline: true,
    narration: 'A team ships QuarterlyFilingRecalcJob: a ~40k-job fan-out at quarter close. It gets its own queue, and the solver re-solves with stage 1’s layout as the baseline and total move cost as the second objective. The burst fits on no shard as-is — but rather than churn the fleet, the solver returns the cheapest fix: place the new queue, and relocate the least expensive existing queue to make room.',
  },
  {
    id: 3,
    label: '3 · Infeasibility',
    shardCap: 4,
    strictTenantIsolation: true,
    includeHeldOut: true,
    useBaseline: true,
    narration: `Two policies tighten at once: the shard budget is frozen at four, and after an incident, ${NOISY_TENANT}’s bulk workload must run on a dedicated shard — strict tenant isolation. No layout satisfies everything. The solver proves it and names the conflict as policy groups, turning a doomed migration into a negotiation held at planning time.`,
    relaxation: {
      shardCap: 5,
      label: 'Raise the shard cap to 5 and re-solve',
      description: 'Keep strict tenant isolation, allow one more shard.',
    },
  },
];

// ── Load-time validation: fail loudly on dangling names ───────────────

const fail = (msg) => { throw new Error(`jobs.js dataset invalid: ${msg}`); };

const validateDataset = () => {
  const queueIds = new Set(QUEUES.map(q => q.id));
  const scenarioIds = new Set(SCENARIOS.map(s => s.id));
  const dbIds = new Set(DATABASES.map(d => d.id));
  const groupIds = new Set(AFFINITY_GROUPS.map(g => g.id));
  const classIds = new Set(LATENCY_CLASSES.map(c => c.id));
  const queueClass = new Map(QUEUES.map(q => [q.id, q.latencyClass]));

  for (const q of QUEUES) {
    if (!classIds.has(q.latencyClass)) fail(`queue ${q.id} has unknown latency class '${q.latencyClass}'`);
  }
  for (const p of DEMOTION_PATHS) {
    if (!queueIds.has(p.from)) fail(`demotion path names undefined queue '${p.from}'`);
    if (!queueIds.has(p.to)) fail(`demotion path names undefined queue '${p.to}'`);
  }
  for (const job of JOB_CLASSES) {
    if (!queueIds.has(job.queue)) fail(`${job.name} names undefined queue '${job.queue}'`);
    if (!classIds.has(job.latencyClass)) fail(`${job.name} has unknown latency class '${job.latencyClass}'`);
    if (job.latencyClass !== queueClass.get(job.queue)) {
      fail(`${job.name} is '${job.latencyClass}' but its queue ${job.queue} is '${queueClass.get(job.queue)}'`);
    }
    if (job.db !== null && !dbIds.has(job.db)) fail(`${job.name} names undefined database '${job.db}'`);
    for (const g of job.affinityGroups) {
      if (!groupIds.has(g)) fail(`${job.name} names undefined affinity group '${g}'`);
    }
    for (const s of scenarioIds) {
      if (typeof job.arrivalRate[s] !== 'number') fail(`${job.name} missing arrivalRate for scenario '${s}'`);
      if (typeof job.cmdLoad[s] !== 'number') fail(`${job.name} missing cmdLoad for scenario '${s}'`);
    }
    for (const s of Object.keys(job.arrivalRate)) {
      if (!scenarioIds.has(s)) fail(`${job.name} arrivalRate names undefined scenario '${s}'`);
    }
    for (const s of Object.keys(job.cmdLoad)) {
      if (!scenarioIds.has(s)) fail(`${job.name} cmdLoad names undefined scenario '${s}'`);
    }
    if (job.latencyClass === 'urgent' && !job.slo) fail(`${job.name} is urgent but has no slo entry`);
  }
  const populated = new Set(JOB_CLASSES.map(j => j.queue));
  for (const q of QUEUES) {
    if (!populated.has(q.id)) fail(`queue ${q.id} has no member job classes`);
  }
};

validateDataset();
