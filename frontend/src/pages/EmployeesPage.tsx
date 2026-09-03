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
import {
  employeesApi,
  departmentsApi,
  type EmployeeListParams,
} from '../api/employees';
import { EmployeeStatus, EmploymentType, HR_WRITE_ROLES, type Employee } from '../types';
import { useAuth } from '../auth/AuthContext';
import { EmployeeFormDialog } from '../components/EmployeeFormDialog';

const statusColor: Record<string, 'success' | 'warning' | 'default' | 'error'> = {
  ACTIVE: 'success',
  ON_LEAVE: 'warning',
  SUSPENDED: 'default',
  TERMINATED: 'error',
};

export function EmployeesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canWrite = !!user && HR_WRITE_ROLES.includes(user.role);

  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [status, setStatus] = useState('');
  const [employmentType, setEmploymentType] = useState('');
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

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: departmentsApi.list,
  });

  const params: EmployeeListParams = useMemo(
    () => ({
      q: q || undefined,
      departmentId: departmentId ? Number(departmentId) : undefined,
      status: status || undefined,
      employmentType: employmentType || undefined,
      limit,
      page,
    }),
    [q, departmentId, status, employmentType, page],
  );

  const { data, isError, isFetching } = useQuery({
    queryKey: ['employees', params],
    queryFn: () => employeesApi.list(params),
    placeholderData: (prev) => prev,
  });

  const deptName = useMemo(() => {
    const m = new Map((departments ?? []).map((d) => [d.id, d.name]));
    return (id: string | null) => (id ? (m.get(id) ?? '—') : '—');
  }, [departments]);

  const createMutation = useMutation({
    mutationFn: (payload: Partial<Employee>) => employeesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setDialogOpen(false);
    },
  });

  const rows = data?.rows ?? [];

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
      >
        <Typography variant="h5">Employees</Typography>
        {canWrite && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
          >
            New employee
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
            label="Department"
            size="small"
            select
            value={departmentId}
            onChange={(e) => {
              setDepartmentId(e.target.value);
              setPage(1);
            }}
            sx={{ minWidth: 170 }}
          >
            <MenuItem value="">All</MenuItem>
            {(departments ?? []).map((d) => (
              <MenuItem key={d.id} value={d.id}>
                {d.name}
              </MenuItem>
            ))}
          </TextField>
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
            {Object.values(EmployeeStatus).map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Type"
            size="small"
            select
            value={employmentType}
            onChange={(e) => {
              setEmploymentType(e.target.value);
              setPage(1);
            }}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">All</MenuItem>
            {Object.values(EmploymentType).map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Paper>

      {isError && <Alert severity="error">Failed to load employees.</Alert>}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Code</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Department</TableCell>
              <TableCell>Designation</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Joined</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((e) => (
              <TableRow
                key={e.id}
                hover
                sx={{ cursor: 'pointer' }}
                onClick={() => navigate(`/employees/${e.id}`)}
              >
                <TableCell>{e.code}</TableCell>
                <TableCell>
                  {e.firstName} {e.lastName}
                </TableCell>
                <TableCell>{deptName(e.departmentId)}</TableCell>
                <TableCell>{e.designation || '—'}</TableCell>
                <TableCell>{e.employmentType}</TableCell>
                <TableCell>{e.dateOfJoining}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={e.status}
                    color={statusColor[e.status] ?? 'default'}
                  />
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  No employees match these filters.
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

      <EmployeeFormDialog
        open={dialogOpen}
        title="New employee"
        onClose={() => setDialogOpen(false)}
        onSubmit={(payload) => createMutation.mutate(payload)}
        submitting={createMutation.isPending}
        error={
          createMutation.isError
            ? ((createMutation.error as {
                response?: { data?: { message?: string } };
              })?.response?.data?.message ?? 'Save failed')
            : null
        }
      />
    </Box>
  );
}
