import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
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
import { attendanceApi } from '../api/attendance';
import { departmentsApi, employeesApi } from '../api/employees';
import { AttendanceStatus, HR_MANAGE_ROLES } from '../types';
import { useAuth } from '../auth/AuthContext';

const monthNow = () => new Date().toISOString().slice(0, 7);

/** Last calendar day of a 'YYYY-MM' month, as 'YYYY-MM-DD'. */
const monthEnd = (periodMonth: string) => {
  const [y, m] = periodMonth.split('-').map(Number);
  const day = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${periodMonth}-${String(day).padStart(2, '0')}`;
};

const CELL_COLOR: Record<string, string> = {
  PRESENT: '#e8f5e9',
  ABSENT: '#ffebee',
  ON_LEAVE: '#fff8e1',
  HALF_DAY: '#fff3e0',
  HOLIDAY: '#eceff1',
  WEEK_OFF: '#f5f5f5',
};

export function AttendancePage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canManage = !!user && HR_MANAGE_ROLES.includes(user.role);

  const [periodMonth, setPeriodMonth] = useState(monthNow());
  const [departmentId, setDepartmentId] = useState('');

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: departmentsApi.list,
  });
  const employeesQuery = useQuery({
    queryKey: ['employees-att', departmentId],
    queryFn: () =>
      employeesApi.list({
        departmentId: departmentId ? Number(departmentId) : undefined,
        status: 'ACTIVE',
        limit: 100,
      }),
  });
  const from = `${periodMonth}-01`;
  const to = monthEnd(periodMonth);
  const recordsQuery = useQuery({
    queryKey: ['attendance', periodMonth, departmentId],
    queryFn: () =>
      attendanceApi.list({
        departmentId: departmentId ? Number(departmentId) : undefined,
        from,
        to,
      }),
  });
  const summaryQuery = useQuery({
    queryKey: ['attendance-summary', periodMonth, departmentId],
    queryFn: () =>
      attendanceApi.summary(
        periodMonth,
        departmentId ? Number(departmentId) : undefined,
      ),
  });

  const markMutation = useMutation({
    mutationFn: (v: { employeeId: number; date: string; status: string }) =>
      attendanceApi.mark(v),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-summary'] });
    },
  });

  const days = useMemo(() => {
    const [y, m] = periodMonth.split('-').map(Number);
    const count = new Date(y, m, 0).getDate();
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [periodMonth]);

  const cellMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of recordsQuery.data ?? []) {
      map.set(`${r.employeeId}_${r.date}`, r.status);
    }
    return map;
  }, [recordsQuery.data]);

  const employees = employeesQuery.data?.rows ?? [];

  const cycle = (current: string | undefined): string => {
    const order: string[] = [
      AttendanceStatus.PRESENT,
      AttendanceStatus.ABSENT,
      AttendanceStatus.HALF_DAY,
      AttendanceStatus.WEEK_OFF,
    ];
    const idx = current ? order.indexOf(current) : -1;
    return order[(idx + 1) % order.length];
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Attendance
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" sx={{ gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            label="Month"
            type="month"
            size="small"
            value={periodMonth}
            onChange={(e) => setPeriodMonth(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Department"
            select
            size="small"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">All</MenuItem>
            {(departments ?? []).map((d) => (
              <MenuItem key={d.id} value={d.id}>
                {d.name}
              </MenuItem>
            ))}
          </TextField>
          {summaryQuery.data && (
            <Stack direction="row" spacing={1}>
              {summaryQuery.data.byStatus.map((s) => (
                <Chip
                  key={s.status}
                  size="small"
                  label={`${s.status}: ${s.count}`}
                />
              ))}
              <Chip
                size="small"
                color="warning"
                label={`On leave today: ${summaryQuery.data.onLeaveToday}`}
              />
            </Stack>
          )}
        </Stack>
        {canManage && (
          <Typography variant="caption" color="text.secondary">
            Click a cell to cycle PRESENT → ABSENT → HALF_DAY → WEEK_OFF.
          </Typography>
        )}
      </Paper>

      {recordsQuery.isLoading || employeesQuery.isLoading ? (
        <CircularProgress />
      ) : employees.length === 0 ? (
        <Alert severity="info">No active employees for this filter.</Alert>
      ) : (
        <TableContainer component={Paper} sx={{ maxHeight: '70vh' }}>
          <Table size="small" stickyHeader sx={{ '& td, & th': { px: 0.5 } }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 3, minWidth: 160 }}>
                  Employee
                </TableCell>
                {days.map((d) => (
                  <TableCell key={d} align="center">
                    {d}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {employees.map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell
                    sx={{
                      position: 'sticky',
                      left: 0,
                      bgcolor: 'background.paper',
                      zIndex: 2,
                    }}
                  >
                    {emp.firstName} {emp.lastName}
                  </TableCell>
                  {days.map((d) => {
                    const date = `${periodMonth}-${String(d).padStart(2, '0')}`;
                    const key = `${emp.id}_${date}`;
                    const status = cellMap.get(key);
                    return (
                      <TableCell
                        key={d}
                        align="center"
                        onClick={
                          canManage
                            ? () =>
                                markMutation.mutate({
                                  employeeId: Number(emp.id),
                                  date,
                                  status: cycle(status),
                                })
                            : undefined
                        }
                        sx={{
                          cursor: canManage ? 'pointer' : 'default',
                          bgcolor: status ? CELL_COLOR[status] : undefined,
                          fontSize: 11,
                        }}
                      >
                        {status ? status[0] : ''}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <RegularizationsSection canManage={canManage} />
    </Box>
  );
}

// ---- regularization queue -------------------------------------

function errMsg(e: unknown): string {
  return (
    (e as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? 'Request failed'
  );
}

function RegularizationsSection({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState('PENDING');
  const q = useQuery({
    queryKey: ['att-regs', status],
    queryFn: () =>
      attendanceApi.regularizations({ status: status || undefined }),
  });
  const decide = useMutation({
    mutationFn: (v: { id: string; decision: string }) =>
      attendanceApi.decideRegularization(v.id, v.decision),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['att-regs'] }),
  });
  const t = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—';

  return (
    <Paper sx={{ p: 2, mt: 3 }}>
      <Stack direction="row" sx={{ gap: 2, alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle1">Regularizations</Typography>
        <TextField
          select
          size="small"
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="">All</MenuItem>
          {['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map((s) => (
            <MenuItem key={s} value={s}>
              {s}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
      {decide.isError && (
        <Alert severity="error" sx={{ mb: 1 }}>
          {errMsg(decide.error)}
        </Alert>
      )}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Employee</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>In</TableCell>
              <TableCell>Out</TableCell>
              <TableCell>Reason</TableCell>
              <TableCell>Status</TableCell>
              {canManage && <TableCell align="right" />}
            </TableRow>
          </TableHead>
          <TableBody>
            {(q.data ?? []).map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  {r.employeeName} ({r.employeeCode})
                </TableCell>
                <TableCell>{r.date}</TableCell>
                <TableCell>{t(r.requestedInAt)}</TableCell>
                <TableCell>{t(r.requestedOutAt)}</TableCell>
                <TableCell>{r.reason}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={r.status}
                    color={
                      r.status === 'APPROVED'
                        ? 'success'
                        : r.status === 'REJECTED'
                          ? 'error'
                          : r.status === 'CANCELLED'
                            ? 'default'
                            : 'warning'
                    }
                  />
                </TableCell>
                {canManage && (
                  <TableCell align="right">
                    {r.status === 'PENDING' && (
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ justifyContent: 'flex-end' }}
                      >
                        <Button
                          size="small"
                          color="success"
                          onClick={() =>
                            decide.mutate({ id: r.id, decision: 'APPROVED' })
                          }
                        >
                          Approve
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          onClick={() =>
                            decide.mutate({ id: r.id, decision: 'REJECTED' })
                          }
                        >
                          Reject
                        </Button>
                      </Stack>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
            {(q.data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                  Nothing here.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
