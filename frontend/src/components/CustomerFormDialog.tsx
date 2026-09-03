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
import { CustomerStatus, CustomerType, type Customer } from '../types';

interface Props {
  open: boolean;
  title: string;
  initial?: Partial<Customer>;
  onClose: () => void;
  onSubmit: (payload: Partial<Customer>) => void;
  submitting: boolean;
  error: string | null;
}

const EMPTY: Partial<Customer> = {
  code: '',
  name: '',
  type: CustomerType.CHEMIST,
  phone: '',
  email: '',
  city: '',
  state: '',
  territory: '',
  creditLimit: '0',
  status: CustomerStatus.ACTIVE,
};

export function CustomerFormDialog({
  open,
  title,
  initial,
  onClose,
  onSubmit,
  submitting,
  error,
}: Props) {
  const [form, setForm] = useState<Partial<Customer>>(EMPTY);
  const isEdit = !!initial?.id;

  useEffect(() => {
    if (open) setForm({ ...EMPTY, ...initial });
  }, [open, initial]);

  const set = (key: keyof Customer, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = () => {
    // Send only the editable fields (keys of EMPTY) — never server-owned
    // columns (id / balances / timestamps) that ride along on `initial`.
    const payload: Partial<Customer> = {};
    (Object.keys(EMPTY) as (keyof Customer)[]).forEach((k) => {
      const v = form[k];
      if (v !== '' && v !== undefined && v !== null) {
        (payload as Record<string, unknown>)[k] = v;
      }
    });
    if (isEdit) delete payload.code;
    onSubmit(payload);
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
              label="Type"
              select
              value={form.type ?? CustomerType.CHEMIST}
              onChange={(e) => set('type', e.target.value)}
              fullWidth
            >
              {Object.values(CustomerType).map((t) => (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              ))}
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
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Territory"
              value={form.territory ?? ''}
              onChange={(e) => set('territory', e.target.value)}
              fullWidth
            />
            <TextField
              label="Credit limit"
              value={form.creditLimit ?? '0'}
              onChange={(e) => set('creditLimit', e.target.value)}
              fullWidth
            />
            <TextField
              label="Status"
              select
              value={form.status ?? CustomerStatus.ACTIVE}
              onChange={(e) => set('status', e.target.value)}
              fullWidth
            >
              {Object.values(CustomerStatus).map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </TextField>
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
