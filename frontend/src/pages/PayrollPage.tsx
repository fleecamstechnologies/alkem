import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { payrollApi } from '../api/payroll';
import { money } from '../format';
import {
  HR_MANAGE_ROLES,
  HR_WRITE_ROLES,
  TaxRegime,
  type ItSlab,
  type PayRun,
  type PtSlab,
  type StatutoryConfig,
} from '../types';
import { useAuth } from '../auth/AuthContext';
import { PayslipView } from '../components/PayslipView';

function errMsg(e: unknown): string {
  return (
    (e as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? 'Request failed'
  );
}

const runColor: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> =
  {
    DRAFT: 'default',
    PROCESSED: 'info',
    APPROVED: 'warning',
    PAID: 'success',
    CANCELLED: 'error',
  };

export function PayrollPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canManage = !!user && HR_MANAGE_ROLES.includes(user.role);
  const canWrite = !!user && HR_WRITE_ROLES.includes(user.role);

  const [tab, setTab] = useState(0);
  const [newMonth, setNewMonth] = useState(new Date().toISOString().slice(0, 7));
  const [openRun, setOpenRun] = useState<string | null>(null);
  const [openPayslip, setOpenPayslip] = useState<string | null>(null);

  const runsQuery = useQuery({ queryKey: ['pay-runs'], queryFn: payrollApi.runs });
  const componentsQuery = useQuery({
    queryKey: ['salary-components'],
    queryFn: payrollApi.components,
    enabled: tab === 1,
  });
  const payslipsQuery = useQuery({
    queryKey: ['run-payslips', openRun],
    queryFn: () => payrollApi.payslips(openRun!, { limit: 200 }),
    enabled: !!openRun,
  });

  const createMutation = useMutation({
    mutationFn: () => payrollApi.createRun(newMonth),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pay-runs'] }),
  });
  const actionMutation = useMutation({
    mutationFn: (v: { id: string; action: 'process' | 'approve' | 'mark-paid' }) =>
      payrollApi.runAction(v.id, v.action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pay-runs'] });
      queryClient.invalidateQueries({ queryKey: ['run-payslips'] });
    },
  });

  const runActions = (run: PayRun) => {
    if (!canManage) return null;
    const btns: Array<{ label: string; action: 'process' | 'approve' | 'mark-paid' }> =
      [];
    if (run.status === 'DRAFT' || run.status === 'PROCESSED')
      btns.push({ label: 'Process', action: 'process' });
    if (run.status === 'PROCESSED')
      btns.push({ label: 'Approve', action: 'approve' });
    if (run.status === 'APPROVED')
      btns.push({ label: 'Mark paid', action: 'mark-paid' });
    return (
      <Stack
        direction="row"
        spacing={1}
        sx={{ justifyContent: 'flex-end' }}
      >
        {btns.map((b) => (
          <Button
            key={b.action}
            size="small"
            onClick={() => actionMutation.mutate({ id: run.id, action: b.action })}
          >
            {b.label}
          </Button>
        ))}
      </Stack>
    );
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Payroll
      </Typography>

      <Paper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Pay runs" />
          <Tab label="Salary components" />
          <Tab label="Statutory" />
        </Tabs>
      </Paper>

      {tab === 0 && !openRun && (
        <>
          {canManage && (
            <Paper sx={{ p: 2, mb: 2 }}>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <TextField
                  label="Period"
                  type="month"
                  size="small"
                  value={newMonth}
                  onChange={(e) => setNewMonth(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <Button
                  variant="contained"
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending}
                >
                  Create pay run
                </Button>
                {createMutation.isError && (
                  <Alert severity="error">{errMsg(createMutation.error)}</Alert>
                )}
              </Stack>
            </Paper>
          )}

          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Period</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Employees</TableCell>
                  <TableCell align="right">Gross</TableCell>
                  <TableCell align="right">Deductions</TableCell>
                  <TableCell align="right">Net</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(runsQuery.data ?? []).map((run) => (
                  <TableRow key={run.id} hover>
                    <TableCell>
                      <Button size="small" onClick={() => setOpenRun(run.id)}>
                        {run.periodMonth}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={run.status}
                        color={runColor[run.status] ?? 'default'}
                      />
                    </TableCell>
                    <TableCell align="right">{run.employeeCount}</TableCell>
                    <TableCell align="right">{money(run.totalGross)}</TableCell>
                    <TableCell align="right">
                      {money(run.totalDeductions)}
                    </TableCell>
                    <TableCell align="right">{money(run.totalNet)}</TableCell>
                    <TableCell align="right">{runActions(run)}</TableCell>
                  </TableRow>
                ))}
                {(runsQuery.data ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      No pay runs yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {tab === 0 && openRun && (
        <>
          <Button size="small" onClick={() => { setOpenRun(null); setOpenPayslip(null); }}>
            ← Back to pay runs
          </Button>
          {openPayslip ? (
            <Box sx={{ mt: 2 }}>
              <Button size="small" onClick={() => setOpenPayslip(null)}>
                ← Back to payslips
              </Button>
              <Box sx={{ mt: 2 }}>
                <PayslipView payslipId={openPayslip} />
              </Box>
            </Box>
          ) : (
            <TableContainer component={Paper} sx={{ mt: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Employee</TableCell>
                    <TableCell align="right">LOP days</TableCell>
                    <TableCell align="right">Gross</TableCell>
                    <TableCell align="right">Deductions</TableCell>
                    <TableCell align="right">Net</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(payslipsQuery.data?.rows ?? []).map((p) => (
                    <TableRow
                      key={p.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => setOpenPayslip(p.id)}
                    >
                      <TableCell>
                        {p.employeeName ?? `#${p.employeeId}`}
                        {p.employeeCode ? ` (${p.employeeCode})` : ''}
                      </TableCell>
                      <TableCell align="right">{p.lopDays}</TableCell>
                      <TableCell align="right">
                        {money(p.grossEarnings)}
                      </TableCell>
                      <TableCell align="right">
                        {money(p.totalDeductions)}
                      </TableCell>
                      <TableCell align="right">{money(p.netPay)}</TableCell>
                      <TableCell>{p.status}</TableCell>
                    </TableRow>
                  ))}
                  {(payslipsQuery.data?.rows ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                        No payslips — process the run first.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}

      {tab === 1 && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Calculation</TableCell>
                <TableCell align="right">Default</TableCell>
                <TableCell>Active</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(componentsQuery.data ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.code}</TableCell>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>{c.type}</TableCell>
                  <TableCell>{c.calculationType}</TableCell>
                  <TableCell align="right">
                    {c.calculationType === 'PERCENT_OF_BASIC'
                      ? `${c.defaultValue}%`
                      : money(c.defaultValue)}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={c.active ? 'active' : 'inactive'}
                      color={c.active ? 'success' : 'default'}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {tab === 2 && <StatutoryTab canWrite={canWrite} />}
    </Box>
  );
}

// ---- Statutory tab -------------------------------------------------

const CONFIG_FIELDS: Array<{ key: keyof StatutoryConfig; label: string }> = [
  { key: 'financialYear', label: 'Financial year' },
  { key: 'pfWageCeiling', label: 'PF wage ceiling' },
  { key: 'pfEmployeeRate', label: 'PF employee %' },
  { key: 'pfEmployerRate', label: 'PF employer %' },
  { key: 'epsRate', label: 'EPS %' },
  { key: 'epsWageCeiling', label: 'EPS wage ceiling' },
  { key: 'edliRate', label: 'EDLI %' },
  { key: 'pfAdminRate', label: 'PF admin %' },
  { key: 'esiWageCeiling', label: 'ESI wage ceiling' },
  { key: 'esiEmployeeRate', label: 'ESI employee %' },
  { key: 'esiEmployerRate', label: 'ESI employer %' },
  { key: 'stdDeductionOld', label: 'Std deduction (old)' },
  { key: 'stdDeductionNew', label: 'Std deduction (new)' },
  { key: 'cessRate', label: 'Cess %' },
  { key: 'rebate87aOldLimit', label: '87A limit (old)' },
  { key: 'rebate87aNewLimit', label: '87A limit (new)' },
];

function StatutoryTab({ canWrite }: { canWrite: boolean }) {
  const qc = useQueryClient();
  const configQuery = useQuery({
    queryKey: ['statutory-config'],
    queryFn: payrollApi.statutoryConfig,
  });
  const ptQuery = useQuery({
    queryKey: ['pt-slabs'],
    queryFn: payrollApi.ptSlabs,
  });
  const [fy, setFy] = useState('');
  const [regime, setRegime] = useState<TaxRegime>(TaxRegime.NEW);
  const itQuery = useQuery({
    queryKey: ['it-slabs', fy || configQuery.data?.financialYear, regime],
    queryFn: () =>
      payrollApi.itSlabs(fy || configQuery.data!.financialYear, regime),
    enabled: !!(fy || configQuery.data?.financialYear),
  });

  const [cfg, setCfg] = useState<Partial<StatutoryConfig>>({});
  const saveCfg = useMutation({
    mutationFn: () => payrollApi.saveStatutoryConfig(cfg),
    onSuccess: () => {
      setCfg({});
      qc.invalidateQueries({ queryKey: ['statutory-config'] });
    },
  });

  const [editPt, setEditPt] = useState<PtSlab | null>(null);
  const [newPt, setNewPt] = useState(false);

  const c = { ...configQuery.data, ...cfg } as StatutoryConfig;

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Rates &amp; ceilings
        </Typography>
        {saveCfg.isError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errMsg(saveCfg.error)}
          </Alert>
        )}
        {configQuery.data && (
          <>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr 1fr',
                  md: 'repeat(4, 1fr)',
                },
                gap: 2,
              }}
            >
              {CONFIG_FIELDS.map((f) => (
                <TextField
                  key={f.key}
                  size="small"
                  label={f.label}
                  value={String(c[f.key] ?? '')}
                  disabled={!canWrite}
                  onChange={(e) =>
                    setCfg((p) => ({ ...p, [f.key]: e.target.value }))
                  }
                />
              ))}
            </Box>
            {canWrite && (
              <Stack direction="row" sx={{ mt: 2, gap: 1 }}>
                <Button
                  variant="contained"
                  disabled={
                    Object.keys(cfg).length === 0 || saveCfg.isPending
                  }
                  onClick={() => saveCfg.mutate()}
                >
                  Save config
                </Button>
                {Object.keys(cfg).length > 0 && (
                  <Button onClick={() => setCfg({})}>Reset</Button>
                )}
              </Stack>
            )}
          </>
        )}
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Stack
          direction="row"
          sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}
        >
          <Typography variant="subtitle1">Professional tax slabs</Typography>
          {canWrite && (
            <Button size="small" onClick={() => setNewPt(true)}>
              Add slab
            </Button>
          )}
        </Stack>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>State</TableCell>
                <TableCell align="right">Min gross</TableCell>
                <TableCell align="right">Max gross</TableCell>
                <TableCell align="right">Monthly</TableCell>
                <TableCell align="right">February</TableCell>
                <TableCell>Active</TableCell>
                {canWrite && <TableCell />}
              </TableRow>
            </TableHead>
            <TableBody>
              {(ptQuery.data ?? []).map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    {s.stateCode} · {s.stateName}
                  </TableCell>
                  <TableCell align="right">{money(s.minGross)}</TableCell>
                  <TableCell align="right">
                    {s.maxGross ? money(s.maxGross) : '∞'}
                  </TableCell>
                  <TableCell align="right">{money(s.monthlyAmount)}</TableCell>
                  <TableCell align="right">
                    {s.februaryAmount ? money(s.februaryAmount) : '—'}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={s.active ? 'yes' : 'no'}
                      color={s.active ? 'success' : 'default'}
                    />
                  </TableCell>
                  {canWrite && (
                    <TableCell align="right">
                      <Button size="small" onClick={() => setEditPt(s)}>
                        Edit
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Stack direction="row" sx={{ gap: 2, mb: 1, alignItems: 'center' }}>
          <Typography variant="subtitle1">Income-tax slabs</Typography>
          <TextField
            select
            size="small"
            label="Regime"
            value={regime}
            onChange={(e) => setRegime(e.target.value as TaxRegime)}
          >
            <MenuItem value="NEW">New</MenuItem>
            <MenuItem value="OLD">Old</MenuItem>
          </TextField>
          <TextField
            size="small"
            label="FY"
            placeholder={configQuery.data?.financialYear}
            value={fy}
            onChange={(e) => setFy(e.target.value)}
          />
        </Stack>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell align="right">From (annual)</TableCell>
              <TableCell align="right">To (annual)</TableCell>
              <TableCell align="right">Rate %</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(itQuery.data ?? []).map((s: ItSlab) => (
              <TableRow key={s.id}>
                <TableCell align="right">{money(s.minAnnual)}</TableCell>
                <TableCell align="right">
                  {s.maxAnnual ? money(s.maxAnnual) : '∞'}
                </TableCell>
                <TableCell align="right">{s.ratePercent}</TableCell>
              </TableRow>
            ))}
            {(itQuery.data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                  No slabs for this regime / FY.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      {(editPt || newPt) && (
        <PtSlabDialog
          slab={editPt}
          defaultEffectiveFrom={
            configQuery.data
              ? `${configQuery.data.financialYear.split('-')[0]}-04-01`
              : new Date().toISOString().slice(0, 10)
          }
          onClose={() => {
            setEditPt(null);
            setNewPt(false);
            qc.invalidateQueries({ queryKey: ['pt-slabs'] });
          }}
        />
      )}
    </Stack>
  );
}

function PtSlabDialog({
  slab,
  defaultEffectiveFrom,
  onClose,
}: {
  slab: PtSlab | null;
  defaultEffectiveFrom: string;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    stateCode: slab?.stateCode ?? '',
    stateName: slab?.stateName ?? '',
    minGross: slab?.minGross ?? '0',
    maxGross: slab?.maxGross ?? '',
    monthlyAmount: slab?.monthlyAmount ?? '0',
    februaryAmount: slab?.februaryAmount ?? '',
    active: slab?.active ?? true,
  });
  const set = (k: keyof typeof form, v: unknown) =>
    setForm((f) => ({ ...f, [k]: v }));
  const mut = useMutation({
    mutationFn: () => {
      const body = {
        stateName: form.stateName,
        minGross: form.minGross || '0',
        maxGross: form.maxGross === '' ? null : form.maxGross,
        monthlyAmount: form.monthlyAmount || '0',
        februaryAmount: form.februaryAmount === '' ? null : form.februaryAmount,
        active: form.active,
      };
      return slab
        ? payrollApi.updatePtSlab(slab.id, body)
        : payrollApi.createPtSlab({
            ...body,
            stateCode: form.stateCode.toUpperCase(),
            effectiveFrom: defaultEffectiveFrom,
          });
    },
    onSuccess: onClose,
  });
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{slab ? `Edit ${slab.stateCode} slab` : 'New PT slab'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {mut.isError && <Alert severity="error">{errMsg(mut.error)}</Alert>}
          <Stack direction="row" spacing={2}>
            <TextField
              label="State code"
              value={form.stateCode}
              disabled={!!slab}
              onChange={(e) => set('stateCode', e.target.value)}
              sx={{ width: 120 }}
            />
            <TextField
              label="State name"
              fullWidth
              value={form.stateName}
              onChange={(e) => set('stateName', e.target.value)}
            />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Min gross"
              value={form.minGross}
              onChange={(e) => set('minGross', e.target.value)}
            />
            <TextField
              label="Max gross (blank = ∞)"
              value={form.maxGross}
              onChange={(e) => set('maxGross', e.target.value)}
            />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Monthly amount"
              value={form.monthlyAmount}
              onChange={(e) => set('monthlyAmount', e.target.value)}
            />
            <TextField
              label="February amount"
              value={form.februaryAmount}
              onChange={(e) => set('februaryAmount', e.target.value)}
            />
          </Stack>
          <TextField
            select
            label="Active"
            value={form.active ? 'yes' : 'no'}
            onChange={(e) => set('active', e.target.value === 'yes')}
          >
            <MenuItem value="yes">Yes</MenuItem>
            <MenuItem value="no">No</MenuItem>
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!form.stateCode || !form.stateName || mut.isPending}
          onClick={() => mut.mutate()}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
