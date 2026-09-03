import {
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import type { Payment } from '../types';
import { money } from '../format';

const kindColor: Record<string, 'primary' | 'success' | 'warning' | 'default'> = {
  INVOICE: 'primary',
  RECEIPT: 'success',
  CREDIT_NOTE: 'warning',
  ADJUSTMENT: 'default',
};

export function PaymentsTable({
  rows,
  showCustomer,
}: {
  rows: Payment[];
  showCustomer?: boolean;
}) {
  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Date</TableCell>
            {showCustomer && <TableCell>Customer</TableCell>}
            <TableCell>Kind</TableCell>
            <TableCell align="right">Amount</TableCell>
            <TableCell>Method</TableCell>
            <TableCell>Reference</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Notes</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((p) => (
            <TableRow key={p.id} hover>
              <TableCell>{p.paymentDate}</TableCell>
              {showCustomer && <TableCell>{p.customerId}</TableCell>}
              <TableCell>
                <Chip
                  size="small"
                  label={p.kind}
                  color={kindColor[p.kind] ?? 'default'}
                />
              </TableCell>
              <TableCell align="right">{money(p.amount)}</TableCell>
              <TableCell>{p.method ?? '—'}</TableCell>
              <TableCell>{p.referenceNo ?? '—'}</TableCell>
              <TableCell>{p.status}</TableCell>
              <TableCell>{p.notes ?? '—'}</TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={showCustomer ? 8 : 7}
                align="center"
                sx={{ py: 4 }}
              >
                No payments.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
