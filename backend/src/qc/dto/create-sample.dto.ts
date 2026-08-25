import { IsInt, IsString, IsUUID, Min } from 'class-validator';

export class CreateSampleDto {
  @IsUUID()
  batchId: string;

  @IsString()
  sampleType: string;

  @IsInt()
  @Min(1)
  sampleQuantity: number;

  @IsString()
  collectionDate: string;
}
