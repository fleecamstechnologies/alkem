import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { RepStock } from './entities/rep-stock.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { PromoItem } from './entities/promo-item.entity';
import { StockMovementKind } from '../common/enums/field.enum';
import {
  CreatePromoItemDto,
  UpdatePromoItemDto,
} from './field.dto';
import { addMoney, fromPaise, toPaise } from '../common/utils/money.util';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

export interface StockLine {
  promoItemId: string | number;
  qty: string;
}

@Injectable()
export class StockService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /**
   * Apply one signed movement inside the given transaction: write the ledger row
   * and fold `signedQty` into rep_stock.balance (upsert).
   */
  async applyMovement(
    manager: EntityManager,
    params: {
      repEmployeeId: string;
      promoItemId: string;
      kind: StockMovementKind;
      signedQty: string;
      movementDate: string;
      refType?: string | null;
      refId?: string | null;
      note?: string | null;
      actorUserId?: string | null;
    },
  ): Promise<void> {
    await manager.getRepository(StockMovement).insert({
      repEmployeeId: params.repEmployeeId,
      promoItemId: params.promoItemId,
      kind: params.kind,
      qty: params.signedQty,
      refType: params.refType ?? null,
      refId: params.refId ?? null,
      movementDate: params.movementDate,
      note: params.note ?? null,
      createdByUserId: params.actorUserId ?? null,
    });

    const repo = manager.getRepository(RepStock);
    const existing = await repo
      .createQueryBuilder('s')
      .setLock('pessimistic_write')
      .where('s.repEmployeeId = :r AND s.promoItemId = :p', {
        r: params.repEmployeeId,
        p: params.promoItemId,
      })
      .getOne();

    if (existing) {
      existing.balance = addMoney(existing.balance, params.signedQty);
      await repo.save(existing);
    } else {
      await repo.insert({
        repEmployeeId: params.repEmployeeId,
        promoItemId: params.promoItemId,
        balance: fromPaise(toPaise(params.signedQty)),
      });
    }
  }

  /** Admin issues / returns / adjusts stock for a rep (many lines, one tx). */
  async issue(
    repEmployeeId: string,
    kind: StockMovementKind,
    movementDate: string,
    lines: StockLine[],
    note: string | null,
    actor: AuthenticatedUser,
  ): Promise<void> {
    await this.ds.transaction(async (manager) => {
      for (const line of lines) {
        const magnitude = toPaise(line.qty);
        const signed =
          kind === StockMovementKind.ISSUE
            ? fromPaise(magnitude)
            : kind === StockMovementKind.RETURN ||
                kind === StockMovementKind.DISTRIBUTE
              ? fromPaise(-magnitude)
              : line.qty; // ADJUST: caller passes a signed value
        await this.applyMovement(manager, {
          repEmployeeId,
          promoItemId: String(line.promoItemId),
          kind,
          signedQty: signed,
          movementDate,
          note,
          actorUserId: actor.userId,
        });
      }
    });
  }

  async balances(repEmployeeId: string) {
    return this.ds.query(
      `SELECT rs.promoItemId, pi.code, pi.name, pi.type, pi.unit,
              rs.balance
       FROM rep_stock rs
       JOIN promo_items pi ON pi.id = rs.promoItemId
       WHERE rs.repEmployeeId = ?
       ORDER BY pi.code`,
      [repEmployeeId],
    );
  }

  async movements(filter: {
    repEmployeeId: string;
    from?: string;
    to?: string;
  }) {
    const where = ['sm.repEmployeeId = ?'];
    const args: unknown[] = [filter.repEmployeeId];
    if (filter.from) {
      where.push('sm.movementDate >= ?');
      args.push(filter.from);
    }
    if (filter.to) {
      where.push('sm.movementDate <= ?');
      args.push(filter.to);
    }
    return this.ds.query(
      `SELECT sm.id, sm.promoItemId, pi.code AS itemCode, pi.name AS itemName,
              sm.kind, sm.qty, sm.movementDate, sm.refType, sm.refId, sm.note
       FROM stock_movements sm
       JOIN promo_items pi ON pi.id = sm.promoItemId
       WHERE ${where.join(' AND ')}
       ORDER BY sm.movementDate DESC, sm.id DESC
       LIMIT 500`,
      args,
    );
  }

  /** Rebuild every balance for a rep from the ledger. */
  async recompute(repEmployeeId: string): Promise<void> {
    await this.ds.query(
      `UPDATE rep_stock rs
         JOIN (
           SELECT promoItemId, SUM(qty) AS bal
           FROM stock_movements
           WHERE repEmployeeId = ?
           GROUP BY promoItemId
         ) t ON t.promoItemId = rs.promoItemId
         SET rs.balance = t.bal
       WHERE rs.repEmployeeId = ?`,
      [repEmployeeId, repEmployeeId],
    );
  }

  promoItems(activeOnly = false) {
    return this.ds
      .getRepository(PromoItem)
      .find(activeOnly ? { where: { active: true } } : { order: { code: 'ASC' } });
  }

  async createPromoItem(dto: CreatePromoItemDto): Promise<PromoItem> {
    const repo = this.ds.getRepository(PromoItem);
    if (await repo.findOne({ where: { code: dto.code } })) {
      throw new ConflictException(`Promo item ${dto.code} already exists`);
    }
    return repo.save(
      repo.create({
        code: dto.code,
        name: dto.name,
        type: dto.type,
        unit: dto.unit ?? 'unit',
        active: dto.active ?? true,
      }),
    );
  }

  async updatePromoItem(
    id: string,
    dto: UpdatePromoItemDto,
  ): Promise<PromoItem> {
    const repo = this.ds.getRepository(PromoItem);
    const item = await repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Promo item ${id} not found`);
    Object.assign(item, {
      name: dto.name ?? item.name,
      unit: dto.unit ?? item.unit,
      active: dto.active ?? item.active,
    });
    return repo.save(item);
  }
}
