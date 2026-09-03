// Generate a "patient history" (visits) CSV for the Imports module.
//
//   node backend/scripts/gen-visits-csv.mjs [patientRows] [outFile] [doctorCount] [maxVisitsPerPatient]
//   node backend/scripts/gen-visits-csv.mjs 25000 sample-data/visits-25000.csv 30000 5
//
// Emits 1..maxVisitsPerPatient encounters per patient, referencing patients by
// `patientCode` (UHT00000001..) and doctors by `doctorCode` (DOCT000001..), so
// load the patients and doctors files first. The importer upserts on
// (patientId, visitDate), so re-running an import of the same file is safe.
import { createWriteStream } from 'node:fs';
import { argv, stdout } from 'node:process';

const patients = Number(argv[2] ?? 25_000);
const outFile = argv[3] ?? `sample-data/visits-${patients}.csv`;
const DOCTORS = Number(argv[4] ?? 30_000);
const MAX_VISITS = Math.max(1, Number(argv[5] ?? 5));

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
const START = Date.UTC(2023, 0, 1);
const ymd = (d) => d.toISOString().slice(0, 10);

const HEADERS =
  'patientCode,doctorCode,visitDate,visitType,chiefComplaint,bpSystolic,' +
  'bpDiastolic,pulse,temperature,weightKg,heightCm,spo2,bmi,diagnosis,icdCodes,' +
  'clinicalNotes,followUpDate\n';

const out = createWriteStream(outFile, { encoding: 'utf8', highWaterMark: 1 << 20 });
out.write(HEADERS);

function visitLine(p, v, heightCm) {
  const g = p * 11 + v;
  const pcode = `UHT${pad(p + 1, 8)}`;
  const dcode =
    v === 0
      ? `DOCT${pad((p % DOCTORS) + 1, 6)}`
      : `DOCT${pad(((p + v * 9973) % DOCTORS) + 1, 6)}`;
  const dayOffset = (p % 700) + v * (45 + (p % 25));
  const day = new Date(START + dayOffset * 86_400_000);
  const hh = pad(9 + (v % 8), 2);
  const mm = pad((p * 7 + v * 13) % 60, 2);
  const weightKg = 48 + (g % 47) + (g % 2 ? 0.5 : 0);
  const bmi = (weightKg / (heightCm / 100) ** 2).toFixed(1);
  const temp = (97 + (g % 25) / 10).toFixed(1);
  const followUp = g % 3 === 0 ? ymd(new Date(day.getTime() + 14 * 86_400_000)) : '';
  return (
    `${pcode},${dcode},${ymd(day)} ${hh}:${mm},${pick(VISIT_TYPE, g)},` +
    `${pick(COMPLAINT, g)},${110 + (g % 31)},${70 + (g % 21)},` +
    `${64 + (g % 32)},${temp},${weightKg.toFixed(1)},${heightCm}.0,` +
    `${95 + (g % 5)},${bmi},${pick(DIAGNOSIS, g)},${pick(ICD, g)},` +
    `${pick(NOTES, g)},${followUp}\n`
  );
}

let p = 0;
let v = 0;
let total = 0;
function writeBatch() {
  let ok = true;
  while (p < patients && ok) {
    const nVisits = 1 + ((p * 7) % MAX_VISITS);
    const heightCm = 150 + (p % 36);
    while (v < nVisits && ok) {
      ok = out.write(visitLine(p, v, heightCm));
      v += 1;
      total += 1;
    }
    if (v >= nVisits) {
      p += 1;
      v = 0;
      if (p % 5_000 === 0) {
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
        `\rdone — ${total.toLocaleString()} visits for ${p.toLocaleString()} patients -> ${outFile}\n`,
      ),
    );
}
writeBatch();
