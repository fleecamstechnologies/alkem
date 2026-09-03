import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds a unique (patientId, visitDate) key to `visits` so the bulk "patient
 * history" importer can upsert instead of duplicating on re-import. Any
 * pre-existing duplicates are collapsed to the earliest row first.
 */
export class AddVisitImportKey1788500100000 implements MigrationInterface {
  name = 'AddVisitImportKey1788500100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE v FROM \`visits\` v
      JOIN \`visits\` keep
        ON keep.\`patientId\` = v.\`patientId\`
       AND keep.\`visitDate\` = v.\`visitDate\`
       AND keep.\`id\` < v.\`id\`
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`uq_visits_patient_visitdate\` ON \`visits\` (\`patientId\`, \`visitDate\`)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`uq_visits_patient_visitdate\` ON \`visits\``,
    );
  }
}
