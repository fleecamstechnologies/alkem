import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { departmentsApi } from '../api/employees';
import { EmployeeStatus, EmploymentType, type Employee } from '../types';

interface Props {
  open: boolean;
  title: string;
  initial?: Partial<Employee>;
  onClose: () => void;
  onSubmit: (payload: Partial<Employee>) => void;
  submitting: boolean;
  error: string | null;
}

const EMPTY: Partial<Employee> = {
  code: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  designation: '',
  employmentType: EmploymentType.FULL_TIME,
  status: EmployeeStatus.ACTIVE,
  dateOfJoining: new Date().toISOString().slice(0, 10),
  ctcAnnual: '0',
};

export function EmployeeFormDialog({
  open,
  title,
  initial,
  onClose,
  onSubmit,
  submitting,
  error,
}: Props) {
  const [form, setForm] = useState<Partial<Employee>>(EMPTY);
  const isEdit = !!initial?.id;
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: departmentsApi.list,
  });

  useEffect(() => {
    if (open) setForm({ ...EMPTY, ...initial });
  }, [open, initial]);

  const set = (key: keyof Employee, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = () => {
    // Send only the fields this form edits — never the server-owned columns
    // (id / timestamps / …) that ride along on `initial` when editing.
    const EDITABLE: (keyof Employee)[] = [
      'code', 'firstName', 'lastName', 'email', 'phone', 'designation',
      'employmentType', 'status', 'dateOfJoining', 'ctcAnnual', 'departmentId',
      'workLocation',
    ];
    const payload: Record<string, unknown> = {};
    for (const k of EDITABLE) {
      const v = form[k];
      if (v !== '' && v !== undefined && v !== null) payload[k] = v;
    }
    if (isEdit) delete payload.code;
    if (payload.departmentId != null && payload.departmentId !== '') {
      payload.departmentId = Number(payload.departmentId);
    }
    onSubmit(payload as Partial<Employee>);
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
              label="Employment type"
              select
              value={form.employmentType ?? EmploymentType.FULL_TIME}
              onChange={(e) => set('employmentType', e.target.value)}
              fullWidth
            >
              {Object.values(EmploymentType).map((t) => (
                <MenuItem key={t} value={t}>
                  {t}
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
              label="Email"
              value={form.email ?? ''}
              onChange={(e) => set('email', e.target.value)}
              fullWidth
            />
            <TextField
              label="Phone"
              value={form.phone ?? ''}
              onChange={(e) => set('phone', e.target.value)}
              fullWidth
            />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Department"
              select
              value={form.departmentId ?? ''}
              onChange={(e) => set('departmentId', e.target.value)}
              fullWidth
            >
              <MenuItem value="">—</MenuItem>
              {(departments ?? []).map((d) => (
                <MenuItem key={d.id} value={d.id}>
                  {d.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Designation"
              value={form.designation ?? ''}
              onChange={(e) => set('designation', e.target.value)}
              fullWidth
            />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Date of joining"
              type="date"
              value={form.dateOfJoining ?? ''}
              onChange={(e) => set('dateOfJoining', e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
              required
            />
            <TextField
              label="Status"
              select
              value={form.status ?? EmployeeStatus.ACTIVE}
              onChange={(e) => set('status', e.target.value)}
              fullWidth
            >
              {Object.values(EmployeeStatus).map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Annual CTC"
              value={form.ctcAnnual ?? '0'}
              onChange={(e) => set('ctcAnnual', e.target.value)}
              fullWidth
            />
            <TextField
              label="Work location"
              value={form.workLocation ?? ''}
              onChange={(e) => set('workLocation', e.target.value)}
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
          disabled={
            submitting ||
            !form.code ||
            !form.firstName ||
            !form.lastName ||
            !form.dateOfJoining
          }
        >
          {submitting ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
