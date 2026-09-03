import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
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
import { leaveApi } from '../api/attendance';
import { LeaveRequestStatus, HR_MANAGE_ROLES, HR_WRITE_ROLES } from '../types';
import { useAuth } from '../auth/AuthContext';

function errMsg(e: unknown): string {
  return (
    (e as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? 'Request failed'
  );
}

const statusColor: Record<string, 'warning' | 'success' | 'error' | 'default'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
  CANCELLED: 'default',
};

export function LeavePage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canManage = !!user && HR_MANAGE_ROLES.includes(user.role);
  const canConfig = !!user && HR_WRITE_ROLES.includes(user.role);

  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [typeDialog, setTypeDialog] = useState(false);
  const [typeForm, setTypeForm] = useState({
    code: '',
    name: '',
    paid: true,
    annualQuota: '0',
  });

  const requestsQuery = useQuery({
    queryKey: ['leave-requests-all', statusFilter],
    queryFn: () =>
      leaveApi.requests({ status: statusFilter || undefined }),
  });
  const typesQuery = useQuery({
    queryKey: ['leave-types'],
    queryFn: leaveApi.types,
  });

  const typeName = useMemo(() => {
    const m = new Map((typesQuery.data ?? []).map((t) => [t.id, t.code]));
    return (id: string) => m.get(id) ?? id;
  }, [typesQuery.data]);

  const decideMutation = useMutation({
    mutationFn: (v: { id: string; decision: string }) =>
      leaveApi.decide(v.id, v.decision),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['leave-requests-all'] }),
  });
  const grantMutation = useMutation({
    mutationFn: () => leaveApi.grantQuota(new Date().getFullYear()),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] }),
  });
  const createTypeMutation = useMutation({
    mutationFn: () =>
      leaveApi.createType({
        code: typeForm.code,
        name: typeForm.name,
        paid: typeForm.paid,
        annualQuota: typeForm.annualQuota,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-types'] });
      setTypeDialog(false);
      setTypeForm({ code: '', name: '', paid: true, annualQuota: '0' });
    },
  });

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
      >
        <Typography variant="h5">Leave</Typography>
        <Stack direction="row" spacing={1}>
          {canConfig && (
            <Button
              variant="outlined"
              onClick={() => grantMutation.mutate()}
              disabled={grantMutation.isPending}
            >
              Grant {new Date().getFullYear()} quota
            </Button>
          )}
          {canConfig && (
            <Button variant="contained" onClick={() => setTypeDialog(true)}>
              New leave type
            </Button>
          )}
        </Stack>
      </Stack>

      {grantMutation.isSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Quota granted: {grantMutation.data?.affected} balance rows touched.
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            label="Status"
            select
            size="small"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">All</MenuItem>
            {Object.values(LeaveRequestStatus).map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={1}>
            {(typesQuery.data ?? []).map((t) => (
              <Chip
                key={t.id}
                size="small"
                label={`${t.code} · ${t.paid ? 'paid' : 'unpaid'} · ${t.annualQuota}`}
              />
            ))}
          </Stack>
        </Stack>
      </Paper>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Employee</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>From</TableCell>
              <TableCell>To</TableCell>
              <TableCell align="right">Days</TableCell>
              <TableCell>Reason</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(requestsQuery.data ?? []).map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  {r.employeeName ?? `#${r.employeeId}`}
                  {r.employeeCode ? ` (${r.employeeCode})` : ''}
                </TableCell>
                <TableCell>{typeName(r.leaveTypeId)}</TableCell>
                <TableCell>{r.fromDate}</TableCell>
                <TableCell>{r.toDate}</TableCell>
                <TableCell align="right">{r.days}</TableCell>
                <TableCell>{r.reason || '—'}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={r.status}
                    color={statusColor[r.status] ?? 'default'}
                  />
                </TableCell>
                <TableCell align="right">
                  {canManage && r.status === 'PENDING' && (
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ justifyContent: 'flex-end' }}
                    >
                      <Button
                        size="small"
                        color="success"
                        onClick={() =>
                          decideMutation.mutate({
                            id: r.id,
                            decision: 'APPROVED',
                          })
                        }
                      >
                        Approve
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        onClick={() =>
                          decideMutation.mutate({
                            id: r.id,
                            decision: 'REJECTED',
                          })
                        }
                      >
                        Reject
                      </Button>
                    </Stack>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(requestsQuery.data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  No leave requests.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={typeDialog} onClose={() => setTypeDialog(false)}>
        <DialogTitle>New leave type</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1, minWidth: 320 }}>
            {createTypeMutation.isError && (
              <Alert severity="error">{errMsg(createTypeMutation.error)}</Alert>
            )}
            <TextField
              label="Code"
              value={typeForm.code}
              onChange={(e) =>
                setTypeForm((f) => ({ ...f, code: e.target.value }))
              }
            />
            <TextField
              label="Name"
              value={typeForm.name}
              onChange={(e) =>
                setTypeForm((f) => ({ ...f, name: e.target.value }))
              }
            />
            <TextField
              label="Annual quota"
              value={typeForm.annualQuota}
              onChange={(e) =>
                setTypeForm((f) => ({ ...f, annualQuota: e.target.value }))
              }
            />
            <FormControlLabel
              control={
                <Switch
                  checked={typeForm.paid}
                  onChange={(e) =>
                    setTypeForm((f) => ({ ...f, paid: e.target.checked }))
                  }
                />
              }
              label="Paid leave"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTypeDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={
              !typeForm.code || !typeForm.name || createTypeMutation.isPending
            }
            onClick={() => createTypeMutation.mutate()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
