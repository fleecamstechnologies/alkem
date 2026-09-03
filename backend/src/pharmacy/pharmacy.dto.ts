import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQuery } from '../common/dto/pagination';
import { DrugForm } from '../common/enums/pharmacy.enum';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// ---- drugs -----------------------------------------------------------

export class CreateDrugDto {
  @IsString() @Length(1, 40) code: string;
  @IsString() @Length(1, 200) name: string;
  @IsOptional() @IsString() @MaxLength(200) genericName?: string;
  @IsOptional() @IsEnum(DrugForm) form?: DrugForm;
  @IsOptional() @IsString() @MaxLength(60) strength?: string;
  @IsOptional() @IsString() @MaxLength(40) unit?: string;
  @IsOptional() @IsString() @MaxLength(20) hsnCode?: string;
  @IsOptional() @IsNumberString() gstRate?: string;
  @IsOptional() @IsNumberString() mrp?: string;
  @IsOptional() @IsNumberString() purchasePrice?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) reorderLevel?: number;
  @IsOptional() @IsString() @MaxLength(40) rackLocation?: string;
  @IsOptional() @IsBoolean() scheduleH?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateDrugDto {
  @IsOptional() @IsString() @Length(1, 200) name?: string;
  @IsOptional() @IsString() @MaxLength(200) genericName?: string;
  @IsOptional() @IsEnum(DrugForm) form?: DrugForm;
  @IsOptional() @IsString() @MaxLength(60) strength?: string;
  @IsOptional() @IsString() @MaxLength(40) unit?: string;
  @IsOptional() @IsString() @MaxLength(20) hsnCode?: string;
  @IsOptional() @IsNumberString() gstRate?: string;
  @IsOptional() @IsNumberString() mrp?: string;
  @IsOptional() @IsNumberString() purchasePrice?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) reorderLevel?: number;
  @IsOptional() @IsString() @MaxLength(40) rackLocation?: string;
  @IsOptional() @IsBoolean() scheduleH?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class QueryDrugsDto extends PaginationQuery {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsEnum(DrugForm) form?: DrugForm;
  @IsOptional() @IsString() isActive?: string;
}

// ---- suppliers -----------------------------------------------------------

export class CreateSupplierDto {
  @IsString() @Length(1, 40) code: string;
  @IsString() @Length(1, 200) name: string;
  @IsOptional() @IsString() @MaxLength(20) gstin?: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @IsOptional() @IsEmail() @MaxLength(120) email?: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateSupplierDto {
  @IsOptional() @IsString() @Length(1, 200) name?: string;
  @IsOptional() @IsString() @MaxLength(20) gstin?: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @IsOptional() @IsEmail() @MaxLength(120) email?: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class QuerySuppliersDto extends PaginationQuery {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsString() isActive?: string;
}

export class SupplierPaymentDto {
  @IsNumberString() amount: string;
  @IsOptional() @IsString() @MaxLength(40) method?: string;
  @IsOptional() @IsString() @MaxLength(80) reference?: string;
  @Matches(DATE, { message: 'paidAt must be YYYY-MM-DD' }) paidAt: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

// ---- GRN -----------------------------------------------------------

export class CreateGrnDto {
  @IsInt() supplierId: number;
  @IsOptional() @IsString() @MaxLength(60) invoiceNo?: string;
  @IsOptional() @Matches(DATE, { message: 'invoiceDate must be YYYY-MM-DD' })
  invoiceDate?: string;
  @Matches(DATE, { message: 'receivedDate must be YYYY-MM-DD' })
  receivedDate: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class GrnItemDto {
  @IsInt() drugId: number;
  @IsString() @Length(1, 60) batchNo: string;
  @Matches(DATE, { message: 'expiryDate must be YYYY-MM-DD' }) expiryDate: string;
  @IsNumberString() quantity: string;
  @IsOptional() @IsNumberString() freeQuantity?: string;
  @IsNumberString() purchasePrice: string;
  @IsNumberString() mrp: string;
  @IsOptional() @IsNumberString() gstRate?: string;
}

export class SetGrnItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GrnItemDto)
  items: GrnItemDto[];
}

export class QueryGrnsDto extends PaginationQuery {
  @IsOptional() @Type(() => Number) @IsInt() supplierId?: number;
  @IsOptional() @IsString() @MaxLength(20) status?: string;
}

// ---- dispensing -----------------------------------------------------------

export class DispenseLineDto {
  @IsInt() drugId: number;
  @IsNumberString() quantity: string;
  @IsOptional() @IsNumberString() discount?: string;
  @IsOptional() @IsInt() prescriptionItemId?: number;
}

export class CreateDispenseDto {
  @IsInt() patientId: number;
  @IsOptional() @IsInt() prescriptionId?: number;
  @IsOptional() @IsInt() visitId?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DispenseLineDto)
  lines: DispenseLineDto[];
}

export class QueryDispensesDto extends PaginationQuery {
  @IsOptional() @Type(() => Number) @IsInt() patientId?: number;
  @IsOptional() @Matches(DATE) from?: string;
  @IsOptional() @Matches(DATE) to?: string;
}

export class MovementQueryDto {
  @IsOptional() @Matches(DATE) from?: string;
  @IsOptional() @Matches(DATE) to?: string;
}
