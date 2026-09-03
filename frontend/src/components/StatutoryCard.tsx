import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { payrollApi } from '../api/payroll';
import { money } from '../format';
import type { EmployeeStatutoryProfile } from '../types';

function errMsg(e: unknown): string {
  return (
    (e as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? 'Request failed'
  );
}

function currentFy(): string {
  const d = new Date();
  const start = d.getMonth() + 1 >= 4 ? d.getFullYear() : d.getFullYear() - 1;
  return `${start}-${start + 1}`;
}

const PT_STATES = ['MH', 'KA', 'WB', 'TN', 'TS', 'GJ'];

export function StatutoryCard({
  employeeId,
  canWrite,
}: {
  employeeId: string;
  canWrite: boolean;
}) {
  const qc = useQueryClient();
  const fy = currentFy();
  const profileQuery = useQuery({
    queryKey: ['emp-statutory', employeeId],
    queryFn: () => payrollApi.employeeStatutory(employeeId),
  });
  const declQuery = useQuery({
    queryKey: ['emp-tax-decl', employeeId, fy],
    queryFn: () => payrollApi.taxDeclaration(employeeId, fy),
  });

  const [form, setForm] = useState<Partial<EmployeeStatutoryProfile>>({});
  const p = { ...profileQuery.data, ...form } as EmployeeStatutoryProfile;

  const saveProfile = useMutation({
    mutationFn: () => payrollApi.saveEmployeeStatutory(employeeId, form),
    onSuccess: () => {
      setForm({});
      qc.invalidateQueries({ queryKey: ['emp-statutory', employeeId] });
    },
  });
  const lockDecl = useMutation({
    mutationFn: () =>
      payrollApi.saveTaxDeclaration(employeeId, fy, { status: 'LOCKED' }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['emp-tax-decl', employeeId, fy] }),
  });

  if (!profileQuery.data) return null;
  const d = declQuery.data?.declaration;
  const proj = declQuery.data?.projection;
  const esiVal =
    p.esiApplicable === null || p.esiApplicable === undefined
      ? 'auto'
      : p.esiApplicable
        ? 'yes'
        : 'no';

  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 3 }}>
      <Typography variant="subtitle2" gutterBottom>
        Statutory profile
      </Typography>
      {saveProfile.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errMsg(saveProfile.error)}
        </Alert>
      )}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
          gap: 2,
        }}
      >
        <TextField
          size="small"
          label="UAN"
          value={p.uanNumber ?? ''}
          disabled={!canWrite}
          onChange={(e) => setForm((f) => ({ ...f, uanNumber: e.target.value }))}
        />
        <TextField
          size="small"
          label="ESI IP number"
          value={p.esiIpNumber ?? ''}
          disabled={!canWrite}
          onChange={(e) =>
            setForm((f) => ({ ...f, esiIpNumber: e.target.value }))
          }
        />
        <TextField
          select
          size="small"
          label="PT state"
          value={p.ptStateCode ?? 'MH'}
          disabled={!canWrite}
          onChange={(e) =>
            setForm((f) => ({ ...f, ptStateCode: e.target.value }))
          }
        >
          {PT_STATES.map((s) => (
            <MenuItem key={s} value={s}>
              {s}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="PF applicable"
          value={p.pfApplicable ? 'yes' : 'no'}
          disabled={!canWrite}
          onChange={(e) =>
            setForm((f) => ({ ...f, pfApplicable: e.target.value === 'yes' }))
          }
        >
          <MenuItem value="yes">Yes</MenuItem>
          <MenuItem value="no">No</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          label="PF on actual wage (no ₹15k cap)"
          value={p.pfUsesActualWage ? 'yes' : 'no'}
          disabled={!canWrite}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              pfUsesActualWage: e.target.value === 'yes',
            }))
          }
        >
          <MenuItem value="yes">Yes</MenuItem>
          <MenuItem value="no">No</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          label="ESI applicable"
          value={esiVal}
          disabled={!canWrite}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              esiApplicable:
                e.target.value === 'auto'
                  ? null
                  : e.target.value === 'yes',
            }))
          }
        >
          <MenuItem value="auto">Auto (by gross)</MenuItem>
          <MenuItem value="yes">Always</MenuItem>
          <MenuItem value="no">Never</MenuItem>
        </TextField>
      </Box>
      {canWrite && Object.keys(form).length > 0 && (
        <Stack direction="row" sx={{ mt: 2, gap: 1 }}>
          <Button
            variant="contained"
            size="small"
            disabled={saveProfile.isPending}
            onClick={() => saveProfile.mutate()}
          >
            Save profile
          </Button>
          <Button size="small" onClick={() => setForm({})}>
            Cancel
          </Button>
        </Stack>
      )}

      <Typography variant="subtitle2" sx={{ mt: 3 }} gutterBottom>
        Tax declaration — FY {fy}
        {d && (
          <Chip
            size="small"
            label={d.status}
            color={d.status === 'LOCKED' ? 'default' : 'success'}
            sx={{ ml: 1 }}
          />
        )}
      </Typography>
      {lockDecl.isError && (
        <Alert severity="error" sx={{ mb: 1 }}>
          {errMsg(lockDecl.error)}
        </Alert>
      )}
      <Table size="small">
        <TableBody>
          <TableRow>
            <TableCell>Regime</TableCell>
            <TableCell align="right">{d?.regime ?? '—'}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>80C / 80D / 80CCD(1B)</TableCell>
            <TableCell align="right">
              {money(d?.deduction80C)} / {money(d?.deduction80D)} /{' '}
              {money(d?.deduction80CCD1B)}
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>HRA rent paid (annual)</TableCell>
            <TableCell align="right">{money(d?.hraRentPaid)}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Projected taxable income</TableCell>
            <TableCell align="right">
              {proj ? money(proj.taxableIncome) : '—'}
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Projected annual tax</TableCell>
            <TableCell align="right">
              {proj ? money(proj.totalTax) : '—'}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
      {canWrite && d && d.status !== 'LOCKED' && (
        <Button
          size="small"
          color="warning"
          sx={{ mt: 1 }}
          disabled={lockDecl.isPending}
          onClick={() => lockDecl.mutate()}
        >
          Lock declaration
        </Button>
      )}
    </Paper>
  );
}
