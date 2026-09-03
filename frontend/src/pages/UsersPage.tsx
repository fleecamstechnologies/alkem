import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { usersApi, type CreateUserPayload } from '../api/users';
import { employeesApi } from '../api/employees';
import { UserRole, type Employee } from '../types';
import { useAuth } from '../auth/AuthContext';

function errMsg(e: unknown): string {
  return (
    (e as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? 'Request failed'
  );
}

const EMPTY: CreateUserPayload = {
  email: '',
  password: '',
  name: '',
  role: UserRole.VIEWER,
  department: '',
};

export function UsersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage =
    user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.HR_ADMIN;

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CreateUserPayload>(EMPTY);
  const [empOptions, setEmpOptions] = useState<Employee[]>([]);
  const [picked, setPicked] = useState<Employee | null>(null);

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.list,
    enabled: canManage,
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateUserPayload) => usersApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setOpen(false);
      setForm(EMPTY);
      setPicked(null);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      usersApi.setActive(id, active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  if (!canManage) {
    return (
      <Alert severity="warning">
        Only super admins and HR admins can manage users.
      </Alert>
    );
  }

  const searchEmployees = async (term: string) => {
    if (term.length < 2) return;
    setEmpOptions(await employeesApi.search(term));
  };

  const pickEmployee = (emp: Employee | null) => {
    setPicked(emp);
    if (emp) {
      setForm((f) => ({
        ...f,
        name: `${emp.firstName} ${emp.lastName}`,
        email: emp.email ?? f.email,
        role: UserRole.EMPLOYEE,
        employeeId: Number(emp.id),
      }));
    } else {
      setForm((f) => ({ ...f, employeeId: undefined }));
    }
  };

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
      >
        <Typography variant="h5">Users</Typography>
        <Button variant="contained" onClick={() => setOpen(true)}>
          New user
        </Button>
      </Stack>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Department</TableCell>
              <TableCell>Employee</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(usersQuery.data ?? []).map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.role.replaceAll('_', ' ')}</TableCell>
                <TableCell>{u.department || '—'}</TableCell>
                <TableCell>{u.employeeId ? `#${u.employeeId}` : '—'}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={u.isActive ? 'active' : 'disabled'}
                    color={u.isActive ? 'success' : 'default'}
                  />
                </TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    onClick={() =>
                      toggleMutation.mutate({ id: u.id, active: !u.isActive })
                    }
                  >
                    {u.isActive ? 'Disable' : 'Enable'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>New user</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {createMutation.isError && (
              <Alert severity="error">{errMsg(createMutation.error)}</Alert>
            )}
            <Autocomplete
              options={empOptions}
              getOptionLabel={(o) =>
                `${o.firstName} ${o.lastName} (${o.code})`
              }
              value={picked}
              onChange={(_, v) => pickEmployee(v)}
              onInputChange={(_, v) => void searchEmployees(v)}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              renderInput={(p) => (
                <TextField
                  {...p}
                  label="Link to employee (optional — makes it a portal login)"
                />
              )}
            />
            <TextField
              label="Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <TextField
              label="Email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <TextField
              label="Password (min 8 chars)"
              type="password"
              value={form.password}
              onChange={(e) =>
                setForm((f) => ({ ...f, password: e.target.value }))
              }
            />
            <TextField
              label="Role"
              select
              value={form.role}
              onChange={(e) =>
                setForm((f) => ({ ...f, role: e.target.value as UserRole }))
              }
            >
              {Object.values(UserRole).map((r) => (
                <MenuItem key={r} value={r}>
                  {r.replaceAll('_', ' ')}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Department"
              value={form.department}
              onChange={(e) =>
                setForm((f) => ({ ...f, department: e.target.value }))
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={
              createMutation.isPending ||
              !form.email ||
              !form.name ||
              form.password.length < 8
            }
            onClick={() => createMutation.mutate(form)}
          >
            {createMutation.isPending ? 'Saving…' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
