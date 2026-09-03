import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  List,
  ListItemButton,
  ListItemText,
  ListSubheader,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import { reportsApi } from '../api/reports';
import { payrollApi } from '../api/payroll';
import { money } from '../format';
import type { ReportInfo, ReportParamDef, ReportResult } from '../types';

function errMsg(e: unknown): string {
  return (
    (e as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? 'Report failed'
  );
}

function defaultParams(report: ReportInfo): Record<string, string> {
  const out: Record<string, string> = {};
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  for (const p of report.params) {
    if (p.default) out[p.key] = p.default;
    else if (p.type === 'date')
      out[p.key] = p.key === 'from' ? `${today.slice(0, 4)}-01-01` : today;
    else if (p.type === 'month') out[p.key] = month;
    else if (p.key === 'year') out[p.key] = String(new Date().getFullYear());
    else out[p.key] = '';
  }
  return out;
}

export function ReportsPage() {
  const { data: reports, isLoading } = useQuery({
    queryKey: ['reports'],
    queryFn: reportsApi.list,
  });
  const { data: payRuns } = useQuery({
    queryKey: ['pay-runs'],
    queryFn: payrollApi.runs,
  });

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ReportResult | null>(null);
  const [downloading, setDownloading] = useState<'csv' | 'xlsx' | null>(null);

  const selected = useMemo(
    () => reports?.find((r) => r.key === selectedKey) ?? null,
    [reports, selectedKey],
  );

  useEffect(() => {
    if (selected) {
      setParams(defaultParams(selected));
      setResult(null);
    }
  }, [selected]);

  const grouped = useMemo(() => {
    const g: Record<string, ReportInfo[]> = {};
    for (const r of reports ?? []) (g[r.category] ??= []).push(r);
    return g;
  }, [reports]);

  const runMutation = useMutation({
    mutationFn: () => reportsApi.run(selectedKey!, params),
    onSuccess: (r) => setResult(r),
  });

  const missingRequired = (selected?.params ?? []).some(
    (p) => p.required && !params[p.key],
  );

  const doDownload = async (format: 'csv' | 'xlsx') => {
    if (!selectedKey) return;
    setDownloading(format);
    try {
      await reportsApi.download(selectedKey, params, format);
    } finally {
      setDownloading(null);
    }
  };

  const renderParam = (p: ReportParamDef) => {
    const common = {
      key: p.key,
      label: p.label + (p.required ? ' *' : ''),
      size: 'small' as const,
      value: params[p.key] ?? '',
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setParams((x) => ({ ...x, [p.key]: e.target.value })),
    };
    if (p.type === 'payRun') {
      return (
        <TextField {...common} select sx={{ minWidth: 200 }}>
          <MenuItem value="">—</MenuItem>
          {(payRuns ?? []).map((r) => (
            <MenuItem key={r.id} value={r.id}>
              {r.periodMonth} ({r.status})
            </MenuItem>
          ))}
        </TextField>
      );
    }
    if (p.type === 'select') {
      return (
        <TextField {...common} select sx={{ minWidth: 160 }}>
          <MenuItem value="">Any</MenuItem>
          {(p.options ?? []).map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>
      );
    }
    return (
      <TextField
        {...common}
        type={
          p.type === 'date'
            ? 'date'
            : p.type === 'month'
              ? 'month'
              : p.type === 'number'
                ? 'number'
                : 'text'
        }
        slotProps={
          p.type === 'date' || p.type === 'month'
            ? { inputLabel: { shrink: true } }
            : undefined
        }
        sx={{ minWidth: 150 }}
      />
    );
  };

  const fmtCell = (value: unknown, type?: string): string => {
    if (value === null || value === undefined || value === '') return '';
    if (type === 'money') return money(value as string);
    return String(value);
  };

  if (isLoading) return <CircularProgress />;

  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
      <Paper sx={{ width: 260, flexShrink: 0 }}>
        {Object.entries(grouped).map(([cat, list]) => (
          <List
            key={cat}
            dense
            subheader={<ListSubheader disableSticky>{cat}</ListSubheader>}
          >
            {list.map((r) => (
              <ListItemButton
                key={r.key}
                selected={r.key === selectedKey}
                onClick={() => setSelectedKey(r.key)}
              >
                <ListItemText primary={r.name} />
              </ListItemButton>
            ))}
          </List>
        ))}
        {(reports ?? []).length === 0 && (
          <Typography sx={{ p: 2 }} color="text.secondary">
            No reports available for your role.
          </Typography>
        )}
      </Paper>

      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        {!selected ? (
          <Typography color="text.secondary">
            Pick a report from the list.
          </Typography>
        ) : (
          <>
            <Typography variant="h5">{selected.name}</Typography>
            {selected.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {selected.description}
              </Typography>
            )}

            <Paper sx={{ p: 2, mb: 2 }}>
              <Stack
                direction="row"
                sx={{ gap: 2, flexWrap: 'wrap', alignItems: 'center' }}
              >
                {selected.params.map(renderParam)}
                <Button
                  variant="contained"
                  disabled={missingRequired || runMutation.isPending}
                  onClick={() => runMutation.mutate()}
                >
                  {runMutation.isPending ? 'Running…' : 'Run'}
                </Button>
              </Stack>
            </Paper>

            {runMutation.isError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {errMsg(runMutation.error)}
              </Alert>
            )}

            {result && (
              <>
                <Stack
                  direction="row"
                  sx={{
                    gap: 1,
                    mb: 1,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    {result.rows.length} rows
                    {result.meta?.truncated ? ' (preview capped)' : ''}
                  </Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  <Button
                    size="small"
                    startIcon={<DownloadIcon />}
                    disabled={downloading !== null}
                    onClick={() => doDownload('csv')}
                  >
                    {downloading === 'csv' ? '…' : 'CSV'}
                  </Button>
                  <Button
                    size="small"
                    startIcon={<DownloadIcon />}
                    disabled={downloading !== null}
                    onClick={() => doDownload('xlsx')}
                  >
                    {downloading === 'xlsx' ? '…' : 'Excel'}
                  </Button>
                  <Button size="small" onClick={() => window.print()}>
                    Print
                  </Button>
                </Stack>

                {result.meta &&
                  Object.keys(result.meta).some(
                    (k) => k !== 'truncated' && k !== 'previewCap',
                  ) && (
                    <Stack
                      direction="row"
                      sx={{ gap: 1, mb: 1, flexWrap: 'wrap' }}
                    >
                      {Object.entries(result.meta)
                        .filter(
                          ([k]) => k !== 'truncated' && k !== 'previewCap',
                        )
                        .map(([k, v]) => (
                          <Chip
                            key={k}
                            size="small"
                            label={`${k}: ${
                              typeof v === 'object'
                                ? JSON.stringify(v)
                                : String(v)
                            }`}
                          />
                        ))}
                    </Stack>
                  )}

                <TableContainer
                  component={Paper}
                  className="printable"
                  sx={{ maxHeight: '65vh' }}
                >
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        {result.columns.map((c) => (
                          <TableCell
                            key={c.key}
                            align={
                              c.type === 'money' || c.type === 'number'
                                ? 'right'
                                : 'left'
                            }
                          >
                            {c.label}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {result.rows.map((row, i) => (
                        <TableRow key={i} hover>
                          {result.columns.map((c) => (
                            <TableCell
                              key={c.key}
                              align={
                                c.type === 'money' || c.type === 'number'
                                  ? 'right'
                                  : 'left'
                              }
                            >
                              {fmtCell(row[c.key], c.type)}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                      {result.rows.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={result.columns.length}
                            align="center"
                            sx={{ py: 4 }}
                          >
                            No data for these parameters.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </>
        )}
      </Box>
    </Box>
  );
}
