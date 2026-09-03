// Generate an employees CSV for load-testing the Imports module.
//
//   node backend/scripts/gen-employees-csv.mjs [rows] [outFile]
//   node backend/scripts/gen-employees-csv.mjs 30000 sample-data/employees-30000.csv
//
// Headers are the canonical field names (the importer also matches loose
// variants). departmentId cycles 1..8 to match the seeded departments.
import { createWriteStream } from 'node:fs';
import { argv, stdout } from 'node:process';

const rows = Number(argv[2] ?? 30_000);
const outFile = argv[3] ?? `sample-data/employees-${rows}.csv`;

const FIRST = [
  'Aarav','Aditya','Arjun','Rohan','Rahul','Rohit','Amit','Sandeep','Vikram','Manish',
  'Nikhil','Karan','Suresh','Ramesh','Ananya','Diya','Priya','Neha','Pooja','Sneha',
  'Kavya','Meera','Shreya','Divya','Anjali','Deepa','Kiran','Ashok','Rajesh','Sunita',
];
const LAST = [
  'Sharma','Verma','Patel','Reddy','Nair','Iyer','Gupta','Agarwal','Bansal','Kulkarni',
  'Deshmukh','Joshi','Chauhan','Rao','Naidu','Pillai','Das','Bose','Singh','Yadav',
  'Mishra','Pandey','Shetty','Hegde','Kapoor','Malhotra','Chopra','Bhatt','Jain','Shah',
];
const DESIGNATIONS = [
  'Executive','Sr. Executive','Officer','Sr. Officer','Team Lead','Assistant Manager',
  'Manager','Sr. Manager','Analyst','Sr. Analyst','Engineer','Sr. Engineer',
  'Associate','Consultant','Coordinator','Supervisor',
];
const LOCATIONS = [
  'Mumbai HQ','Baddi Plant','Pune Office','Bengaluru Office','Chennai Office',
  'Hyderabad Office','Kolkata Office','Ahmedabad Office','Delhi Office','Sikkim Plant',
];
const BANKS = ['HDFC Bank','ICICI Bank','State Bank of India','Axis Bank','Kotak Mahindra Bank','Bank of Baroda'];
const IFSC_PREFIX = ['HDFC000','ICIC000','SBIN000','UTIB000','KKBK000','BARB0'];
const EMP_TYPE = ['FULL_TIME','FULL_TIME','FULL_TIME','FULL_TIME','CONTRACT','PART_TIME','INTERN'];
const STATUS = ['ACTIVE','ACTIVE','ACTIVE','ACTIVE','ACTIVE','ACTIVE','ACTIVE','ON_LEAVE','SUSPENDED','TERMINATED'];
const CTC = ['300000','360000','450000','540000','660000','780000','900000','1100000','1450000','1900000','2500000'];
const PAN_L = 'ABCDEFGHJKLMNPRSTUVWXYZ';

const pad = (n, w) => String(n).padStart(w, '0');
const pick = (a, i) => a[i % a.length];

const HEADERS =
  'code,firstName,lastName,email,phone,designation,employmentType,status,' +
  'dateOfJoining,dateOfBirth,departmentId,workLocation,bankAccountName,' +
  'bankAccountNumber,bankName,bankIfsc,panNumber,aadhaarNumber,pfNumber,' +
  'uanNumber,esiNumber,ctcAnnual\n';

const out = createWriteStream(outFile, { encoding: 'utf8', highWaterMark: 1 << 20 });
out.write(HEADERS);

let i = 0;
function writeBatch() {
  let ok = true;
  while (i < rows && ok) {
    const fn = pick(FIRST, i * 7 + 1);
    const ln = pick(LAST, i * 11 + 3);
    const dojYr = 2015 + (i % 11);
    const mo = pad((i % 12) + 1, 2);
    const da = pad((i % 27) + 1, 2);
    const dobYr = 1965 + (i % 40);
    const pan =
      PAN_L[i % 22] + PAN_L[(i * 3) % 22] + PAN_L[(i * 7) % 22] +
      PAN_L[(i * 5) % 22] + PAN_L[(i * 2) % 22] + pad(i % 10000, 4) + PAN_L[(i * 13) % 22];
    const line =
      `EMPT${pad(i + 1, 6)},${fn},${ln},` +
      `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@alkem.example,` +
      `9${pad(700000000 + (i % 299999999), 9)},` +
      `${pick(DESIGNATIONS, i)},${pick(EMP_TYPE, i)},${pick(STATUS, i)},` +
      `${dojYr}-${mo}-${da},${dobYr}-${mo}-${da},${(i % 8) + 1},` +
      `${pick(LOCATIONS, i)},${fn} ${ln},` +
      `${pad(10000000000 + (i % 8999999999), 11)},${pick(BANKS, i)},` +
      `${pick(IFSC_PREFIX, i)}${pad((i % 900) + 100, 3)},${pan},` +
      `${pad(200000000000 + (i % 799999999999), 12)},` +
      `MH/BAN/${pad(1000000 + (i % 8999999), 7)}/${pad(i % 999, 3)},` +
      `10${pad(i % 100000000000, 11)},` +
      `${i % 3 === 0 ? '31' + pad(i % 10000000000, 10) : ''},` +
      `${pick(CTC, i)}\n`;
    ok = out.write(line);
    i += 1;
    if (i % 10_000 === 0) stdout.write(`\r${i.toLocaleString()} / ${rows.toLocaleString()} rows`);
  }
  if (i < rows) out.once('drain', writeBatch);
  else out.end(() => stdout.write(`\rdone — ${i.toLocaleString()} rows -> ${outFile}\n`));
}
writeBatch();
