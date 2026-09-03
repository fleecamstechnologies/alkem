import { useState } from 'react';
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
import { portalApi } from '../api/portal';
import { leaveApi } from '../api/attendance';
import { money, todayISO } from '../format';
import { TaxRegime, type Employee } from '../types';
import { PayslipView } from '../components/PayslipView';

function errMsg(e: unknown): string {
  return (
    (e as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? 'Request failed'
  );
}
const monthNow = () => new Date().toISOString().slice(0, 7);

export function PortalPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [periodMonth, setPeriodMonth] = useState(monthNow());
  const [openPayslip, setOpenPayslip] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [profileForm, setProfileForm] = useState<Partial<Employee>>({});
  const [leaveForm, setLeaveForm] = useState({
    leaveTypeId: '',
    fromDate: todayISO(),
    toDate: todayISO(),
    reason: '',
  });

  const meQuery = useQuery({ queryKey: ['me'], queryFn: portalApi.me });
  const payslipsQuery = useQuery({
    queryKey: ['me-payslips'],
    queryFn: portalApi.payslips,
    enabled: tab === 1,
  });
  const gridQuery = useQuery({
    queryKey: ['me-attendance', periodMonth],
    queryFn: () => portalApi.attendance(periodMonth),
    enabled: tab === 3,
  });
  const balancesQuery = useQuery({
    queryKey: ['me-balances'],
    queryFn: () => portalApi.leaveBalances(new Date().getFullYear()),
    enabled: tab === 4,
  });
  const requestsQuery = useQuery({
    queryKey: ['me-leave-requests'],
    queryFn: portalApi.leaveRequests,
    enabled: tab === 4,
  });
  const leaveTypesQuery = useQuery({
    queryKey: ['leave-types'],
    queryFn: leaveApi.types,
    enabled: tab === 4,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Partial<Employee>) =>
      portalApi.updateProfile(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] });
      setEditOpen(false);
    },
  });
  const leaveMutation = useMutation({
    mutationFn: () =>
      portalApi.requestLeave({
        leaveTypeId: Number(leaveForm.leaveTypeId),
        fromDate: leaveForm.fromDate,
        toDate: leaveForm.toDate,
        reason: leaveForm.reason || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me-leave-requests'] });
      qc.invalidateQueries({ queryKey: ['me-balances'] });
      setLeaveForm((f) => ({ ...f, reason: '' }));
    },
  });
  const cancelMutation = useMutation({
    mutationFn: (id: string) => portalApi.cancelLeave(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me-leave-requests'] });
      qc.invalidateQueries({ queryKey: ['me-balances'] });
    },
  });

  const me = meQuery.data;
  const typeName = (id: string) =>
    (leaveTypesQuery.data ?? []).find((t) => String(t.id) === String(id))?.code ??
    id;

  if (meQuery.isLoading) return <CircularProgress />;
  if (meQuery.isError || !me)
    return <Alert severity="error">Could not load your profile.</Alert>;

  return (
    <Box>
      <Typography variant="h5">
        {me.firstName} {me.lastName}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {me.code} · {me.designation || '—'} · joined {me.dateOfJoining}
      </Typography>

      <Paper>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable">
          <Tab label="Profile" />
          <Tab label="Payslips" />
          <Tab label="Punch" />
          <Tab label="Attendance" />
          <Tab label="Leave" />
          <Tab label="Tax declaration" />
        </Tabs>
        <Box sx={{ p: 2 }}>
          {tab === 0 && (
            <>
              <Stack
                direction="row"
                sx={{ justifyContent: 'flex-end', mb: 1 }}
              >
                <Button
                  variant="outlined"
                  onClick={() => {
                    setProfileForm({
                      phone: me.phone ?? '',
                      bankAccountName: me.bankAccountName ?? '',
                      bankAccountNumber: me.bankAccountNumber ?? '',
                      bankName: me.bankName ?? '',
                      bankIfsc: me.bankIfsc ?? '',
                    });
                    setEditOpen(true);
                  }}
                >
                  Update contact / bank
                </Button>
              </Stack>
              <Grid container spacing={2}>
                {[
                  ['Email', me.email],
                  ['Phone', me.phone],
                  ['Department id', me.departmentId],
                  ['Employment type', me.employmentType],
                  ['Status', me.status],
                  ['Annual CTC', money(me.ctcAnnual)],
                  ['Bank account', me.bankAccountNumber],
                  ['Bank', me.bankName],
                  ['IFSC', me.bankIfsc],
                  ['PF no.', me.pfNumber],
                  ['UAN', me.uanNumber],
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

          {tab === 2 && <PunchTab />}

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
                  My balances ({new Date().getFullYear()})
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
                        <TableCell>{typeName(b.leaveTypeId)}</TableCell>
                        <TableCell align="right">{b.entitled}</TableCell>
                        <TableCell align="right">{b.used}</TableCell>
                        <TableCell align="right">{b.pending}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Apply for leave
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
                        setLeaveForm((f) => ({ ...f, reason: e.target.value }))
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
                      disabled={!leaveForm.leaveTypeId || leaveMutation.isPending}
                      onClick={() => leaveMutation.mutate()}
                    >
                      Submit
                    </Button>
                  </Stack>
                </Paper>
              </Grid>

              <Grid size={{ xs: 12, md: 7 }}>
                <Typography variant="subtitle2" gutterBottom>
                  My requests
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell>From</TableCell>
                      <TableCell>To</TableCell>
                      <TableCell align="right">Days</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(requestsQuery.data ?? []).map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{typeName(r.leaveTypeId)}</TableCell>
                        <TableCell>{r.fromDate}</TableCell>
                        <TableCell>{r.toDate}</TableCell>
                        <TableCell align="right">{r.days}</TableCell>
                        <TableCell>{r.status}</TableCell>
                        <TableCell align="right">
                          {(r.status === 'PENDING' ||
                            r.status === 'APPROVED') && (
                            <Button
                              size="small"
                              onClick={() => cancelMutation.mutate(r.id)}
                            >
                              Cancel
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(requestsQuery.data ?? []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                          No leave requests.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Grid>
            </Grid>
          )}

          {tab === 5 && <TaxDeclarationTab />}
        </Box>
      </Paper>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Update contact &amp; bank details</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {updateMutation.isError && (
              <Alert severity="error">{errMsg(updateMutation.error)}</Alert>
            )}
            {(
              [
                ['phone', 'Phone'],
                ['bankAccountName', 'Account holder name'],
                ['bankAccountNumber', 'Account number'],
                ['bankName', 'Bank'],
                ['bankIfsc', 'IFSC'],
              ] as [keyof Employee, string][]
            ).map(([key, label]) => (
              <TextField
                key={key}
                label={label}
                value={(profileForm[key] as string) ?? ''}
                onChange={(e) =>
                  setProfileForm((f) => ({ ...f, [key]: e.target.value }))
                }
              />
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={updateMutation.isPending}
            onClick={() => updateMutation.mutate(profileForm)}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ---- Punch tab --------------------------------------------------

function localToday(): string {
  return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local tz
}
function hhmm(iso: string | null): string {
  return iso
    ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '—';
}
function mins(n: number): string {
  const h = Math.floor(n / 60);
  const m = n % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

function PunchTab() {
  const qc = useQueryClient();
  const [geoError, setGeoError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const statusQuery = useQuery({
    queryKey: ['me-punch-status'],
    queryFn: () => portalApi.punchStatus(),
    refetchInterval: 60_000,
  });
  const s = statusQuery.data;

  const doPunch = (type: string) => {
    setGeoError(null);
    if (!('geolocation' in navigator)) {
      setGeoError('This device has no location support.');
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await portalApi.punch({
            type: type as never,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracyM: Math.round(pos.coords.accuracy),
            localDate: localToday(),
          });
          qc.invalidateQueries({ queryKey: ['me-punch-status'] });
          qc.invalidateQueries({ queryKey: ['me-attendance'] });
        } catch (e) {
          setGeoError(errMsg(e));
        } finally {
          setBusy(false);
        }
      },
      (err) => {
        setBusy(false);
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied — allow location access to punch.'
            : 'Could not get your location. Move to an open area and retry.',
        );
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  };

  const stateLabel =
    s?.state === 'IN'
      ? `Punched in since ${hhmm(s.since)}`
      : s?.state === 'ON_BREAK'
        ? `On break since ${hhmm(s.since)}`
        : 'Punched out';
  const stateColor =
    s?.state === 'IN' ? 'success' : s?.state === 'ON_BREAK' ? 'warning' : 'default';

  return (
    <Stack spacing={3}>
      <Paper variant="outlined" sx={{ p: 3 }}>
        {statusQuery.isLoading ? (
          <CircularProgress />
        ) : (
          <>
            <Stack
              direction="row"
              sx={{ alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}
            >
              <Chip label={stateLabel} color={stateColor} />
              {s?.office && (
                <Typography variant="body2" color="text.secondary">
                  {s.office.name} · ~{s.office.distanceM} m away
                </Typography>
              )}
            </Stack>

            {geoError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {geoError}
              </Alert>
            )}

            <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', mb: 2 }}>
              {s?.state === 'OUT' && (
                <Button
                  variant="contained"
                  disabled={busy}
                  onClick={() => doPunch('PUNCH_IN')}
                >
                  Punch in
                </Button>
              )}
              {s?.state === 'IN' && (
                <>
                  <Button
                    variant="outlined"
                    disabled={busy}
                    onClick={() => doPunch('BREAK_START')}
                  >
                    Start break
                  </Button>
                  <Button
                    variant="contained"
                    color="error"
                    disabled={busy}
                    onClick={() => doPunch('PUNCH_OUT')}
                  >
                    Punch out
                  </Button>
                </>
              )}
              {s?.state === 'ON_BREAK' && (
                <>
                  <Button
                    variant="contained"
                    disabled={busy}
                    onClick={() => doPunch('BREAK_END')}
                  >
                    End break
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    disabled={busy}
                    onClick={() => doPunch('PUNCH_OUT')}
                  >
                    Punch out
                  </Button>
                </>
              )}
            </Stack>

            <Stack direction="row" spacing={4} sx={{ flexWrap: 'wrap' }}>
              <Metric label="First in" value={hhmm(s?.firstInAt ?? null)} />
              <Metric label="Last out" value={hhmm(s?.lastOutAt ?? null)} />
              <Metric label="Worked" value={mins(s?.workedMinutes ?? 0)} />
              <Metric label="Break" value={mins(s?.breakMinutes ?? 0)} />
              <Metric label="Today" value={s?.status ?? '—'} />
            </Stack>
          </>
        )}
      </Paper>

      {!!s?.events.length && (
        <Paper variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Time</TableCell>
                <TableCell>Event</TableCell>
                <TableCell>Where</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {s.events.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{hhmm(e.eventAt)}</TableCell>
                  <TableCell>{e.type.replace('_', ' ')}</TableCell>
                  <TableCell>
                    {e.source === 'REGULARIZATION'
                      ? 'Regularized'
                      : e.officeName
                        ? `${e.officeName}${e.distanceM != null ? ` · ${e.distanceM} m` : ''}`
                        : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      <RegularizationPanel />
    </Stack>
  );
}

function RegularizationPanel() {
  const qc = useQueryClient();
  const listQuery = useQuery({
    queryKey: ['me-regularizations'],
    queryFn: portalApi.regularizations,
  });
  const [form, setForm] = useState({
    date: '',
    inTime: '09:30',
    outTime: '18:00',
    reason: '',
  });
  const mut = useMutation({
    mutationFn: () =>
      portalApi.requestRegularization({
        date: form.date,
        inAt: `${form.date}T${form.inTime}`,
        outAt: `${form.date}T${form.outTime}`,
        reason: form.reason,
      }),
    onSuccess: () => {
      setForm((f) => ({ ...f, reason: '' }));
      qc.invalidateQueries({ queryKey: ['me-regularizations'] });
    },
  });
  const cancelMut = useMutation({
    mutationFn: (id: string) => portalApi.cancelRegularization(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['me-regularizations'] }),
  });

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle2" gutterBottom>
        Regularization — forgot to punch?
      </Typography>
      {mut.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errMsg(mut.error)}
        </Alert>
      )}
      <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', mb: 2 }}>
        <TextField
          type="date"
          size="small"
          label="Date"
          value={form.date}
          onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          type="time"
          size="small"
          label="In time"
          value={form.inTime}
          onChange={(e) => setForm((f) => ({ ...f, inTime: e.target.value }))}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          type="time"
          size="small"
          label="Out time"
          value={form.outTime}
          onChange={(e) => setForm((f) => ({ ...f, outTime: e.target.value }))}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          size="small"
          label="Reason"
          value={form.reason}
          onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
          sx={{ minWidth: 220 }}
        />
        <Button
          variant="contained"
          disabled={!form.date || !form.reason || mut.isPending}
          onClick={() => mut.mutate()}
        >
          Request
        </Button>
      </Stack>

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Date</TableCell>
            <TableCell>In</TableCell>
            <TableCell>Out</TableCell>
            <TableCell>Reason</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right" />
          </TableRow>
        </TableHead>
        <TableBody>
          {(listQuery.data ?? []).map((r) => (
            <TableRow key={r.id}>
              <TableCell>{r.date}</TableCell>
              <TableCell>{hhmm(r.requestedInAt)}</TableCell>
              <TableCell>{hhmm(r.requestedOutAt)}</TableCell>
              <TableCell>{r.reason}</TableCell>
              <TableCell>
                <Chip
                  size="small"
                  label={r.status}
                  color={
                    r.status === 'APPROVED'
                      ? 'success'
                      : r.status === 'REJECTED'
                        ? 'error'
                        : r.status === 'CANCELLED'
                          ? 'default'
                          : 'warning'
                  }
                />
              </TableCell>
              <TableCell align="right">
                {r.status === 'PENDING' && (
                  <Button
                    size="small"
                    onClick={() => cancelMut.mutate(r.id)}
                  >
                    Cancel
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
          {(listQuery.data ?? []).length === 0 && (
            <TableRow>
              <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                No regularization requests.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
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

// ---- Tax declaration tab -----------------------------------------

function currentFy(): string {
  const d = new Date();
  const start = d.getMonth() + 1 >= 4 ? d.getFullYear() : d.getFullYear() - 1;
  return `${start}-${start + 1}`;
}

const DECL_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'deduction80C', label: '80C investments (max ₹1.5L)' },
  { key: 'deduction80D', label: '80D medical insurance' },
  { key: 'deduction80CCD1B', label: '80CCD(1B) NPS (max ₹50k)' },
  { key: 'hraRentPaid', label: 'Annual rent paid (HRA)' },
  { key: 'homeLoanInterest', label: 'Home-loan interest (max ₹2L)' },
];

function TaxDeclarationTab() {
  const qc = useQueryClient();
  const fy = currentFy();
  const q = useQuery({
    queryKey: ['me-tax-decl', fy],
    queryFn: () => portalApi.taxDeclaration(fy),
  });
  const [form, setForm] = useState<Record<string, string>>({});
  const [regime, setRegime] = useState<TaxRegime | ''>('');
  const [metro, setMetro] = useState<boolean | null>(null);

  const d = q.data?.declaration;
  const locked = d?.status === 'LOCKED';
  const val = (k: string) =>
    form[k] ?? (d ? String((d as unknown as Record<string, string>)[k]) : '0');
  const reg = regime || d?.regime || TaxRegime.NEW;
  const metroCity = metro ?? d?.metroCity ?? false;

  const save = useMutation({
    mutationFn: () =>
      portalApi.saveTaxDeclaration(fy, {
        regime: reg,
        metroCity,
        deduction80C: val('deduction80C'),
        deduction80D: val('deduction80D'),
        deduction80CCD1B: val('deduction80CCD1B'),
        hraRentPaid: val('hraRentPaid'),
        homeLoanInterest: val('homeLoanInterest'),
      }),
    onSuccess: () => {
      setForm({});
      setRegime('');
      setMetro(null);
      qc.invalidateQueries({ queryKey: ['me-tax-decl'] });
    },
  });

  if (q.isLoading) return <CircularProgress />;
  if (!q.data) return <Typography>Could not load your declaration.</Typography>;

  const cmp = q.data.regimeComparison;

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: 6 }}>
        <Typography variant="subtitle2" gutterBottom>
          Declaration for FY {fy}
          {d && (
            <Chip
              size="small"
              label={d.status}
              color={locked ? 'default' : 'success'}
              sx={{ ml: 1 }}
            />
          )}
        </Typography>
        {save.isError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errMsg(save.error)}
          </Alert>
        )}
        {locked && (
          <Alert severity="info" sx={{ mb: 2 }}>
            HR has locked this declaration — contact HR to change it.
          </Alert>
        )}
        <Stack spacing={2}>
          <TextField
            select
            size="small"
            label="Tax regime"
            value={reg}
            disabled={locked}
            onChange={(e) => setRegime(e.target.value as TaxRegime)}
          >
            <MenuItem value="NEW">New regime</MenuItem>
            <MenuItem value="OLD">Old regime (with deductions)</MenuItem>
          </TextField>
          {reg === 'OLD' && (
            <>
              {DECL_FIELDS.map((f) => (
                <TextField
                  key={f.key}
                  size="small"
                  label={f.label}
                  value={val(f.key)}
                  disabled={locked}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, [f.key]: e.target.value }))
                  }
                />
              ))}
              <TextField
                select
                size="small"
                label="Metro city (HRA 50% vs 40%)"
                value={metroCity ? 'yes' : 'no'}
                disabled={locked}
                onChange={(e) => setMetro(e.target.value === 'yes')}
              >
                <MenuItem value="yes">Yes</MenuItem>
                <MenuItem value="no">No</MenuItem>
              </TextField>
            </>
          )}
          <Button
            variant="contained"
            disabled={locked || save.isPending}
            onClick={() => save.mutate()}
          >
            Save declaration
          </Button>
        </Stack>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <Typography variant="subtitle2" gutterBottom>
          Projected annual tax
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Regime</TableCell>
              <TableCell align="right">Taxable income</TableCell>
              <TableCell align="right">Total tax</TableCell>
              <TableCell align="right">≈ per month</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(['old', 'new'] as const).map((k) => {
              const r = cmp[k];
              return (
                <TableRow
                  key={k}
                  selected={reg.toLowerCase() === k}
                >
                  <TableCell>{k === 'old' ? 'Old' : 'New'}</TableCell>
                  <TableCell align="right">
                    {r ? money(r.taxableIncome) : '—'}
                  </TableCell>
                  <TableCell align="right">
                    {r ? money(r.totalTax) : '—'}
                  </TableCell>
                  <TableCell align="right">
                    {r ? money(Number(r.totalTax) / 12) : '—'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <Typography variant="caption" color="text.secondary">
          Actual monthly TDS is shown on each payslip and trues up over the year.
        </Typography>
      </Grid>
    </Grid>
  );
}
