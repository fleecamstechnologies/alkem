import { IsInt, Min } from 'class-validator';

export class SubmitForQcDto {
  @IsInt()
  @Min(1)
  productionQuantity: number;
}
