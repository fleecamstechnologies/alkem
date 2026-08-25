import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateProductDto {
  @IsString()
  productCode: string;

  @IsString()
  productName: string;

  @IsString()
  genericName: string;

  @IsOptional()
  @IsString()
  brandName?: string;

  @IsString()
  composition: string;

  @IsString()
  strength: string;

  @IsString()
  dosageForm: string;

  @IsString()
  packSize: string;

  @IsString()
  manufacturingSite: string;

  @IsOptional()
  @IsString()
  storageCondition?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  shelfLifeMonths?: number;
}
