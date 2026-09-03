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
import { customersApi, type CustomerListParams } from '../api/customers';
import { CustomerStatus, CustomerType, type Customer } from '../types';
import { money } from '../format';
import { useAuth } from '../auth/AuthContext';
import { WRITE_ROLES } from '../types';
import { CustomerFormDialog } from '../components/CustomerFormDialog';

const PAGE_SIZES = [25, 50, 100];

const statusColor: Record<string, 'success' | 'default' | 'error'> = {
  ACTIVE: 'success',
  INACTIVE: 'default',
  BLOCKED: 'error',
};

export function CustomersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canWrite = !!user && WRITE_ROLES.includes(user.role);

  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [city, setCity] = useState('');
  const [limit, setLimit] = useState(50);
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [qInput]);

  const params: CustomerListParams = useMemo(
    () => ({
      q: q || undefined,
      type: type || undefined,
      status: status || undefined,
      city: city || undefined,
      limit,
      page,
    }),
    [q, type, status, city, limit, page],
  );

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['customers', params],
    queryFn: () => customersApi.list(params),
    placeholderData: (prev) => prev,
  });

  const createMutation = useMutation({
    mutationFn: (payload: Partial<Customer>) => customersApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setDialogOpen(false);
    },
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? null;
  const hasNext = rows.length === limit;

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
      >
        <Typography variant="h5">Customers</Typography>
        {canWrite && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
          >
            New customer
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
            label="Type"
            size="small"
            select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">All</MenuItem>
            {Object.values(CustomerType).map((t) => (
              <MenuItem key={t} value={t}>
                {t}
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
            {Object.values(CustomerStatus).map((s) => (
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
          <TextField
            label="Page size"
            size="small"
            select
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
            sx={{ minWidth: 110 }}
          >
            {PAGE_SIZES.map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Paper>

      {isError && <Alert severity="error">Failed to load customers.</Alert>}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Code</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>City / State</TableCell>
              <TableCell>Territory</TableCell>
              <TableCell align="right">Outstanding</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((c) => (
              <TableRow
                key={c.id}
                hover
                sx={{ cursor: 'pointer' }}
                onClick={() => navigate(`/customers/${c.id}`)}
              >
                <TableCell>{c.code}</TableCell>
                <TableCell>{c.name}</TableCell>
                <TableCell>{c.type}</TableCell>
                <TableCell>
                  {[c.city, c.state].filter(Boolean).join(', ') || '—'}
                </TableCell>
                <TableCell>{c.territory || '—'}</TableCell>
                <TableCell align="right">
                  {money(c.outstandingBalance)}
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={c.status}
                    color={statusColor[c.status] ?? 'default'}
                  />
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  No customers match these filters.
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
          {total !== null ? `${total} matching · ` : ''}Page {page}
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
            disabled={!hasNext || page >= 200}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </Stack>
      </Stack>

      <CustomerFormDialog
        open={dialogOpen}
        title="New customer"
        onClose={() => setDialogOpen(false)}
        onSubmit={(payload) => createMutation.mutate(payload)}
        submitting={createMutation.isPending}
        error={
          createMutation.isError
            ? ((createMutation.error as { response?: { data?: { message?: string } } })
                ?.response?.data?.message ?? 'Save failed')
            : null
        }
      />
    </Box>
  );
}
