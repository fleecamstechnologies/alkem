import { MigrationInterface, QueryRunner } from "typeorm";

export class Phase9Punch1788410844432 implements MigrationInterface {
    name = 'Phase9Punch1788410844432'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`office_locations\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`code\` varchar(40) NOT NULL, \`name\` varchar(150) NOT NULL, \`latitude\` decimal(10,7) NOT NULL, \`longitude\` decimal(10,7) NOT NULL, \`radiusMeters\` int NOT NULL DEFAULT '200', \`address\` varchar(300) NULL, \`isActive\` tinyint NOT NULL DEFAULT 1, \`createdByUserId\` varchar(36) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`uq_office_locations_code\` (\`code\`), INDEX \`idx_office_locations_active\` (\`isActive\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`attendance_regularizations\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`employeeId\` bigint NOT NULL, \`date\` date NOT NULL, \`requestedInAt\` datetime NULL, \`requestedOutAt\` datetime NULL, \`reason\` varchar(500) NOT NULL, \`status\` enum ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING', \`decidedByUserId\` varchar(36) NULL, \`decidedAt\` datetime NULL, \`decisionNote\` varchar(255) NULL, \`createdByUserId\` varchar(36) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`idx_att_reg_status\` (\`status\`), INDEX \`idx_att_reg_emp_date\` (\`employeeId\`, \`date\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`attendance_events\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`employeeId\` bigint NOT NULL, \`eventDate\` date NOT NULL, \`eventAt\` datetime NOT NULL, \`type\` enum ('PUNCH_IN', 'PUNCH_OUT', 'BREAK_START', 'BREAK_END') NOT NULL, \`latitude\` decimal(10,7) NULL, \`longitude\` decimal(10,7) NULL, \`accuracyM\` int NULL, \`officeId\` bigint NULL, \`distanceM\` int NULL, \`withinGeofence\` tinyint NOT NULL DEFAULT 0, \`source\` varchar(20) NOT NULL DEFAULT 'WEB', \`note\` varchar(255) NULL, \`createdByUserId\` varchar(36) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`idx_attendance_events_date\` (\`eventDate\`), INDEX \`idx_attendance_events_emp_date\` (\`employeeId\`, \`eventDate\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`app_settings\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`punchHalfDayHours\` decimal(4,2) NOT NULL DEFAULT '4.00', \`punchFullDayHours\` decimal(4,2) NOT NULL DEFAULT '8.00', \`defaultGeofenceMeters\` int NOT NULL DEFAULT '200', \`updatedByUserId\` varchar(36) NULL, \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`attendance_records\` ADD \`firstInAt\` datetime NULL`);
        await queryRunner.query(`ALTER TABLE \`attendance_records\` ADD \`lastOutAt\` datetime NULL`);
        await queryRunner.query(`ALTER TABLE \`attendance_records\` ADD \`breakMinutes\` int NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE \`attendance_records\` CHANGE \`source\` \`source\` enum ('MANUAL', 'IMPORT', 'LEAVE', 'SYSTEM', 'PUNCH', 'REGULARIZED') NOT NULL DEFAULT 'MANUAL'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`attendance_records\` CHANGE \`source\` \`source\` enum ('MANUAL', 'IMPORT', 'LEAVE', 'SYSTEM') NOT NULL DEFAULT 'MANUAL'`);
        await queryRunner.query(`ALTER TABLE \`attendance_records\` DROP COLUMN \`breakMinutes\``);
        await queryRunner.query(`ALTER TABLE \`attendance_records\` DROP COLUMN \`lastOutAt\``);
        await queryRunner.query(`ALTER TABLE \`attendance_records\` DROP COLUMN \`firstInAt\``);
        await queryRunner.query(`DROP TABLE \`app_settings\``);
        await queryRunner.query(`DROP INDEX \`idx_attendance_events_emp_date\` ON \`attendance_events\``);
        await queryRunner.query(`DROP INDEX \`idx_attendance_events_date\` ON \`attendance_events\``);
        await queryRunner.query(`DROP TABLE \`attendance_events\``);
        await queryRunner.query(`DROP INDEX \`idx_att_reg_emp_date\` ON \`attendance_regularizations\``);
        await queryRunner.query(`DROP INDEX \`idx_att_reg_status\` ON \`attendance_regularizations\``);
        await queryRunner.query(`DROP TABLE \`attendance_regularizations\``);
        await queryRunner.query(`DROP INDEX \`idx_office_locations_active\` ON \`office_locations\``);
        await queryRunner.query(`DROP INDEX \`uq_office_locations_code\` ON \`office_locations\``);
        await queryRunner.query(`DROP TABLE \`office_locations\``);
    }

}
