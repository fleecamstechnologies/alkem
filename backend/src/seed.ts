import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { UsersService } from './users/users.service';
import { CustomersService } from './customers/customers.service';
import { Customer } from './customers/entities/customer.entity';
import { Payment } from './payments/entities/payment.entity';
import { Employee } from './employees/entities/employee.entity';
import { Department } from './departments/entities/department.entity';
import { SalaryComponent } from './payroll/entities/salary-component.entity';
import { EmployeeSalaryStructure } from './payroll/entities/employee-salary-structure.entity';
import { SalaryStructureLine } from './payroll/entities/salary-structure-line.entity';
import { LeaveType } from './attendance/entities/leave-type.entity';
import { AttendanceRecord } from './attendance/entities/attendance-record.entity';
import { OfficeLocation } from './attendance/entities/office-location.entity';
import { AppSettings } from './attendance/entities/app-settings.entity';
import { StatutoryConfig } from './payroll/entities/statutory-config.entity';
import { PtSlab } from './payroll/entities/pt-slab.entity';
import { IncomeTaxSlab } from './payroll/entities/income-tax-slab.entity';
import { EmployeeStatutoryProfile } from './payroll/entities/employee-statutory-profile.entity';
import { TaxDeclaration } from './payroll/entities/tax-declaration.entity';
import { TaxRegime } from './common/enums/payroll.enum';
import { FieldRep } from './field/entities/field-rep.entity';
import { PromoItem } from './field/entities/promo-item.entity';
import { RepStock } from './field/entities/rep-stock.entity';
import { StockMovement } from './field/entities/stock-movement.entity';
import { TourPlan } from './field/entities/tour-plan.entity';
import { TourPlanDay } from './field/entities/tour-plan-day.entity';
import { CallReport } from './field/entities/call-report.entity';
import { CallProduct } from './field/entities/call-product.entity';
import { CallRx } from './field/entities/call-rx.entity';
import {
  CallKind,
  CallProductAction,
  PromoItemType,
  StockMovementKind,
  TourPlanStatus,
} from './common/enums/field.enum';
import { Doctor } from './doctors/entities/doctor.entity';
import { DrugsService } from './pharmacy/drugs.service';
import { SuppliersService } from './pharmacy/suppliers.service';
import { GrnsService } from './pharmacy/grns.service';
import { DispensesService } from './pharmacy/dispenses.service';
import { Drug } from './pharmacy/entities/drug.entity';
import { Supplier } from './pharmacy/entities/supplier.entity';
import { Prescription } from './patients/entities/prescription.entity';
import { PrescriptionItem } from './patients/entities/prescription-item.entity';
import { DrugForm } from './common/enums/pharmacy.enum';
import { Patient } from './patients/entities/patient.entity';
import { Appointment } from './patients/entities/appointment.entity';
import { Visit } from './patients/entities/visit.entity';
import { PatientCharge } from './patients/entities/patient-charge.entity';
import {
  AppointmentStatus,
  ChargeKind,
  ChargeMethod,
  ChargeStatus,
  Gender,
  PatientStatus,
  ServiceKind,
} from './common/enums/patient.enum';
import { UserRole } from './common/enums/user-role.enum';
import { CustomerStatus, CustomerType } from './common/enums/customer.enum';
import { PaymentKind, PaymentMethod, PaymentStatus } from './common/enums/payment.enum';
import { EmployeeStatus, EmploymentType } from './common/enums/employee.enum';
import {
  CalculationType,
  ComponentType,
} from './common/enums/payroll.enum';
import {
  AttendanceSource,
  AttendanceStatus,
} from './common/enums/attendance.enum';
import {
  eachDate,
  isWeekOff,
  monthDateRange,
} from './common/utils/working-days.util';
import type { AuthenticatedUser } from './common/types/authenticated-user.type';

const SYSTEM_ACTOR: AuthenticatedUser = {
  userId: 'system-seed',
  email: 'system@alkem.local',
  role: UserRole.SUPER_ADMIN,
  employeeId: null,
  doctorId: null,
};

const DEMO_USERS: Array<{ email: string; name: string; role: UserRole }> = [
  { email: 'admin@alkem.local', name: 'System Administrator', role: UserRole.SUPER_ADMIN },
  { email: 'finance@alkem.local', name: 'Finance User', role: UserRole.FINANCE },
  { email: 'sales@alkem.local', name: 'Sales Manager', role: UserRole.SALES_MANAGER },
  { email: 'dataentry@alkem.local', name: 'Data Entry', role: UserRole.DATA_ENTRY },
  { email: 'hr@alkem.local', name: 'HR Administrator', role: UserRole.HR_ADMIN },
  { email: 'hrmanager@alkem.local', name: 'HR Manager', role: UserRole.HR_MANAGER },
  { email: 'viewer@alkem.local', name: 'Viewer', role: UserRole.VIEWER },
];

const DEPARTMENTS = ['Sales', 'Marketing', 'Production', 'Quality', 'Finance', 'Human Resources', 'R&D', 'Logistics'];
const DESIGNATIONS = ['Executive', 'Senior Executive', 'Team Lead', 'Manager', 'Senior Manager', 'AGM'];

const SALARY_COMPONENTS: Array<Partial<SalaryComponent>> = [
  { code: 'HRA', name: 'House Rent Allowance', type: ComponentType.EARNING, calculationType: CalculationType.PERCENT_OF_BASIC, defaultValue: '40.00', system: false },
  { code: 'CONVEYANCE', name: 'Conveyance Allowance', type: ComponentType.EARNING, calculationType: CalculationType.FIXED, defaultValue: '1600.00', system: false },
  { code: 'SPECIAL', name: 'Special Allowance', type: ComponentType.EARNING, calculationType: CalculationType.FIXED, defaultValue: '5000.00', system: false },
];

// EPF / ESI / PT / TDS + employer contributions are produced by the statutory
// engine (Phase 8), not by manual structure lines — registered read-only so the
// components tab still lists them.
const STATUTORY_SYSTEM_COMPONENTS: Array<Partial<SalaryComponent>> = [
  { code: 'EPF', name: 'Provident Fund', type: ComponentType.DEDUCTION, calculationType: CalculationType.PERCENT_OF_BASIC, defaultValue: '12.00', system: true },
  { code: 'ESI', name: 'Employee State Insurance', type: ComponentType.DEDUCTION, calculationType: CalculationType.PERCENT_OF_BASIC, defaultValue: '0.75', system: true },
  { code: 'PT', name: 'Professional Tax', type: ComponentType.DEDUCTION, calculationType: CalculationType.FIXED, defaultValue: '0.00', system: true },
  { code: 'TDS', name: 'Income Tax (TDS)', type: ComponentType.DEDUCTION, calculationType: CalculationType.FIXED, defaultValue: '0.00', system: true },
  { code: 'EPF_ER', name: 'Employer PF', type: ComponentType.EMPLOYER_CONTRIBUTION, calculationType: CalculationType.PERCENT_OF_BASIC, defaultValue: '3.67', system: true },
  { code: 'EPS_ER', name: 'Employer Pension (EPS)', type: ComponentType.EMPLOYER_CONTRIBUTION, calculationType: CalculationType.PERCENT_OF_BASIC, defaultValue: '8.33', system: true },
  { code: 'EDLI_ER', name: 'EDLI', type: ComponentType.EMPLOYER_CONTRIBUTION, calculationType: CalculationType.PERCENT_OF_BASIC, defaultValue: '0.50', system: true },
  { code: 'EPF_ADMIN', name: 'PF Admin Charges', type: ComponentType.EMPLOYER_CONTRIBUTION, calculationType: CalculationType.PERCENT_OF_BASIC, defaultValue: '0.50', system: true },
  { code: 'ESI_ER', name: 'Employer ESI', type: ComponentType.EMPLOYER_CONTRIBUTION, calculationType: CalculationType.PERCENT_OF_BASIC, defaultValue: '3.25', system: true },
];

const PT_SLAB_SEED: Array<Partial<PtSlab>> = [
  // Maharashtra — higher amount in February
  { stateCode: 'MH', stateName: 'Maharashtra', minGross: '0.00', maxGross: '7500.00', monthlyAmount: '0.00' },
  { stateCode: 'MH', stateName: 'Maharashtra', minGross: '7500.01', maxGross: '10000.00', monthlyAmount: '175.00' },
  { stateCode: 'MH', stateName: 'Maharashtra', minGross: '10000.01', maxGross: null, monthlyAmount: '200.00', februaryAmount: '300.00' },
  // Karnataka
  { stateCode: 'KA', stateName: 'Karnataka', minGross: '0.00', maxGross: '25000.00', monthlyAmount: '0.00' },
  { stateCode: 'KA', stateName: 'Karnataka', minGross: '25000.01', maxGross: null, monthlyAmount: '200.00' },
  // West Bengal
  { stateCode: 'WB', stateName: 'West Bengal', minGross: '0.00', maxGross: '10000.00', monthlyAmount: '0.00' },
  { stateCode: 'WB', stateName: 'West Bengal', minGross: '10000.01', maxGross: '15000.00', monthlyAmount: '110.00' },
  { stateCode: 'WB', stateName: 'West Bengal', minGross: '15000.01', maxGross: '25000.00', monthlyAmount: '130.00' },
  { stateCode: 'WB', stateName: 'West Bengal', minGross: '25000.01', maxGross: '40000.00', monthlyAmount: '150.00' },
  { stateCode: 'WB', stateName: 'West Bengal', minGross: '40000.01', maxGross: null, monthlyAmount: '200.00' },
  // Tamil Nadu (half-yearly in reality; monthly-equivalent bands here)
  { stateCode: 'TN', stateName: 'Tamil Nadu', minGross: '0.00', maxGross: '21000.00', monthlyAmount: '0.00' },
  { stateCode: 'TN', stateName: 'Tamil Nadu', minGross: '21000.01', maxGross: '30000.00', monthlyAmount: '135.00' },
  { stateCode: 'TN', stateName: 'Tamil Nadu', minGross: '30000.01', maxGross: '45000.00', monthlyAmount: '315.00' },
  { stateCode: 'TN', stateName: 'Tamil Nadu', minGross: '45000.01', maxGross: '60000.00', monthlyAmount: '690.00' },
  { stateCode: 'TN', stateName: 'Tamil Nadu', minGross: '60000.01', maxGross: null, monthlyAmount: '1025.00' },
  // Telangana
  { stateCode: 'TS', stateName: 'Telangana', minGross: '0.00', maxGross: '15000.00', monthlyAmount: '0.00' },
  { stateCode: 'TS', stateName: 'Telangana', minGross: '15000.01', maxGross: '20000.00', monthlyAmount: '150.00' },
  { stateCode: 'TS', stateName: 'Telangana', minGross: '20000.01', maxGross: null, monthlyAmount: '200.00' },
  // Gujarat
  { stateCode: 'GJ', stateName: 'Gujarat', minGross: '0.00', maxGross: '12000.00', monthlyAmount: '0.00' },
  { stateCode: 'GJ', stateName: 'Gujarat', minGross: '12000.01', maxGross: null, monthlyAmount: '200.00' },
];

const PT_STATES = ['MH', 'KA', 'WB', 'TN', 'TS', 'GJ'];

const IT_SLABS_NEW: Array<[string, string | null, string]> = [
  ['0.00', '300000.00', '0.000'],
  ['300000.00', '700000.00', '5.000'],
  ['700000.00', '1000000.00', '10.000'],
  ['1000000.00', '1200000.00', '15.000'],
  ['1200000.00', '1500000.00', '20.000'],
  ['1500000.00', null, '30.000'],
];

const IT_SLABS_OLD: Array<[string, string | null, string]> = [
  ['0.00', '250000.00', '0.000'],
  ['250000.00', '500000.00', '5.000'],
  ['500000.00', '1000000.00', '20.000'],
  ['1000000.00', null, '30.000'],
];

const LEAVE_TYPES: Array<Partial<LeaveType>> = [
  { code: 'CL', name: 'Casual Leave', paid: true, annualQuota: '12.00' },
  { code: 'SL', name: 'Sick Leave', paid: true, annualQuota: '6.00' },
  { code: 'EL', name: 'Earned Leave', paid: true, annualQuota: '15.00' },
  { code: 'LWP', name: 'Leave Without Pay', paid: false, annualQuota: '0.00' },
];

const CITIES = [
  ['Mumbai', 'Maharashtra'], ['Pune', 'Maharashtra'], ['Delhi', 'Delhi'],
  ['Bengaluru', 'Karnataka'], ['Hyderabad', 'Telangana'], ['Chennai', 'Tamil Nadu'],
  ['Kolkata', 'West Bengal'], ['Ahmedabad', 'Gujarat'], ['Jaipur', 'Rajasthan'],
  ['Lucknow', 'Uttar Pradesh'], ['Indore', 'Madhya Pradesh'], ['Patna', 'Bihar'],
];
const TYPES = Object.values(CustomerType);
const FIRST = ['Ashok', 'Sunil', 'Rajesh', 'Priya', 'Anil', 'Vijay', 'Meena', 'Ramesh', 'Kiran', 'Deepak'];
const LAST = ['Medical', 'Pharma', 'Traders', 'Distributors', 'Hospital', 'Chemist', 'Agencies', 'Enterprises'];

async function seedUsers(users: UsersService): Promise<void> {
  for (const u of DEMO_USERS) {
    const existing = await users.findByEmail(u.email);
    if (existing) {
      console.log(`user exists: ${u.email}`);
      continue;
    }
    await users.create(
      { email: u.email, password: 'ChangeMe123!', name: u.name, role: u.role },
      SYSTEM_ACTOR,
    );
    console.log(`created user: ${u.email} / ChangeMe123!`);
  }
}

async function seedCustomers(ds: DataSource, count: number, perCustomer: number): Promise<void> {
  const customerRepo = ds.getRepository(Customer);
  const already = await customerRepo.count();
  if (already >= count) {
    console.log(`customers table already has ${already} rows, skipping bulk seed`);
    return;
  }

  console.time('seed customers');
  const CHUNK = 2000;
  let made = 0;
  for (let start = already; start < count; start += CHUNK) {
    const rows: Partial<Customer>[] = [];
    for (let i = start; i < Math.min(start + CHUNK, count); i += 1) {
      const [city, state] = CITIES[i % CITIES.length];
      rows.push({
        code: `CUST${String(i + 1).padStart(7, '0')}`,
        name: `${FIRST[i % FIRST.length]} ${LAST[i % LAST.length]} ${i + 1}`,
        type: TYPES[i % TYPES.length] as CustomerType,
        phone: `9${String(100000000 + (i % 899999999)).slice(0, 9)}`,
        city,
        state,
        territory: `${state}-${(i % 20) + 1}`,
        creditLimit: '50000.00',
        outstandingBalance: '0.00',
        status: CustomerStatus.ACTIVE,
      });
    }
    await customerRepo.createQueryBuilder().insert().values(rows).orIgnore().execute();
    made += rows.length;
    if (made % 20000 === 0) console.log(`  ...${made} customers`);
  }
  console.timeEnd('seed customers');

  if (perCustomer > 0) {
    console.time('seed payments');
    const paymentRepo = ds.getRepository(Payment);
    const ids: Array<{ id: string }> = await customerRepo
      .createQueryBuilder('c')
      .select('c.id', 'id')
      .getRawMany();
    const PCHUNK = 1000;
    let pRows: Partial<Payment>[] = [];
    let pMade = 0;
    const flush = async () => {
      if (!pRows.length) return;
      await paymentRepo.createQueryBuilder().insert().values(pRows).execute();
      pMade += pRows.length;
      pRows = [];
      if (pMade % 100000 === 0) console.log(`  ...${pMade} payments`);
    };
    for (const { id } of ids) {
      for (let k = 0; k < perCustomer; k += 1) {
        const isInvoice = k % 2 === 0;
        const month = (k % 12) + 1;
        pRows.push({
          customerId: id,
          kind: isInvoice ? PaymentKind.INVOICE : PaymentKind.RECEIPT,
          amount: isInvoice ? '12000.00' : '10000.00',
          method: isInvoice ? null : PaymentMethod.NEFT,
          paymentDate: `2025-${String(month).padStart(2, '0')}-15`,
          status: PaymentStatus.CLEARED,
        });
        if (pRows.length >= PCHUNK) await flush();
      }
    }
    await flush();
    console.timeEnd('seed payments');
  }
}

async function seedHrMasters(ds: DataSource): Promise<void> {
  const deptRepo = ds.getRepository(Department);
  for (const name of DEPARTMENTS) {
    if (!(await deptRepo.findOne({ where: { name } }))) {
      await deptRepo.save(deptRepo.create({ name }));
    }
  }

  const compRepo = ds.getRepository(SalaryComponent);
  if (!(await compRepo.findOne({ where: { code: 'BASIC' } }))) {
    await compRepo.save(
      compRepo.create({
        code: 'BASIC',
        name: 'Basic',
        type: ComponentType.EARNING,
        calculationType: CalculationType.FIXED,
        defaultValue: '0.00',
        system: true,
      }),
    );
  }
  if (!(await compRepo.findOne({ where: { code: 'LOP' } }))) {
    await compRepo.save(
      compRepo.create({
        code: 'LOP',
        name: 'Loss of Pay',
        type: ComponentType.DEDUCTION,
        calculationType: CalculationType.FIXED,
        defaultValue: '0.00',
        system: true,
      }),
    );
  }
  for (const c of [...SALARY_COMPONENTS, ...STATUTORY_SYSTEM_COMPONENTS]) {
    if (!(await compRepo.findOne({ where: { code: c.code! } }))) {
      await compRepo.save(compRepo.create(c));
    }
  }

  const ltRepo = ds.getRepository(LeaveType);
  for (const lt of LEAVE_TYPES) {
    if (!(await ltRepo.findOne({ where: { code: lt.code! } }))) {
      await ltRepo.save(ltRepo.create(lt));
    }
  }
  console.log('seeded HR masters (departments, salary components, leave types)');
}

/** Office geofences + attendance settings for the punch-in feature. */
async function seedOfficesAndSettings(ds: DataSource): Promise<void> {
  const settingsRepo = ds.getRepository(AppSettings);
  if ((await settingsRepo.count()) === 0) {
    await settingsRepo.save(settingsRepo.create({}));
  }
  const officeRepo = ds.getRepository(OfficeLocation);
  if ((await officeRepo.count()) === 0) {
    await officeRepo.save([
      officeRepo.create({
        code: 'HQ-MUM',
        name: 'Alkem HQ, Mumbai',
        latitude: '19.1150000',
        longitude: '72.8630000',
        radiusMeters: 200,
        address: 'Lower Parel, Mumbai, Maharashtra',
      }),
      officeRepo.create({
        code: 'PLANT-BAD',
        name: 'Alkem Baddi Plant',
        latitude: '30.9578000',
        longitude: '76.7911000',
        radiusMeters: 250,
        address: 'Baddi, Himachal Pradesh',
      }),
    ]);
  }
  console.log('seeded office geofences + attendance settings');
}

/** Apr–Mar financial-year label for a date, e.g. "2025-2026". */
function statutoryFyOf(date: Date): string {
  const y = date.getUTCFullYear();
  const startYear = date.getUTCMonth() + 1 >= 4 ? y : y - 1;
  return `${startYear}-${startYear + 1}`;
}

/** Statutory config + PT/IT slabs for the current financial year. */
async function seedStatutory(ds: DataSource): Promise<void> {
  const fy = statutoryFyOf(new Date());
  const startYear = Number(fy.split('-')[0]);
  const effectiveFrom = `${startYear}-04-01`;

  const cfgRepo = ds.getRepository(StatutoryConfig);
  if (!(await cfgRepo.findOne({ where: { active: true } }))) {
    await cfgRepo.save(
      cfgRepo.create({ financialYear: fy, effectiveFrom, active: true }),
    );
  }

  const ptRepo = ds.getRepository(PtSlab);
  if ((await ptRepo.count()) === 0) {
    await ptRepo.save(
      PT_SLAB_SEED.map((s) => ptRepo.create({ ...s, effectiveFrom })),
    );
  }

  const itRepo = ds.getRepository(IncomeTaxSlab);
  if ((await itRepo.count({ where: { financialYear: fy } })) === 0) {
    const mk = (
      regime: TaxRegime,
      rows: Array<[string, string | null, string]>,
    ) =>
      rows.map(([minAnnual, maxAnnual, ratePercent]) =>
        itRepo.create({
          regime,
          financialYear: fy,
          effectiveFrom,
          minAnnual,
          maxAnnual,
          ratePercent,
        }),
      );
    await itRepo.save([
      ...mk(TaxRegime.NEW, IT_SLABS_NEW),
      ...mk(TaxRegime.OLD, IT_SLABS_OLD),
    ]);
  }
  console.log(`seeded statutory config + slabs for FY ${fy}`);
}

async function seedEmployees(
  ds: DataSource,
  count: number,
  withAttendance: boolean,
): Promise<void> {
  const empRepo = ds.getRepository(Employee);
  const already = await empRepo.count();
  if (already >= count) {
    console.log(`employees table already has ${already} rows, skipping bulk seed`);
    return;
  }

  const deptIds = (await ds.getRepository(Department).find()).map((d) => d.id);
  const components = await ds.getRepository(SalaryComponent).find();
  const hraId = components.find((c) => c.code === 'HRA')!.id;

  console.time('seed employees');
  const CHUNK = 2000;
  for (let start = already; start < count; start += CHUNK) {
    const rows: Partial<Employee>[] = [];
    for (let i = start; i < Math.min(start + CHUNK, count); i += 1) {
      rows.push({
        code: `EMP${String(i + 1).padStart(6, '0')}`,
        firstName: FIRST[i % FIRST.length],
        lastName: `Kumar${i + 1}`,
        email: `emp${i + 1}@alkem.local`,
        phone: `9${String(200000000 + (i % 799999999)).slice(0, 9)}`,
        departmentId: deptIds.length ? deptIds[i % deptIds.length] : null,
        designation: DESIGNATIONS[i % DESIGNATIONS.length],
        employmentType: EmploymentType.FULL_TIME,
        status: EmployeeStatus.ACTIVE,
        dateOfJoining: '2023-04-01',
        ctcAnnual: '900000.00',
      });
    }
    await empRepo.createQueryBuilder().insert().values(rows).orIgnore().execute();
  }
  console.timeEnd('seed employees');

  // One active salary structure per employee: basic 30000 + HRA 40% + PF 12%.
  console.time('seed salary structures');
  const structRepo = ds.getRepository(EmployeeSalaryStructure);
  const lineRepo = ds.getRepository(SalaryStructureLine);
  const empIds: Array<{ id: string }> = await empRepo
    .createQueryBuilder('e')
    .select('e.id', 'id')
    .getRawMany();
  let structRows: Partial<EmployeeSalaryStructure>[] = [];
  let lineRows: Partial<SalaryStructureLine>[] = [];
  const flushStruct = async () => {
    if (!structRows.length) return;
    const saved = await structRepo.save(structRows);
    for (const s of saved) {
      lineRows.push({
        structureId: s.id,
        componentId: hraId,
        calculationType: CalculationType.PERCENT_OF_BASIC,
        value: '40.00',
        computedMonthly: '12000.00',
      });
    }
    await lineRepo.insert(lineRows);
    structRows = [];
    lineRows = [];
  };
  for (const { id } of empIds) {
    structRows.push({
      employeeId: id,
      effectiveFrom: '2023-04-01',
      basicMonthly: '30000.00',
      grossMonthly: '42000.00',
      active: true,
    });
    if (structRows.length >= 500) await flushStruct();
  }
  await flushStruct();
  console.timeEnd('seed salary structures');

  // Per-employee statutory profile + a DRAFT tax declaration for this FY.
  console.time('seed statutory profiles');
  const fyLabel = statutoryFyOf(new Date());
  const profRepo = ds.getRepository(EmployeeStatutoryProfile);
  const declRepo = ds.getRepository(TaxDeclaration);
  let profRows: Partial<EmployeeStatutoryProfile>[] = [];
  let declRows: Partial<TaxDeclaration>[] = [];
  const flushStat = async () => {
    if (profRows.length) {
      await profRepo
        .createQueryBuilder()
        .insert()
        .values(profRows)
        .orIgnore()
        .execute();
    }
    if (declRows.length) {
      await declRepo
        .createQueryBuilder()
        .insert()
        .values(declRows)
        .orIgnore()
        .execute();
    }
    profRows = [];
    declRows = [];
  };
  for (let i = 0; i < empIds.length; i += 1) {
    const { id } = empIds[i];
    profRows.push({
      employeeId: id,
      pfApplicable: true,
      pfUsesActualWage: false,
      esiApplicable: null,
      ptStateCode: PT_STATES[i % PT_STATES.length],
      uanNumber: `10${String(1000000000 + i).slice(0, 10)}`,
    });
    declRows.push({
      employeeId: id,
      financialYear: fyLabel,
      regime: TaxRegime.NEW,
    });
    if (profRows.length >= 500) await flushStat();
  }
  await flushStat();
  console.timeEnd('seed statutory profiles');

  // Current-year leave balances from the type quotas.
  const year = new Date().getUTCFullYear();
  await ds.query(
    `INSERT INTO leave_balances (employeeId, leaveTypeId, year, entitled, used, pending)
     SELECT e.id, lt.id, ?, lt.annualQuota, 0, 0
     FROM employees e CROSS JOIN leave_types lt
     WHERE e.status = 'ACTIVE' AND lt.active = 1
     ON DUPLICATE KEY UPDATE entitled = VALUES(entitled)`,
    [year],
  );
  console.log(`seeded leave balances for ${year}`);

  if (withAttendance) {
    console.time('seed attendance');
    const attRepo = ds.getRepository(AttendanceRecord);
    const periodMonth = new Date().toISOString().slice(0, 7);
    const { from, to } = monthDateRange(periodMonth);
    const dates = eachDate(from, to);
    let attRows: Partial<AttendanceRecord>[] = [];
    const flushAtt = async () => {
      if (!attRows.length) return;
      await attRepo
        .createQueryBuilder()
        .insert()
        .values(attRows)
        .orIgnore()
        .execute();
      attRows = [];
    };
    for (const { id } of empIds) {
      for (const date of dates) {
        attRows.push({
          employeeId: id,
          date,
          status: isWeekOff(date)
            ? AttendanceStatus.WEEK_OFF
            : AttendanceStatus.PRESENT,
          source: AttendanceSource.SYSTEM,
        });
        if (attRows.length >= 2000) await flushAtt();
      }
    }
    await flushAtt();
    console.timeEnd('seed attendance');
  }
}

/**
 * Wire up a couple of self-service logins: `employee@` linked to the first
 * employee, `manager@` linked to the second, and point a handful of employees'
 * reportingManagerId at the second so the approvals inbox has content.
 */
async function seedPortalLogins(
  ds: DataSource,
  users: UsersService,
): Promise<void> {
  const empRepo = ds.getRepository(Employee);
  const first = await empRepo.find({ order: { id: 'ASC' }, take: 6 });
  if (first.length < 2) {
    console.log('need >=2 employees for portal logins, skipping');
    return;
  }
  const [emp, mgr, ...reports] = first;

  const reportIds = [emp.id, ...reports.map((r) => r.id)];
  await empRepo.update(reportIds, { reportingManagerId: mgr.id });

  const logins: Array<{ email: string; name: string; employeeId: string }> = [
    { email: 'employee@alkem.local', name: `${emp.firstName} ${emp.lastName}`, employeeId: emp.id },
    { email: 'manager@alkem.local', name: `${mgr.firstName} ${mgr.lastName}`, employeeId: mgr.id },
  ];
  for (const l of logins) {
    if (await users.findByEmail(l.email)) {
      console.log(`portal login exists: ${l.email}`);
      continue;
    }
    try {
      await users.create(
        {
          email: l.email,
          password: 'ChangeMe123!',
          name: l.name,
          role: UserRole.EMPLOYEE,
          employeeId: Number(l.employeeId),
        },
        SYSTEM_ACTOR,
      );
      console.log(`created portal login: ${l.email} -> employee ${l.employeeId}`);
    } catch (e) {
      console.log(`skip ${l.email}: ${(e as Error).message}`);
    }
  }
}

/** Field-force demo data: reps, promo items + stock, assignments, a tour plan,
 *  and a couple of call reports so dashboards/reports have content. */
async function seedField(ds: DataSource): Promise<void> {
  const empRepo = ds.getRepository(Employee);
  const emps = await empRepo.find({ order: { id: 'ASC' }, take: 3 });
  if (emps.length < 2) return;
  const [rep, mgr] = emps;

  const frRepo = ds.getRepository(FieldRep);
  for (const [e, hq] of [
    [rep, 'Mumbai'],
    [mgr, 'Mumbai'],
  ] as const) {
    if (!(await frRepo.findOne({ where: { employeeId: e.id } }))) {
      await frRepo.save(
        frRepo.create({ employeeId: e.id, hq, territory: 'Maharashtra-1', active: true }),
      );
    }
  }

  const piRepo = ds.getRepository(PromoItem);
  const items: Array<Partial<PromoItem>> = [
    { code: 'SMP-PARA', name: 'Paracetamol 500 sample', type: PromoItemType.SAMPLE },
    { code: 'SMP-AMOX', name: 'Amoxicillin sample', type: PromoItemType.SAMPLE },
    { code: 'GFT-PAD', name: 'Prescription pad', type: PromoItemType.GIFT },
    { code: 'PRD-ALK1', name: 'Alkem Brand A', type: PromoItemType.PRODUCT },
  ];
  for (const it of items) {
    if (!(await piRepo.findOne({ where: { code: it.code! } }))) {
      await piRepo.save(piRepo.create(it));
    }
  }
  const allItems = await piRepo.find();
  const smpPara = allItems.find((i) => i.code === 'SMP-PARA')!;
  const gftPad = allItems.find((i) => i.code === 'GFT-PAD')!;

  // Opening stock for the rep (idempotent-ish: only if no movements yet).
  const smRepo = ds.getRepository(StockMovement);
  if ((await smRepo.count({ where: { repEmployeeId: rep.id } })) === 0) {
    const today = new Date().toISOString().slice(0, 10);
    for (const [item, qty] of [
      [smpPara, '60.00'],
      [gftPad, '30.00'],
    ] as const) {
      await smRepo.save(
        smRepo.create({
          repEmployeeId: rep.id,
          promoItemId: item.id,
          kind: StockMovementKind.ISSUE,
          qty,
          movementDate: today,
          note: 'opening stock',
        }),
      );
      await ds
        .getRepository(RepStock)
        .save(
          ds
            .getRepository(RepStock)
            .create({ repEmployeeId: rep.id, promoItemId: item.id, balance: qty }),
        );
    }
  }

  // Assign a few doctors + customers to the rep.
  await ds
    .getRepository(Doctor)
    .createQueryBuilder()
    .update()
    .set({ assignedRepEmployeeId: rep.id })
    .where('assignedRepEmployeeId IS NULL')
    .limit(3)
    .execute();
  await ds
    .getRepository(Customer)
    .createQueryBuilder()
    .update()
    .set({ assignedRepEmployeeId: rep.id })
    .where('assignedRepEmployeeId IS NULL AND deletedAt IS NULL')
    .limit(5)
    .execute();

  // Tour plan for the current month (SUBMITTED) with a few days.
  const periodMonth = new Date().toISOString().slice(0, 7);
  const tpRepo = ds.getRepository(TourPlan);
  let plan = await tpRepo.findOne({
    where: { repEmployeeId: rep.id, periodMonth },
  });
  if (!plan) {
    plan = await tpRepo.save(
      tpRepo.create({
        repEmployeeId: rep.id,
        periodMonth,
        status: TourPlanStatus.SUBMITTED,
        submittedAt: new Date(),
      }),
    );
    await ds.getRepository(TourPlanDay).save(
      [3, 4, 5, 6].map((d) =>
        ds.getRepository(TourPlanDay).create({
          tourPlanId: plan!.id,
          planDate: `${periodMonth}-${String(d).padStart(2, '0')}`,
          area: 'Andheri',
          plannedCalls: 10,
        }),
      ),
    );
  }

  // Two call reports.
  const crRepo = ds.getRepository(CallReport);
  if ((await crRepo.count({ where: { repEmployeeId: rep.id } })) === 0) {
    const doc = await ds
      .getRepository(Doctor)
      .findOne({ where: { assignedRepEmployeeId: rep.id } });
    const cust = await ds
      .getRepository(Customer)
      .findOne({ where: { assignedRepEmployeeId: rep.id } });
    if (doc) {
      const r1 = await crRepo.save(
        crRepo.create({
          repEmployeeId: rep.id,
          callDate: `${periodMonth}-03`,
          kind: CallKind.DOCTOR,
          doctorId: doc.id,
          area: 'Andheri',
          wasPlanned: true,
          pobValue: '0.00',
          remarks: 'Detailed Brand A; left samples.',
        }),
      );
      await ds.getRepository(CallProduct).save(
        ds.getRepository(CallProduct).create({
          callReportId: r1.id,
          promoItemId: smpPara.id,
          action: CallProductAction.SAMPLE,
          qty: '5.00',
        }),
      );
      await ds.getRepository(CallRx).save(
        ds.getRepository(CallRx).create({
          callReportId: r1.id,
          brand: 'Alkem Brand A',
          rxPerDay: 6,
        }),
      );
      // reflect the sample in stock
      await smRepo.save(
        smRepo.create({
          repEmployeeId: rep.id,
          promoItemId: smpPara.id,
          kind: StockMovementKind.DISTRIBUTE,
          qty: '-5.00',
          movementDate: `${periodMonth}-03`,
          refType: 'CALL',
          refId: r1.id,
        }),
      );
      await ds.query(
        `UPDATE rep_stock SET balance = balance - 5 WHERE repEmployeeId = ? AND promoItemId = ?`,
        [rep.id, smpPara.id],
      );
    }
    if (cust) {
      await crRepo.save(
        crRepo.create({
          repEmployeeId: rep.id,
          callDate: `${periodMonth}-04`,
          kind: CallKind.CHEMIST,
          customerId: cust.id,
          area: 'Andheri',
          wasPlanned: true,
          pobValue: '4500.00',
        }),
      );
    }
  }

  console.log('seeded field-force demo data');
}

/** Clinic logins + demo patients (+ appointment / visit / charges). */
async function seedPatientsData(
  ds: DataSource,
  users: UsersService,
): Promise<void> {
  const firstDoctor = await ds.getRepository(Doctor).findOne({
    where: {},
    order: { id: 'ASC' },
  });

  for (const [email, name, role, link] of [
    ['reception@alkem.local', 'Front Desk', UserRole.RECEPTION, null],
    [
      'clinician@alkem.local',
      firstDoctor?.name ?? 'Clinician',
      UserRole.CLINICIAN,
      firstDoctor?.id ?? null,
    ],
  ] as const) {
    if (await users.findByEmail(email)) {
      console.log(`clinic login exists: ${email}`);
      continue;
    }
    try {
      await users.create(
        {
          email,
          password: 'ChangeMe123!',
          name,
          role,
          doctorId: link ? Number(link) : undefined,
        },
        SYSTEM_ACTOR,
      );
      console.log(`created clinic login: ${email}`);
    } catch (e) {
      console.log(`skip ${email}: ${(e as Error).message}`);
    }
  }

  const patientRepo = ds.getRepository(Patient);
  const bulk = Number(process.env.SEED_PATIENTS ?? 0);
  const already = await patientRepo.count();
  const target = Math.max(bulk, already >= 20 ? already : 20);

  if (already < target) {
    console.time('seed patients');
    const CITIES = [
      ['Mumbai', 'Maharashtra'], ['Pune', 'Maharashtra'], ['Delhi', 'Delhi'],
      ['Bengaluru', 'Karnataka'], ['Chennai', 'Tamil Nadu'],
    ];
    const FIRST = ['Ravi', 'Sunita', 'Amit', 'Pooja', 'Kiran', 'Neha', 'Arjun', 'Meera'];
    const CHUNK = 2000;
    for (let start = already; start < target; start += CHUNK) {
      const rows: Partial<Patient>[] = [];
      for (let i = start; i < Math.min(start + CHUNK, target); i += 1) {
        const [city, state] = CITIES[i % CITIES.length];
        rows.push({
          code: `UH${String(i + 1).padStart(8, '0')}`,
          firstName: FIRST[i % FIRST.length],
          lastName: `Patient${i + 1}`,
          gender: i % 2 === 0 ? Gender.MALE : Gender.FEMALE,
          dateOfBirth: `19${70 + (i % 40)}-0${(i % 9) + 1}-15`,
          phone: `98${String(100000000 + (i % 899999999)).slice(0, 8)}`,
          city,
          state,
          bloodGroup: ['A+', 'B+', 'O+', 'AB+'][i % 4],
          assignedDoctorId: firstDoctor?.id ?? null,
          registrationDate: '2026-01-15',
          status: PatientStatus.ACTIVE,
          outstandingBalance: '0.00',
        });
      }
      await patientRepo
        .createQueryBuilder()
        .insert()
        .values(rows)
        .orIgnore()
        .execute();
    }
    console.timeEnd('seed patients');
  }

  // Demo appointment + visit + charges for the first patient (once).
  const p1 = await patientRepo.findOne({ where: {}, order: { id: 'ASC' } });
  if (
    p1 &&
    firstDoctor &&
    (await ds.getRepository(Visit).count({ where: { patientId: p1.id } })) === 0
  ) {
    const visitPerPatient = Number(process.env.SEED_PATIENT_VISITS ?? 0);
    const month = new Date().toISOString().slice(0, 7);
    const ids: Array<{ id: string }> = await patientRepo
      .createQueryBuilder('p')
      .select('p.id', 'id')
      .orderBy('p.id', 'ASC')
      .limit(visitPerPatient > 0 ? 100000 : 5)
      .getRawMany();

    let visitRows: Partial<Visit>[] = [];
    let apptRows: Partial<Appointment>[] = [];
    let chargeRows: Partial<PatientCharge>[] = [];
    const flush = async () => {
      if (apptRows.length)
        await ds.getRepository(Appointment).insert(apptRows);
      if (visitRows.length) await ds.getRepository(Visit).insert(visitRows);
      if (chargeRows.length)
        await ds.getRepository(PatientCharge).insert(chargeRows);
      apptRows = [];
      visitRows = [];
      chargeRows = [];
    };
    const per = Math.max(1, visitPerPatient || 1);
    for (const { id } of ids) {
      for (let k = 0; k < per; k += 1) {
        const day = `${month}-${String((k % 27) + 1).padStart(2, '0')}`;
        apptRows.push({
          patientId: id,
          doctorId: firstDoctor.id,
          scheduledAt: new Date(`${day}T10:00:00`),
          status: AppointmentStatus.COMPLETED,
        });
        visitRows.push({
          patientId: id,
          doctorId: firstDoctor.id,
          visitDate: new Date(`${day}T10:15:00`),
          chiefComplaint: 'Routine check',
          diagnosis: 'Stable',
        });
        chargeRows.push(
          {
            patientId: id,
            kind: ChargeKind.INVOICE,
            amount: '600.00',
            serviceKind: ServiceKind.CONSULTATION,
            chargeDate: day,
            status: ChargeStatus.CLEARED,
          },
          {
            patientId: id,
            kind: ChargeKind.PAYMENT,
            amount: '400.00',
            method: ChargeMethod.UPI,
            chargeDate: day,
            status: ChargeStatus.CLEARED,
          },
        );
      }
      if (apptRows.length >= 1000) await flush();
    }
    await flush();
    await ds.query(
      `UPDATE patients p
         LEFT JOIN (SELECT patientId, COUNT(*) c, MAX(visitDate) m FROM visits GROUP BY patientId) v
           ON v.patientId = p.id
         SET p.visitCount = COALESCE(v.c,0), p.lastVisitAt = v.m`,
    );
    console.log('seeded demo patient visits + charges');
  }

  await app_recomputePatientBalances(ds);
}

async function app_recomputePatientBalances(ds: DataSource): Promise<void> {
  await ds.query(
    `UPDATE patients p
       LEFT JOIN (
         SELECT patientId, SUM(CASE WHEN kind IN ('INVOICE','ADJUSTMENT') THEN amount ELSE -amount END) bal
         FROM patient_charges WHERE status IN ('PENDING','CLEARED') GROUP BY patientId
       ) t ON t.patientId = p.id
       SET p.outstandingBalance = COALESCE(t.bal, 0)`,
  );
  console.log('recomputed patient balances');
}

const SEED_DRUGS: Array<{
  code: string;
  name: string;
  genericName: string;
  form: DrugForm;
  strength: string;
  unit: string;
  gstRate: string;
  mrp: string;
  purchasePrice: string;
  reorderLevel: number;
  rackLocation: string;
  scheduleH?: boolean;
}> = [
  { code: 'PARA500', name: 'Paracetamol 500mg Tablet', genericName: 'Paracetamol', form: DrugForm.TABLET, strength: '500mg', unit: 'tablet', gstRate: '12', mrp: '25.50', purchasePrice: '14.00', reorderLevel: 200, rackLocation: 'A1' },
  { code: 'AMOX250', name: 'Amoxicillin 250mg Capsule', genericName: 'Amoxicillin', form: DrugForm.CAPSULE, strength: '250mg', unit: 'capsule', gstRate: '12', mrp: '68.00', purchasePrice: '40.00', reorderLevel: 150, rackLocation: 'A2', scheduleH: true },
  { code: 'AZI500', name: 'Azithromycin 500mg Tablet', genericName: 'Azithromycin', form: DrugForm.TABLET, strength: '500mg', unit: 'tablet', gstRate: '12', mrp: '110.00', purchasePrice: '72.00', reorderLevel: 100, rackLocation: 'A2', scheduleH: true },
  { code: 'CET10', name: 'Cetirizine 10mg Tablet', genericName: 'Cetirizine', form: DrugForm.TABLET, strength: '10mg', unit: 'tablet', gstRate: '12', mrp: '18.00', purchasePrice: '9.50', reorderLevel: 120, rackLocation: 'A3' },
  { code: 'PAN40', name: 'Pantoprazole 40mg Tablet', genericName: 'Pantoprazole', form: DrugForm.TABLET, strength: '40mg', unit: 'tablet', gstRate: '12', mrp: '95.00', purchasePrice: '55.00', reorderLevel: 90, rackLocation: 'A3' },
  { code: 'MET500', name: 'Metformin 500mg Tablet', genericName: 'Metformin', form: DrugForm.TABLET, strength: '500mg', unit: 'tablet', gstRate: '12', mrp: '32.00', purchasePrice: '17.00', reorderLevel: 180, rackLocation: 'B1' },
  { code: 'AML5', name: 'Amlodipine 5mg Tablet', genericName: 'Amlodipine', form: DrugForm.TABLET, strength: '5mg', unit: 'tablet', gstRate: '12', mrp: '28.00', purchasePrice: '15.00', reorderLevel: 140, rackLocation: 'B1' },
  { code: 'COUGH100', name: 'Cough Syrup 100ml', genericName: 'Dextromethorphan', form: DrugForm.SYRUP, strength: '100ml', unit: 'bottle', gstRate: '12', mrp: '85.00', purchasePrice: '52.00', reorderLevel: 60, rackLocation: 'C1' },
  { code: 'CEFT1G', name: 'Ceftriaxone 1g Injection', genericName: 'Ceftriaxone', form: DrugForm.INJECTION, strength: '1g', unit: 'vial', gstRate: '12', mrp: '45.00', purchasePrice: '28.00', reorderLevel: 80, rackLocation: 'D1', scheduleH: true },
  { code: 'ORS21', name: 'ORS Powder Sachet', genericName: 'Oral Rehydration Salts', form: DrugForm.CONSUMABLE, strength: '21g', unit: 'sachet', gstRate: '5', mrp: '12.00', purchasePrice: '6.00', reorderLevel: 300, rackLocation: 'C2' },
  { code: 'DICGEL30', name: 'Diclofenac Gel 30g', genericName: 'Diclofenac', form: DrugForm.OINTMENT, strength: '30g', unit: 'tube', gstRate: '12', mrp: '72.00', purchasePrice: '44.00', reorderLevel: 70, rackLocation: 'C3' },
  { code: 'MOXEYE5', name: 'Moxifloxacin Eye Drops 5ml', genericName: 'Moxifloxacin', form: DrugForm.DROPS, strength: '5ml', unit: 'bottle', gstRate: '12', mrp: '120.00', purchasePrice: '78.00', reorderLevel: 50, rackLocation: 'C3', scheduleH: true },
  { code: 'INSGLA', name: 'Insulin Glargine 100IU/ml', genericName: 'Insulin Glargine', form: DrugForm.INJECTION, strength: '3ml', unit: 'cartridge', gstRate: '5', mrp: '850.00', purchasePrice: '620.00', reorderLevel: 40, rackLocation: 'D2', scheduleH: true },
  { code: 'IBU400', name: 'Ibuprofen 400mg Tablet', genericName: 'Ibuprofen', form: DrugForm.TABLET, strength: '400mg', unit: 'tablet', gstRate: '12', mrp: '35.00', purchasePrice: '19.00', reorderLevel: 160, rackLocation: 'A1' },
  { code: 'VITD3', name: 'Vitamin D3 60000IU Sachet', genericName: 'Cholecalciferol', form: DrugForm.CONSUMABLE, strength: '60000IU', unit: 'sachet', gstRate: '12', mrp: '42.00', purchasePrice: '25.00', reorderLevel: 110, rackLocation: 'C2' },
];

/** Pharmacy demo: pharmacist login, drug master, 2 suppliers, a posted GRN
 *  (creates batches + stock), and one dispense against patient 1. */
async function seedPharmacy(
  ds: DataSource,
  users: UsersService,
  drugsSvc: DrugsService,
  suppliersSvc: SuppliersService,
  grnsSvc: GrnsService,
  dispensesSvc: DispensesService,
): Promise<void> {
  if (!(await users.findByEmail('pharmacist@alkem.local'))) {
    try {
      await users.create(
        {
          email: 'pharmacist@alkem.local',
          password: 'ChangeMe123!',
          name: 'Pharmacy Desk',
          role: UserRole.PHARMACIST,
        },
        SYSTEM_ACTOR,
      );
      console.log('created pharmacy login: pharmacist@alkem.local');
    } catch (e) {
      console.log(`skip pharmacist@alkem.local: ${(e as Error).message}`);
    }
  }

  const drugRepo = ds.getRepository(Drug);
  if ((await drugRepo.count()) === 0) {
    for (const d of SEED_DRUGS) {
      try {
        await drugsSvc.create(
          {
            code: d.code,
            name: d.name,
            genericName: d.genericName,
            form: d.form,
            strength: d.strength,
            unit: d.unit,
            gstRate: d.gstRate,
            mrp: d.mrp,
            purchasePrice: d.purchasePrice,
            reorderLevel: d.reorderLevel,
            rackLocation: d.rackLocation,
            scheduleH: d.scheduleH ?? false,
          },
          SYSTEM_ACTOR,
        );
      } catch (e) {
        console.log(`skip drug ${d.code}: ${(e as Error).message}`);
      }
    }
    console.log(`seeded ${SEED_DRUGS.length} drugs`);
  }

  const supplierRepo = ds.getRepository(Supplier);
  let suppliers = await supplierRepo.find({ order: { id: 'ASC' } });
  if (suppliers.length === 0) {
    for (const s of [
      { code: 'SUP-001', name: 'MediSource Distributors Pvt Ltd', gstin: '27AABCM1234A1Z5', phone: '9820090001', city: 'Mumbai' },
      { code: 'SUP-002', name: 'HealthLine Pharma Supplies', gstin: '27AABCH5678B1Z2', phone: '9820090002', city: 'Pune' },
    ]) {
      try {
        await suppliersSvc.create(s, SYSTEM_ACTOR);
      } catch (e) {
        console.log(`skip supplier ${s.code}: ${(e as Error).message}`);
      }
    }
    suppliers = await supplierRepo.find({ order: { id: 'ASC' } });
    console.log('seeded 2 suppliers');
  }

  // One posted GRN stocking every drug, if no batches exist yet.
  const batchCount: Array<{ c: string }> = await ds.query(
    'SELECT COUNT(*) AS c FROM drug_batches',
  );
  if (Number(batchCount[0]?.c ?? 0) === 0 && suppliers.length) {
    const today = new Date().toISOString().slice(0, 10);
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    const soon = new Date();
    soon.setDate(soon.getDate() + 60);
    const drugs = await drugRepo.find({ order: { id: 'ASC' } });
    try {
      const grn = await grnsSvc.create(
        {
          supplierId: Number(suppliers[0].id),
          invoiceNo: 'INV-DEMO-1001',
          invoiceDate: today,
          receivedDate: today,
        },
        SYSTEM_ACTOR,
      );
      await grnsSvc.setItems(
        grn.id,
        {
          items: drugs.map((d, i) => ({
            drugId: Number(d.id),
            batchNo: `B${today.replace(/-/g, '')}-${d.code}`,
            // make 2 batches expire soon so the expiry alert has content
            expiryDate:
              i % 7 === 0
                ? soon.toISOString().slice(0, 10)
                : nextYear.toISOString().slice(0, 10),
            quantity: '150',
            purchasePrice: d.purchasePrice,
            mrp: d.mrp,
            gstRate: d.gstRate,
          })),
        },
        SYSTEM_ACTOR,
      );
      await grnsSvc.post(grn.id, SYSTEM_ACTOR);
      console.log(`posted demo GRN ${grn.grnNo} (${drugs.length} batches)`);
    } catch (e) {
      console.log(`skip demo GRN: ${(e as Error).message}`);
    }
  }

  // One dispense against patient 1's latest prescription (or first 2 drugs).
  const dispensed: Array<{ c: string }> = await ds.query(
    'SELECT COUNT(*) AS c FROM dispenses',
  );
  if (Number(dispensed[0]?.c ?? 0) === 0) {
    const p1 = await ds
      .getRepository(Patient)
      .findOne({ where: {}, order: { id: 'ASC' } });
    const drugs = await drugRepo.find({ order: { id: 'ASC' }, take: 2 });
    if (p1 && drugs.length === 2) {
      const rx = await ds.getRepository(Prescription).findOne({
        where: { patientId: p1.id },
        order: { id: 'DESC' },
      });
      let rxItems: PrescriptionItem[] = [];
      if (rx) {
        rxItems = await ds
          .getRepository(PrescriptionItem)
          .find({ where: { prescriptionId: rx.id } });
      }
      try {
        await dispensesSvc.create(
          {
            patientId: Number(p1.id),
            prescriptionId: rx ? Number(rx.id) : undefined,
            lines: [
              {
                drugId: Number(drugs[0].id),
                quantity: '10',
                prescriptionItemId: rxItems[0]
                  ? Number(rxItems[0].id)
                  : undefined,
              },
              { drugId: Number(drugs[1].id), quantity: '5', discount: '10.00' },
            ],
          },
          SYSTEM_ACTOR,
        );
        console.log(`dispensed demo medicines to patient ${p1.code}`);
      } catch (e) {
        console.log(`skip demo dispense: ${(e as Error).message}`);
      }
    }
  }
}

async function seed(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const users = app.get(UsersService);
    const customers = app.get(CustomersService);
    const ds = app.get(DataSource);

    await seedUsers(users);
    await seedHrMasters(ds);
    await seedStatutory(ds);
    await seedOfficesAndSettings(ds);

    const target = Number(process.env.SEED_CUSTOMERS ?? 0);
    if (target > 0) {
      const perCustomer = Number(process.env.SEED_PAYMENTS_PER_CUSTOMER ?? 0);
      await seedCustomers(ds, target, perCustomer);
      console.log('recomputing outstanding balances...');
      console.time('recompute');
      await customers.recomputeAllOutstanding();
      console.timeEnd('recompute');
    }

    const empTarget = Number(process.env.SEED_EMPLOYEES ?? 0);
    if (empTarget > 0) {
      await seedEmployees(ds, empTarget, process.env.SEED_ATTENDANCE === '1');
    }

    if ((await ds.getRepository(Employee).count()) >= 2) {
      await seedPortalLogins(ds, users);
      await seedField(ds);
    }

    await seedPatientsData(ds, users);

    await seedPharmacy(
      ds,
      users,
      app.get(DrugsService),
      app.get(SuppliersService),
      app.get(GrnsService),
      app.get(DispensesService),
    );
  } finally {
    await app.close();
  }
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
