import { IsEnum, IsString, MinLength } from 'class-validator';
import { QaDecision } from '../../common/enums/qa.enum';

export class QaDecisionDto {
  @IsEnum(QaDecision)
  decision: QaDecision;

  @IsString()
  @MinLength(3)
  comments: string;
}
