import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from '@mui/material';
import { payrollApi } from '../api/payroll';
import { money } from '../format';

export function PayslipView({ payslipId }: { payslipId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['payslip', payslipId],
    queryFn: () => payrollApi.payslip(payslipId),
  });

  if (isLoading) return <CircularProgress />;
  if (isError || !data) return <Typography>Could not load payslip.</Typography>;

  const earnings = data.lines.filter((l) => l.type === 'EARNING');
  const deductions = data.lines.filter((l) => l.type === 'DEDUCTION');
  const employer = data.lines.filter(
    (l) => l.type === 'EMPLOYER_CONTRIBUTION',
  );
  const st = data.statutory;
  const name = data.employee
    ? `${data.employee.firstName} ${data.employee.lastName}`
    : data.employeeId;

  return (
    <Paper sx={{ p: 3 }} className="printable">
      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}
      >
        <Box>
          <Typography variant="h6">Payslip — {data.periodMonth}</Typography>
          <Typography variant="body2" color="text.secondary">
            {name}
            {data.employee ? ` · ${data.employee.code}` : ''} ·{' '}
            {data.employee?.designation ?? ''}
          </Typography>
        </Box>
        <Button size="small" onClick={() => window.print()}>
          Print
        </Button>
      </Stack>

      <Stack direction="row" spacing={4} sx={{ mb: 2 }}>
        <Metric label="Days in month" value={String(data.totalDaysInMonth)} />
        <Metric label="Paid days" value={data.paidDays} />
        <Metric label="LOP days" value={data.lopDays} />
        <Metric label="Status" value={data.status} />
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Earnings
          </Typography>
          <Table size="small">
            <TableBody>
              {earnings.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{l.componentName}</TableCell>
                  <TableCell align="right">{money(l.amount)}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Gross earnings</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>
                  {money(data.grossEarnings)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Deductions
          </Typography>
          <Table size="small">
            <TableBody>
              {deductions.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{l.componentName}</TableCell>
                  <TableCell align="right">{money(l.amount)}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Total deductions</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>
                  {money(data.totalDeductions)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Box>
      </Stack>

      {employer.length > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" gutterBottom>
            Employer contributions (not deducted from pay)
          </Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
            <Box sx={{ flex: 1 }}>
              <Table size="small">
                <TableBody>
                  {employer.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{l.componentName}</TableCell>
                      <TableCell align="right">{money(l.amount)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>
                      Total employer contribution
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                      {money(data.employerContributions)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Box>
            <Box sx={{ flex: 1 }} />
          </Stack>
        </>
      )}

      {st && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" gutterBottom>
            Statutory
          </Typography>
          <Stack
            direction="row"
            sx={{ flexWrap: 'wrap', gap: 3 }}
          >
            <Metric label="FY" value={st.financialYear} />
            <Metric label="PF wages" value={money(st.pfWages)} />
            <Metric
              label="ESI"
              value={st.esiApplicable ? money(st.esiWages) : 'N/A'}
            />
            <Metric
              label="PT"
              value={`${money(st.ptAmount)}${st.ptStateCode ? ` (${st.ptStateCode})` : ''}`}
            />
            <Metric label="Tax regime" value={st.taxRegime} />
            <Metric
              label="Projected annual tax"
              value={money(st.projectedAnnualTax)}
            />
            <Metric label="TDS this month" value={money(st.tdsThisMonth)} />
            <Metric label="TDS YTD" value={money(st.tdsYtd)} />
          </Stack>
        </>
      )}

      <Divider sx={{ my: 2 }} />
      <Stack
        direction="row"
        sx={{
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Monthly CTC {money(data.ctcMonthly)}
        </Typography>
        <Stack direction="row" sx={{ alignItems: 'baseline', gap: 2 }}>
          <Typography variant="subtitle1">Net pay</Typography>
          <Typography variant="h5">{money(data.netPay)}</Typography>
        </Stack>
      </Stack>
    </Paper>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h6">{value}</Typography>
    </Box>
  );
}
