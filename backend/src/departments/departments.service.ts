import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from './entities/department.entity';
import {
  CreateDepartmentDto,
  UpdateDepartmentDto,
} from './dto/department.dto';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(Department)
    private readonly repo: Repository<Department>,
  ) {}

  findAll(): Promise<Department[]> {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  async findById(id: string): Promise<Department> {
    const dept = await this.repo.findOne({ where: { id } });
    if (!dept) throw new NotFoundException(`Department ${id} not found`);
    return dept;
  }

  async create(dto: CreateDepartmentDto): Promise<Department> {
    const existing = await this.repo.findOne({ where: { name: dto.name } });
    if (existing) {
      throw new ConflictException(`Department "${dto.name}" already exists`);
    }
    return this.repo.save(
      this.repo.create({
        name: dto.name,
        code: dto.code ?? null,
        headEmployeeId:
          dto.headEmployeeId !== undefined ? String(dto.headEmployeeId) : null,
      }),
    );
  }

  async update(id: string, dto: UpdateDepartmentDto): Promise<Department> {
    const dept = await this.findById(id);
    if (dto.name !== undefined) dept.name = dto.name;
    if (dto.code !== undefined) dept.code = dto.code ?? null;
    if (dto.headEmployeeId !== undefined) {
      dept.headEmployeeId = String(dto.headEmployeeId);
    }
    return this.repo.save(dept);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.repo.delete(id);
  }
}
