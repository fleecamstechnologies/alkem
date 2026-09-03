import { useMemo, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Link,
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
import { employeesApi } from '../api/employees';
import { usersApi } from '../api/users';
import { payrollApi, type StructureLineInput } from '../api/payroll';
import { attendanceApi, leaveApi } from '../api/attendance';
import { money, todayISO } from '../format';
import {
  HR_MANAGE_ROLES,
  HR_WRITE_ROLES,
  UserRole,
  type Employee,
} from '../types';
import { StatutoryCard } from '../components/StatutoryCard';
import { useAuth } from '../auth/AuthContext';
import { EmployeeFormDialog } from '../components/EmployeeFormDialog';
import { SalaryStructureDialog } from '../components/SalaryStructureDialog';
import { PayslipView } from '../components/PayslipView';

function errMsg(e: unknown): string {
  return (
    (e as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? 'Request failed'
  );
}

const monthNow = () => new Date().toISOString().slice(0, 7);

export function EmployeeDetailPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canWrite = !!user && HR_WRITE_ROLES.includes(user.role);
  const canManage = !!user && HR_MANAGE_ROLES.includes(user.role);

  const [tab, setTab] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [structOpen, setStructOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [periodMonth, setPeriodMonth] = useState(monthNow());
  const [openPayslip, setOpenPayslip] = useState<string | null>(null);
  const [leaveForm, setLeaveForm] = useState({
    leaveTypeId: '',
    fromDate: todayISO(),
    toDate: todayISO(),
    reason: '',
  });

  const employeeQuery = useQuery({
    queryKey: ['employee', id],
    queryFn: () => employeesApi.get(id),
  });
  const structureQuery = useQuery({
    queryKey: ['structure', id],
    queryFn: () => payrollApi.structure(id),
    enabled: tab === 1,
  });
  const payslipsQuery = useQuery({
    queryKey: ['employee-payslips', id],
    queryFn: () => payrollApi.employeePayslips(id),
    enabled: tab === 2,
  });
  const gridQuery = useQuery({
    queryKey: ['emp-attendance', id, periodMonth],
    queryFn: () => attendanceApi.monthGrid(id, periodMonth),
    enabled: tab === 3,
  });
  const leaveTypesQuery = useQuery({
    queryKey: ['leave-types'],
    queryFn: leaveApi.types,
    enabled: tab === 4,
  });
  const balancesQuery = useQuery({
    queryKey: ['leave-balances', id],
    queryFn: () => leaveApi.balances(id),
    enabled: tab === 4,
  });
  const requestsQuery = useQuery({
    queryKey: ['leave-requests', id],
    queryFn: () => leaveApi.requests({ employeeId: Number(id) }),
    enabled: tab === 4,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Partial<Employee>) =>
      employeesApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
      setEditOpen(false);
    },
  });
  const assignMutation = useMutation({
    mutationFn: (payload: {
      effectiveFrom: string;
      basicMonthly: string;
      lines: StructureLineInput[];
    }) => payrollApi.assignStructure(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['structure', id] });
      setStructOpen(false);
    },
  });
  const leaveMutation = useMutation({
    mutationFn: () =>
      leaveApi.request({
        employeeId: Number(id),
        leaveTypeId: Number(leaveForm.leaveTypeId),
        fromDate: leaveForm.fromDate,
        toDate: leaveForm.toDate,
        reason: leaveForm.reason || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests', id] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances', id] });
      setLeaveForm((f) => ({ ...f, reason: '' }));
    },
  });

  const loginMutation = useMutation({
    mutationFn: () =>
      usersApi.create({
        email: loginForm.email,
        password: loginForm.password,
        name: `${employeeQuery.data?.firstName ?? ''} ${
          employeeQuery.data?.lastName ?? ''
        }`.trim(),
        role: UserRole.EMPLOYEE,
        employeeId: Number(id),
      }),
    onSuccess: () => {
      setLoginOpen(false);
      setLoginForm({ email: '', password: '' });
    },
  });

  const employee = employeeQuery.data;
  const leaveTypeName = useMemo(() => {
    const m = new Map(
      (leaveTypesQuery.data ?? []).map((t) => [t.id, t.code]),
    );
    return (tid: string) => m.get(tid) ?? tid;
  }, [leaveTypesQuery.data]);

  if (employeeQuery.isLoading) return <CircularProgress />;
  if (employeeQuery.isError || !employee)
    return <Alert severity="error">Employee not found.</Alert>;

  return (
    <Box>
      <Link component={RouterLink} to="/employees">
        ← Back to employees
      </Link>

      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mt: 1, mb: 2 }}
      >
        <Box>
          <Typography variant="h5">
            {employee.firstName} {employee.lastName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {employee.code} · {employee.designation || 'no designation'} ·{' '}
            {employee.employmentType} · joined {employee.dateOfJoining}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Chip
            label={employee.status}
            color={employee.status === 'ACTIVE' ? 'success' : 'default'}
          />
          {canWrite && (
            <Button variant="outlined" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
          )}
        </Stack>
      </Stack>

      <Paper>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable">
          <Tab label="Profile" />
          <Tab label="Salary" />
          <Tab label="Payslips" />
          <Tab label="Attendance" />
          <Tab label="Leave" />
        </Tabs>

        <Box sx={{ p: 2 }}>
          {tab === 0 && (
            <>
              {canWrite && (
                <Stack
                  direction="row"
                  sx={{ justifyContent: 'flex-end', mb: 1 }}
                >
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setLoginForm({
                        email: employee.email ?? '',
                        password: '',
                      });
                      setLoginOpen(true);
                    }}
                  >
                    Create portal login
                  </Button>
                </Stack>
              )}
              <Grid container spacing={2}>
                {[
                  ['Email', employee.email],
                  ['Phone', employee.phone],
                  ['Work location', employee.workLocation],
                  ['Annual CTC', money(employee.ctcAnnual)],
                  ['Bank account', employee.bankAccountNumber],
                  ['IFSC', employee.bankIfsc],
                  ['PAN', employee.panNumber],
                  ['UAN', employee.uanNumber],
                ].map(([label, value]) => (
                  <Grid size={{ xs: 12, sm: 6 }} key={label}>
                    <Typography variant="body2" color="text.secondary">
                      {label}
                    </Typography>
                    <Typography>{value || '—'}</Typography>
                  </Grid>
                ))}
              </Grid>
            </>
          )}

          {tab === 1 && (
            <>
              <Stack
                direction="row"
                sx={{ justifyContent: 'flex-end', mb: 2 }}
              >
                {canWrite && (
                  <Button variant="contained" onClick={() => setStructOpen(true)}>
                    Revise structure
                  </Button>
                )}
              </Stack>
              {structureQuery.isLoading ? (
                <CircularProgress />
              ) : structureQuery.data ? (
                <>
                  <Stack direction="row" spacing={4} sx={{ mb: 2 }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Basic (monthly)
                      </Typography>
                      <Typography variant="h6">
                        {money(structureQuery.data.basicMonthly)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Gross (monthly)
                      </Typography>
                      <Typography variant="h6">
                        {money(structureQuery.data.grossMonthly)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Effective from
                      </Typography>
                      <Typography variant="h6">
                        {structureQuery.data.effectiveFrom}
                      </Typography>
                    </Box>
                  </Stack>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Component</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Basis</TableCell>
                        <TableCell align="right">Monthly</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        <TableCell>Basic</TableCell>
                        <TableCell>EARNING</TableCell>
                        <TableCell>FIXED</TableCell>
                        <TableCell align="right">
                          {money(structureQuery.data.basicMonthly)}
                        </TableCell>
                      </TableRow>
                      {structureQuery.data.lines.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell>
                            {l.component?.name ?? l.componentId}
                          </TableCell>
                          <TableCell>{l.component?.type ?? '—'}</TableCell>
                          <TableCell>
                            {l.calculationType === 'PERCENT_OF_BASIC'
                              ? `${l.value}% of basic`
                              : 'Fixed'}
                          </TableCell>
                          <TableCell align="right">
                            {money(l.computedMonthly)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              ) : (
                <Alert severity="info">
                  No salary structure assigned yet.
                </Alert>
              )}

              <StatutoryCard employeeId={id} canWrite={canWrite} />
            </>
          )}

          {tab === 2 && (
            <>
              {openPayslip ? (
                <>
                  <Button size="small" onClick={() => setOpenPayslip(null)}>
                    ← Back to list
                  </Button>
                  <Box sx={{ mt: 2 }}>
                    <PayslipView payslipId={openPayslip} />
                  </Box>
                </>
              ) : payslipsQuery.isLoading ? (
                <CircularProgress />
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Period</TableCell>
                      <TableCell align="right">Gross</TableCell>
                      <TableCell align="right">Deductions</TableCell>
                      <TableCell align="right">Net</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(payslipsQuery.data ?? []).map((p) => (
                      <TableRow
                        key={p.id}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => setOpenPayslip(p.id)}
                      >
                        <TableCell>{p.periodMonth}</TableCell>
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
                    {(payslipsQuery.data ?? []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                          No payslips yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </>
          )}

          {tab === 3 && (
            <>
              <TextField
                label="Month"
                type="month"
                size="small"
                value={periodMonth}
                onChange={(e) => setPeriodMonth(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ mb: 2 }}
              />
              {gridQuery.isLoading ? (
                <CircularProgress />
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Note</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(gridQuery.data ?? []).map((d) => (
                        <TableRow key={d.date}>
                          <TableCell>{d.date}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={d.status}
                              variant={d.recorded ? 'filled' : 'outlined'}
                              color={
                                d.status === 'ABSENT'
                                  ? 'error'
                                  : d.status === 'ON_LEAVE' ||
                                      d.status === 'HALF_DAY'
                                    ? 'warning'
                                    : d.status === 'PRESENT'
                                      ? 'success'
                                      : 'default'
                              }
                            />
                          </TableCell>
                          <TableCell>{d.note || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </>
          )}

          {tab === 4 && (
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 5 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Leave balances ({new Date().getFullYear()})
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell align="right">Entitled</TableCell>
                      <TableCell align="right">Used</TableCell>
                      <TableCell align="right">Pending</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(balancesQuery.data ?? []).map((b) => (
                      <TableRow key={b.id}>
                        <TableCell>{leaveTypeName(b.leaveTypeId)}</TableCell>
                        <TableCell align="right">{b.entitled}</TableCell>
                        <TableCell align="right">{b.used}</TableCell>
                        <TableCell align="right">{b.pending}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {canManage && (
                  <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Request leave
                    </Typography>
                    <Stack spacing={1.5}>
                      <TextField
                        select
                        size="small"
                        label="Type"
                        value={leaveForm.leaveTypeId}
                        onChange={(e) =>
                          setLeaveForm((f) => ({
                            ...f,
                            leaveTypeId: e.target.value,
                          }))
                        }
                      >
                        {(leaveTypesQuery.data ?? []).map((t) => (
                          <MenuItem key={t.id} value={t.id}>
                            {t.name} {t.paid ? '' : '(unpaid)'}
                          </MenuItem>
                        ))}
                      </TextField>
                      <Stack direction="row" spacing={1}>
                        <TextField
                          type="date"
                          size="small"
                          label="From"
                          value={leaveForm.fromDate}
                          onChange={(e) =>
                            setLeaveForm((f) => ({
                              ...f,
                              fromDate: e.target.value,
                            }))
                          }
                          slotProps={{ inputLabel: { shrink: true } }}
                        />
                        <TextField
                          type="date"
                          size="small"
                          label="To"
                          value={leaveForm.toDate}
                          onChange={(e) =>
                            setLeaveForm((f) => ({
                              ...f,
                              toDate: e.target.value,
                            }))
                          }
                          slotProps={{ inputLabel: { shrink: true } }}
                        />
                      </Stack>
                      <TextField
                        size="small"
                        label="Reason"
                        value={leaveForm.reason}
                        onChange={(e) =>
                          setLeaveForm((f) => ({
                            ...f,
                            reason: e.target.value,
                          }))
                        }
                      />
                      {leaveMutation.isError && (
                        <Alert severity="error">
                          {errMsg(leaveMutation.error)}
                        </Alert>
                      )}
                      <Button
                        variant="contained"
                        size="small"
                        disabled={
                          !leaveForm.leaveTypeId || leaveMutation.isPending
                        }
                        onClick={() => leaveMutation.mutate()}
                      >
                        Submit request
                      </Button>
                    </Stack>
                  </Paper>
                )}
              </Grid>

              <Grid size={{ xs: 12, md: 7 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Requests
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell>From</TableCell>
                      <TableCell>To</TableCell>
                      <TableCell align="right">Days</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(requestsQuery.data ?? []).map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{leaveTypeName(r.leaveTypeId)}</TableCell>
                        <TableCell>{r.fromDate}</TableCell>
                        <TableCell>{r.toDate}</TableCell>
                        <TableCell align="right">{r.days}</TableCell>
                        <TableCell>{r.status}</TableCell>
                      </TableRow>
                    ))}
                    {(requestsQuery.data ?? []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                          No leave requests.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Grid>
            </Grid>
          )}
        </Box>
      </Paper>

      <EmployeeFormDialog
        open={editOpen}
        title="Edit employee"
        initial={employee}
        onClose={() => setEditOpen(false)}
        onSubmit={(payload) => updateMutation.mutate(payload)}
        submitting={updateMutation.isPending}
        error={updateMutation.isError ? errMsg(updateMutation.error) : null}
      />
      <SalaryStructureDialog
        open={structOpen}
        current={structureQuery.data ?? null}
        onClose={() => setStructOpen(false)}
        onSubmit={(payload) => assignMutation.mutate(payload)}
        submitting={assignMutation.isPending}
        error={assignMutation.isError ? errMsg(assignMutation.error) : null}
      />

      <Dialog
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Create portal login</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {loginMutation.isError && (
              <Alert severity="error">{errMsg(loginMutation.error)}</Alert>
            )}
            {loginMutation.isSuccess && (
              <Alert severity="success">Login created.</Alert>
            )}
            <TextField
              label="Email"
              value={loginForm.email}
              onChange={(e) =>
                setLoginForm((f) => ({ ...f, email: e.target.value }))
              }
            />
            <TextField
              label="Password (min 8 chars)"
              type="password"
              value={loginForm.password}
              onChange={(e) =>
                setLoginForm((f) => ({ ...f, password: e.target.value }))
              }
            />
            <Typography variant="caption" color="text.secondary">
              Role EMPLOYEE, linked to this employee.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLoginOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={
              loginMutation.isPending ||
              !loginForm.email ||
              loginForm.password.length < 8
            }
            onClick={() => loginMutation.mutate()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
