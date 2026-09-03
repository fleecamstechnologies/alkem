import { MigrationInterface, QueryRunner } from "typeorm";

export class Phase5Field1788318990855 implements MigrationInterface {
    name = 'Phase5Field1788318990855'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`tour_plans\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`repEmployeeId\` bigint NOT NULL, \`periodMonth\` varchar(7) NOT NULL, \`status\` enum ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'DRAFT', \`submittedAt\` datetime NULL, \`decidedByUserId\` varchar(36) NULL, \`decidedAt\` datetime NULL, \`note\` varchar(255) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`uq_tour_plans_rep_month\` (\`repEmployeeId\`, \`periodMonth\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`tour_plan_days\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`tourPlanId\` bigint NOT NULL, \`planDate\` date NOT NULL, \`area\` varchar(120) NOT NULL, \`plannedCalls\` int NOT NULL DEFAULT '0', \`notes\` varchar(255) NULL, INDEX \`idx_tour_plan_days_plan\` (\`tourPlanId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`stock_movements\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`repEmployeeId\` bigint NOT NULL, \`promoItemId\` bigint NOT NULL, \`kind\` enum ('ISSUE', 'RETURN', 'DISTRIBUTE', 'ADJUST') NOT NULL, \`qty\` decimal(12,2) NOT NULL, \`refType\` varchar(20) NULL, \`refId\` varchar(40) NULL, \`movementDate\` date NOT NULL, \`note\` varchar(255) NULL, \`createdByUserId\` varchar(36) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`idx_stock_mov_item\` (\`promoItemId\`), INDEX \`idx_stock_mov_rep_date\` (\`repEmployeeId\`, \`movementDate\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`rep_stock\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`repEmployeeId\` bigint NOT NULL, \`promoItemId\` bigint NOT NULL, \`balance\` decimal(12,2) NOT NULL DEFAULT '0.00', \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`uq_rep_stock\` (\`repEmployeeId\`, \`promoItemId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`promo_items\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`code\` varchar(30) NOT NULL, \`name\` varchar(120) NOT NULL, \`type\` enum ('SAMPLE', 'GIFT', 'PRODUCT') NOT NULL, \`unit\` varchar(20) NOT NULL DEFAULT 'unit', \`active\` tinyint NOT NULL DEFAULT 1, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`uq_promo_items_code\` (\`code\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`field_reps\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`employeeId\` bigint NOT NULL, \`hq\` varchar(80) NULL, \`territory\` varchar(80) NULL, \`active\` tinyint NOT NULL DEFAULT 1, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`uq_field_reps_employee\` (\`employeeId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`call_rx\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`callReportId\` bigint NOT NULL, \`brand\` varchar(120) NOT NULL, \`rxPerDay\` int NOT NULL DEFAULT '0', \`remarks\` varchar(255) NULL, INDEX \`idx_call_rx_report\` (\`callReportId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`call_reports\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`repEmployeeId\` bigint NOT NULL, \`callDate\` date NOT NULL, \`kind\` enum ('DOCTOR', 'CHEMIST') NOT NULL, \`doctorId\` bigint NULL, \`customerId\` bigint NULL, \`area\` varchar(120) NULL, \`wasPlanned\` tinyint NOT NULL DEFAULT 0, \`jointWithEmployeeId\` bigint NULL, \`remarks\` varchar(500) NULL, \`pobValue\` decimal(14,2) NOT NULL DEFAULT '0.00', \`checkInAt\` datetime NULL, \`latitude\` decimal(9,6) NULL, \`longitude\` decimal(9,6) NULL, \`createdByUserId\` varchar(36) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`idx_call_reports_customer\` (\`customerId\`), INDEX \`idx_call_reports_doctor\` (\`doctorId\`), INDEX \`idx_call_reports_date\` (\`callDate\`), INDEX \`idx_call_reports_rep_date\` (\`repEmployeeId\`, \`callDate\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`call_rcpa\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`callReportId\` bigint NOT NULL, \`brand\` varchar(120) NOT NULL, \`company\` varchar(120) NULL, \`units\` int NOT NULL DEFAULT '0', \`isOwn\` tinyint NOT NULL DEFAULT 0, \`remarks\` varchar(255) NULL, INDEX \`idx_call_rcpa_report\` (\`callReportId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`call_products\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`callReportId\` bigint NOT NULL, \`promoItemId\` bigint NOT NULL, \`action\` enum ('DETAILED', 'SAMPLE', 'GIFT', 'ORDER') NOT NULL, \`qty\` decimal(12,2) NOT NULL DEFAULT '0.00', \`value\` decimal(14,2) NOT NULL DEFAULT '0.00', \`notes\` varchar(255) NULL, INDEX \`idx_call_products_report\` (\`callReportId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`doctors\` ADD \`assignedRepEmployeeId\` bigint NULL`);
        await queryRunner.query(`ALTER TABLE \`customers\` ADD \`assignedRepEmployeeId\` bigint NULL`);
        await queryRunner.query(`CREATE INDEX \`idx_doctors_assigned_rep\` ON \`doctors\` (\`assignedRepEmployeeId\`)`);
        await queryRunner.query(`CREATE INDEX \`idx_customers_assigned_rep_emp\` ON \`customers\` (\`assignedRepEmployeeId\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`idx_customers_assigned_rep_emp\` ON \`customers\``);
        await queryRunner.query(`DROP INDEX \`idx_doctors_assigned_rep\` ON \`doctors\``);
        await queryRunner.query(`ALTER TABLE \`customers\` DROP COLUMN \`assignedRepEmployeeId\``);
        await queryRunner.query(`ALTER TABLE \`doctors\` DROP COLUMN \`assignedRepEmployeeId\``);
        await queryRunner.query(`DROP INDEX \`idx_call_products_report\` ON \`call_products\``);
        await queryRunner.query(`DROP TABLE \`call_products\``);
        await queryRunner.query(`DROP INDEX \`idx_call_rcpa_report\` ON \`call_rcpa\``);
        await queryRunner.query(`DROP TABLE \`call_rcpa\``);
        await queryRunner.query(`DROP INDEX \`idx_call_reports_rep_date\` ON \`call_reports\``);
        await queryRunner.query(`DROP INDEX \`idx_call_reports_date\` ON \`call_reports\``);
        await queryRunner.query(`DROP INDEX \`idx_call_reports_doctor\` ON \`call_reports\``);
        await queryRunner.query(`DROP INDEX \`idx_call_reports_customer\` ON \`call_reports\``);
        await queryRunner.query(`DROP TABLE \`call_reports\``);
        await queryRunner.query(`DROP INDEX \`idx_call_rx_report\` ON \`call_rx\``);
        await queryRunner.query(`DROP TABLE \`call_rx\``);
        await queryRunner.query(`DROP INDEX \`uq_field_reps_employee\` ON \`field_reps\``);
        await queryRunner.query(`DROP TABLE \`field_reps\``);
        await queryRunner.query(`DROP INDEX \`uq_promo_items_code\` ON \`promo_items\``);
        await queryRunner.query(`DROP TABLE \`promo_items\``);
        await queryRunner.query(`DROP INDEX \`uq_rep_stock\` ON \`rep_stock\``);
        await queryRunner.query(`DROP TABLE \`rep_stock\``);
        await queryRunner.query(`DROP INDEX \`idx_stock_mov_rep_date\` ON \`stock_movements\``);
        await queryRunner.query(`DROP INDEX \`idx_stock_mov_item\` ON \`stock_movements\``);
        await queryRunner.query(`DROP TABLE \`stock_movements\``);
        await queryRunner.query(`DROP INDEX \`idx_tour_plan_days_plan\` ON \`tour_plan_days\``);
        await queryRunner.query(`DROP TABLE \`tour_plan_days\``);
        await queryRunner.query(`DROP INDEX \`uq_tour_plans_rep_month\` ON \`tour_plans\``);
        await queryRunner.query(`DROP TABLE \`tour_plans\``);
    }

}
