import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { paymentsApi, type PaymentListParams } from '../api/payments';
import type { CreatePaymentPayload } from '../api/payments';
import { PaymentKind, PaymentMethod, PaymentStatus, WRITE_ROLES } from '../types';
import { money, monthsAgoISO, todayISO } from '../format';
import { useAuth } from '../auth/AuthContext';
import { PaymentFormDialog } from '../components/PaymentFormDialog';
import { PaymentsTable } from '../components/PaymentsTable';

function errMsg(e: unknown): string {
  return (
    (e as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? 'Request failed'
  );
}

export function PaymentsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canWrite = !!user && WRITE_ROLES.includes(user.role);

  const [from, setFrom] = useState(monthsAgoISO(1));
  const [to, setTo] = useState(todayISO());
  const [kind, setKind] = useState('');
  const [method, setMethod] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);

  const params: PaymentListParams = useMemo(
    () => ({
      from,
      to,
      kind: kind || undefined,
      method: method || undefined,
      status: status || undefined,
      limit: 50,
      page,
    }),
    [from, to, kind, method, status, page],
  );

  const listQuery = useQuery({
    queryKey: ['payments', params],
    queryFn: () => paymentsApi.list(params),
    placeholderData: (p) => p,
  });

  const summaryQuery = useQuery({
    queryKey: ['payments-summary', from, to],
    queryFn: () => paymentsApi.summary(from, to, 'month'),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreatePaymentPayload) => paymentsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['payments-summary'] });
      setOpen(false);
    },
  });

  const rows = listQuery.data?.rows ?? [];
  const totalInvoiced = summaryQuery.data?.reduce(
    (s, r) => s + Number(r.invoiced),
    0,
  );
  const totalReceived = summaryQuery.data?.reduce(
    (s, r) => s + Number(r.received),
    0,
  );

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
      >
        <Typography variant="h5">Payments</Typography>
        {canWrite && (
          <Button variant="contained" onClick={() => setOpen(true)}>
            Record payment
          </Button>
        )}
      </Stack>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Invoiced (range)
            </Typography>
            <Typography variant="h6">{money(totalInvoiced ?? 0)}</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Received (range)
            </Typography>
            <Typography variant="h6">{money(totalReceived ?? 0)}</Typography>
          </Paper>
        </Grid>
      </Grid>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 2 }}>
          <TextField
            label="From"
            type="date"
            size="small"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="To"
            type="date"
            size="small"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Kind"
            select
            size="small"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setPage(1);
            }}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="">All</MenuItem>
            {Object.values(PaymentKind).map((k) => (
              <MenuItem key={k} value={k}>
                {k}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Method"
            select
            size="small"
            value={method}
            onChange={(e) => {
              setMethod(e.target.value);
              setPage(1);
            }}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="">All</MenuItem>
            {Object.values(PaymentMethod).map((m) => (
              <MenuItem key={m} value={m}>
                {m}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Status"
            select
            size="small"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="">All</MenuItem>
            {Object.values(PaymentStatus).map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Paper>

      <PaymentsTable rows={rows} showCustomer />

      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', mt: 2 }}
      >
        <Typography variant="body2" color="text.secondary">
          {listQuery.data?.total !== null && listQuery.data?.total !== undefined
            ? `${listQuery.data.total} matching · `
            : ''}
          Page {page}
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
            disabled={rows.length < 50}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </Stack>
      </Stack>

      <PaymentFormDialog
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={(payload) => createMutation.mutate(payload)}
        submitting={createMutation.isPending}
        error={createMutation.isError ? errMsg(createMutation.error) : null}
      />
    </Box>
  );
}
