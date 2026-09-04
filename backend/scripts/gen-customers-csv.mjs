// Generate a customers CSV for the Imports module — every column populated.
//
//   node backend/scripts/gen-customers-csv.mjs [rows] [outFile]
//   node backend/scripts/gen-customers-csv.mjs 10000 sample-data/customers-10000.csv
//
// Headers are the canonical importer field names; the importer also matches
// loose variants. All 15 columns are filled on every row (no blanks). Pools are
// comma-free — values land in unquoted CSV columns.
import { createWriteStream } from 'node:fs';
import { argv, stdout } from 'node:process';

const rows = Number(argv[2] ?? 10_000);
const outFile = argv[3] ?? `sample-data/customers-${rows}.csv`;

const TYPES = ['CHEMIST', 'STOCKIST', 'HOSPITAL', 'DOCTOR', 'INSTITUTION', 'INDIVIDUAL'];
const TYPE_SUFFIX = {
  CHEMIST: ['Medical Store', 'Medicos', 'Chemist & Druggist', 'Pharmacy'],
  STOCKIST: ['Pharma Distributors', 'Agencies', 'Enterprises', 'Marketing'],
  HOSPITAL: ['Hospital', 'Multispeciality Hospital', 'Nursing Home', 'Healthcare'],
  DOCTOR: ['Clinic', 'Polyclinic', 'Consulting Rooms', 'Care Centre'],
  INSTITUTION: ['Trust', 'Foundation', 'Charitable Society', 'Institute'],
  INDIVIDUAL: ['', '', '', ''],
};
const NAME1 = [
  'Rajesh', 'Priya', 'Sunrise', 'City', 'Apollo', 'Lifeline', 'Green Cross', 'Wellness',
  'Sanjeevani', 'Aarogya', 'Nova', 'Prime', 'Metro', 'Shree', 'Krishna', 'Sai',
  'Ganga', 'Lotus', 'Sterling', 'Unity', 'Guardian', 'Trust', 'Care Plus', 'Medicare',
];
const NAME2 = [
  'Sharma', 'Patel', 'Iyer', 'Reddy', 'Nair', 'Deshmukh', 'Kulkarni', 'Rao', 'Gupta',
  'Menon', 'Joshi', 'Pillai', 'Bose', 'Das', 'Naidu', 'Shetty', 'Hegde', 'Verma',
];
const CITIES = [
  ['Mumbai', 'Maharashtra', 'MH', '400001'], ['Pune', 'Maharashtra', 'MH', '411001'],
  ['Nagpur', 'Maharashtra', 'MH', '440001'], ['Delhi', 'Delhi', 'DL', '110001'],
  ['Bengaluru', 'Karnataka', 'KA', '560001'], ['Mysuru', 'Karnataka', 'KA', '570001'],
  ['Chennai', 'Tamil Nadu', 'TN', '600001'], ['Coimbatore', 'Tamil Nadu', 'TN', '641001'],
  ['Hyderabad', 'Telangana', 'TS', '500001'], ['Kolkata', 'West Bengal', 'WB', '700001'],
  ['Ahmedabad', 'Gujarat', 'GJ', '380001'], ['Surat', 'Gujarat', 'GJ', '395001'],
  ['Jaipur', 'Rajasthan', 'RJ', '302001'], ['Lucknow', 'Uttar Pradesh', 'UP', '226001'],
  ['Kochi', 'Kerala', 'KL', '682001'], ['Indore', 'Madhya Pradesh', 'MP', '452001'],
];
const GST_STATE = {
  MH: '27', DL: '07', KA: '29', TN: '33', TS: '36', WB: '19',
  GJ: '24', RJ: '08', UP: '09', KL: '32', MP: '23',
};
const ROADS = ['MG', 'Station', 'Gandhi', 'Nehru', 'Market', 'Hospital', 'College', 'Ring'];
const LANDMARKS = ['Bus Stand', 'Railway Station', 'Civil Hospital', 'Main Market', 'Clock Tower', 'Old Post Office'];
const STATUS = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'INACTIVE', 'BLOCKED'];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const pad = (n, w) => String(n).padStart(w, '0');
const pick = (a, i) => a[((i % a.length) + a.length) % a.length];

// Plausible 15-char GSTIN: <2 state><5 alpha><4 digit><1 alpha><1 entity>Z<1 check>.
function gstin(i, stateAbbr) {
  const sc = GST_STATE[stateAbbr] ?? '27';
  const p =
    pick(LETTERS, i * 3) + pick(LETTERS, i * 5 + 1) + pick(LETTERS, i * 7 + 2) +
    pick(LETTERS, i * 11 + 3) + pick(LETTERS, i * 13 + 4) +
    pad(1000 + (i % 9000), 4) + pick(LETTERS, i * 17 + 5);
  const check = LETTERS[i % 26] || '0';
  return `${sc}${p}1Z${check}`;
}

const HEADERS =
  'code,name,type,phone,email,gstin,addressLine1,addressLine2,city,state,' +
  'pincode,territory,assignedRepId,creditLimit,status\n';

const out = createWriteStream(outFile, { encoding: 'utf8', highWaterMark: 1 << 20 });
out.write(HEADERS);

let i = 0;
function writeBatch() {
  let ok = true;
  while (i < rows && ok) {
    const type = pick(TYPES, i);
    const [city, state, abbr, basePin] = pick(CITIES, i * 3 + 1);
    const n1 = pick(NAME1, i * 5 + 2);
    const n2 = pick(NAME2, i * 9 + 4);
    const suffix = pick(TYPE_SUFFIX[type], i);
    const name =
      type === 'INDIVIDUAL'
        ? `${n1} ${n2}`
        : `${n1} ${n2} ${suffix}`.trim();
    const pin = `${basePin.slice(0, 2)}${pad((i % 89) + 10, 2)}${pad((i * 7) % 90 + 10, 2)}`.slice(0, 6);
    const creditLimit = 20000 + (i % 60) * 15000; // 20k .. 905k
    const line =
      `CUST${pad(i + 1, 6)},${name},${type},` +
      `9${pad(100000000 + (i % 899999999), 9)},` +
      `${n1.toLowerCase().replace(/ /g, '')}.${n2.toLowerCase()}${i}@example.com,` +
      `${gstin(i, abbr)},` +
      `${(i % 400) + 1} ${pick(ROADS, i)} Road,` +
      `Near ${pick(LANDMARKS, i)} - ${city} ${abbr}-${pad((i % 30) + 1, 2)} area,` +
      `${city},${state},${pin},${abbr}-${pad((i % 30) + 1, 2)},` +
      `REP-${pad((i % 40) + 1, 3)},${creditLimit},${pick(STATUS, i)}\n`;
    ok = out.write(line);
    i += 1;
    if (i % 2000 === 0) stdout.write(`\r${i.toLocaleString()} / ${rows.toLocaleString()} rows`);
  }
  if (i < rows) out.once('drain', writeBatch);
  else out.end(() => stdout.write(`\rdone — ${i.toLocaleString()} rows -> ${outFile}\n`));
}
writeBatch();
