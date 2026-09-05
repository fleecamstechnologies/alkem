# Alkem HRMS

Customer & finance platform for Alkem — built to hold ~20 lakh (2M+) customer
records plus their full payment history and stay fast at that scale.

Built and verified end to end:

- **Phase 1 — Customers + Payment history**: customer master, payment ledger,
  running-balance statements, cached dashboard, CSV/XLSX import.
- **Phase 2 — Employees, Attendance & Leave, Payroll, Doctors**: employee &
  department master, daily attendance + leave (types / balances / approvals that
  feed LOP into payroll), configurable salary structures and monthly pay runs
  (DRAFT → PROCESSED → APPROVED → PAID) with per-employee payslips, and a
  doctor master.
- **Phase 3 — Reports & exports**: a read-only report registry (13 reports across
  Payroll / HR / Finance / CRM) with on-screen preview plus **CSV and Excel**
  download. No schema change.
- **Phase 4 — Employee self-service portal**: new `EMPLOYEE` role; a login can be
  linked to one employee (`users.employeeId`). Employees sign in to a scoped
  `/me/*` portal — own profile (limited self-edit), payslips, attendance, leave
  balances + requests — and reporting managers get a team approvals inbox.
- **Phase 5 — Field force (MR & doctor visits)**: rep profiles + doctor/chemist
  assignment, monthly tour plans (manager-approved), daily call reports (DCR)
  capturing detailing / samples / gifts / orders (POB) / RCPA / Rx, per-rep
  sample & gift stock (balance + ledger), and compliance dashboards + 4 MR
  reports. Reps file from `/portal/field`; sales managers get `/field`.
- **Phase 6 — Patients & clinical records** (built for ~1 crore rows): patient
  master with medical history, appointment scheduling, clinical visits (vitals /
  diagnosis / notes), prescriptions, lab tests, and a patient billing ledger
  (running-balance statement). New roles `RECEPTION` (front desk) and `CLINICIAN`
  (doctor login via `users.doctorId`); 6 Clinical reports; `patients` added to
  the bulk-import pipeline.
- **Phase 7 — Pharmacy & inventory**: a drug / consumable master with
  **batch + expiry (FEFO) stock**, goods-receipt notes (GRN) from suppliers
  (draft → post creates batches, a stock-in movement, updates drug MRP/cost and
  a **supplier payables ledger**), FEFO dispensing against a patient's
  prescription (decrements the earliest-expiry batches and posts a `PHARMACY`
  invoice on the patient's billing ledger; cancel restores stock and voids the
  charge), a signed stock-movement ledger, low-stock + expiry alerts, a cached
  dashboard, 6 Pharmacy reports, and `drugs` added to the bulk-import pipeline.
  New role `PHARMACIST`.
- **Phase 8 — Statutory payroll (India)**: the monthly pay run now computes
  **Provident Fund** (employee 12% of PF wages; employer 12% split into EPS +
  EPF, plus EDLI + admin; ₹15,000 ceiling with a per-employee "actual wage"
  override), **ESI** (auto ≤ ₹21,000 gross; 0.75% / 3.25%), **Professional Tax**
  (per-employee state slab, 6 states seeded incl. Maharashtra's February rate),
  and **TDS** (old + new regime slab engines; each employee files an FY
  investment declaration on the portal; monthly TDS = projected annual liability
  − YTD, spread over the remaining months). Employer contributions show as their
  own payslip section and roll into a monthly CTC. DB-backed, effective-dated,
  editable rate/slab config. 6 compliance reports (PF ECR, ESI statement, PT
  challan, Form 24Q, tax-computation sheet, employer cost summary).
- **Phase 9 — Geofenced punch in/out**: employees mark their own attendance from
  the self-service portal — **punch in / start break / end break / punch out**,
  each accepted only when the browser's location is within an HR-managed office
  **geofence** (default 200 m; nearest active office wins). The day's
  `attendance_records` row is rebuilt from the punch log — `worked = last-out −
  first-in − breaks`; `≥ half-day hours` (config, default 4) → `PRESENT`, else
  `HALF_DAY`; `ON_LEAVE` / `HOLIDAY` / `WEEK_OFF` days are never overwritten. A
  **regularization** request (missed punch → propose in/out times + reason) is
  approved by the employee's reporting manager in the same portal inbox as
  leave; HR sees and can act on everything from the Attendance page.

## Stack

| Layer    | Tech |
|----------|------|
| Backend  | NestJS 11, TypeORM 0.3, MySQL 8 |
| Frontend | React 19, MUI, Vite, TanStack Query |
| Auth     | JWT (bearer), role-based guards |

Roles: `SUPER_ADMIN`, `FINANCE`, `SALES_MANAGER`, `DATA_ENTRY`, `HR_ADMIN`,
`HR_MANAGER`, `EMPLOYEE`, `RECEPTION`, `CLINICIAN`, `PHARMACIST`, `VIEWER`. HR
data (employees / attendance / leave / payroll) is visible only to `SUPER_ADMIN`,
`HR_ADMIN`, `HR_MANAGER` and `FINANCE`; statutory rate/slab config and tax-
declaration locking are `SUPER_ADMIN` / `HR_ADMIN` only. Patient / clinical data is visible only
to `SUPER_ADMIN`, `RECEPTION` and `CLINICIAN`; `RECEPTION` owns the patient
master + scheduling + billing, `CLINICIAN` owns visits / prescriptions / labs.
Pharmacy data is readable by `SUPER_ADMIN`, `PHARMACIST`, `RECEPTION` and
`CLINICIAN`; only `SUPER_ADMIN` and `PHARMACIST` write it. `EMPLOYEE` is in *no*
privileged list — its only surface is `/auth/*` and `/me/*`.

## Running locally

```bash
# 1. Database
docker compose up -d mysql            # MySQL 8 on localhost:3309, db alkem_portal

# 2. Backend
cd backend
cp .env.example .env                  # adjust if needed
npm install
npm run migration:run                 # create schema
npm run seed                          # demo users (admin@alkem.local / ChangeMe123!)
npm run start:dev                     # API on http://localhost:3005/api

# 3. Frontend
cd ../frontend
npm install
npm run dev                           # http://localhost:5173
```

### Load-test data

```bash
cd backend
SEED_CUSTOMERS=200000 SEED_PAYMENTS_PER_CUSTOMER=5 npm run seed
```

Generates 200k customers + 1M payments via chunked bulk inserts, then recomputes
every outstanding balance in one `UPDATE ... JOIN`.

```bash
SEED_EMPLOYEES=500 SEED_ATTENDANCE=1 npm run seed
```

Generates 500 employees, one active salary structure each, current-year leave
balances, and a full month of attendance rows.

## Performance design

- **BIGINT auto-increment PKs** on `customers` / `payments` — compact, append-only
  clustered indexes and cheap joins. (`users` stays UUID; low volume.)
- **Every list endpoint is paginated.** Keyset (`?cursor=`) for infinite scroll —
  O(1) at any depth; capped offset (`?page=`, max 200) for "jump to page".
- **Search uses a MySQL `FULLTEXT` index** on `customers.name` with
  `MATCH ... AGAINST` in boolean mode (prefix match); short tokens fall back to a
  prefix `LIKE`. Never `LIKE '%term%'`.
- **`customers.outstandingBalance` is denormalised** and maintained inside the
  same transaction as each payment write (customer row locked
  `FOR UPDATE`). No `SUM(payments)` per customer. `recomputeAllOutstanding()` /
  `recomputeOutstandingForIds()` rebuild it after imports.
- **Bulk import** streams the file (`csv-parse` / `exceljs`), validates rows, and
  writes 1000-row `INSERT ... ON DUPLICATE KEY UPDATE` chunks; a failed chunk
  retries row-by-row to isolate bad rows.
- **Cached aggregates** — dashboard + period summary go through an in-memory
  cache (`@nestjs/cache-manager`, 60s TTL).
- gzip compression, lean list DTOs, connection pool sized via `DB_POOL_SIZE`.
- Schema changes go through **TypeORM migrations** (`synchronize` is always off).

## Deployment

Live at **https://medical.fleecams.com**, on VPS `76.13.223.106` (pm2 process
`alkem-hrms-api`, port 3010, MySQL locally, nginx serving `frontend/dist` +
proxying `/api`).

Auto-deploy is poll-based, not GitHub Actions: `/opt/alkem-hrms/repo` on the box
is a real `git clone` (read-only deploy key), and a cron job runs
`/opt/alkem-hrms/auto-deploy.sh` every 2 minutes. When `origin/main` has moved,
it pulls, rebuilds whichever of `backend`/`frontend` actually changed, runs
pending TypeORM migrations, restarts pm2, and reloads nginx — silently, when
there's nothing new. **Every push to `main` is live within ~2 minutes,
automatically.** Deploy log: `/opt/alkem-hrms/shared/logs/auto-deploy.log`.

## API surface

```
POST   /api/auth/login
GET    /api/health

GET    /api/customers            ?q&type&status&city&limit&page|cursor
GET    /api/customers/search     ?q&limit
GET    /api/customers/:id
POST   /api/customers
PATCH  /api/customers/:id
DELETE /api/customers/:id        (soft delete)

GET    /api/payments            ?customerId&kind&method&status&from&to&limit&page|cursor
GET    /api/payments/summary    ?from&to&groupBy=day|month
GET    /api/payments/dashboard
POST   /api/payments
PATCH  /api/payments/:id/status
GET    /api/customers/:id/payments
GET    /api/customers/:id/statement   ?from&to        (running balance)

POST   /api/imports/:entity     entity = customers | payments | employees | attendance | patients | drugs
GET    /api/imports/:jobId

GET    /api/users  ·  POST /api/users  ·  PATCH /api/users/:id/(de)activate

--- Phase 2 (HR) --------------------------------------------------------

GET    /api/departments  ·  POST  ·  PATCH /:id  ·  DELETE /:id

GET    /api/employees            ?q&departmentId&status&employmentType&limit&page|cursor
GET    /api/employees/search     ?q&limit
GET    /api/employees/:id  ·  POST  ·  PATCH /:id  ·  DELETE /:id (soft)

GET    /api/attendance           ?employeeId&departmentId&from&to
PUT    /api/attendance           mark one { employeeId, date, status }
GET    /api/attendance/summary   ?periodMonth&departmentId
GET    /api/attendance/holidays  ·  POST  ·  DELETE /:id
GET    /api/employees/:id/attendance      ?periodMonth   (month grid)

GET    /api/leave/types  ·  POST  ·  PATCH /:id
POST   /api/leave/grant-quota    { year }
GET    /api/leave/requests       ?employeeId&status
POST   /api/leave/requests       { employeeId, leaveTypeId, fromDate, toDate }
POST   /api/leave/requests/:id/decide  { decision: APPROVED|REJECTED|CANCELLED }
GET    /api/employees/:id/leave-balances  ?year

GET    /api/payroll/components  ·  POST  ·  PATCH /:id  ·  DELETE /:id
GET    /api/payroll/employees/:id/structure          (active)
POST   /api/payroll/employees/:id/structure          { effectiveFrom, basicMonthly, lines[] }
GET    /api/payroll/employees/:id/payslips
GET    /api/payroll/runs  ·  GET /runs/:id
POST   /api/payroll/runs        { periodMonth: "YYYY-MM" }
POST   /api/payroll/runs/:id/process | approve | mark-paid
DELETE /api/payroll/runs/:id    (cancel)
GET    /api/payroll/runs/:id/payslips   ?limit&page
GET    /api/payroll/payslips/:id        (with component lines)
GET    /api/payroll/dashboard

GET    /api/doctors             ?q&speciality&city&status&limit&page|cursor
GET    /api/doctors/search  ·  GET /:id  ·  POST  ·  PATCH /:id  ·  DELETE /:id (soft)

--- Phase 3 (Reports) -------------------------------------------------

GET    /api/reports                       catalog the caller's role may run (+ param metadata)
GET    /api/reports/:key?format=json|csv|xlsx&<params>
       json  -> { columns, rows, meta } (preview capped at 500 rows)
       csv   -> UTF-8 BOM download        xlsx -> ExcelJS workbook download
       export caps at 100 000 rows -> 400 "add filters"

--- Phase 4 (Self-service portal) ----------------------------------

POST   /api/users            { ..., role:"EMPLOYEE", employeeId }   link a login to an employee (SUPER_ADMIN / HR_ADMIN)
PATCH  /api/users/:id/employee { employeeId }                       link/relink

GET    /api/me                              own employee profile
PATCH  /api/me/profile                      self-edit: phone + bank fields only
GET    /api/me/payslips  ·  GET /me/payslips/:id (ownership-checked)
GET    /api/me/attendance?periodMonth       own month grid
GET    /api/me/leave-balances?year
GET    /api/me/leave-requests
POST   /api/me/leave-requests { leaveTypeId, fromDate, toDate }
POST   /api/me/leave-requests/:id/cancel
GET    /api/me/team                          direct reports (reportingManagerId = me)
GET    /api/me/approvals                     pending team leave requests
POST   /api/me/approvals/:id/decide { decision }
GET    /api/me/team/:employeeId/attendance?periodMonth
```

All `/me/*` routes resolve the target from the JWT's `employeeId` (no id in the
URL to spoof); detail routes re-check ownership; a login with no linked employee
gets 403.

--- Phase 5 (Field force) --------------------------------------------

GET   /api/field/reps                     (SUPER_ADMIN / SALES_MANAGER / HR_ADMIN)
GET   /api/field/reps/me                  own rep profile or 404
PUT   /api/field/reps/:employeeId         { hq, territory, active }
POST  /api/field/reps/assign             { entityType:DOCTOR|CUSTOMER, entityId, repEmployeeId }
GET   /api/field/promo-items · POST · PATCH /:id
GET   /api/field/stock?repEmployeeId              balances (role-scoped)
GET   /api/field/stock/movements?repEmployeeId&from&to
POST  /api/field/stock/issue            { repEmployeeId, lines:[{promoItemId,qty}] }
GET   /api/field/tour-plans?repEmployeeId&periodMonth&status
GET   /api/field/tour-plans/:id
POST  /api/field/tour-plans             { periodMonth }
PUT   /api/field/tour-plans/:id/days    { days:[{planDate,area,plannedCalls}] }
POST  /api/field/tour-plans/:id/submit
POST  /api/field/tour-plans/:id/decide  { decision:APPROVED|REJECTED, note }
GET   /api/field/call-reports?repEmployeeId&from&to&kind&limit&cursor
GET   /api/field/call-reports/:id
POST  /api/field/call-reports           full DCR (products / rcpa / rx lines)
GET   /api/field/dashboard?periodMonth&repEmployeeId   self / team / all
```

`/field/*` scopes by role: `SUPER_ADMIN` / `SALES_MANAGER` see any rep; a linked
employee sees only their own data; a reporting manager may act for a direct
report. SAMPLE/GIFT lines on a DCR decrement `rep_stock.balance` in the same
transaction (ledger in `stock_movements`); negative balances are allowed and
flagged in `mr-sample-account`. New reports: `mr-call-report`,
`mr-tour-compliance`, `mr-pob-summary`, `mr-sample-account` (Field category).

--- Phase 6 (Patients) ----------------------------------------------

GET  /api/patients            ?q&assignedDoctorId&status&city&limit&page|cursor  (CLINIC_READ)
     q that is mostly digits -> phone index; otherwise FULLTEXT on name
GET  /api/patients/search  ·  GET /:id  ·  POST  ·  PATCH /:id  ·  DELETE /:id (soft)
GET  /api/patients/:id/medical-history
GET  /api/patients/:id/{appointments,visits,prescriptions,labs,charges,statement?from&to}
POST /api/patients/:id/charges   { kind:INVOICE|PAYMENT|REFUND|ADJUSTMENT, amount, serviceKind?, chargeDate }

GET  /api/appointments        ?doctorId&patientId&from&to&status&mine&limit&cursor
GET  /api/appointments/{calendar?doctorId&from&to, dashboard}
POST /api/appointments        { patientId, doctorId, scheduledAt, type, reason }   (CLINIC_DESK)
PATCH /api/appointments/:id/status  { status, cancelReason? }   (guarded transitions)
POST /api/appointments/:id/complete { createVisit?, diagnosis, ... }   (CLINIC_WRITE)

POST /api/visits              walk-in encounter (+ medicines[] + labs[])   (CLINIC_WRITE)
GET  /api/visits/:id          (+ prescription items + labs)
POST /api/visits/:id/prescriptions   ·   POST /api/labs   ·   PATCH /api/labs/:id/result

GET  /api/patient-billing/dashboard   ·   PATCH /api/patient-charges/:id/status
```

`CLINICIAN` logins are linked via `users.doctorId` (like `users.employeeId` for
staff); `?mine=1` on `/appointments` forces the caller's own doctor (403 if
unlinked). Patient billing is a single `patient_charges` ledger +
`patients.outstandingBalance` (tx-maintained, row-locked) + a running-balance
statement — the same design as the pharma payments module. `patients` /
`appointments` / `visits` / `patient_charges` each carry one date column so
`PARTITION BY RANGE(<date>)` is a later pure-DDL step. New reports:
`patient-register`, `appointment-register`, `doctor-productivity`,
`patient-outstanding-ageing`, `clinic-revenue`, `prescriptions-issued`
(Clinical category).

--- Phase 7 (Pharmacy) --------------------------------------------

GET  /api/pharmacy/drugs          ?q&form&isActive&limit&page|cursor   (PHARMACY_READ)
GET  /api/pharmacy/drugs/stock    per-drug on-hand + reorder flag + stock value
GET  /api/pharmacy/drugs/search  ·  GET /:id  ·  POST  ·  PATCH /:id  ·  DELETE /:id (soft)
GET  /api/pharmacy/drugs/:id/{batches, movements?from&to}

GET  /api/pharmacy/suppliers  ·  GET /:id  ·  GET /:id/payments  ·  POST  ·  PATCH /:id
POST /api/pharmacy/suppliers/:id/payments   { amount, method?, reference?, paidAt }  (payable down)

GET  /api/pharmacy/grns           ?supplierId&status&limit&cursor   ·   GET /:id (+ items)
POST /api/pharmacy/grns           { supplierId, invoiceNo?, invoiceDate?, receivedDate }  -> DRAFT + grnNo
PUT  /api/pharmacy/grns/:id/items { items:[{drugId,batchNo,expiryDate,quantity,freeQuantity?,purchasePrice,mrp,gstRate?}] }  (DRAFT only)
POST /api/pharmacy/grns/:id/post   ·   POST /api/pharmacy/grns/:id/cancel   (DRAFT only)

GET  /api/pharmacy/dispenses      ?patientId&from&to&limit&cursor   ·   GET /:id (+ items)
GET  /api/pharmacy/dispenses/prescription/:rxId/items    prefill helper (fuzzy drug-master match)
POST /api/pharmacy/dispenses      { patientId, prescriptionId?, visitId?, lines:[{drugId,quantity,discount?}] }
POST /api/pharmacy/dispenses/:id/cancel   (returns stock, voids the PHARMACY charge)

GET  /api/pharmacy/dashboard   ·   GET /api/pharmacy/alerts   (low-stock + expiring-soon, cached 60s)
```

Every receipt is a `drug_batches` row (own batch no / expiry / MRP / cost);
`quantityOnHand` is denormalised and folded transactionally by
`pharmacy_stock_movements` (signed ledger, batch row locked `FOR UPDATE`).
Dispensing calls `allocateFefo()` — `drug_batches WHERE quantityOnHand > 0 AND
expiryDate >= CURDATE()` ordered by `expiryDate ASC`, greedily split across
batches, `400` if short. A dispense posts an `INVOICE` `patient_charges` row
(`serviceKind = PHARMACY`) via the Phase 6 billing service; cancelling flips it
to `CANCELLED` (which reverses `patients.outstandingBalance`). Posting a GRN adds
its total to `suppliers.outstandingPayable`; `supplier_payments` settle it.
`drug_batches` / `pharmacy_stock_movements` / `dispenses` carry a single date
column for later `PARTITION BY RANGE`. New reports: `pharmacy-stock`,
`expiry-report`, `dispense-register`, `purchase-register`, `drug-movement`,
`supplier-outstanding` (Pharmacy category). Seed adds `pharmacist@alkem.local`,
~15 drugs, 2 suppliers, one posted GRN and one dispense.

--- Phase 8 (Statutory payroll) -----------------------------------

GET  /api/payroll/statutory/config              ·  PUT (HR_WRITE)   effective-dated rates/ceilings
GET  /api/payroll/statutory/pt-slabs            ·  POST · PATCH /:id · DELETE /:id  (HR_WRITE)
GET  /api/payroll/statutory/it-slabs?fy&regime  ·  PUT   { regime, financialYear, effectiveFrom, rows[] }
GET  /api/payroll/employees/:id/statutory       ·  PUT   { pfApplicable, pfUsesActualWage, esiApplicable, ptStateCode, uanNumber, ... }
GET  /api/payroll/employees/:id/tax-declaration?fy   ->  { declaration, projection, regimeComparison }
PUT  /api/payroll/employees/:id/tax-declaration?fy   { regime, deduction80C, deduction80D, deduction80CCD1B, hraRentPaid, homeLoanInterest, metroCity, status? }  (HR may LOCK)
GET  /api/payroll/payslips/:id                  now returns `statutory` + EMPLOYER_CONTRIBUTION lines

GET  /api/me/tax-declaration?fy                 self-service: declaration + projection + old/new comparison
PUT  /api/me/tax-declaration?fy                 employee submits (never LOCK)
```

`processRun` loads the active `statutory_configs` row, all `pt_slabs` /
`income_tax_slabs`, and per-employee `employee_statutory_profiles` +
`tax_declarations` once, then for each employee appends engine-owned DEDUCTION
lines (`EPF`, `ESI`, `PT`, `TDS`) and `EMPLOYER_CONTRIBUTION` lines (`EPF_ER`,
`EPS_ER`, `EDLI_ER`, `EPF_ADMIN`, `ESI_ER`) — any manual structure line with one
of these codes (or legacy `PF`) is dropped. `netPay = Σ EARNING − Σ DEDUCTION`
(employer lines never touch it); `ctcMonthly = grossEarnings +
employerContributions`. A `payslip_statutory` row (1:1) snapshots the wage
bases, employer split, NCP days and the tax projection so ECR / ESI / 24Q /
tax-computation reports never recompute. TDS is projected as `ytd.grossPaid +
grossEarnings × monthsRemaining`, run through `TaxService.computeAnnualTax`
(old-regime HRA exemption + std deduction + PT + 80C/80D/80CCD(1B)/home-loan +
87A rebate ≤ ₹5L; new-regime std deduction + 87A ≤ config limit), then
`(annualTax − ytd.tdsPaid) / monthsRemaining`. New reports: `pf-ecr`,
`esi-contribution`, `pt-challan`, `form-24q`, `tax-computation`,
`statutory-cost-summary` (Payroll category). Seed adds `statutory_configs` +
PT/IT slabs for the current FY and a profile + DRAFT declaration per employee.

```
Reports: `payroll-register`, `bank-transfer`, `salary-component-summary`,
`attendance-register`, `leave-balance`, `employee-master`, `joiners-exits`,
`payment-register`, `daily-collection`, `customer-ageing`, `customer-statement`,
`customer-master`, `doctor-master`. Each is a bounded, index-backed raw query;
role-gated per category. Add one by appending an entry to
`backend/src/reports/report-definitions.ts`.

### Payroll model

Salary structure = `basicMonthly` + component lines, each `FIXED` or
`PERCENT_OF_BASIC` (statutory codes are rejected — the engine owns them). A pay
run, for every ACTIVE employee with an active structure, shows earnings at full
value, then a single `LOP` deduction line = `grossEarnings × lopDays /
daysInMonth` (`lopDays` = `ABSENT` days + days on an **unpaid** leave type),
then the Phase 8 statutory deduction + employer-contribution lines. `netPay =
grossEarnings − totalDeductions` (DEDUCTION lines only). All money math is exact
(integer paise); `percentOfPaise` / `roundToRupeePaise` / `ceilToRupeePaise`
live in `common/utils/money.util.ts`.

### Punch / geofence (Phase 9)

```
GET  /api/attendance/offices      ·  POST · PATCH /:id · DELETE /:id   (HR)
GET  /api/attendance/settings     ·  PUT /api/attendance/settings      (HR)
GET  /api/attendance/events?employeeId&from&to                          (HR)
GET  /api/attendance/regularizations?status&employeeId                  (HR)
POST /api/attendance/regularizations/:id/decide  { decision, note? }    (HR_MANAGE)

GET  /api/me/punch/status?date=YYYY-MM-DD        -> { state, since, office, events[], workedMinutes, breakMinutes, status }
POST /api/me/punch   { type: PUNCH_IN|PUNCH_OUT|BREAK_START|BREAK_END, latitude, longitude, accuracyM?, localDate, note? }
GET  /api/me/regularizations                     ·  POST  { date, inAt, outAt, reason }  ·  POST /:id/cancel
GET  /api/me/regularization-approvals            ·  POST /api/me/regularizations/:id/decide  { decision, note? }
```

`office_locations` (lat/lng + `radiusMeters`) drive the geofence — `PunchService`
runs a JS haversine against every active office and rejects a punch (`403` with
the distance) unless the nearest is within its radius. `attendance_events` is an
append-only log (`PUNCH_IN`/`PUNCH_OUT`/`BREAK_START`/`BREAK_END`, coords, matched
office, `withinGeofence`); a valid transition is enforced
(OUT→IN→[BREAK]→OUT). `recomputeDay` rebuilds the day's `attendance_records` row
(`firstInAt` / `lastOutAt` / `breakMinutes` / `workedHours` / status) after every
punch and skips `ON_LEAVE`/`HOLIDAY`/`WEEK_OFF` rows. Regularization mirrors the
leave request→`decide` flow (`RegularizationService`) — on approval the day's row
is written from the requested times (`source = REGULARIZED`) plus two synthetic
events. `app_settings` (single row) holds `punchHalfDayHours` / `punchFullDayHours`
/ `defaultGeofenceMeters`. Seed adds 2 offices + the settings row. In the UI, a
punch widget sits in the app header for every employee-linked login, and
**HR → Offices** (`/offices`, `HR_WRITE_ROLES`) is the geofence + rules editor.

Sample import files: `backend/sample-data/*.sample.csv`.
