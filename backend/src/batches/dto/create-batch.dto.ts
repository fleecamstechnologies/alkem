import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateBatchDto {
  @IsString()
  batchNumber: string;

  @IsUUID()
  productId: string;

  @IsInt()
  @Min(1)
  batchSize: number;

  @IsString()
  manufacturingSite: string;

  @IsOptional()
  @IsString()
  manufacturingDate?: string;
}
