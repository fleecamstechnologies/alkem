import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildDataSourceOptions } from './config/database.config';
import { HealthController } from './health.controller';
import { AuditModule } from './audit/audit.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { CustomersModule } from './customers/customers.module';
import { PaymentsModule } from './payments/payments.module';
import { ImportsModule } from './imports/imports.module';
import { DepartmentsModule } from './departments/departments.module';
import { EmployeesModule } from './employees/employees.module';
import { AttendanceModule } from './attendance/attendance.module';
import { PayrollModule } from './payroll/payroll.module';
import { DoctorsModule } from './doctors/doctors.module';
import { ReportsModule } from './reports/reports.module';
import { PortalModule } from './portal/portal.module';
import { FieldModule } from './field/field.module';
import { PatientsModule } from './patients/patients.module';
import { PharmacyModule } from './pharmacy/pharmacy.module';
import { StatsModule } from './stats/stats.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule.register({ isGlobal: true, ttl: 60_000 }),
    TypeOrmModule.forRoot({
      ...buildDataSourceOptions(),
      autoLoadEntities: true,
    }),
    AuditModule,
    UsersModule,
    AuthModule,
    CustomersModule,
    PaymentsModule,
    ImportsModule,
    DepartmentsModule,
    EmployeesModule,
    AttendanceModule,
    PayrollModule,
    DoctorsModule,
    ReportsModule,
    PortalModule,
    FieldModule,
    PatientsModule,
    PharmacyModule,
    StatsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
