import { MigrationInterface, QueryRunner } from "typeorm";

export class Phase7Pharmacy1788327850847 implements MigrationInterface {
    name = 'Phase7Pharmacy1788327850847'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`suppliers\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`code\` varchar(40) NOT NULL, \`name\` varchar(200) NOT NULL, \`gstin\` varchar(20) NULL, \`phone\` varchar(20) NULL, \`email\` varchar(120) NULL, \`address\` varchar(300) NULL, \`city\` varchar(80) NULL, \`outstandingPayable\` decimal(14,2) NOT NULL DEFAULT '0.00', \`isActive\` tinyint NOT NULL DEFAULT 1, \`createdByUserId\` varchar(36) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, UNIQUE INDEX \`uq_suppliers_code\` (\`code\`), INDEX \`idx_suppliers_active\` (\`isActive\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`supplier_payments\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`supplierId\` bigint NOT NULL, \`amount\` decimal(14,2) NOT NULL, \`method\` varchar(40) NULL, \`reference\` varchar(80) NULL, \`paidAt\` date NOT NULL, \`notes\` varchar(500) NULL, \`createdByUserId\` varchar(36) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`idx_supplier_payments_supplier_date\` (\`supplierId\`, \`paidAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`pharmacy_stock_movements\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`drugId\` bigint NOT NULL, \`batchId\` bigint NOT NULL, \`kind\` enum ('GRN_IN', 'DISPENSE_OUT', 'RETURN_IN', 'ADJUST', 'EXPIRY_WRITEOFF') NOT NULL, \`qty\` decimal(12,2) NOT NULL, \`refType\` varchar(20) NULL, \`refId\` varchar(40) NULL, \`movementDate\` date NOT NULL, \`note\` varchar(255) NULL, \`createdByUserId\` varchar(36) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`idx_pharm_mov_batch\` (\`batchId\`), INDEX \`idx_pharm_mov_drug_date\` (\`drugId\`, \`movementDate\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`grns\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`grnNo\` varchar(40) NOT NULL, \`supplierId\` bigint NOT NULL, \`invoiceNo\` varchar(60) NULL, \`invoiceDate\` date NULL, \`receivedDate\` date NOT NULL, \`status\` enum ('DRAFT', 'POSTED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT', \`subtotal\` decimal(14,2) NOT NULL DEFAULT '0.00', \`gstAmount\` decimal(14,2) NOT NULL DEFAULT '0.00', \`total\` decimal(14,2) NOT NULL DEFAULT '0.00', \`notes\` varchar(500) NULL, \`postedByUserId\` varchar(36) NULL, \`createdByUserId\` varchar(36) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`uq_grns_no\` (\`grnNo\`), INDEX \`idx_grns_status\` (\`status\`), INDEX \`idx_grns_supplier_date\` (\`supplierId\`, \`receivedDate\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`grn_items\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`grnId\` bigint NOT NULL, \`drugId\` bigint NOT NULL, \`batchNo\` varchar(60) NOT NULL, \`expiryDate\` date NOT NULL, \`quantity\` decimal(12,2) NOT NULL, \`freeQuantity\` decimal(12,2) NOT NULL DEFAULT '0.00', \`purchasePrice\` decimal(12,2) NOT NULL DEFAULT '0.00', \`mrp\` decimal(12,2) NOT NULL DEFAULT '0.00', \`gstRate\` decimal(5,2) NOT NULL DEFAULT '0.00', \`lineTotal\` decimal(14,2) NOT NULL DEFAULT '0.00', INDEX \`idx_grn_items_grn\` (\`grnId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`drugs\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`code\` varchar(40) NOT NULL, \`name\` varchar(200) NOT NULL, \`genericName\` varchar(200) NULL, \`form\` enum ('TABLET', 'CAPSULE', 'SYRUP', 'INJECTION', 'OINTMENT', 'DROPS', 'CONSUMABLE', 'OTHER') NOT NULL DEFAULT 'TABLET', \`strength\` varchar(60) NULL, \`unit\` varchar(40) NOT NULL DEFAULT 'unit', \`hsnCode\` varchar(20) NULL, \`gstRate\` decimal(5,2) NOT NULL DEFAULT '0.00', \`mrp\` decimal(12,2) NOT NULL DEFAULT '0.00', \`purchasePrice\` decimal(12,2) NOT NULL DEFAULT '0.00', \`reorderLevel\` int NOT NULL DEFAULT '0', \`rackLocation\` varchar(40) NULL, \`scheduleH\` tinyint NOT NULL DEFAULT 0, \`isActive\` tinyint NOT NULL DEFAULT 1, \`createdByUserId\` varchar(36) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, UNIQUE INDEX \`uq_drugs_code\` (\`code\`), INDEX \`idx_drugs_active\` (\`isActive\`), FULLTEXT INDEX \`ft_drugs_name\` (\`name\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`drug_batches\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`drugId\` bigint NOT NULL, \`batchNo\` varchar(60) NOT NULL, \`expiryDate\` date NOT NULL, \`mrp\` decimal(12,2) NOT NULL DEFAULT '0.00', \`purchasePrice\` decimal(12,2) NOT NULL DEFAULT '0.00', \`quantityReceived\` decimal(12,2) NOT NULL DEFAULT '0.00', \`quantityOnHand\` decimal(12,2) NOT NULL DEFAULT '0.00', \`grnId\` bigint NULL, \`supplierId\` bigint NULL, \`receivedDate\` date NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`uq_drug_batch\` (\`drugId\`, \`batchNo\`, \`expiryDate\`), INDEX \`idx_drug_batches_grn\` (\`grnId\`), INDEX \`idx_drug_batches_drug_onhand\` (\`drugId\`, \`quantityOnHand\`), INDEX \`idx_drug_batches_expiry\` (\`expiryDate\`), INDEX \`idx_drug_batches_drug_expiry\` (\`drugId\`, \`expiryDate\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`dispenses\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`dispenseNo\` varchar(40) NOT NULL, \`patientId\` bigint NOT NULL, \`prescriptionId\` bigint NULL, \`visitId\` bigint NULL, \`status\` enum ('DISPENSED', 'CANCELLED') NOT NULL DEFAULT 'DISPENSED', \`subtotal\` decimal(14,2) NOT NULL DEFAULT '0.00', \`discount\` decimal(14,2) NOT NULL DEFAULT '0.00', \`gstAmount\` decimal(14,2) NOT NULL DEFAULT '0.00', \`total\` decimal(14,2) NOT NULL DEFAULT '0.00', \`patientChargeId\` bigint NULL, \`dispensedByUserId\` varchar(36) NULL, \`dispensedAt\` datetime NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`uq_dispenses_no\` (\`dispenseNo\`), INDEX \`idx_dispenses_rx\` (\`prescriptionId\`), INDEX \`idx_dispenses_at\` (\`dispensedAt\`), INDEX \`idx_dispenses_patient_at\` (\`patientId\`, \`dispensedAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`dispense_items\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`dispenseId\` bigint NOT NULL, \`drugId\` bigint NOT NULL, \`batchId\` bigint NOT NULL, \`prescriptionItemId\` bigint NULL, \`quantity\` decimal(12,2) NOT NULL, \`mrp\` decimal(12,2) NOT NULL DEFAULT '0.00', \`gstRate\` decimal(5,2) NOT NULL DEFAULT '0.00', \`discount\` decimal(14,2) NOT NULL DEFAULT '0.00', \`lineTotal\` decimal(14,2) NOT NULL DEFAULT '0.00', INDEX \`idx_dispense_items_dispense\` (\`dispenseId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`users\` CHANGE \`role\` \`role\` enum ('SUPER_ADMIN', 'FINANCE', 'SALES_MANAGER', 'DATA_ENTRY', 'HR_ADMIN', 'HR_MANAGER', 'EMPLOYEE', 'RECEPTION', 'CLINICIAN', 'PHARMACIST', 'VIEWER') NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` CHANGE \`role\` \`role\` enum ('SUPER_ADMIN', 'FINANCE', 'SALES_MANAGER', 'DATA_ENTRY', 'HR_ADMIN', 'HR_MANAGER', 'EMPLOYEE', 'RECEPTION', 'CLINICIAN', 'VIEWER') NOT NULL`);
        await queryRunner.query(`DROP INDEX \`idx_dispense_items_dispense\` ON \`dispense_items\``);
        await queryRunner.query(`DROP TABLE \`dispense_items\``);
        await queryRunner.query(`DROP INDEX \`idx_dispenses_patient_at\` ON \`dispenses\``);
        await queryRunner.query(`DROP INDEX \`idx_dispenses_at\` ON \`dispenses\``);
        await queryRunner.query(`DROP INDEX \`idx_dispenses_rx\` ON \`dispenses\``);
        await queryRunner.query(`DROP INDEX \`uq_dispenses_no\` ON \`dispenses\``);
        await queryRunner.query(`DROP TABLE \`dispenses\``);
        await queryRunner.query(`DROP INDEX \`idx_drug_batches_drug_expiry\` ON \`drug_batches\``);
        await queryRunner.query(`DROP INDEX \`idx_drug_batches_expiry\` ON \`drug_batches\``);
        await queryRunner.query(`DROP INDEX \`idx_drug_batches_drug_onhand\` ON \`drug_batches\``);
        await queryRunner.query(`DROP INDEX \`idx_drug_batches_grn\` ON \`drug_batches\``);
        await queryRunner.query(`DROP INDEX \`uq_drug_batch\` ON \`drug_batches\``);
        await queryRunner.query(`DROP TABLE \`drug_batches\``);
        await queryRunner.query(`DROP INDEX \`ft_drugs_name\` ON \`drugs\``);
        await queryRunner.query(`DROP INDEX \`idx_drugs_active\` ON \`drugs\``);
        await queryRunner.query(`DROP INDEX \`uq_drugs_code\` ON \`drugs\``);
        await queryRunner.query(`DROP TABLE \`drugs\``);
        await queryRunner.query(`DROP INDEX \`idx_grn_items_grn\` ON \`grn_items\``);
        await queryRunner.query(`DROP TABLE \`grn_items\``);
        await queryRunner.query(`DROP INDEX \`idx_grns_supplier_date\` ON \`grns\``);
        await queryRunner.query(`DROP INDEX \`idx_grns_status\` ON \`grns\``);
        await queryRunner.query(`DROP INDEX \`uq_grns_no\` ON \`grns\``);
        await queryRunner.query(`DROP TABLE \`grns\``);
        await queryRunner.query(`DROP INDEX \`idx_pharm_mov_drug_date\` ON \`pharmacy_stock_movements\``);
        await queryRunner.query(`DROP INDEX \`idx_pharm_mov_batch\` ON \`pharmacy_stock_movements\``);
        await queryRunner.query(`DROP TABLE \`pharmacy_stock_movements\``);
        await queryRunner.query(`DROP INDEX \`idx_supplier_payments_supplier_date\` ON \`supplier_payments\``);
        await queryRunner.query(`DROP TABLE \`supplier_payments\``);
        await queryRunner.query(`DROP INDEX \`idx_suppliers_active\` ON \`suppliers\``);
        await queryRunner.query(`DROP INDEX \`uq_suppliers_code\` ON \`suppliers\``);
        await queryRunner.query(`DROP TABLE \`suppliers\``);
    }

}
