import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  CircularProgress,
  Grid,
  Link,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { paymentsApi } from '../api/payments';
import { payrollApi } from '../api/payroll';
import { attendanceApi } from '../api/attendance';
import { statsApi } from '../api/stats';
import { money } from '../format';
import { HR_READ_ROLES } from '../types';
import { useAuth } from '../auth/AuthContext';

const TILES: {
  key:
    | 'totalCustomers'
    | 'activeCustomers'
    | 'blockedCustomers'
    | 'paymentsToday';
  label: string;
  color: string;
}[] = [
  { key: 'totalCustomers', label: 'Total customers', color: '#1565c0' },
  { key: 'activeCustomers', label: 'Active', color: '#2e7d32' },
  { key: 'blockedCustomers', label: 'Blocked', color: '#c62828' },
  { key: 'paymentsToday', label: 'Payments today', color: '#6a1b9a' },
];

const thisMonth = () => new Date().toISOString().slice(0, 7);

export function DashboardPage() {
  const { user } = useAuth();
  const showHr = !!user && HR_READ_ROLES.includes(user.role);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard'],
    queryFn: paymentsApi.dashboard,
  });
  const payrollQuery = useQuery({
    queryKey: ['payroll-dashboard'],
    queryFn: payrollApi.dashboard,
    enabled: showHr,
  });
  const attendanceQuery = useQuery({
    queryKey: ['attendance-dashboard', thisMonth()],
    queryFn: () => attendanceApi.summary(thisMonth()),
    enabled: showHr,
  });
  const countsQuery = useQuery({
    queryKey: ['record-counts'],
    queryFn: statsApi.counts,
    staleTime: 5 * 60_000,
  });

  const recordCounts = countsQuery.data;

  if (isLoading) return <CircularProgress />;
  if (isError || !data)
    return <Typography>Could not load the dashboard.</Typography>;

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Dashboard
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {TILES.map((t) => (
          <Grid key={t.key} size={{ xs: 6, md: 3 }}>
            <Paper sx={{ p: 2, borderTop: `4px solid ${t.color}` }}>
              <Typography variant="body2" color="text.secondary">
                {t.label}
              </Typography>
              <Typography variant="h4">
                {data[t.key].toLocaleString('en-IN')}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          ['Total outstanding', data.totalOutstanding],
          ['Invoiced this month', data.invoicedThisMonth],
          ['Received this month', data.receivedThisMonth],
        ].map(([label, value]) => (
          <Grid key={label} size={{ xs: 12, md: 4 }}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {label}
              </Typography>
              <Typography variant="h5">{money(value)}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {showHr && payrollQuery.data && (
        <>
          <Typography variant="h6" gutterBottom>
            HR &amp; payroll
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 6, md: 3 }}>
              <Paper sx={{ p: 2, borderTop: '4px solid #00695c' }}>
                <Typography variant="body2" color="text.secondary">
                  Headcount
                </Typography>
                <Typography variant="h4">
                  {payrollQuery.data.headcount.toLocaleString('en-IN')}
                </Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Paper sx={{ p: 2, borderTop: '4px solid #ef6c00' }}>
                <Typography variant="body2" color="text.secondary">
                  On leave today
                </Typography>
                <Typography variant="h4">
                  {attendanceQuery.data?.onLeaveToday ?? '—'}
                </Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  {payrollQuery.data.periodMonth} pay run
                </Typography>
                <Typography variant="h5">
                  {payrollQuery.data.currentRun?.status ?? 'not started'}
                </Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Net payroll (last run)
                </Typography>
                <Typography variant="h5">
                  {money(payrollQuery.data.currentRun?.totalNet ?? '0')}
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </>
      )}

      <Stack
        direction="row"
        sx={{ alignItems: 'baseline', gap: 1, mb: 1 }}
      >
        <Typography variant="h6">Record counts</Typography>
        {recordCounts && (
          <Typography variant="caption" color="text.secondary">
            as of {new Date(recordCounts.generatedAt).toLocaleTimeString()}
          </Typography>
        )}
      </Stack>
      {countsQuery.isLoading && <CircularProgress size={24} sx={{ mb: 3 }} />}
      {countsQuery.isError && (
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Could not load record counts.
        </Typography>
      )}
      {recordCounts && (
        <Box sx={{ mb: 3 }}>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            {recordCounts.highlights.map((h) => {
              const n = recordCounts.counts[h.key] ?? -1;
              return (
                <Grid key={h.key} size={{ xs: 6, md: 3 }}>
                  <Paper sx={{ p: 2, borderTop: '4px solid #1565c0' }}>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {h.label}
                    </Typography>
                    <Typography variant="h4">
                      {n < 0 ? '—' : n.toLocaleString('en-IN')}
                    </Typography>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
          {recordCounts.groups.map((g) => (
            <Box key={g.group} sx={{ mb: 2 }}>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                sx={{ mb: 1 }}
              >
                {g.group}
              </Typography>
              <Grid container spacing={2}>
                {g.items.map((it) => {
                  const n = recordCounts.counts[it.key] ?? -1;
                  return (
                    <Grid
                      key={it.key}
                      size={{ xs: 6, sm: 4, md: 3, lg: 2 }}
                    >
                      <Paper sx={{ p: 2 }}>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          noWrap
                        >
                          {it.label}
                        </Typography>
                        <Typography variant="h5">
                          {n < 0 ? '—' : n.toLocaleString('en-IN')}
                        </Typography>
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>
            </Box>
          ))}
        </Box>
      )}

      <Typography variant="h6" gutterBottom>
        Top customers by outstanding
      </Typography>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Code</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>City</TableCell>
              <TableCell align="right">Outstanding</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.topOutstanding.map((c) => (
              <TableRow key={c.id} hover>
                <TableCell>{c.code}</TableCell>
                <TableCell>
                  <Link component={RouterLink} to={`/customers/${c.id}`}>
                    {c.name}
                  </Link>
                </TableCell>
                <TableCell>{c.city || '—'}</TableCell>
                <TableCell align="right">
                  {money(c.outstandingBalance)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
