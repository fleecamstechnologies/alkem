import { MigrationInterface, QueryRunner } from "typeorm";

export class Phase6Patients1788322070680 implements MigrationInterface {
    name = 'Phase6Patients1788322070680'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`visits\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`patientId\` bigint NOT NULL, \`doctorId\` bigint NOT NULL, \`appointmentId\` bigint NULL, \`visitDate\` datetime NOT NULL, \`visitType\` enum ('OPD', 'IPD', 'EMERGENCY', 'TELE') NOT NULL DEFAULT 'OPD', \`chiefComplaint\` varchar(500) NULL, \`bpSystolic\` int NULL, \`bpDiastolic\` int NULL, \`pulse\` int NULL, \`temperature\` decimal(4,1) NULL, \`weightKg\` decimal(5,2) NULL, \`heightCm\` decimal(5,1) NULL, \`spo2\` int NULL, \`bmi\` decimal(4,1) NULL, \`diagnosis\` text NULL, \`icdCodes\` varchar(255) NULL, \`clinicalNotes\` text NULL, \`followUpDate\` date NULL, \`createdByUserId\` varchar(36) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`idx_visits_date\` (\`visitDate\`), INDEX \`idx_visits_doctor_date\` (\`doctorId\`, \`visitDate\`), INDEX \`idx_visits_patient_date\` (\`patientId\`, \`visitDate\`, \`id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`prescriptions\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`visitId\` bigint NULL, \`patientId\` bigint NOT NULL, \`doctorId\` bigint NOT NULL, \`prescribedAt\` datetime NOT NULL, \`notes\` varchar(500) NULL, \`createdByUserId\` varchar(36) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`idx_rx_visit\` (\`visitId\`), INDEX \`idx_rx_patient_date\` (\`patientId\`, \`prescribedAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`prescription_items\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`prescriptionId\` bigint NOT NULL, \`drugName\` varchar(160) NOT NULL, \`strength\` varchar(60) NULL, \`dosage\` varchar(60) NULL, \`route\` varchar(30) NULL, \`frequency\` varchar(60) NULL, \`durationDays\` int NULL, \`quantity\` varchar(40) NULL, \`instructions\` varchar(255) NULL, INDEX \`idx_rx_items_rx\` (\`prescriptionId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`patients\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`code\` varchar(40) NOT NULL, \`firstName\` varchar(100) NOT NULL, \`lastName\` varchar(100) NOT NULL, \`gender\` enum ('MALE', 'FEMALE', 'OTHER') NULL, \`dateOfBirth\` date NULL, \`phone\` varchar(20) NULL, \`altPhone\` varchar(20) NULL, \`email\` varchar(160) NULL, \`bloodGroup\` varchar(5) NULL, \`maritalStatus\` varchar(20) NULL, \`addressLine1\` varchar(200) NULL, \`addressLine2\` varchar(200) NULL, \`city\` varchar(80) NULL, \`state\` varchar(80) NULL, \`pincode\` varchar(12) NULL, \`emergencyName\` varchar(120) NULL, \`emergencyPhone\` varchar(20) NULL, \`assignedDoctorId\` bigint NULL, \`registrationDate\` date NOT NULL, \`status\` enum ('ACTIVE', 'INACTIVE', 'DECEASED') NOT NULL DEFAULT 'ACTIVE', \`allergies\` text NULL, \`chronicConditions\` text NULL, \`outstandingBalance\` decimal(14,2) NOT NULL DEFAULT '0.00', \`visitCount\` int NOT NULL DEFAULT '0', \`lastVisitAt\` datetime NULL, \`createdByUserId\` varchar(36) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, UNIQUE INDEX \`uq_patients_code\` (\`code\`), FULLTEXT INDEX \`ft_patients_name\` (\`firstName\`, \`lastName\`), INDEX \`idx_patients_reg_date\` (\`registrationDate\`), INDEX \`idx_patients_city_state\` (\`city\`, \`state\`), INDEX \`idx_patients_status_id\` (\`status\`, \`id\`), INDEX \`idx_patients_doctor\` (\`assignedDoctorId\`), INDEX \`idx_patients_phone\` (\`phone\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`patient_charges\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`patientId\` bigint NOT NULL, \`kind\` enum ('INVOICE', 'PAYMENT', 'REFUND', 'ADJUSTMENT') NOT NULL, \`amount\` decimal(14,2) NOT NULL, \`method\` enum ('CASH', 'CARD', 'UPI', 'NEFT', 'INSURANCE', 'OTHER') NULL, \`reference\` varchar(60) NULL, \`chargeDate\` date NOT NULL, \`serviceKind\` enum ('CONSULTATION', 'PROCEDURE', 'LAB', 'PHARMACY', 'REGISTRATION', 'OTHER') NULL, \`description\` varchar(255) NULL, \`visitId\` bigint NULL, \`status\` enum ('PENDING', 'CLEARED', 'CANCELLED') NOT NULL DEFAULT 'CLEARED', \`createdByUserId\` varchar(36) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`idx_pcharge_service_date\` (\`serviceKind\`, \`chargeDate\`), INDEX \`idx_pcharge_status\` (\`status\`), INDEX \`idx_pcharge_date\` (\`chargeDate\`), INDEX \`idx_pcharge_patient_date\` (\`patientId\`, \`chargeDate\`, \`id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`lab_tests\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`patientId\` bigint NOT NULL, \`visitId\` bigint NULL, \`doctorId\` bigint NULL, \`testName\` varchar(160) NOT NULL, \`orderedAt\` datetime NOT NULL, \`status\` enum ('ORDERED', 'COLLECTED', 'RESULT_READY', 'CANCELLED') NOT NULL DEFAULT 'ORDERED', \`resultValue\` varchar(120) NULL, \`unit\` varchar(30) NULL, \`refRange\` varchar(60) NULL, \`flag\` enum ('NORMAL', 'HIGH', 'LOW', 'CRITICAL') NULL, \`resultAt\` datetime NULL, \`notes\` varchar(255) NULL, \`createdByUserId\` varchar(36) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`idx_lab_visit\` (\`visitId\`), INDEX \`idx_lab_status\` (\`status\`), INDEX \`idx_lab_patient_date\` (\`patientId\`, \`orderedAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`appointments\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`patientId\` bigint NOT NULL, \`doctorId\` bigint NOT NULL, \`scheduledAt\` datetime NOT NULL, \`durationMin\` int NOT NULL DEFAULT '15', \`status\` enum ('SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW') NOT NULL DEFAULT 'SCHEDULED', \`type\` enum ('NEW', 'FOLLOW_UP', 'PROCEDURE', 'TELE') NOT NULL DEFAULT 'NEW', \`reason\` varchar(255) NULL, \`department\` varchar(80) NULL, \`visitId\` bigint NULL, \`cancelReason\` varchar(255) NULL, \`createdByUserId\` varchar(36) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`idx_appt_status\` (\`status\`), INDEX \`idx_appt_time_status\` (\`scheduledAt\`, \`status\`), INDEX \`idx_appt_patient_time\` (\`patientId\`, \`scheduledAt\`), INDEX \`idx_appt_doctor_time\` (\`doctorId\`, \`scheduledAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`doctorId\` bigint NULL`);
        await queryRunner.query(`ALTER TABLE \`users\` CHANGE \`role\` \`role\` enum ('SUPER_ADMIN', 'FINANCE', 'SALES_MANAGER', 'DATA_ENTRY', 'HR_ADMIN', 'HR_MANAGER', 'EMPLOYEE', 'RECEPTION', 'CLINICIAN', 'VIEWER') NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX \`uq_users_doctor\` ON \`users\` (\`doctorId\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`uq_users_doctor\` ON \`users\``);
        await queryRunner.query(`ALTER TABLE \`users\` CHANGE \`role\` \`role\` enum ('SUPER_ADMIN', 'FINANCE', 'SALES_MANAGER', 'DATA_ENTRY', 'HR_ADMIN', 'HR_MANAGER', 'EMPLOYEE', 'VIEWER') NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`doctorId\``);
        await queryRunner.query(`DROP INDEX \`idx_appt_doctor_time\` ON \`appointments\``);
        await queryRunner.query(`DROP INDEX \`idx_appt_patient_time\` ON \`appointments\``);
        await queryRunner.query(`DROP INDEX \`idx_appt_time_status\` ON \`appointments\``);
        await queryRunner.query(`DROP INDEX \`idx_appt_status\` ON \`appointments\``);
        await queryRunner.query(`DROP TABLE \`appointments\``);
        await queryRunner.query(`DROP INDEX \`idx_lab_patient_date\` ON \`lab_tests\``);
        await queryRunner.query(`DROP INDEX \`idx_lab_status\` ON \`lab_tests\``);
        await queryRunner.query(`DROP INDEX \`idx_lab_visit\` ON \`lab_tests\``);
        await queryRunner.query(`DROP TABLE \`lab_tests\``);
        await queryRunner.query(`DROP INDEX \`idx_pcharge_patient_date\` ON \`patient_charges\``);
        await queryRunner.query(`DROP INDEX \`idx_pcharge_date\` ON \`patient_charges\``);
        await queryRunner.query(`DROP INDEX \`idx_pcharge_status\` ON \`patient_charges\``);
        await queryRunner.query(`DROP INDEX \`idx_pcharge_service_date\` ON \`patient_charges\``);
        await queryRunner.query(`DROP TABLE \`patient_charges\``);
        await queryRunner.query(`DROP INDEX \`idx_patients_phone\` ON \`patients\``);
        await queryRunner.query(`DROP INDEX \`idx_patients_doctor\` ON \`patients\``);
        await queryRunner.query(`DROP INDEX \`idx_patients_status_id\` ON \`patients\``);
        await queryRunner.query(`DROP INDEX \`idx_patients_city_state\` ON \`patients\``);
        await queryRunner.query(`DROP INDEX \`idx_patients_reg_date\` ON \`patients\``);
        await queryRunner.query(`DROP INDEX \`ft_patients_name\` ON \`patients\``);
        await queryRunner.query(`DROP INDEX \`uq_patients_code\` ON \`patients\``);
        await queryRunner.query(`DROP TABLE \`patients\``);
        await queryRunner.query(`DROP INDEX \`idx_rx_items_rx\` ON \`prescription_items\``);
        await queryRunner.query(`DROP TABLE \`prescription_items\``);
        await queryRunner.query(`DROP INDEX \`idx_rx_patient_date\` ON \`prescriptions\``);
        await queryRunner.query(`DROP INDEX \`idx_rx_visit\` ON \`prescriptions\``);
        await queryRunner.query(`DROP TABLE \`prescriptions\``);
        await queryRunner.query(`DROP INDEX \`idx_visits_patient_date\` ON \`visits\``);
        await queryRunner.query(`DROP INDEX \`idx_visits_doctor_date\` ON \`visits\``);
        await queryRunner.query(`DROP INDEX \`idx_visits_date\` ON \`visits\``);
        await queryRunner.query(`DROP TABLE \`visits\``);
    }

}
