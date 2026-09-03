import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class PharmacyDashboardService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async dashboard() {
    const cached = await this.cache.get('pharmacy:dashboard');
    if (cached) return cached;
    const today = new Date().toISOString().slice(0, 10);

    const [lowStock, expiring, dispenseToday, grnToday, stockValue] =
      await Promise.all([
        this.ds.query(
          `SELECT COUNT(*) AS c FROM (
             SELECT d.id, d.reorderLevel
             FROM drugs d
             LEFT JOIN drug_batches b ON b.drugId = d.id
             WHERE d.isActive = 1
             GROUP BY d.id, d.reorderLevel
             HAVING COALESCE(SUM(b.quantityOnHand), 0) <= d.reorderLevel
           ) t`,
        ),
        this.ds.query(
          `SELECT COUNT(*) AS c FROM drug_batches
           WHERE quantityOnHand > 0 AND expiryDate <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)`,
        ),
        this.ds.query(
          `SELECT COALESCE(SUM(total), 0) AS v, COUNT(*) AS c
           FROM dispenses
           WHERE status = 'DISPENSED' AND DATE(dispensedAt) = ?`,
          [today],
        ),
        this.ds.query(
          `SELECT COALESCE(SUM(total), 0) AS v, COUNT(*) AS c
           FROM grns
           WHERE status = 'POSTED' AND receivedDate = ?`,
          [today],
        ),
        this.ds.query(
          `SELECT COALESCE(SUM(quantityOnHand * purchasePrice), 0) AS v
           FROM drug_batches WHERE quantityOnHand > 0`,
        ),
      ]);

    const result = {
      date: today,
      lowStockCount: Number(lowStock[0]?.c ?? 0),
      expiringSoonCount: Number(expiring[0]?.c ?? 0),
      dispenseTodayValue: String(dispenseToday[0]?.v ?? '0.00'),
      dispenseTodayCount: Number(dispenseToday[0]?.c ?? 0),
      grnTodayValue: String(grnToday[0]?.v ?? '0.00'),
      grnTodayCount: Number(grnToday[0]?.c ?? 0),
      totalStockValue: String(stockValue[0]?.v ?? '0.00'),
    };
    await this.cache.set('pharmacy:dashboard', result, 60_000);
    return result;
  }

  async alerts() {
    const cached = await this.cache.get('pharmacy:alerts');
    if (cached) return cached;

    const [lowStock, expiring] = await Promise.all([
      this.ds.query(
        `SELECT d.id, d.code, d.name, d.reorderLevel, d.rackLocation,
                COALESCE(SUM(b.quantityOnHand), 0) AS onHand
         FROM drugs d
         LEFT JOIN drug_batches b ON b.drugId = d.id
         WHERE d.isActive = 1
         GROUP BY d.id
         HAVING onHand <= d.reorderLevel
         ORDER BY (onHand - d.reorderLevel) ASC
         LIMIT 200`,
      ),
      this.ds.query(
        `SELECT b.id AS batchId, b.drugId, d.code, d.name, b.batchNo,
                DATE_FORMAT(b.expiryDate,'%Y-%m-%d') AS expiryDate,
                b.quantityOnHand,
                (b.quantityOnHand * b.purchasePrice) AS valueAtRisk
         FROM drug_batches b
         JOIN drugs d ON d.id = b.drugId
         WHERE b.quantityOnHand > 0
           AND b.expiryDate <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)
         ORDER BY b.expiryDate ASC
         LIMIT 200`,
      ),
    ]);

    const result = { lowStock, expiring };
    await this.cache.set('pharmacy:alerts', result, 60_000);
    return result;
  }
}
