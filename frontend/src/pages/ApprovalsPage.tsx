import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { portalApi } from '../api/portal';

function errMsg(e: unknown): string {
  return (
    (e as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? 'Request failed'
  );
}

export function ApprovalsPage() {
  const qc = useQueryClient();
  const [openMember, setOpenMember] = useState<string | null>(null);
  const month = new Date().toISOString().slice(0, 7);

  const teamQuery = useQuery({ queryKey: ['me-team'], queryFn: portalApi.team });
  const approvalsQuery = useQuery({
    queryKey: ['me-approvals'],
    queryFn: portalApi.approvals,
  });
  const memberAttQuery = useQuery({
    queryKey: ['me-team-att', openMember, month],
    queryFn: () => portalApi.teamAttendance(openMember!, month),
    enabled: !!openMember,
  });

  const decide = useMutation({
    mutationFn: (v: { id: string; decision: string }) =>
      portalApi.decide(v.id, v.decision),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me-approvals'] }),
  });

  const regQuery = useQuery({
    queryKey: ['me-reg-approvals'],
    queryFn: portalApi.regularizationApprovals,
  });
  const decideReg = useMutation({
    mutationFn: (v: { id: string; decision: string }) =>
      portalApi.decideRegularization(v.id, v.decision),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['me-reg-approvals'] }),
  });
  const t = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—';

  const memberName = useMemo(() => {
    const m = new Map(
      (teamQuery.data ?? []).map((t) => [t.id, `${t.firstName} ${t.lastName}`]),
    );
    return (id: string) => m.get(id) ?? `#${id}`;
  }, [teamQuery.data]);

  if (teamQuery.isLoading) return <CircularProgress />;

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Team approvals
      </Typography>

      {(decide.isError || decideReg.isError) && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errMsg(decide.error ?? decideReg.error)}
        </Alert>
      )}

      <Typography variant="subtitle2" gutterBottom>
        Pending regularizations
      </Typography>
      <TableContainer component={Paper} sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Employee</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Requested in</TableCell>
              <TableCell>Requested out</TableCell>
              <TableCell>Reason</TableCell>
              <TableCell align="right">Decision</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(regQuery.data ?? []).map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  {r.employeeName} ({r.employeeCode})
                </TableCell>
                <TableCell>{r.date}</TableCell>
                <TableCell>{t(r.requestedInAt)}</TableCell>
                <TableCell>{t(r.requestedOutAt)}</TableCell>
                <TableCell>{r.reason}</TableCell>
                <TableCell align="right">
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ justifyContent: 'flex-end' }}
                  >
                    <Button
                      size="small"
                      color="success"
                      onClick={() =>
                        decideReg.mutate({ id: r.id, decision: 'APPROVED' })
                      }
                    >
                      Approve
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      onClick={() =>
                        decideReg.mutate({ id: r.id, decision: 'REJECTED' })
                      }
                    >
                      Reject
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {(regQuery.data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  Nothing pending.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="subtitle2" gutterBottom>
        Pending leave requests
      </Typography>
      <TableContainer component={Paper} sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Employee</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>From</TableCell>
              <TableCell>To</TableCell>
              <TableCell align="right">Days</TableCell>
              <TableCell>Reason</TableCell>
              <TableCell align="right">Decision</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(approvalsQuery.data ?? []).map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  {a.employeeName} ({a.employeeCode})
                </TableCell>
                <TableCell>{a.leaveTypeCode}</TableCell>
                <TableCell>{a.fromDate}</TableCell>
                <TableCell>{a.toDate}</TableCell>
                <TableCell align="right">{a.days}</TableCell>
                <TableCell>{a.reason || '—'}</TableCell>
                <TableCell align="right">
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ justifyContent: 'flex-end' }}
                  >
                    <Button
                      size="small"
                      color="success"
                      onClick={() =>
                        decide.mutate({ id: a.id, decision: 'APPROVED' })
                      }
                    >
                      Approve
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      onClick={() =>
                        decide.mutate({ id: a.id, decision: 'REJECTED' })
                      }
                    >
                      Reject
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {(approvalsQuery.data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  Nothing pending.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="subtitle2" gutterBottom>
        My team
      </Typography>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Code</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Designation</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Attendance</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(teamQuery.data ?? []).map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.code}</TableCell>
                <TableCell>
                  {t.firstName} {t.lastName}
                </TableCell>
                <TableCell>{t.designation || '—'}</TableCell>
                <TableCell>
                  <Chip size="small" label={t.status} />
                </TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    onClick={() =>
                      setOpenMember(openMember === t.id ? null : t.id)
                    }
                  >
                    {openMember === t.id ? 'Hide' : `${month}`}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {openMember && (
        <Paper sx={{ mt: 2, p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            {memberName(openMember)} — {month}
          </Typography>
          {memberAttQuery.isLoading ? (
            <CircularProgress />
          ) : (
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
              {(memberAttQuery.data ?? []).map((d) => (
                <Chip
                  key={d.date}
                  size="small"
                  label={`${d.date.slice(8)}:${d.status[0]}`}
                  variant={d.recorded ? 'filled' : 'outlined'}
                  color={
                    d.status === 'ABSENT'
                      ? 'error'
                      : d.status === 'ON_LEAVE' || d.status === 'HALF_DAY'
                        ? 'warning'
                        : 'default'
                  }
                />
              ))}
            </Stack>
          )}
        </Paper>
      )}
    </Box>
  );
}
