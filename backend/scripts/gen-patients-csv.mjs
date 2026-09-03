// Generate a large patients CSV for load-testing the Imports module.
//
//   node backend/scripts/gen-patients-csv.mjs [rows] [outFile]
//   node backend/scripts/gen-patients-csv.mjs 2000000 sample-data/patients-2000000.csv
//
// XLSX can't hold this — a worksheet maxes out at 1,048,576 rows — so the
// Imports module takes CSV (streamed, up to 512 MB). Headers below are the
// canonical field names; the importer also matches loose variants.
import { createWriteStream } from 'node:fs';
import { argv, stdout } from 'node:process';

const rows = Number(argv[2] ?? 2_000_000);
const outFile = argv[3] ?? `sample-data/patients-${rows}.csv`;

const FIRST = [
  'Aarav','Vivaan','Aditya','Vihaan','Arjun','Sai','Reyansh','Krishna','Ishaan','Rohan',
  'Ananya','Diya','Aadhya','Saanvi','Pari','Anika','Navya','Myra','Sara','Ira',
  'Rahul','Rohit','Amit','Sandeep','Vikram','Manish','Nikhil','Karan','Suresh','Ramesh',
  'Priya','Neha','Pooja','Sneha','Kavya','Meera','Shreya','Divya','Anjali','Deepa',
];
const LAST = [
  'Sharma','Verma','Patel','Reddy','Nair','Iyer','Menon','Gupta','Agarwal','Bansal',
  'Kulkarni','Deshmukh','Joshi','Chauhan','Rao','Naidu','Pillai','Das','Bose','Mukherjee',
  'Singh','Yadav','Mishra','Pandey','Shetty','Hegde','Kapoor','Malhotra','Chopra','Bhatt',
];
const CITIES = [
  ['Mumbai','Maharashtra','4000'],['Pune','Maharashtra','4110'],['Nagpur','Maharashtra','4400'],
  ['Delhi','Delhi','1100'],['Bengaluru','Karnataka','5600'],['Mysuru','Karnataka','5700'],
  ['Chennai','Tamil Nadu','6000'],['Coimbatore','Tamil Nadu','6410'],['Hyderabad','Telangana','5000'],
  ['Kolkata','West Bengal','7000'],['Ahmedabad','Gujarat','3800'],['Surat','Gujarat','3950'],
  ['Jaipur','Rajasthan','3020'],['Lucknow','Uttar Pradesh','2260'],['Kochi','Kerala','6820'],
];
const BLOOD = ['A+','A-','B+','B-','O+','O-','AB+','AB-'];
const ALLERGY = ['','','','','Penicillin','Sulfa drugs','Peanuts','Dust','Aspirin','Latex'];
const CHRONIC = ['','','','','Hypertension','Type 2 Diabetes','Asthma','Hypothyroidism','CAD','CKD stage 2'];
const STATUS = ['ACTIVE','ACTIVE','ACTIVE','ACTIVE','ACTIVE','ACTIVE','ACTIVE','ACTIVE','INACTIVE','DECEASED'];
const GENDER = ['MALE','FEMALE','MALE','FEMALE','OTHER'];

const pad = (n, w) => String(n).padStart(w, '0');
const pick = (arr, i) => arr[i % arr.length];

const HEADERS =
  'code,firstName,lastName,gender,dateOfBirth,phone,altPhone,email,bloodGroup,' +
  'maritalStatus,addressLine1,city,state,pincode,emergencyName,emergencyPhone,' +
  'registrationDate,status,allergies,chronicConditions\n';

const out = createWriteStream(outFile, { encoding: 'utf8', highWaterMark: 1 << 20 });
out.write(HEADERS);

let i = 0;
function writeBatch() {
  let ok = true;
  while (i < rows && ok) {
    const fn = pick(FIRST, i * 7 + 3);
    const ln = pick(LAST, i * 13 + 5);
    const [city, state, pin4] = pick(CITIES, i * 3 + 1);
    const yr = 1940 + (i % 71);
    const mo = pad((i % 12) + 1, 2);
    const da = pad((i % 27) + 1, 2);
    const regYr = 2023 + (i % 4);
    const phone = '9' + pad((100000000 + (i % 899999999)), 9);
    const alt = i % 4 === 0 ? '8' + pad((100000000 + ((i * 3) % 899999999)), 9) : '';
    const marital = i % 3 === 0 ? 'Single' : i % 3 === 1 ? 'Married' : '';
    const line =
      `UHT${pad(i + 1, 8)},${fn},${ln},${pick(GENDER, i)},` +
      `${yr}-${mo}-${da},${phone},${alt},` +
      `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@example.com,${pick(BLOOD, i)},` +
      `${marital},${(i % 200) + 1} ${pick(LAST, i)} Road,${city},${state},` +
      `${pin4}${pad((i % 90) + 10, 2)},${fn} ${pick(LAST, i + 1)},` +
      `${i % 3 === 0 ? '9' + pad((200000000 + (i % 799999999)), 9) : ''},` +
      `${regYr}-${mo}-${da},${pick(STATUS, i)},${pick(ALLERGY, i)},${pick(CHRONIC, i * 5)}\n`;
    ok = out.write(line);
    i += 1;
    if (i % 200_000 === 0) stdout.write(`\r${i.toLocaleString()} / ${rows.toLocaleString()} rows`);
  }
  if (i < rows) { out.once('drain', writeBatch); }
  else out.end(() => stdout.write(`\rdone — ${i.toLocaleString()} rows -> ${outFile}\n`));
}
writeBatch();
