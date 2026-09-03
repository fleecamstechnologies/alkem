import { useEffect, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { customersApi } from '../api/customers';
import type { CreatePaymentPayload } from '../api/payments';
import { PaymentKind, PaymentMethod, PaymentStatus, type Customer } from '../types';
import { todayISO } from '../format';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: CreatePaymentPayload) => void;
  submitting: boolean;
  error: string | null;
  /** When set, the customer is locked to this one. */
  fixedCustomer?: Pick<Customer, 'id' | 'name' | 'code'>;
}

export function PaymentFormDialog({
  open,
  onClose,
  onSubmit,
  submitting,
  error,
  fixedCustomer,
}: Props) {
  const [kind, setKind] = useState<string>(PaymentKind.INVOICE);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<string>('');
  const [referenceNo, setReferenceNo] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [status, setStatus] = useState<string>(PaymentStatus.CLEARED);
  const [notes, setNotes] = useState('');
  const [options, setOptions] = useState<Customer[]>([]);
  const [picked, setPicked] = useState<Customer | null>(null);

  useEffect(() => {
    if (open) {
      setKind(PaymentKind.INVOICE);
      setAmount('');
      setMethod('');
      setReferenceNo('');
      setPaymentDate(todayISO());
      setStatus(PaymentStatus.CLEARED);
      setNotes('');
      setPicked(null);
    }
  }, [open]);

  const search = async (term: string) => {
    if (term.length < 2) return;
    setOptions(await customersApi.search(term));
  };

  const customerId = fixedCustomer
    ? Number(fixedCustomer.id)
    : picked
      ? Number(picked.id)
      : NaN;

  const submit = () => {
    onSubmit({
      customerId,
      kind,
      amount,
      method: method || undefined,
      referenceNo: referenceNo || undefined,
      paymentDate,
      status: status || undefined,
      notes: notes || undefined,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Record payment</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {fixedCustomer ? (
            <TextField
              label="Customer"
              value={`${fixedCustomer.name} (${fixedCustomer.code})`}
              disabled
              fullWidth
            />
          ) : (
            <Autocomplete
              options={options}
              getOptionLabel={(o) => `${o.name} (${o.code})`}
              value={picked}
              onChange={(_, v) => setPicked(v)}
              onInputChange={(_, v) => void search(v)}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              renderInput={(p) => (
                <TextField {...p} label="Customer" required />
              )}
            />
          )}
          <Stack direction="row" spacing={2}>
            <TextField
              label="Kind"
              select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              fullWidth
            >
              {Object.values(PaymentKind).map((k) => (
                <MenuItem key={k} value={k}>
                  {k}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              fullWidth
              required
            />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Method"
              select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              fullWidth
            >
              <MenuItem value="">—</MenuItem>
              {Object.values(PaymentMethod).map((m) => (
                <MenuItem key={m} value={m}>
                  {m}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Reference no."
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              fullWidth
            />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <TextField
              label="Status"
              select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              fullWidth
            >
              {Object.values(PaymentStatus).map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            fullWidth
            multiline
            minRows={2}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={submit}
          disabled={
            submitting || !amount || Number.isNaN(customerId) || !paymentDate
          }
        >
          {submitting ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
