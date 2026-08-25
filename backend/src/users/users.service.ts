import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

const SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly auditService: AuditService,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({ order: { createdAt: 'DESC' } });
  }

  async create(dto: CreateUserDto, actor: AuthenticatedUser): Promise<User> {
    const existing = await this.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException(`A user with email ${dto.email} already exists`);
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = this.usersRepository.create({
      email: dto.email,
      passwordHash,
      name: dto.name,
      role: dto.role,
      manufacturingSite: dto.manufacturingSite ?? null,
    });
    const saved = await this.usersRepository.save(user);

    await this.auditService.record({
      entityName: 'User',
      entityId: saved.id,
      action: AuditAction.CREATE,
      user: actor,
    });

    return saved;
  }

  async setActive(id: string, isActive: boolean, actor: AuthenticatedUser): Promise<User> {
    const user = await this.findById(id);
    const previous = user.isActive;
    user.isActive = isActive;
    const saved = await this.usersRepository.save(user);

    await this.auditService.record({
      entityName: 'User',
      entityId: saved.id,
      action: AuditAction.UPDATE,
      user: actor,
      changes: { isActive: { old: previous, new: isActive } },
    });

    return saved;
  }
}
