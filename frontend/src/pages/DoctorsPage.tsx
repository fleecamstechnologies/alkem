import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
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
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { doctorsApi, type Doctor, type DoctorListParams } from '../api/doctors';
import { usersApi } from '../api/users';
import { UserRole, WRITE_ROLES } from '../types';
import { useAuth } from '../auth/AuthContext';
import { DoctorFormDialog } from '../components/DoctorFormDialog';

export function DoctorsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canWrite = !!user && WRITE_ROLES.includes(user.role);
  const canMakeLogin =
    user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.HR_ADMIN;
  const [loginFor, setLoginFor] = useState<Doctor | null>(null);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const loginMut = useMutation({
    mutationFn: () =>
      usersApi.create({
        email: loginForm.email,
        password: loginForm.password,
        name: loginFor!.name,
        role: UserRole.CLINICIAN,
        doctorId: Number(loginFor!.id),
      }),
    onSuccess: () => {
      setLoginFor(null);
      setLoginForm({ email: '', password: '' });
    },
  });

  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [speciality, setSpeciality] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Doctor | null>(null);
  const limit = 50;

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [qInput]);

  const params: DoctorListParams = useMemo(
    () => ({
      q: q || undefined,
      speciality: speciality || undefined,
      status: status || undefined,
      limit,
      page,
    }),
    [q, speciality, status, page],
  );

  const { data, isError, isFetching } = useQuery({
    queryKey: ['doctors', params],
    queryFn: () => doctorsApi.list(params),
    placeholderData: (prev) => prev,
  });

  const saveMutation = useMutation({
    mutationFn: (payload: Partial<Doctor>) =>
      editing
        ? doctorsApi.update(editing.id, payload)
        : doctorsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctors'] });
      setDialogOpen(false);
      setEditing(null);
    },
  });

  const rows = data?.rows ?? [];

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
      >
        <Typography variant="h5">Doctors</Typography>
        {canWrite && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            New doctor
          </Button>
        )}
      </Stack>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 2 }}>
          <TextField
            label="Search name"
            size="small"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            sx={{ minWidth: 220 }}
          />
          <TextField
            label="Speciality"
            size="small"
            value={speciality}
            onChange={(e) => {
              setSpeciality(e.target.value);
              setPage(1);
            }}
            sx={{ minWidth: 170 }}
          />
          <TextField
            label="Status"
            size="small"
            select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="ACTIVE">ACTIVE</MenuItem>
            <MenuItem value="INACTIVE">INACTIVE</MenuItem>
          </TextField>
        </Stack>
      </Paper>

      {isError && <Alert severity="error">Failed to load doctors.</Alert>}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Code</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Speciality</TableCell>
              <TableCell>Hospital</TableCell>
              <TableCell>City / State</TableCell>
              <TableCell>Status</TableCell>
              {canWrite && <TableCell align="right">Edit</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((d) => (
              <TableRow key={d.id} hover>
                <TableCell>{d.code}</TableCell>
                <TableCell>{d.name}</TableCell>
                <TableCell>{d.speciality || '—'}</TableCell>
                <TableCell>{d.hospitalName || '—'}</TableCell>
                <TableCell>
                  {[d.city, d.state].filter(Boolean).join(', ') || '—'}
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={d.status}
                    color={d.status === 'ACTIVE' ? 'success' : 'default'}
                  />
                </TableCell>
                {canWrite && (
                  <TableCell align="right">
                    {canMakeLogin && (
                      <Button
                        size="small"
                        onClick={() => {
                          setLoginFor(d);
                          setLoginForm({ email: d.email ?? '', password: '' });
                        }}
                      >
                        Login
                      </Button>
                    )}
                    <Button
                      size="small"
                      onClick={() => {
                        setEditing(d);
                        setDialogOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  No doctors match these filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', alignItems: 'center', mt: 2 }}
      >
        <Typography variant="body2" color="text.secondary">
          {data?.total != null ? `${data.total} matching · ` : ''}Page {page}
          {isFetching ? ' · loading…' : ''}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <Button
            size="small"
            disabled={rows.length < limit}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </Stack>
      </Stack>

      <DoctorFormDialog
        open={dialogOpen}
        title={editing ? 'Edit doctor' : 'New doctor'}
        initial={editing ?? undefined}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
        onSubmit={(payload) => saveMutation.mutate(payload)}
        submitting={saveMutation.isPending}
        error={
          saveMutation.isError
            ? ((saveMutation.error as {
                response?: { data?: { message?: string } };
              })?.response?.data?.message ?? 'Save failed')
            : null
        }
      />

      <Dialog open={!!loginFor} onClose={() => setLoginFor(null)} fullWidth maxWidth="xs">
        <DialogTitle>Create clinician login</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {loginMut.isError && (
              <Alert severity="error">
                {(loginMut.error as {
                  response?: { data?: { message?: string } };
                })?.response?.data?.message ?? 'Failed'}
              </Alert>
            )}
            {loginMut.isSuccess && <Alert severity="success">Login created.</Alert>}
            <Typography variant="body2" color="text.secondary">
              {loginFor?.name} — role CLINICIAN, linked to this doctor.
            </Typography>
            <TextField
              label="Email"
              value={loginForm.email}
              onChange={(e) =>
                setLoginForm((f) => ({ ...f, email: e.target.value }))
              }
            />
            <TextField
              label="Password (min 8)"
              type="password"
              value={loginForm.password}
              onChange={(e) =>
                setLoginForm((f) => ({ ...f, password: e.target.value }))
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLoginFor(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={
              !loginForm.email ||
              loginForm.password.length < 8 ||
              loginMut.isPending
            }
            onClick={() => loginMut.mutate()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
