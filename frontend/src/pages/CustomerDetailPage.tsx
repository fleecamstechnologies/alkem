import { useMemo, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  Link,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { customersApi } from '../api/customers';
import { paymentsApi } from '../api/payments';
import type { CreatePaymentPayload } from '../api/payments';
import { money, monthsAgoISO, todayISO } from '../format';
import { WRITE_ROLES, type Customer } from '../types';
import { useAuth } from '../auth/AuthContext';
import { CustomerFormDialog } from '../components/CustomerFormDialog';
import { PaymentFormDialog } from '../components/PaymentFormDialog';
import { PaymentsTable } from '../components/PaymentsTable';

function errMsg(e: unknown): string {
  return (
    (e as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? 'Request failed'
  );
}

export function CustomerDetailPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canWrite = !!user && WRITE_ROLES.includes(user.role);

  const [tab, setTab] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [from, setFrom] = useState(monthsAgoISO(6));
  const [to, setTo] = useState(todayISO());

  const customerQuery = useQuery({
    queryKey: ['customer', id],
    queryFn: () => customersApi.get(id),
  });

  const paymentsQuery = useQuery({
    queryKey: ['customer-payments', id],
    queryFn: () => paymentsApi.listForCustomer(id, { limit: 100 }),
    enabled: tab === 1,
  });

  const statementQuery = useQuery({
    queryKey: ['statement', id, from, to],
    queryFn: () => paymentsApi.statement(id, from, to),
    enabled: tab === 2,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Partial<Customer>) =>
      customersApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      setEditOpen(false);
    },
  });

  const payMutation = useMutation({
    mutationFn: (payload: CreatePaymentPayload) => paymentsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      queryClient.invalidateQueries({ queryKey: ['customer-payments', id] });
      queryClient.invalidateQueries({ queryKey: ['statement', id] });
      setPayOpen(false);
    },
  });

  const customer = customerQuery.data;
  const fixedCustomer = useMemo(
    () =>
      customer
        ? { id: customer.id, name: customer.name, code: customer.code }
        : undefined,
    [customer],
  );

  if (customerQuery.isLoading) return <CircularProgress />;
  if (customerQuery.isError || !customer)
    return <Alert severity="error">Customer not found.</Alert>;

  return (
    <Box>
      <Link component={RouterLink} to="/customers">
        ← Back to customers
      </Link>

      <Stack
        direction="row"
        sx={{
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mt: 1,
          mb: 2,
        }}
      >
        <Box>
          <Typography variant="h5">{customer.name}</Typography>
          <Typography variant="body2" color="text.secondary">
            {customer.code} · {customer.type} ·{' '}
            {[customer.city, customer.state].filter(Boolean).join(', ') || '—'} ·{' '}
            {customer.territory || 'no territory'}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Chip
            label={customer.status}
            color={customer.status === 'ACTIVE' ? 'success' : 'default'}
          />
          {canWrite && (
            <Button variant="outlined" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
          )}
        </Stack>
      </Stack>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Outstanding balance
            </Typography>
            <Typography variant="h4">
              {money(customer.outstandingBalance)}
            </Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Credit limit
            </Typography>
            <Typography variant="h4">{money(customer.creditLimit)}</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Contact
            </Typography>
            <Typography>{customer.phone || '—'}</Typography>
            <Typography variant="body2" color="text.secondary">
              {customer.email || '—'}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      <Paper>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Overview" />
          <Tab label="Payments" />
          <Tab label="Statement" />
        </Tabs>

        <Box sx={{ p: 2 }}>
          {tab === 0 && (
            <Grid container spacing={2}>
              {[
                ['GSTIN', customer.gstin],
                ['Address line 1', customer.addressLine1],
                ['Address line 2', customer.addressLine2],
                ['Pincode', customer.pincode],
                ['Assigned rep', customer.assignedRepId],
                ['Created', customer.createdAt?.slice(0, 10)],
              ].map(([label, value]) => (
                <Grid size={{ xs: 12, sm: 6 }} key={label}>
                  <Typography variant="body2" color="text.secondary">
                    {label}
                  </Typography>
                  <Typography>{value || '—'}</Typography>
                </Grid>
              ))}
            </Grid>
          )}

          {tab === 1 && (
            <>
              <Stack
                direction="row"
                sx={{ justifyContent: 'flex-end', mb: 2 }}
              >
                {canWrite && (
                  <Button variant="contained" onClick={() => setPayOpen(true)}>
                    Add payment
                  </Button>
                )}
              </Stack>
              {paymentsQuery.isLoading ? (
                <CircularProgress />
              ) : (
                <PaymentsTable rows={paymentsQuery.data?.rows ?? []} />
              )}
            </>
          )}

          {tab === 2 && (
            <>
              <Stack
                direction="row"
                spacing={2}
                sx={{ mb: 2, alignItems: 'center' }}
              >
                <TextField
                  label="From"
                  type="date"
                  size="small"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                  label="To"
                  type="date"
                  size="small"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <Button onClick={() => window.print()}>Print</Button>
              </Stack>
              {statementQuery.isLoading ? (
                <CircularProgress />
              ) : statementQuery.data ? (
                <Box className="printable">
                  <Stack direction="row" spacing={4} sx={{ mb: 2 }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Opening balance
                      </Typography>
                      <Typography variant="h6">
                        {money(statementQuery.data.openingBalance)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Closing balance
                      </Typography>
                      <Typography variant="h6">
                        {money(statementQuery.data.closingBalance)}
                      </Typography>
                    </Box>
                  </Stack>
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell>Kind</TableCell>
                          <TableCell>Reference</TableCell>
                          <TableCell align="right">Amount</TableCell>
                          <TableCell align="right">Running balance</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {statementQuery.data.lines.map((l) => (
                          <TableRow key={l.id}>
                            <TableCell>{l.paymentDate}</TableCell>
                            <TableCell>{l.kind}</TableCell>
                            <TableCell>{l.referenceNo ?? '—'}</TableCell>
                            <TableCell align="right">{money(l.amount)}</TableCell>
                            <TableCell align="right">
                              {money(l.runningBalance)}
                            </TableCell>
                          </TableRow>
                        ))}
                        {statementQuery.data.lines.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                              No entries in this range.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              ) : (
                <Alert severity="error">Could not load statement.</Alert>
              )}
            </>
          )}
        </Box>
      </Paper>

      <CustomerFormDialog
        open={editOpen}
        title="Edit customer"
        initial={customer}
        onClose={() => setEditOpen(false)}
        onSubmit={(payload) => updateMutation.mutate(payload)}
        submitting={updateMutation.isPending}
        error={updateMutation.isError ? errMsg(updateMutation.error) : null}
      />
      <PaymentFormDialog
        open={payOpen}
        onClose={() => setPayOpen(false)}
        onSubmit={(payload) => payMutation.mutate(payload)}
        submitting={payMutation.isPending}
        error={payMutation.isError ? errMsg(payMutation.error) : null}
        fixedCustomer={fixedCustomer}
      />
    </Box>
  );
}
