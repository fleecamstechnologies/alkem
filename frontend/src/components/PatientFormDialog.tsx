import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { doctorsApi } from '../api/doctors';
import { Gender, PatientStatus, type Patient } from '../types';
import { todayISO } from '../format';

interface Props {
  open: boolean;
  title: string;
  initial?: Partial<Patient>;
  onClose: () => void;
  onSubmit: (payload: Partial<Patient>) => void;
  submitting: boolean;
  error: string | null;
}

const EMPTY: Partial<Patient> = {
  code: '',
  firstName: '',
  lastName: '',
  gender: Gender.MALE,
  dateOfBirth: '',
  phone: '',
  city: '',
  state: '',
  bloodGroup: '',
  registrationDate: todayISO(),
  status: PatientStatus.ACTIVE,
  allergies: '',
  chronicConditions: '',
};

export function PatientFormDialog({
  open,
  title,
  initial,
  onClose,
  onSubmit,
  submitting,
  error,
}: Props) {
  const [form, setForm] = useState<Partial<Patient>>(EMPTY);
  const [doctor, setDoctor] = useState<{ id: string; label: string } | null>(
    null,
  );
  const [docOptions, setDocOptions] = useState<
    { id: string; label: string }[]
  >([]);
  const isEdit = !!initial?.id;

  const { data: currentDoctor } = useQuery({
    queryKey: ['doctor', initial?.assignedDoctorId],
    queryFn: () => doctorsApi.get(initial!.assignedDoctorId as string),
    enabled: open && !!initial?.assignedDoctorId,
  });

  const loadDoctors = async (term?: string) => {
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
    if (open) {
      setForm({ ...EMPTY, ...initial });
      setDoctor(
        currentDoctor
          ? { id: currentDoctor.id, label: `${currentDoctor.name} (${currentDoctor.code})` }
          : null,
      );
      void loadDoctors();
    }
  }, [open, initial, currentDoctor]);

  const set = (key: keyof Patient, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = () => {
    // Only send fields the API accepts — never the server-owned columns that
    // ride along on `initial` when editing (id, balances, timestamps, …).
    const EDITABLE = [
      'firstName', 'lastName', 'gender', 'dateOfBirth', 'phone', 'altPhone',
      'email', 'bloodGroup', 'maritalStatus', 'addressLine1', 'addressLine2',
      'city', 'state', 'pincode', 'emergencyName', 'emergencyPhone', 'status',
      'allergies', 'chronicConditions',
    ] as const;
    const payload: Record<string, unknown> = {};
    for (const k of EDITABLE) {
      const v = (form as Record<string, unknown>)[k];
      if (v !== '' && v !== undefined && v !== null) payload[k] = v;
    }
    if (!isEdit) {
      payload.code = form.code;
      if (form.registrationDate) payload.registrationDate = form.registrationDate;
    }
    if (doctor) payload.assignedDoctorId = Number(doctor.id);
    onSubmit(payload as Partial<Patient>);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Stack direction="row" spacing={2}>
            <TextField
              label="UHID / code"
              value={form.code ?? ''}
              onChange={(e) => set('code', e.target.value)}
              disabled={isEdit}
              fullWidth
              required
            />
            <TextField
              label="Gender"
              select
              value={form.gender ?? Gender.MALE}
              onChange={(e) => set('gender', e.target.value)}
              fullWidth
            >
              {Object.values(Gender).map((g) => (
                <MenuItem key={g} value={g}>
                  {g}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              label="First name"
              value={form.firstName ?? ''}
              onChange={(e) => set('firstName', e.target.value)}
              fullWidth
              required
            />
            <TextField
              label="Last name"
              value={form.lastName ?? ''}
              onChange={(e) => set('lastName', e.target.value)}
              fullWidth
              required
            />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Date of birth"
              type="date"
              value={form.dateOfBirth ?? ''}
              onChange={(e) => set('dateOfBirth', e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <TextField
              label="Blood group"
              value={form.bloodGroup ?? ''}
              onChange={(e) => set('bloodGroup', e.target.value)}
              fullWidth
            />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Phone"
              value={form.phone ?? ''}
              onChange={(e) => set('phone', e.target.value)}
              fullWidth
            />
            <TextField
              label="Alt phone"
              value={form.altPhone ?? ''}
              onChange={(e) => set('altPhone', e.target.value)}
              fullWidth
            />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              label="City"
              value={form.city ?? ''}
              onChange={(e) => set('city', e.target.value)}
              fullWidth
            />
            <TextField
              label="State"
              value={form.state ?? ''}
              onChange={(e) => set('state', e.target.value)}
              fullWidth
            />
          </Stack>
          <Autocomplete
            options={docOptions}
            getOptionLabel={(o) => o.label}
            value={doctor}
            onChange={(_, v) => setDoctor(v)}
            onInputChange={(_, v) => void loadDoctors(v)}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            noOptionsText="No doctors — add one under Doctors"
            renderInput={(p) => (
              <TextField {...p} label="Assigned doctor" />
            )}
          />
          <TextField
            label="Allergies"
            value={form.allergies ?? ''}
            onChange={(e) => set('allergies', e.target.value)}
            multiline
            minRows={2}
          />
          <TextField
            label="Chronic conditions"
            value={form.chronicConditions ?? ''}
            onChange={(e) => set('chronicConditions', e.target.value)}
            multiline
            minRows={2}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={submit}
          disabled={
            submitting || !form.code || !form.firstName || !form.lastName
          }
        >
          {submitting ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
