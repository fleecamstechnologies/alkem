import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

const SALT_ROUNDS = 10;

export type SafeUser = Omit<User, 'passwordHash'>;

/** Never let the password hash leave the service. */
function strip(user: User): SafeUser {
  const { passwordHash: _drop, ...rest } = user;
  void _drop;
  return rest;
}

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

  async findAll(): Promise<SafeUser[]> {
    const users = await this.usersRepository.find({
      order: { createdAt: 'DESC' },
    });
    return users.map(strip);
  }

  async create(
    dto: CreateUserDto,
    actor: AuthenticatedUser,
  ): Promise<SafeUser> {
    const existing = await this.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException(`A user with email ${dto.email} already exists`);
    }

    const employeeId =
      dto.employeeId !== undefined ? String(dto.employeeId) : null;
    if (employeeId) {
      const taken = await this.usersRepository.findOne({ where: { employeeId } });
      if (taken) {
        throw new ConflictException(
          `Employee ${employeeId} already has a login (${taken.email})`,
        );
      }
    }
    const doctorId = dto.doctorId !== undefined ? String(dto.doctorId) : null;
    if (doctorId) {
      const taken = await this.usersRepository.findOne({ where: { doctorId } });
      if (taken) {
        throw new ConflictException(
          `Doctor ${doctorId} already has a login (${taken.email})`,
        );
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = this.usersRepository.create({
      email: dto.email,
      passwordHash,
      name: dto.name,
      role: dto.role,
      department: dto.department ?? null,
      employeeId,
      doctorId,
    });
    const saved = await this.usersRepository.save(user);

    await this.auditService.record({
      entityName: 'User',
      entityId: saved.id,
      action: AuditAction.CREATE,
      user: actor,
    });

    return strip(saved);
  }

  async setActive(
    id: string,
    isActive: boolean,
    actor: AuthenticatedUser,
  ): Promise<SafeUser> {
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

    return strip(saved);
  }

  async linkEmployee(
    id: string,
    employeeId: number | null,
    actor: AuthenticatedUser,
  ): Promise<SafeUser> {
    const user = await this.findById(id);
    const next = employeeId != null ? String(employeeId) : null;
    if (next) {
      const taken = await this.usersRepository.findOne({
        where: { employeeId: next, id: Not(id) },
      });
      if (taken) {
        throw new BadRequestException(
          `Employee ${next} already has a login (${taken.email})`,
        );
      }
    }
    const previous = user.employeeId;
    user.employeeId = next;
    const saved = await this.usersRepository.save(user);
    await this.auditService.record({
      entityName: 'User',
      entityId: saved.id,
      action: AuditAction.UPDATE,
      user: actor,
      changes: { employeeId: { old: previous, new: next } },
    });
    return strip(saved);
  }

  async linkDoctor(
    id: string,
    doctorId: number | null,
    actor: AuthenticatedUser,
  ): Promise<SafeUser> {
    const user = await this.findById(id);
    const next = doctorId != null ? String(doctorId) : null;
    if (next) {
      const taken = await this.usersRepository.findOne({
        where: { doctorId: next, id: Not(id) },
      });
      if (taken) {
        throw new BadRequestException(
          `Doctor ${next} already has a login (${taken.email})`,
        );
      }
    }
    const previous = user.doctorId;
    user.doctorId = next;
    const saved = await this.usersRepository.save(user);
    await this.auditService.record({
      entityName: 'User',
      entityId: saved.id,
      action: AuditAction.UPDATE,
      user: actor,
      changes: { doctorId: { old: previous, new: next } },
    });
    return strip(saved);
  }
}
