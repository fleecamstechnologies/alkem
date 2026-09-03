import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Patient } from './entities/patient.entity';
import { Appointment } from './entities/appointment.entity';
import { Visit } from './entities/visit.entity';
import { Prescription } from './entities/prescription.entity';
import { PrescriptionItem } from './entities/prescription-item.entity';
import { LabTest } from './entities/lab-test.entity';
import { PatientCharge } from './entities/patient-charge.entity';
import { PatientsService } from './patients.service';
import { AppointmentsService } from './appointments.service';
import { EncountersService } from './encounters.service';
import { PatientBillingService } from './patient-billing.service';
import { ClinicScopeService } from './clinic-scope.service';
import { PatientsController } from './patients.controller';
import { AppointmentsController } from './appointments.controller';
import { EncountersController } from './encounters.controller';
import { PatientBillingController } from './patient-billing.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Patient,
      Appointment,
      Visit,
      Prescription,
      PrescriptionItem,
      LabTest,
      PatientCharge,
    ]),
    AuditModule,
  ],
  controllers: [
    PatientsController,
    AppointmentsController,
    EncountersController,
    PatientBillingController,
  ],
  providers: [
    PatientsService,
    AppointmentsService,
    EncountersService,
    PatientBillingService,
    ClinicScopeService,
  ],
  exports: [PatientsService, PatientBillingService],
})
export class PatientsModule {}
