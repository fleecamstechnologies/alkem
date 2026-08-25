import { IsString } from 'class-validator';

export class CloseDeviationDto {
  @IsString()
  rootCause: string;

  @IsString()
  correctiveAction: string;
}
