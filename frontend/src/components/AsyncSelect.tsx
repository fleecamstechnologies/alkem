import { useMemo, useRef, useState } from 'react';
import { Autocomplete, TextField } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { useInfiniteQuery } from '@tanstack/react-query';

export interface AsyncOption {
  id: string;
  label: string;
}

export interface AsyncPage<T extends AsyncOption> {
  options: T[];
  /** Pass back to fetch the next slice; null / undefined when exhausted. */
  nextCursor: string | null;
}

interface Props<T extends AsyncOption> {
  label: string;
  value: T | null;
  onChange: (value: T | null) => void;
  /** Stable identifier for the option source (e.g. 'suppliers', 'drugs'). */
  source: string;
  /** Fetch one page. `cursor` is null for the first page. */
  fetchPage: (args: { q: string; cursor: string | null }) => Promise<AsyncPage<T>>;
  disabled?: boolean;
  required?: boolean;
  size?: 'small' | 'medium';
  placeholder?: string;
  helperText?: string;
  error?: boolean;
  sx?: SxProps<Theme>;
}

/**
 * A searchable, infinitely-scrolling <Autocomplete>. Typing debounces a
 * server-side search; scrolling the option list near the bottom fetches the
 * next page. The selected option stays visible even when it is not part of the
 * active result set.
 */
export function AsyncSelect<T extends AsyncOption>({
  label,
  value,
  onChange,
  source,
  fetchPage,
  disabled,
  required,
  size = 'small',
  placeholder,
  helperText,
  error,
  sx,
}: Props<T>) {
  const [inputValue, setInputValue] = useState('');
  const [q, setQ] = useState('');
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onType = (v: string) => {
    setInputValue(v);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => setQ(v.trim()), 300);
  };

  const query = useInfiniteQuery({
    queryKey: ['async-select', source, q],
    queryFn: ({ pageParam }) =>
      fetchPage({ q, cursor: (pageParam as string | null) ?? null }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: (prev) => prev,
  });

  const options = useMemo(() => {
    const flat = query.data?.pages.flatMap((p) => p.options) ?? [];
    if (value && !flat.some((o) => o.id === value.id)) return [value, ...flat];
    return flat;
  }, [query.data, value]);

  return (
    <Autocomplete
      sx={sx}
      value={value}
      onChange={(_, v) => onChange(v)}
      inputValue={inputValue}
      onInputChange={(_, v, reason) => {
        if (reason === 'input') onType(v);
        else if (reason === 'clear') onType('');
      }}
      options={options}
      getOptionLabel={(o) => o.label}
      isOptionEqualToValue={(o, v) => o.id === v.id}
      filterOptions={(x) => x}
      loading={query.isFetching}
      loadingText="Loading…"
      noOptionsText={q ? 'No matches' : 'Type to search'}
      disabled={disabled}
      size={size}
      slotProps={{
        listbox: {
          onScroll: (e) => {
            const el = e.currentTarget as HTMLElement;
            if (
              el.scrollTop + el.clientHeight >= el.scrollHeight - 48 &&
              query.hasNextPage &&
              !query.isFetchingNextPage
            ) {
              void query.fetchNextPage();
            }
          },
        },
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          required={required}
          placeholder={placeholder}
          helperText={helperText}
          error={error}
        />
      )}
    />
  );
}
