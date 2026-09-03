import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { DrugBatch } from './entities/drug-batch.entity';
import { PharmacyStockMovement } from './entities/pharmacy-stock-movement.entity';
import { PharmacyMovementKind } from '../common/enums/pharmacy.enum';
import { addMoney, fromPaise, toPaise } from '../common/utils/money.util';

export interface FefoAllocation {
  batchId: string;
  batchNo: string;
  expiryDate: string;
  mrp: string;
  qty: string;
}

@Injectable()
export class StockService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /**
   * Write one signed movement inside the caller's transaction and fold the
   * quantity into `drug_batches.quantityOnHand` (row-locked).
   */
  async applyMovement(
    manager: EntityManager,
    params: {
      drugId: string;
      batchId: string;
      kind: PharmacyMovementKind;
      signedQty: string;
      movementDate: string;
      refType?: string | null;
      refId?: string | null;
      note?: string | null;
      actorUserId?: string | null;
    },
  ): Promise<void> {
    await manager.getRepository(PharmacyStockMovement).insert({
      drugId: params.drugId,
      batchId: params.batchId,
      kind: params.kind,
      qty: params.signedQty,
      refType: params.refType ?? null,
      refId: params.refId ?? null,
      movementDate: params.movementDate,
      note: params.note ?? null,
      createdByUserId: params.actorUserId ?? null,
    });

    const repo = manager.getRepository(DrugBatch);
    const batch = await repo
      .createQueryBuilder('b')
      .setLock('pessimistic_write')
      .where('b.id = :id', { id: params.batchId })
      .getOne();
    if (!batch) {
      throw new BadRequestException(`Batch ${params.batchId} not found`);
    }
    const next = addMoney(batch.quantityOnHand, params.signedQty);
    if (toPaise(next) < 0n) {
      throw new BadRequestException(
        `Movement would drive batch ${batch.batchNo} negative`,
      );
    }
    batch.quantityOnHand = next;
    await repo.save(batch);
  }

  /**
   * FEFO: allocate `qtyNeeded` from the drug's batches, earliest expiry first,
   * skipping expired stock. Returns the per-batch split. Throws if short.
   * Rows are locked FOR UPDATE so a concurrent dispense can't double-allocate.
   */
  async allocateFefo(
    manager: EntityManager,
    drugId: string,
    qtyNeeded: string,
  ): Promise<FefoAllocation[]> {
    let remaining = toPaise(qtyNeeded);
    if (remaining <= 0n) {
      throw new BadRequestException('Quantity must be positive');
    }

    const batches = await manager
      .getRepository(DrugBatch)
      .createQueryBuilder('b')
      .setLock('pessimistic_write')
      .where('b.drugId = :drugId', { drugId })
      .andWhere('b.quantityOnHand > 0')
      .andWhere('b.expiryDate >= CURDATE()')
      .orderBy('b.expiryDate', 'ASC')
      .addOrderBy('b.id', 'ASC')
      .getMany();

    const available = batches.reduce(
      (sum, b) => sum + toPaise(b.quantityOnHand),
      0n,
    );
    if (available < remaining) {
      throw new BadRequestException(
        `insufficient stock: ${fromPaise(available)} available, ${qtyNeeded} requested`,
      );
    }

    const out: FefoAllocation[] = [];
    for (const b of batches) {
      if (remaining <= 0n) break;
      const take = min(remaining, toPaise(b.quantityOnHand));
      out.push({
        batchId: b.id,
        batchNo: b.batchNo,
        expiryDate: b.expiryDate,
        mrp: b.mrp,
        qty: fromPaise(take),
      });
      remaining -= take;
    }
    return out;
  }

  async recomputeBatchOnHand(batchId: string): Promise<void> {
    await this.ds.query(
      `UPDATE drug_batches b
         SET b.quantityOnHand = b.quantityReceived + COALESCE((
           SELECT SUM(m.qty) FROM pharmacy_stock_movements m
           WHERE m.batchId = b.id AND m.kind <> 'GRN_IN'
         ), 0)
       WHERE b.id = ?`,
      [batchId],
    );
  }
}

function min(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}
