// Generate a doctors CSV for load-testing the Imports module.
//
//   node backend/scripts/gen-doctors-csv.mjs [rows] [outFile]
//   node backend/scripts/gen-doctors-csv.mjs 30000 sample-data/doctors-30000.csv
//
// Headers are the canonical field names (the importer also matches loose
// variants). Requires the `doctors` import entity (added alongside this file).
import { createWriteStream } from 'node:fs';
import { argv, stdout } from 'node:process';

const rows = Number(argv[2] ?? 30_000);
const outFile = argv[3] ?? `sample-data/doctors-${rows}.csv`;

const FIRST = [
  'Anjali','Rajesh','Suresh','Priya','Vikram','Meera','Arun','Kavita','Sanjay','Deepa',
  'Nikhil','Sunita','Rohit','Neha','Amit','Pooja','Manish','Shreya','Karan','Divya',
  'Ravi','Sneha','Ashok','Kiran','Vijay','Anita','Prakash','Rekha','Mohan','Lata',
];
const LAST = [
  'Mehta','Sharma','Iyer','Reddy','Nair','Deshmukh','Kulkarni','Rao','Gupta','Menon',
  'Joshi','Pillai','Bose','Das','Naidu','Shetty','Hegde','Patel','Verma','Bhat',
];
const SPECIALITY = [
  'General Physician','Cardiology','Orthopaedics','Paediatrics','Gynaecology',
  'Dermatology','ENT','Ophthalmology','Neurology','Gastroenterology','Pulmonology',
  'Nephrology','Endocrinology','Psychiatry','Oncology','Urology','General Surgery',
];
// No commas — these land in an unquoted CSV column.
const QUAL = [
  'MBBS','MBBS MD','MBBS MS','MBBS DNB','MBBS DM','MBBS MD DM','MBBS MS MCh',
  'MBBS DGO','MBBS DCH','MBBS MD (Med)',
];
const CITIES = [
  ['Mumbai','Maharashtra','MH-01'],['Pune','Maharashtra','MH-07'],['Nagpur','Maharashtra','MH-11'],
  ['Delhi','Delhi','DL-01'],['Bengaluru','Karnataka','KA-01'],['Mysuru','Karnataka','KA-05'],
  ['Chennai','Tamil Nadu','TN-01'],['Coimbatore','Tamil Nadu','TN-06'],['Hyderabad','Telangana','TS-01'],
  ['Kolkata','West Bengal','WB-01'],['Ahmedabad','Gujarat','GJ-01'],['Surat','Gujarat','GJ-05'],
  ['Jaipur','Rajasthan','RJ-01'],['Lucknow','Uttar Pradesh','UP-02'],['Kochi','Kerala','KL-03'],
];
const HOSPITALS = [
  'City Care Hospital','Sunrise Medical Centre','Apollo Clinic','Fortis Health',
  'Lifeline Hospital','Metro Speciality Clinic','Green Cross Hospital','Wellness Nursing Home',
  'Sanjeevani Hospital','Aarogya Multispeciality','Nova Clinic','Prime Care Centre',
];
const STATUS = ['ACTIVE','ACTIVE','ACTIVE','ACTIVE','ACTIVE','ACTIVE','ACTIVE','ACTIVE','ACTIVE','INACTIVE'];

const pad = (n, w) => String(n).padStart(w, '0');
const pick = (a, i) => a[i % a.length];

const HEADERS =
  'code,name,speciality,registrationNo,qualification,phone,email,' +
  'hospitalName,city,state,territory,status\n';

const out = createWriteStream(outFile, { encoding: 'utf8', highWaterMark: 1 << 20 });
out.write(HEADERS);

let i = 0;
function writeBatch() {
  let ok = true;
  while (i < rows && ok) {
    const fn = pick(FIRST, i * 5 + 2);
    const ln = pick(LAST, i * 9 + 4);
    const [city, state, terr] = pick(CITIES, i * 3 + 1);
    const line =
      `DOCT${pad(i + 1, 6)},Dr. ${fn} ${ln},${pick(SPECIALITY, i)},` +
      `${state.replace(/\s/g, '')}/${pad(10000 + (i % 89999), 5)}/${2005 + (i % 20)},` +
      `${pick(QUAL, i)},9${pad(600000000 + (i % 399999999), 9)},` +
      `dr.${fn.toLowerCase()}.${ln.toLowerCase()}${i}@clinic.example,` +
      `${pick(HOSPITALS, i)} ${city},${city},${state},${terr},${pick(STATUS, i)}\n`;
    ok = out.write(line);
    i += 1;
    if (i % 10_000 === 0) stdout.write(`\r${i.toLocaleString()} / ${rows.toLocaleString()} rows`);
  }
  if (i < rows) out.once('drain', writeBatch);
  else out.end(() => stdout.write(`\rdone — ${i.toLocaleString()} rows -> ${outFile}\n`));
}
writeBatch();
