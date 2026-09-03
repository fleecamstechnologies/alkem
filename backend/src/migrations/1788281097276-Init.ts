import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1788281097276 implements MigrationInterface {
    name = 'Init1788281097276'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`users\` (\`id\` varchar(36) NOT NULL, \`email\` varchar(255) NOT NULL, \`passwordHash\` varchar(255) NOT NULL, \`name\` varchar(255) NOT NULL, \`role\` enum ('SUPER_ADMIN', 'FINANCE', 'SALES_MANAGER', 'DATA_ENTRY', 'VIEWER') NOT NULL, \`department\` varchar(120) NULL, \`isActive\` tinyint NOT NULL DEFAULT 1, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_97672ac88f789774dd47f7c8be\` (\`email\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`payments\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`customerId\` bigint NOT NULL, \`kind\` enum ('INVOICE', 'RECEIPT', 'CREDIT_NOTE', 'ADJUSTMENT') NOT NULL, \`amount\` decimal(14,2) NOT NULL, \`method\` enum ('CASH', 'CHEQUE', 'NEFT', 'RTGS', 'UPI', 'CARD', 'OTHER') NULL, \`referenceNo\` varchar(60) NULL, \`paymentDate\` date NOT NULL, \`status\` enum ('PENDING', 'CLEARED', 'BOUNCED', 'CANCELLED') NOT NULL DEFAULT 'CLEARED', \`notes\` varchar(255) NULL, \`createdByUserId\` varchar(36) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`uq_payments_customer_ref\` (\`customerId\`, \`referenceNo\`), INDEX \`idx_payments_kind_date\` (\`kind\`, \`paymentDate\`), INDEX \`idx_payments_status\` (\`status\`), INDEX \`idx_payments_date\` (\`paymentDate\`), INDEX \`idx_payments_customer_date\` (\`customerId\`, \`paymentDate\`, \`id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`customers\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`code\` varchar(40) NOT NULL, \`name\` varchar(200) NOT NULL, \`type\` enum ('CHEMIST', 'STOCKIST', 'HOSPITAL', 'DOCTOR', 'INSTITUTION', 'INDIVIDUAL') NOT NULL DEFAULT 'CHEMIST', \`phone\` varchar(20) NULL, \`email\` varchar(160) NULL, \`gstin\` varchar(20) NULL, \`addressLine1\` varchar(200) NULL, \`addressLine2\` varchar(200) NULL, \`city\` varchar(80) NULL, \`state\` varchar(80) NULL, \`pincode\` varchar(12) NULL, \`territory\` varchar(80) NULL, \`assignedRepId\` varchar(36) NULL, \`creditLimit\` decimal(14,2) NOT NULL DEFAULT '0.00', \`outstandingBalance\` decimal(14,2) NOT NULL DEFAULT '0.00', \`status\` enum ('ACTIVE', 'INACTIVE', 'BLOCKED') NOT NULL DEFAULT 'ACTIVE', \`createdByUserId\` varchar(36) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, UNIQUE INDEX \`uq_customers_code\` (\`code\`), FULLTEXT INDEX \`ft_customers_name\` (\`name\`), INDEX \`idx_customers_assigned_rep\` (\`assignedRepId\`), INDEX \`idx_customers_phone\` (\`phone\`), INDEX \`idx_customers_territory\` (\`territory\`), INDEX \`idx_customers_city_state\` (\`city\`, \`state\`), INDEX \`idx_customers_status_id\` (\`status\`, \`id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`audit_logs\` (\`id\` varchar(36) NOT NULL, \`entityName\` varchar(255) NOT NULL, \`entityId\` varchar(255) NOT NULL, \`action\` enum ('CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE') NOT NULL, \`userId\` varchar(255) NULL, \`userEmail\` varchar(255) NULL, \`changes\` json NULL, \`reason\` text NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_fb75d9e4b0438ff85e7294ceb8\` (\`entityName\`), INDEX \`IDX_f23279fad63453147a8efb46cf\` (\`entityId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_f23279fad63453147a8efb46cf\` ON \`audit_logs\``);
        await queryRunner.query(`DROP INDEX \`IDX_fb75d9e4b0438ff85e7294ceb8\` ON \`audit_logs\``);
        await queryRunner.query(`DROP TABLE \`audit_logs\``);
        await queryRunner.query(`DROP INDEX \`idx_customers_status_id\` ON \`customers\``);
        await queryRunner.query(`DROP INDEX \`idx_customers_city_state\` ON \`customers\``);
        await queryRunner.query(`DROP INDEX \`idx_customers_territory\` ON \`customers\``);
        await queryRunner.query(`DROP INDEX \`idx_customers_phone\` ON \`customers\``);
        await queryRunner.query(`DROP INDEX \`idx_customers_assigned_rep\` ON \`customers\``);
        await queryRunner.query(`DROP INDEX \`ft_customers_name\` ON \`customers\``);
        await queryRunner.query(`DROP INDEX \`uq_customers_code\` ON \`customers\``);
        await queryRunner.query(`DROP TABLE \`customers\``);
        await queryRunner.query(`DROP INDEX \`idx_payments_customer_date\` ON \`payments\``);
        await queryRunner.query(`DROP INDEX \`idx_payments_date\` ON \`payments\``);
        await queryRunner.query(`DROP INDEX \`idx_payments_status\` ON \`payments\``);
        await queryRunner.query(`DROP INDEX \`idx_payments_kind_date\` ON \`payments\``);
        await queryRunner.query(`DROP INDEX \`uq_payments_customer_ref\` ON \`payments\``);
        await queryRunner.query(`DROP TABLE \`payments\``);
        await queryRunner.query(`DROP INDEX \`IDX_97672ac88f789774dd47f7c8be\` ON \`users\``);
        await queryRunner.query(`DROP TABLE \`users\``);
    }

}
