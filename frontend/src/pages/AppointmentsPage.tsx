import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Link,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { appointmentsApi, type ApptListParams } from '../api/appointments';
import { clinicApi } from '../api/clinic';
import { patientsApi } from '../api/patients';
import { doctorsApi } from '../api/doctors';
import {
  AppointmentType,
  CLINIC_DESK_ROLES,
  CLINIC_WRITE_ROLES,
  UserRole,
} from '../types';
import { todayISO } from '../format';
import { useAuth } from '../auth/AuthContext';
import { VisitFormDialog } from '../components/VisitFormDialog';

function errMsg(e: unknown): string {
  return (
    (e as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? 'Request failed'
  );
}

const statusColor: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> =
  {
    SCHEDULED: 'default',
    CONFIRMED: 'info',
    CHECKED_IN: 'warning',
    IN_PROGRESS: 'warning',
    COMPLETED: 'success',
    CANCELLED: 'error',
    NO_SHOW: 'error',
  };

export function AppointmentsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const canDesk = !!user && CLINIC_DESK_ROLES.includes(user.role);
  const canClinical = !!user && CLINIC_WRITE_ROLES.includes(user.role);
  const isClinician = user?.role === UserRole.CLINICIAN;

  const [date, setDate] = useState(todayISO());
  const [doctor, setDoctor] = useState<{ id: string; label: string } | null>(
    null,
  );
  const [docOptions, setDocOptions] = useState<{ id: string; label: string }[]>(
    [],
  );
  const [mine, setMine] = useState(isClinician);
  const [bookOpen, setBookOpen] = useState(false);
  const [completeFor, setCompleteFor] = useState<{
    id: string;
    patientId: string;
    doctorId: string;
  } | null>(null);

  const params: ApptListParams = useMemo(
    () => ({
      from: date,
      to: date,
      doctorId: doctor ? Number(doctor.id) : undefined,
      mine: mine ? '1' : undefined,
      limit: 100,
    }),
    [date, doctor, mine],
  );

  const q = useQuery({
    queryKey: ['appointments', params],
    queryFn: () => appointmentsApi.list(params),
  });

  const statusMut = useMutation({
    mutationFn: (v: { id: string; status: string }) =>
      appointmentsApi.setStatus(v.id, v.status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appointments'] }),
  });
  const completeMut = useMutation({
    mutationFn: (v: { id: string; createVisit: boolean; visit?: unknown }) =>
      appointmentsApi.complete(v.id, { createVisit: v.createVisit }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appointments'] }),
  });
  const visitMut = useMutation({
    mutationFn: clinicApi.createVisit,
    onSuccess: async () => {
      if (completeFor) {
        await appointmentsApi.setStatus(completeFor.id, 'COMPLETED').catch(() => {});
      }
      qc.invalidateQueries({ queryKey: ['appointments'] });
      setCompleteFor(null);
    },
  });

  const searchDoctor = async (term: string) => {
    const r = await doctorsApi.list(
      term && term.trim().length >= 2
        ? { q: term.trim(), limit: 20 }
        : { limit: 50 },
    );
    setDocOptions(
      r.rows.map((d) => ({ id: d.id, label: `${d.name} (${d.code})` })),
    );
  };

  useEffect(() => {
    void searchDoctor('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = q.data?.rows ?? [];

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
      >
        <Typography variant="h5">Appointments</Typography>
        {canDesk && (
          <Button variant="contained" onClick={() => setBookOpen(true)}>
            Book appointment
          </Button>
        )}
      </Stack>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" sx={{ gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            label="Date"
            type="date"
            size="small"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          {!mine && (
            <Autocomplete
              size="small"
              sx={{ minWidth: 240 }}
              options={docOptions}
              getOptionLabel={(o) => o.label}
              value={doctor}
              onChange={(_, v) => setDoctor(v)}
              onInputChange={(_, v) => void searchDoctor(v)}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              renderInput={(p) => <TextField {...p} label="Doctor" />}
            />
          )}
          {isClinician && (
            <FormControlLabel
              control={
                <Switch
                  checked={mine}
                  onChange={(e) => setMine(e.target.checked)}
                />
              }
              label="My appointments"
            />
          )}
        </Stack>
      </Paper>

      {q.isError && <Alert severity="error">Failed to load appointments.</Alert>}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Time</TableCell>
              <TableCell>Patient</TableCell>
              <TableCell>Doctor</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Reason</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  {new Date(a.scheduledAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </TableCell>
                <TableCell>
                  <Link component={RouterLink} to={`/patients/${a.patientId}`}>
                    {a.patientName ?? `#${a.patientId}`}
                  </Link>
                  {a.patientCode && (
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      {a.patientCode}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>{a.doctorName ?? `#${a.doctorId}`}</TableCell>
                <TableCell>{a.type}</TableCell>
                <TableCell>{a.reason || '—'}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={a.status}
                    color={statusColor[a.status] ?? 'default'}
                  />
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                    {canDesk && a.status === 'SCHEDULED' && (
                      <Button
                        size="small"
                        onClick={() =>
                          statusMut.mutate({ id: a.id, status: 'CHECKED_IN' })
                        }
                      >
                        Check in
                      </Button>
                    )}
                    {canClinical &&
                      ['CHECKED_IN', 'IN_PROGRESS'].includes(a.status) && (
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() =>
                            setCompleteFor({
                              id: a.id,
                              patientId: a.patientId,
                              doctorId: a.doctorId,
                            })
                          }
                        >
                          Complete + visit
                        </Button>
                      )}
                    {canClinical &&
                      ['CHECKED_IN', 'IN_PROGRESS'].includes(a.status) && (
                        <Button
                          size="small"
                          onClick={() =>
                            completeMut.mutate({ id: a.id, createVisit: false })
                          }
                        >
                          Complete
                        </Button>
                      )}
                    {canDesk &&
                      !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(
                        a.status,
                      ) && (
                        <Button
                          size="small"
                          color="error"
                          onClick={() =>
                            statusMut.mutate({ id: a.id, status: 'CANCELLED' })
                          }
                        >
                          Cancel
                        </Button>
                      )}
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  No appointments for this day.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <BookDialog
        open={bookOpen}
        onClose={() => setBookOpen(false)}
        onBooked={() => {
          setBookOpen(false);
          qc.invalidateQueries({ queryKey: ['appointments'] });
        }}
      />

      {completeFor && (
        <VisitFormDialog
          open
          patientId={Number(completeFor.patientId)}
          doctorId={Number(completeFor.doctorId)}
          appointmentId={Number(completeFor.id)}
          onClose={() => setCompleteFor(null)}
          onSubmit={(payload) => visitMut.mutate(payload)}
          submitting={visitMut.isPending}
          error={visitMut.isError ? errMsg(visitMut.error) : null}
        />
      )}
    </Box>
  );
}

function BookDialog({
  open,
  onClose,
  onBooked,
}: {
  open: boolean;
  onClose: () => void;
  onBooked: () => void;
}) {
  const [patient, setPatient] = useState<{ id: string; label: string } | null>(
    null,
  );
  const [pOptions, setPOptions] = useState<{ id: string; label: string }[]>([]);
  const [doctor, setDoctor] = useState<{ id: string; label: string } | null>(
    null,
  );
  const [dOptions, setDOptions] = useState<{ id: string; label: string }[]>([]);
  const [when, setWhen] = useState(`${todayISO()}T10:00`);
  const [type, setType] = useState<string>(AppointmentType.NEW);
  const [reason, setReason] = useState('');

  const loadDoctors = async (term?: string) => {
    const r = await doctorsApi.list(
      term && term.trim().length >= 2
        ? { q: term.trim(), limit: 20 }
        : { limit: 50 },
    );
    setDOptions(
      r.rows.map((d) => ({ id: d.id, label: `${d.name} (${d.code})` })),
    );
  };

  useEffect(() => {
    if (open) void loadDoctors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const mut = useMutation({
    mutationFn: () =>
      appointmentsApi.book({
        patientId: Number(patient!.id),
        doctorId: Number(doctor!.id),
        scheduledAt: when.replace('T', ' '),
        type,
        reason: reason || undefined,
      }),
    onSuccess: onBooked,
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Book appointment</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {mut.isError && <Alert severity="error">{errMsg(mut.error)}</Alert>}
          <Autocomplete
            options={pOptions}
            getOptionLabel={(o) => o.label}
            value={patient}
            onChange={(_, v) => setPatient(v)}
            onInputChange={async (_, v) => {
              if (v.length < 2) return;
              const r = await patientsApi.list({ q: v, limit: 10 });
              setPOptions(
                r.rows.map((p) => ({
                  id: p.id,
                  label: `${p.firstName} ${p.lastName} (${p.code})`,
                })),
              );
            }}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            renderInput={(p) => <TextField {...p} label="Patient" />}
          />
          <Autocomplete
            options={dOptions}
            getOptionLabel={(o) => o.label}
            value={doctor}
            onChange={(_, v) => setDoctor(v)}
            onInputChange={(_, v) => void loadDoctors(v)}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            noOptionsText="No doctors — add one under Doctors"
            renderInput={(p) => <TextField {...p} label="Doctor" />}
          />
          <Stack direction="row" spacing={2}>
            <TextField
              label="When"
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              select
              label="Type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              sx={{ minWidth: 140 }}
            >
              {Object.values(AppointmentType).map((t) => (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <TextField
            label="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!patient || !doctor || mut.isPending}
          onClick={() => mut.mutate()}
        >
          Book
        </Button>
      </DialogActions>
    </Dialog>
  );
}
