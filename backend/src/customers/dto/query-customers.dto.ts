import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CustomerStatus, CustomerType } from '../../common/enums/customer.enum';
import { PaginationQuery } from '../../common/dto/pagination';

export class QueryCustomersDto extends PaginationQuery {
  /** Free-text search over customer name (FULLTEXT). */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsEnum(CustomerType)
  type?: CustomerType;

  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  territory?: string;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  assignedRepId?: string;
}
