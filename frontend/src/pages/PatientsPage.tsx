import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import AddIcon from '@mui/icons-material/Add';
import { patientsApi, type PatientListParams } from '../api/patients';
import { money } from '../format';
import {
  CLINIC_DESK_ROLES,
  PatientStatus,
  type Patient,
} from '../types';
import { useAuth } from '../auth/AuthContext';
import { PatientFormDialog } from '../components/PatientFormDialog';

const statusColor: Record<string, 'success' | 'default' | 'error'> = {
  ACTIVE: 'success',
  INACTIVE: 'default',
  DECEASED: 'error',
};

export function PatientsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const canWrite = !!user && CLINIC_DESK_ROLES.includes(user.role);

  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [city, setCity] = useState('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const limit = 50;

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [qInput]);

  const params: PatientListParams = useMemo(
    () => ({
      q: q || undefined,
      status: status || undefined,
      city: city || undefined,
      limit,
      page,
    }),
    [q, status, city, page],
  );

  const { data, isError, isFetching } = useQuery({
    queryKey: ['patients', params],
    queryFn: () => patientsApi.list(params),
    placeholderData: (p) => p,
  });

  const createMut = useMutation({
    mutationFn: (payload: Partial<Patient>) => patientsApi.create(payload),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ['patients'] });
      setDialogOpen(false);
      navigate(`/patients/${p.id}`);
    },
  });

  const rows = data?.rows ?? [];

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
      >
        <Typography variant="h5">Patients</Typography>
        {canWrite && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
          >
            New patient
          </Button>
        )}
      </Stack>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 2 }}>
          <TextField
            label="Search name or phone"
            size="small"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            sx={{ minWidth: 260 }}
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
            {Object.values(PatientStatus).map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="City"
            size="small"
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              setPage(1);
            }}
            sx={{ minWidth: 150 }}
          />
        </Stack>
      </Paper>

      {isError && <Alert severity="error">Failed to load patients.</Alert>}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>UHID</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Gender</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>City</TableCell>
              <TableCell align="right">Visits</TableCell>
              <TableCell align="right">Outstanding</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((p) => (
              <TableRow
                key={p.id}
                hover
                sx={{ cursor: 'pointer' }}
                onClick={() => navigate(`/patients/${p.id}`)}
              >
                <TableCell>{p.code}</TableCell>
                <TableCell>
                  {p.firstName} {p.lastName}
                </TableCell>
                <TableCell>{p.gender ?? '—'}</TableCell>
                <TableCell>{p.phone ?? '—'}</TableCell>
                <TableCell>{p.city ?? '—'}</TableCell>
                <TableCell align="right">{p.visitCount}</TableCell>
                <TableCell align="right">
                  {money(p.outstandingBalance)}
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={p.status}
                    color={statusColor[p.status] ?? 'default'}
                  />
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  No patients match this search.
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

      <PatientFormDialog
        open={dialogOpen}
        title="New patient"
        onClose={() => setDialogOpen(false)}
        onSubmit={(payload) => createMut.mutate(payload)}
        submitting={createMut.isPending}
        error={
          createMut.isError
            ? ((createMut.error as {
                response?: { data?: { message?: string } };
              })?.response?.data?.message ?? 'Save failed')
            : null
        }
      />
    </Box>
  );
}
