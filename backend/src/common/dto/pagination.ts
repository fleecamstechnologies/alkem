import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const MAX_PAGE_SIZE = 200;
export const MAX_OFFSET_PAGE = 200;

/**
 * Two pagination modes on the same endpoint:
 *  - keyset:  pass `cursor` (the last id you saw). O(1) at any depth — use for
 *    infinite scroll / "load more".
 *  - offset:  pass `page` (1-based). Capped at MAX_OFFSET_PAGE so a deep jump
 *    can't turn into a full scan. Use for "go to page N" UIs.
 * If neither is passed you get page 1.
 */
export class PaginationQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit = 50;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_OFFSET_PAGE)
  page?: number;
}

export interface Paginated<T> {
  rows: T[];
  /** Pass back as `cursor` to fetch the next slice; null when exhausted. */
  nextCursor: string | null;
  /** Total matching rows — only computed when it is cheap (filters present). */
  total: number | null;
  limit: number;
}
