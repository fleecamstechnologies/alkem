import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase4Portal1788317388387 implements MigrationInterface {
  name = 'Phase4Portal1788317388387';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`employeeId\` bigint NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` CHANGE \`role\` \`role\` enum ('SUPER_ADMIN', 'FINANCE', 'SALES_MANAGER', 'DATA_ENTRY', 'HR_ADMIN', 'HR_MANAGER', 'EMPLOYEE', 'VIEWER') NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`uq_users_employee\` ON \`users\` (\`employeeId\`)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`uq_users_employee\` ON \`users\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` CHANGE \`role\` \`role\` enum ('SUPER_ADMIN', 'FINANCE', 'SALES_MANAGER', 'DATA_ENTRY', 'HR_ADMIN', 'HR_MANAGER', 'VIEWER') NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP COLUMN \`employeeId\``,
    );
  }
}
