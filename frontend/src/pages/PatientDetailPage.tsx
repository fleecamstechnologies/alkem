import { useState } from 'react';
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
import { patientsApi } from '../api/patients';
import { clinicApi } from '../api/clinic';
import { appointmentsApi } from '../api/appointments';
import { money, monthsAgoISO, todayISO } from '../format';
import {
  CLINIC_DESK_ROLES,
  CLINIC_WRITE_ROLES,
  PHARMACY_WRITE_ROLES,
  ChargeKind,
  ChargeMethod,
  ServiceKind,
  type Patient,
} from '../types';
import { useAuth } from '../auth/AuthContext';
import { PatientFormDialog } from '../components/PatientFormDialog';
import { VisitFormDialog } from '../components/VisitFormDialog';
import { DispenseDialog } from '../components/DispenseDialog';

function errMsg(e: unknown): string {
  return (
    (e as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? 'Request failed'
  );
}

export function PatientDetailPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const { user } = useAuth();
  const canDesk = !!user && CLINIC_DESK_ROLES.includes(user.role);
  const canClinical = !!user && CLINIC_WRITE_ROLES.includes(user.role);
  const canDispense = !!user && PHARMACY_WRITE_ROLES.includes(user.role);
  const [dispenseRx, setDispenseRx] = useState<string | null>(null);

  const [tab, setTab] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [visitOpen, setVisitOpen] = useState(false);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [apptOpen, setApptOpen] = useState(false);
  const [openVisitId, setOpenVisitId] = useState<string | null>(null);
  const [from, setFrom] = useState(monthsAgoISO(6));
  const [to, setTo] = useState(todayISO());
  const [charge, setCharge] = useState({
    kind: ChargeKind.INVOICE as string,
    amount: '',
    method: '',
    serviceKind: ServiceKind.CONSULTATION as string,
    chargeDate: todayISO(),
    description: '',
  });
  const [appt, setAppt] = useState({
    scheduledAt: `${todayISO()}T10:00`,
    reason: '',
  });

  const patientQuery = useQuery({
    queryKey: ['patient', id],
    queryFn: () => patientsApi.get(id),
  });
  const historyQuery = useQuery({
    queryKey: ['patient-history', id],
    queryFn: () => patientsApi.medicalHistory(id),
    enabled: tab === 2,
  });
  const apptsQuery = useQuery({
    queryKey: ['patient-appts', id],
    queryFn: () => appointmentsApi.list({ patientId: Number(id), limit: 50 }),
    enabled: tab === 1,
  });
  const rxQuery = useQuery({
    queryKey: ['patient-rx', id],
    queryFn: () => clinicApi.patientPrescriptions(id),
    enabled: tab === 3,
  });
  const labsQuery = useQuery({
    queryKey: ['patient-labs', id],
    queryFn: () => clinicApi.patientLabs(id),
    enabled: tab === 4,
  });
  const statementQuery = useQuery({
    queryKey: ['patient-statement', id, from, to],
    queryFn: () => patientsApi.statement(id, from, to),
    enabled: tab === 5,
  });
  const visitDetailQuery = useQuery({
    queryKey: ['visit', openVisitId],
    queryFn: () => clinicApi.visit(openVisitId!),
    enabled: !!openVisitId,
  });

  const p = patientQuery.data;

  const updateMut = useMutation({
    mutationFn: (payload: Partial<Patient>) => patientsApi.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient', id] });
      setEditOpen(false);
    },
  });
  const visitMut = useMutation({
    mutationFn: clinicApi.createVisit,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient', id] });
      qc.invalidateQueries({ queryKey: ['patient-history', id] });
      setVisitOpen(false);
    },
  });
  const chargeMut = useMutation({
    mutationFn: () =>
      patientsApi.addCharge(id, {
        kind: charge.kind as never,
        amount: charge.amount,
        method: (charge.method || undefined) as never,
        serviceKind: (charge.kind === 'INVOICE'
          ? charge.serviceKind
          : undefined) as never,
        chargeDate: charge.chargeDate,
        description: charge.description || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient', id] });
      qc.invalidateQueries({ queryKey: ['patient-charges', id] });
      qc.invalidateQueries({ queryKey: ['patient-statement', id] });
      setChargeOpen(false);
      setCharge((c) => ({ ...c, amount: '', description: '' }));
    },
  });
  const bookMut = useMutation({
    mutationFn: () =>
      appointmentsApi.book({
        patientId: Number(id),
        doctorId: Number(p!.assignedDoctorId),
        scheduledAt: appt.scheduledAt.replace('T', ' '),
        reason: appt.reason || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient-appts', id] });
      setApptOpen(false);
    },
  });

  if (patientQuery.isLoading) return <CircularProgress />;
  if (patientQuery.isError || !p)
    return <Alert severity="error">Patient not found.</Alert>;

  return (
    <Box>
      <Link component={RouterLink} to="/patients">
        ← Back to patients
      </Link>

      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mt: 1, mb: 2 }}
      >
        <Box>
          <Typography variant="h5">
            {p.firstName} {p.lastName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {p.code} · {p.gender ?? '—'} ·{' '}
            {p.dateOfBirth ? `DOB ${p.dateOfBirth}` : 'DOB —'} ·{' '}
            {p.bloodGroup ?? '—'} · {p.phone ?? 'no phone'}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Chip
            label={p.status}
            color={p.status === 'ACTIVE' ? 'success' : 'default'}
          />
          {canDesk && (
            <Button variant="outlined" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
          )}
        </Stack>
      </Stack>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 3 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Outstanding
            </Typography>
            <Typography variant="h5">{money(p.outstandingBalance)}</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Visits
            </Typography>
            <Typography variant="h5">{p.visitCount}</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Allergies
            </Typography>
            <Typography>{p.allergies || '—'}</Typography>
          </Paper>
        </Grid>
      </Grid>

      {(canDesk || canClinical) && (
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          {canDesk && (
            <Button variant="outlined" onClick={() => setApptOpen(true)}>
              Book appointment
            </Button>
          )}
          {canClinical && (
            <Button variant="outlined" onClick={() => setVisitOpen(true)}>
              New visit
            </Button>
          )}
          {canDesk && (
            <Button variant="outlined" onClick={() => setChargeOpen(true)}>
              Add charge / payment
            </Button>
          )}
        </Stack>
      )}

      <Paper>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable">
          <Tab label="Overview" />
          <Tab label="Appointments" />
          <Tab label="Medical history" />
          <Tab label="Prescriptions" />
          <Tab label="Labs" />
          <Tab label="Billing" />
        </Tabs>

        <Box sx={{ p: 2 }}>
          {tab === 0 && (
            <Grid container spacing={2}>
              {[
                ['Email', p.email],
                ['Address', [p.addressLine1, p.city, p.state].filter(Boolean).join(', ')],
                ['Emergency contact', p.emergencyName && `${p.emergencyName} · ${p.emergencyPhone ?? ''}`],
                ['Chronic conditions', p.chronicConditions],
                ['Registered', p.registrationDate],
                ['Last visit', p.lastVisitAt?.slice(0, 10)],
              ].map(([label, value]) => (
                <Grid size={{ xs: 12, sm: 6 }} key={label}>
                  <Typography variant="body2" color="text.secondary">
                    {label}
                  </Typography>
                  <Typography>{value || '—'}</Typography>
                </Grid>
              ))}
            </Grid>
          )}

          {tab === 1 && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>When</TableCell>
                  <TableCell>Doctor</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(apptsQuery.data?.rows ?? []).map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      {new Date(a.scheduledAt).toLocaleString([], {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </TableCell>
                    <TableCell>
                      {a.doctorName ?? `#${a.doctorId}`}
                    </TableCell>
                    <TableCell>{a.type}</TableCell>
                    <TableCell>{a.reason || '—'}</TableCell>
                    <TableCell>{a.status}</TableCell>
                  </TableRow>
                ))}
                {(apptsQuery.data?.rows ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                      No appointments.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}

          {tab === 2 && (
            <>
              {historyQuery.isLoading ? (
                <CircularProgress />
              ) : (
                <>
                  <Typography variant="subtitle2" gutterBottom>
                    Visit timeline
                  </Typography>
                  <Table size="small" sx={{ mb: 3 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Doctor</TableCell>
                        <TableCell>Complaint</TableCell>
                        <TableCell>Diagnosis</TableCell>
                        <TableCell>Follow-up</TableCell>
                        <TableCell />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(historyQuery.data?.visits ?? []).map((v) => (
                        <TableRow key={v.id}>
                          <TableCell>{v.visitDate}</TableCell>
                          <TableCell>{v.doctorName || '—'}</TableCell>
                          <TableCell>{v.chiefComplaint || '—'}</TableCell>
                          <TableCell>{v.diagnosis || '—'}</TableCell>
                          <TableCell>{v.followUpDate || '—'}</TableCell>
                          <TableCell>
                            <Button size="small" onClick={() => setOpenVisitId(v.id)}>
                              Open
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Recent medicines
                      </Typography>
                      <Table size="small">
                        <TableBody>
                          {(historyQuery.data?.recentMedicines ?? []).map((m, i) => (
                            <TableRow key={i}>
                              <TableCell>
                                {m.drugName} {m.strength ?? ''}
                              </TableCell>
                              <TableCell>{m.dosage ?? ''}</TableCell>
                              <TableCell>{m.prescribedAt}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Recent labs
                      </Typography>
                      <Table size="small">
                        <TableBody>
                          {(historyQuery.data?.recentLabs ?? []).map((l, i) => (
                            <TableRow key={i}>
                              <TableCell>{l.testName}</TableCell>
                              <TableCell>
                                {l.resultValue ?? l.status}
                                {l.flag && l.flag !== 'NORMAL' ? ` (${l.flag})` : ''}
                              </TableCell>
                              <TableCell>{l.orderedAt}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Grid>
                  </Grid>
                </>
              )}
            </>
          )}

          {tab === 3 && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Doctor</TableCell>
                  <TableCell align="right">Items</TableCell>
                  <TableCell>Notes</TableCell>
                  {canDispense && <TableCell align="right" />}
                </TableRow>
              </TableHead>
              <TableBody>
                {(rxQuery.data ?? []).map((rx) => (
                  <TableRow key={rx.id}>
                    <TableCell>{rx.prescribedAt}</TableCell>
                    <TableCell>{rx.doctorName || '—'}</TableCell>
                    <TableCell align="right">{rx.itemCount}</TableCell>
                    <TableCell>{rx.notes || '—'}</TableCell>
                    {canDispense && (
                      <TableCell align="right">
                        <Button
                          size="small"
                          onClick={() => setDispenseRx(rx.id)}
                        >
                          Dispense
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {tab === 4 && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Ordered</TableCell>
                  <TableCell>Test</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Result</TableCell>
                  <TableCell>Flag</TableCell>
                  {canClinical && <TableCell align="right" />}
                </TableRow>
              </TableHead>
              <TableBody>
                {(labsQuery.data ?? []).map((l) => (
                  <LabRow
                    key={l.id}
                    lab={l}
                    canEdit={canClinical}
                    onSaved={() =>
                      qc.invalidateQueries({ queryKey: ['patient-labs', id] })
                    }
                  />
                ))}
              </TableBody>
            </Table>
          )}

          {tab === 5 && (
            <>
              <Stack direction="row" spacing={2} sx={{ mb: 2, alignItems: 'center' }}>
                <TextField
                  label="From"
                  type="date"
                  size="small"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                  label="To"
                  type="date"
                  size="small"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <Button onClick={() => window.print()}>Print</Button>
              </Stack>
              {statementQuery.data && (
                <Box className="printable">
                  <Stack direction="row" spacing={4} sx={{ mb: 2 }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Opening balance
                      </Typography>
                      <Typography variant="h6">
                        {money(statementQuery.data.openingBalance)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Closing balance
                      </Typography>
                      <Typography variant="h6">
                        {money(statementQuery.data.closingBalance)}
                      </Typography>
                    </Box>
                  </Stack>
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell>Kind</TableCell>
                          <TableCell>Service</TableCell>
                          <TableCell>Description</TableCell>
                          <TableCell align="right">Amount</TableCell>
                          <TableCell align="right">Running balance</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {statementQuery.data.lines.map((l) => (
                          <TableRow key={l.id}>
                            <TableCell>{l.chargeDate}</TableCell>
                            <TableCell>{l.kind}</TableCell>
                            <TableCell>{l.serviceKind ?? '—'}</TableCell>
                            <TableCell>{l.description ?? '—'}</TableCell>
                            <TableCell align="right">{money(l.amount)}</TableCell>
                            <TableCell align="right">
                              {money(l.runningBalance)}
                            </TableCell>
                          </TableRow>
                        ))}
                        {statementQuery.data.lines.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                              No entries in this range.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </>
          )}
        </Box>
      </Paper>

      {/* dialogs */}
      <PatientFormDialog
        open={editOpen}
        title="Edit patient"
        initial={p}
        onClose={() => setEditOpen(false)}
        onSubmit={(payload) => updateMut.mutate(payload)}
        submitting={updateMut.isPending}
        error={updateMut.isError ? errMsg(updateMut.error) : null}
      />

      <VisitFormDialog
        open={visitOpen}
        patientId={Number(id)}
        doctorId={Number(p.assignedDoctorId ?? 0)}
        onClose={() => setVisitOpen(false)}
        onSubmit={(payload) => visitMut.mutate(payload)}
        submitting={visitMut.isPending}
        error={visitMut.isError ? errMsg(visitMut.error) : null}
      />

      <Dialog open={chargeOpen} onClose={() => setChargeOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add charge / payment</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {chargeMut.isError && (
              <Alert severity="error">{errMsg(chargeMut.error)}</Alert>
            )}
            <TextField
              select
              label="Kind"
              value={charge.kind}
              onChange={(e) => setCharge((c) => ({ ...c, kind: e.target.value }))}
            >
              {Object.values(ChargeKind).map((k) => (
                <MenuItem key={k} value={k}>
                  {k}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Amount"
              value={charge.amount}
              onChange={(e) => setCharge((c) => ({ ...c, amount: e.target.value }))}
            />
            {charge.kind === 'INVOICE' && (
              <TextField
                select
                label="Service"
                value={charge.serviceKind}
                onChange={(e) =>
                  setCharge((c) => ({ ...c, serviceKind: e.target.value }))
                }
              >
                {Object.values(ServiceKind).map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </TextField>
            )}
            {charge.kind !== 'INVOICE' && (
              <TextField
                select
                label="Method"
                value={charge.method}
                onChange={(e) =>
                  setCharge((c) => ({ ...c, method: e.target.value }))
                }
              >
                <MenuItem value="">—</MenuItem>
                {Object.values(ChargeMethod).map((m) => (
                  <MenuItem key={m} value={m}>
                    {m}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <TextField
              label="Date"
              type="date"
              value={charge.chargeDate}
              onChange={(e) =>
                setCharge((c) => ({ ...c, chargeDate: e.target.value }))
              }
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Description"
              value={charge.description}
              onChange={(e) =>
                setCharge((c) => ({ ...c, description: e.target.value }))
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChargeOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!charge.amount || chargeMut.isPending}
            onClick={() => chargeMut.mutate()}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={apptOpen} onClose={() => setApptOpen(false)}>
        <DialogTitle>Book appointment</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1, minWidth: 300 }}>
            {!p.assignedDoctorId && (
              <Alert severity="warning">
                Assign a doctor to this patient first (Edit).
              </Alert>
            )}
            {bookMut.isError && (
              <Alert severity="error">{errMsg(bookMut.error)}</Alert>
            )}
            <TextField
              label="When"
              type="datetime-local"
              value={appt.scheduledAt}
              onChange={(e) =>
                setAppt((a) => ({ ...a, scheduledAt: e.target.value }))
              }
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Reason"
              value={appt.reason}
              onChange={(e) => setAppt((a) => ({ ...a, reason: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApptOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!p.assignedDoctorId || bookMut.isPending}
            onClick={() => bookMut.mutate()}
          >
            Book
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!openVisitId}
        onClose={() => setOpenVisitId(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Visit details</DialogTitle>
        <DialogContent>
          {visitDetailQuery.data && (
            <Stack spacing={1.5}>
              <Typography variant="body2">
                {visitDetailQuery.data.visitDate.replace('T', ' ').slice(0, 16)} ·{' '}
                {visitDetailQuery.data.visitType}
              </Typography>
              <Typography>
                <b>Vitals:</b>{' '}
                {visitDetailQuery.data.bpSystolic
                  ? `BP ${visitDetailQuery.data.bpSystolic}/${visitDetailQuery.data.bpDiastolic}`
                  : ''}{' '}
                {visitDetailQuery.data.pulse
                  ? `· Pulse ${visitDetailQuery.data.pulse}`
                  : ''}{' '}
                {visitDetailQuery.data.spo2
                  ? `· SpO2 ${visitDetailQuery.data.spo2}`
                  : ''}
              </Typography>
              <Typography>
                <b>Diagnosis:</b> {visitDetailQuery.data.diagnosis || '—'}
              </Typography>
              <Typography>
                <b>Notes:</b> {visitDetailQuery.data.clinicalNotes || '—'}
              </Typography>
              {visitDetailQuery.data.prescriptions.map((rx) => (
                <Box key={rx.id}>
                  <Typography variant="subtitle2">Prescription</Typography>
                  {rx.items.map((m, i) => (
                    <Typography key={i} variant="body2">
                      • {m.drugName} {m.strength ?? ''} {m.dosage ?? ''}{' '}
                      {m.durationDays ? `× ${m.durationDays}d` : ''}
                    </Typography>
                  ))}
                </Box>
              ))}
              {visitDetailQuery.data.labs.length > 0 && (
                <Box>
                  <Typography variant="subtitle2">Labs</Typography>
                  {visitDetailQuery.data.labs.map((l) => (
                    <Typography key={l.id} variant="body2">
                      • {l.testName} — {l.resultValue ?? l.status}
                    </Typography>
                  ))}
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenVisitId(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <DispenseDialog
        open={!!dispenseRx}
        prescriptionId={dispenseRx}
        fixedPatient={{
          id: p.id,
          label: `${p.firstName} ${p.lastName} (${p.code})`,
        }}
        onClose={() => setDispenseRx(null)}
        onDone={() => {
          qc.invalidateQueries({ queryKey: ['patient-statement', id] });
          qc.invalidateQueries({ queryKey: ['patient', id] });
        }}
      />
    </Box>
  );
}

function LabRow({
  lab,
  canEdit,
  onSaved,
}: {
  lab: import('../types').LabTest;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ resultValue: '', unit: '', refRange: '', flag: '' });
  const mut = useMutation({
    mutationFn: () => clinicApi.labResult(lab.id, v),
    onSuccess: () => {
      setOpen(false);
      onSaved();
    },
  });
  return (
    <>
      <TableRow>
        <TableCell>{lab.orderedAt.slice(0, 10)}</TableCell>
        <TableCell>{lab.testName}</TableCell>
        <TableCell>{lab.status}</TableCell>
        <TableCell>
          {lab.resultValue ?? '—'} {lab.unit ?? ''}
        </TableCell>
        <TableCell>{lab.flag ?? '—'}</TableCell>
        {canEdit && (
          <TableCell align="right">
            {lab.status !== 'RESULT_READY' && (
              <Button size="small" onClick={() => setOpen(true)}>
                Enter result
              </Button>
            )}
          </TableCell>
        )}
      </TableRow>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>{lab.testName} result</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1, minWidth: 280 }}>
            <TextField label="Result" value={v.resultValue} onChange={(e) => setV((x) => ({ ...x, resultValue: e.target.value }))} />
            <TextField label="Unit" value={v.unit} onChange={(e) => setV((x) => ({ ...x, unit: e.target.value }))} />
            <TextField label="Ref range" value={v.refRange} onChange={(e) => setV((x) => ({ ...x, refRange: e.target.value }))} />
            <TextField select label="Flag" value={v.flag} onChange={(e) => setV((x) => ({ ...x, flag: e.target.value }))}>
              <MenuItem value="">—</MenuItem>
              {['NORMAL', 'HIGH', 'LOW', 'CRITICAL'].map((f) => (
                <MenuItem key={f} value={f}>
                  {f}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!v.resultValue || mut.isPending} onClick={() => mut.mutate()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
