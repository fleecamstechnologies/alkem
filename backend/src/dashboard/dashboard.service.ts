import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../products/entities/product.entity';
import { Batch } from '../batches/entities/batch.entity';
import { QcSample } from '../qc/entities/qc-sample.entity';
import { Deviation } from '../qa/entities/deviation.entity';
import { BatchStatus } from '../common/enums/batch-status.enum';
import { QcSampleStatus } from '../common/enums/qc.enum';
import { DeviationStatus } from '../common/enums/qa.enum';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Product) private readonly productsRepository: Repository<Product>,
    @InjectRepository(Batch) private readonly batchesRepository: Repository<Batch>,
    @InjectRepository(QcSample) private readonly samplesRepository: Repository<QcSample>,
    @InjectRepository(Deviation) private readonly deviationsRepository: Repository<Deviation>,
  ) {}

  async getSummary() {
    const [
      totalProducts,
      activeProducts,
      totalBatches,
      qcPending,
      qaPending,
      released,
      rejected,
      openDeviations,
    ] = await Promise.all([
      this.productsRepository.count(),
      this.productsRepository.count({ where: { isActive: true } }),
      this.batchesRepository.count(),
      this.samplesRepository.count({
        where: [{ status: QcSampleStatus.PENDING }, { status: QcSampleStatus.IN_PROGRESS }],
      }),
      this.batchesRepository.count({ where: { status: BatchStatus.QA_REVIEW } }),
      this.batchesRepository.count({ where: { status: BatchStatus.RELEASED } }),
      this.batchesRepository.count({ where: { status: BatchStatus.REJECTED } }),
      this.deviationsRepository.count({
        where: [
          { status: DeviationStatus.OPEN },
          { status: DeviationStatus.UNDER_INVESTIGATION },
        ],
      }),
    ]);

    const batchesByStatus = await this.batchesRepository
      .createQueryBuilder('batch')
      .select('batch.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('batch.status')
      .getRawMany<{ status: BatchStatus; count: string }>();

    return {
      totalProducts,
      activeProducts,
      totalBatches,
      qcPending,
      qaPending,
      released,
      rejected,
      openDeviations,
      batchesByStatus: batchesByStatus.map((row) => ({
        status: row.status,
        count: Number(row.count),
      })),
    };
  }
}
