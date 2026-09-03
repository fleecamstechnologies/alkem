// Generate a "patient history" (visits) CSV for the Imports module.
//
//   node backend/scripts/gen-visits-csv.mjs [patientRows] [outFile] [doctorCount] [minVisits] [maxVisits] [mode]
//
//   # ~7M rows (2-3 visits/patient never exceeds the 512 MB import cap in `lean` mode)
//   node backend/scripts/gen-visits-csv.mjs 2000000 sample-data/visits-7000000.csv 30000 3 4 lean
//   # rich 25k-patient sample (all clinical columns)
//   node backend/scripts/gen-visits-csv.mjs 25000 sample-data/visits-25000.csv 30000 1 5 full
//
// Each patient gets minVisits..maxVisits encounters, spread across the last
// ~10 years. References patients by `patientCode` (UHT00000001..) and doctors by
// `doctorCode` (DOCT000001..) — load the patients and doctors files first. The
// importer upserts on (patientId, visitDate), so re-importing is idempotent.
//
// mode:
//   lean  - patientCode,doctorCode,visitDate,visitType only (~45 B/row; use for
//           multi-million-row files so one CSV stays under the 512 MB cap)
//   full  - every clinical column (chief complaint, vitals, diagnosis, ICD,
//           notes, follow-up) — ~185 B/row
import { createWriteStream } from 'node:fs';
import { argv, stdout } from 'node:process';

const patients = Number(argv[2] ?? 25_000);
const outFile = argv[3] ?? `sample-data/visits-${patients}.csv`;
const DOCTORS = Number(argv[4] ?? 30_000);
const MIN_V = Math.max(1, Number(argv[5] ?? 1));
const MAX_V = Math.max(MIN_V, Number(argv[6] ?? 5));
const MODE = (argv[7] ?? 'full').toLowerCase() === 'lean' ? 'lean' : 'full';

// All pools are comma-free — values land in unquoted CSV columns.
const VISIT_TYPE = ['OPD', 'OPD', 'OPD', 'OPD', 'TELE', 'TELE', 'IPD', 'EMERGENCY'];
const COMPLAINT = [
  'Fever and body ache', 'Dry cough for 3 days', 'Follow-up for hypertension',
  'Routine diabetes review', 'Headache and giddiness', 'Lower back pain',
  'Sore throat', 'Acidity and bloating', 'Knee pain on walking',
  'Skin rash on forearm', 'Breathlessness on exertion', 'General health check',
];
const DIAGNOSIS = [
  'Viral upper respiratory infection', 'Essential hypertension - controlled',
  'Type 2 diabetes mellitus - stable', 'Acute pharyngitis', 'Migraine without aura',
  'Mechanical low back pain', 'Gastro-oesophageal reflux disease',
  'Osteoarthritis of knee', 'Allergic contact dermatitis', 'No acute illness',
];
const ICD = ['J06.9', 'I10', 'E11.9', 'J02.9', 'G43.909', 'M54.5', 'K21.9', 'M17.9', 'L23.9', 'Z00.0'];
const NOTES = [
  'Advised rest and oral fluids; review if not improving in 5 days',
  'Continue current medication; BP and sugar log to be maintained',
  'Reassurance given; lifestyle and diet counselling done',
  'Prescribed short analgesic course; physiotherapy referral made',
  'Vitals stable; no red-flag symptoms noted today',
];

const pad = (n, w) => String(n).padStart(w, '0');
const pick = (a, i) => a[((i % a.length) + a.length) % a.length];
const DAY = 86_400_000;
const END = Date.now();
const START = END - Math.round(365.25 * 10) * DAY; // ~10 years ago
const SPAN_DAYS = Math.round((END - START) / DAY);
const ymd = (ms) => new Date(ms).toISOString().slice(0, 10);

const HEADERS =
  MODE === 'lean'
    ? 'patientCode,doctorCode,visitDate,visitType\n'
    : 'patientCode,doctorCode,visitDate,visitType,chiefComplaint,bpSystolic,' +
      'bpDiastolic,pulse,temperature,weightKg,heightCm,spo2,bmi,diagnosis,' +
      'icdCodes,clinicalNotes,followUpDate\n';

const out = createWriteStream(outFile, { encoding: 'utf8', highWaterMark: 1 << 20 });
out.write(HEADERS);

function line(p, v, n, heightCm) {
  const g = p * 11 + v;
  const pcode = `UHT${pad(p + 1, 8)}`;
  const dcode = `DOCT${pad(((p + v * 9973) % DOCTORS) + 1, 6)}`;
  // Spread the patient's visits across the whole 10-year window (v/(n-1): first
  // ~START, last ~END), with jitter up to ~60% of the inter-visit gap so the
  // dates form a continuous spread rather than fixed bands. Then clamp.
  const frac = n === 1 ? 0.15 + (p % 70) / 100 : v / (n - 1);
  const gap = (SPAN_DAYS - 1) / Math.max(1, n - 1);
  const jr = Math.max(1, Math.floor(0.6 * gap));
  const jitter = ((p * 2654435761 + v * 40503) % jr) - (jr >> 1);
  let off = Math.round(frac * (SPAN_DAYS - 1)) + jitter;
  if (off < 0) off = (p + v) % 30;
  if (off > SPAN_DAYS - 1) off = SPAN_DAYS - 1 - ((p + v) % 30);
  const hh = pad(8 + ((p + v) % 10), 2);
  const mm = pad((p * 7 + v * 11) % 60, 2);
  const visitDate = `${ymd(START + off * DAY)} ${hh}:${mm}`;
  const vtype = pick(VISIT_TYPE, g);
  if (MODE === 'lean') return `${pcode},${dcode},${visitDate},${vtype}\n`;

  const weightKg = 48 + (g % 47) + (g % 2 ? 0.5 : 0);
  const bmi = (weightKg / (heightCm / 100) ** 2).toFixed(1);
  const temp = (97 + (g % 25) / 10).toFixed(1);
  const followUp = g % 3 === 0 ? ymd(START + (off + 14) * DAY) : '';
  return (
    `${pcode},${dcode},${visitDate},${vtype},${pick(COMPLAINT, g)},` +
    `${110 + (g % 31)},${70 + (g % 21)},${64 + (g % 32)},${temp},` +
    `${weightKg.toFixed(1)},${heightCm}.0,${95 + (g % 5)},${bmi},` +
    `${pick(DIAGNOSIS, g)},${pick(ICD, g)},${pick(NOTES, g)},${followUp}\n`
  );
}

let p = 0;
let v = 0;
let total = 0;
function writeBatch() {
  let ok = true;
  while (p < patients && ok) {
    const n = MIN_V + (p % (MAX_V - MIN_V + 1));
    const heightCm = 150 + (p % 36);
    while (v < n && ok) {
      ok = out.write(line(p, v, n, heightCm));
      v += 1;
      total += 1;
    }
    if (v >= n) {
      p += 1;
      v = 0;
      if (p % 100_000 === 0) {
        stdout.write(
          `\r${p.toLocaleString()} / ${patients.toLocaleString()} patients · ${total.toLocaleString()} visits`,
        );
      }
    }
  }
  if (p < patients) out.once('drain', writeBatch);
  else
    out.end(() =>
      stdout.write(
        `\rdone — ${total.toLocaleString()} visits for ${p.toLocaleString()} patients ` +
          `(${MODE}, ${ymd(START)}..${ymd(END)}) -> ${outFile}\n`,
      ),
    );
}
writeBatch();
