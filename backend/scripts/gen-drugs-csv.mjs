// Generate a drugs CSV for the Imports module.
//
//   node backend/scripts/gen-drugs-csv.mjs [rows] [outFile]
//   node backend/scripts/gen-drugs-csv.mjs 1000000 sample-data/drugs-1000000.csv
//
// Headers are the canonical importer field names; the importer also matches
// loose variants. Pools are comma-free — values land in unquoted CSV columns.
import { createWriteStream } from 'node:fs';
import { argv, stdout } from 'node:process';

const rows = Number(argv[2] ?? 1_000_000);
const outFile = argv[3] ?? `sample-data/drugs-${rows}.csv`;

const GENERICS = [
  'Paracetamol', 'Amoxicillin', 'Azithromycin', 'Cetirizine', 'Pantoprazole',
  'Metformin', 'Amlodipine', 'Atorvastatin', 'Losartan', 'Omeprazole',
  'Ibuprofen', 'Diclofenac', 'Ciprofloxacin', 'Levocetirizine', 'Montelukast',
  'Telmisartan', 'Glimepiride', 'Rosuvastatin', 'Clopidogrel', 'Aspirin',
  'Ranitidine', 'Domperidone', 'Ondansetron', 'Metronidazole', 'Doxycycline',
  'Cefixime', 'Levofloxacin', 'Prednisolone', 'Salbutamol', 'Budesonide',
  'Insulin Glargine', 'Ceftriaxone', 'Dextromethorphan', 'Ambroxol', 'Guaifenesin',
  'Cholecalciferol', 'Folic Acid', 'Ferrous Ascorbate', 'Calcium Carbonate',
  'Multivitamin', 'Hydrocortisone', 'Betamethasone', 'Clotrimazole', 'Mupirocin',
  'Moxifloxacin', 'Tobramycin', 'Timolol', 'Latanoprost', 'Sodium Chloride',
  'Oral Rehydration Salts',
];
const BRAND_PREFIX = [
  'Zen', 'Novo', 'Care', 'Medi', 'Cure', 'Life', 'Well', 'Bio', 'Rapid', 'Prime',
  'Uni', 'Tri', 'Max', 'Nu', 'Acti',
];

// form -> [unit, strengthPool, rackZone]
const FORMS = [
  ['TABLET', 'tablet', ['10mg', '25mg', '50mg', '100mg', '250mg', '500mg', '650mg'], 'A'],
  ['CAPSULE', 'capsule', ['100mg', '200mg', '250mg', '300mg', '500mg'], 'A'],
  ['SYRUP', 'bottle', ['60ml', '100ml', '150ml', '200ml'], 'B'],
  ['INJECTION', 'vial', ['1ml', '2ml', '5ml', '1g', '2g'], 'D'],
  ['OINTMENT', 'tube', ['10g', '15g', '20g', '30g'], 'C'],
  ['DROPS', 'bottle', ['5ml', '10ml', '15ml'], 'C'],
  ['CONSUMABLE', 'sachet', ['5g', '10g', '21g', '60000IU'], 'E'],
  ['OTHER', 'unit', ['1s', '5s', '10s'], 'F'],
];
const HSN = ['3003', '3004', '30049099', '3005', '300490', '9018'];
const GST = [12, 12, 12, 12, 5, 5, 18];
const RACK_NO = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const BOOL = (b) => (b ? 'true' : 'false');

const pad = (n, w) => String(n).padStart(w, '0');
const pick = (a, i) => a[((i % a.length) + a.length) % a.length];
const title = (s) => s[0] + s.slice(1).toLowerCase();

const HEADERS =
  'code,name,genericName,form,strength,unit,hsnCode,gstRate,mrp,' +
  'purchasePrice,reorderLevel,rackLocation,scheduleH,isActive\n';

const out = createWriteStream(outFile, { encoding: 'utf8', highWaterMark: 1 << 20 });
out.write(HEADERS);

let i = 0;
function writeBatch() {
  let ok = true;
  while (i < rows && ok) {
    const generic = pick(GENERICS, i * 7 + 3);
    const [form, unit, strengths, zone] = pick(FORMS, i);
    const strength = pick(strengths, i * 3 + 1);
    // Vary the display name so 1M rows aren't near-duplicates.
    const brand =
      i % 3 === 0
        ? `${pick(BRAND_PREFIX, i)}${generic.split(' ')[0].toLowerCase()}`
        : generic;
    const name = `${brand} ${strength} ${title(form)}`;
    const mrpPaise = 500 + ((i * 37) % 199500); // ₹5.00 .. ₹2000.00
    const mrp = (mrpPaise / 100).toFixed(2);
    const purchasePrice = ((mrpPaise * (55 + (i % 20))) / 10000).toFixed(2); // 55-74% of MRP
    const line =
      `DRG${pad(i + 1, 7)},${name},${generic},${form},${strength},${unit},` +
      `${pick(HSN, i)},${pick(GST, i)},${mrp},${purchasePrice},` +
      `${20 + (i % 281)},${zone}${pick(RACK_NO, i)},` +
      `${BOOL(i % 10 < 3)},${BOOL(i % 25 !== 0)}\n`;
    ok = out.write(line);
    i += 1;
    if (i % 100_000 === 0) {
      stdout.write(`\r${i.toLocaleString()} / ${rows.toLocaleString()} rows`);
    }
  }
  if (i < rows) out.once('drain', writeBatch);
  else out.end(() => stdout.write(`\rdone — ${i.toLocaleString()} rows -> ${outFile}\n`));
}
writeBatch();
