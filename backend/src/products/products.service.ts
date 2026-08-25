import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { diffFields } from '../common/utils/diff.util';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    private readonly auditService: AuditService,
  ) {}

  findAll(): Promise<Product[]> {
    return this.productsRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findById(id: string): Promise<Product> {
    const product = await this.productsRepository.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    return product;
  }

  async create(dto: CreateProductDto, actor: AuthenticatedUser): Promise<Product> {
    const existing = await this.productsRepository.findOne({
      where: { productCode: dto.productCode },
    });
    if (existing) {
      throw new ConflictException(
        `A product with code ${dto.productCode} already exists`,
      );
    }

    const product = this.productsRepository.create({
      ...dto,
      brandName: dto.brandName ?? null,
      storageCondition: dto.storageCondition ?? null,
      shelfLifeMonths: dto.shelfLifeMonths ?? null,
    });
    const saved = await this.productsRepository.save(product);

    await this.auditService.record({
      entityName: 'Product',
      entityId: saved.id,
      action: AuditAction.CREATE,
      user: actor,
    });

    return saved;
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    actor: AuthenticatedUser,
  ): Promise<Product> {
    const product = await this.findById(id);
    const changes = diffFields(product, dto as Record<string, unknown>);

    Object.assign(product, dto);
    const saved = await this.productsRepository.save(product);

    if (Object.keys(changes).length > 0) {
      await this.auditService.record({
        entityName: 'Product',
        entityId: saved.id,
        action: AuditAction.UPDATE,
        user: actor,
        changes,
      });
    }

    return saved;
  }
}
