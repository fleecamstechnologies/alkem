import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import type { Doctor } from '../api/doctors';

interface Props {
  open: boolean;
  title: string;
  initial?: Partial<Doctor>;
  onClose: () => void;
  onSubmit: (payload: Partial<Doctor>) => void;
  submitting: boolean;
  error: string | null;
}

const EMPTY: Partial<Doctor> = {
  code: '',
  name: '',
  speciality: '',
  registrationNo: '',
  qualification: '',
  phone: '',
  email: '',
  hospitalName: '',
  city: '',
  state: '',
  territory: '',
  status: 'ACTIVE',
};

export function DoctorFormDialog({
  open,
  title,
  initial,
  onClose,
  onSubmit,
  submitting,
  error,
}: Props) {
  const [form, setForm] = useState<Partial<Doctor>>(EMPTY);
  const isEdit = !!initial?.id;

  useEffect(() => {
    if (open) setForm({ ...EMPTY, ...initial });
  }, [open, initial]);

  const set = (key: keyof Doctor, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = () => {
    // Send only the editable fields (the keys of EMPTY) — never the server-owned
    // columns (id / timestamps / …) that ride along on `initial` when editing.
    const payload: Record<string, unknown> = {};
    for (const k of Object.keys(EMPTY) as (keyof Doctor)[]) {
      const v = form[k];
      if (v !== '' && v !== undefined && v !== null) payload[k] = v;
    }
    if (isEdit) delete payload.code;
    onSubmit(payload as Partial<Doctor>);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Stack direction="row" spacing={2}>
            <TextField
              label="Code"
              value={form.code ?? ''}
              onChange={(e) => set('code', e.target.value)}
              disabled={isEdit}
              fullWidth
              required
            />
            <TextField
              label="Status"
              select
              value={form.status ?? 'ACTIVE'}
              onChange={(e) => set('status', e.target.value)}
              fullWidth
            >
              <MenuItem value="ACTIVE">ACTIVE</MenuItem>
              <MenuItem value="INACTIVE">INACTIVE</MenuItem>
            </TextField>
          </Stack>
          <TextField
            label="Name"
            value={form.name ?? ''}
            onChange={(e) => set('name', e.target.value)}
            fullWidth
            required
          />
          <Stack direction="row" spacing={2}>
            <TextField
              label="Speciality"
              value={form.speciality ?? ''}
              onChange={(e) => set('speciality', e.target.value)}
              fullWidth
            />
            <TextField
              label="Registration no."
              value={form.registrationNo ?? ''}
              onChange={(e) => set('registrationNo', e.target.value)}
              fullWidth
            />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Qualification"
              value={form.qualification ?? ''}
              onChange={(e) => set('qualification', e.target.value)}
              fullWidth
            />
            <TextField
              label="Hospital / clinic"
              value={form.hospitalName ?? ''}
              onChange={(e) => set('hospitalName', e.target.value)}
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
              label="Email"
              value={form.email ?? ''}
              onChange={(e) => set('email', e.target.value)}
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
            <TextField
              label="Territory"
              value={form.territory ?? ''}
              onChange={(e) => set('territory', e.target.value)}
              fullWidth
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={submit}
          disabled={submitting || !form.code || !form.name}
        >
          {submitting ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
