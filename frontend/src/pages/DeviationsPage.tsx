import { useEffect, useState, type FormEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { apiClient } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { Deviation } from '../types';
import { DeviationSeverity, DeviationStatus, UserRole } from '../types';

const SEVERITY_COLOR: Record<DeviationSeverity, 'success' | 'warning' | 'error'> = {
  [DeviationSeverity.MINOR]: 'success',
  [DeviationSeverity.MAJOR]: 'warning',
  [DeviationSeverity.CRITICAL]: 'error',
};

export function DeviationsPage() {
  const { user } = useAuth();
  const [deviations, setDeviations] = useState<Deviation[]>([]);
  const [open, setOpen] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canRaise = !!user;
  const canClose = user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.QA_MANAGER;

  const load = () => {
    apiClient.get<Deviation[]>('/qa/deviations').then((res) => setDeviations(res.data));
  };

  useEffect(load, []);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">Deviations</Typography>
        {canRaise && (
          <Button variant="contained" onClick={() => setOpen(true)}>
            Raise Deviation
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Stack spacing={2}>
        {deviations.map((deviation) => (
          <Paper key={deviation.id} sx={{ p: 2 }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Box>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                  <Chip size="small" label={deviation.severity} color={SEVERITY_COLOR[deviation.severity]} />
                  <Chip size="small" label={deviation.status.replaceAll('_', ' ')} variant="outlined" />
                  {deviation.batch && <Chip size="small" label={`Batch ${deviation.batch.batchNumber}`} />}
                </Stack>
                <Typography variant="body1">{deviation.description}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {deviation.department} · {new Date(deviation.createdAt).toLocaleString()}
                </Typography>
                {deviation.status === DeviationStatus.CLOSED && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="body2">
                      <strong>Root cause:</strong> {deviation.rootCause}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Corrective action:</strong> {deviation.correctiveAction}
                    </Typography>
                  </Box>
                )}
              </Box>
              {canClose && deviation.status !== DeviationStatus.CLOSED && (
                <Button size="small" onClick={() => setClosingId(deviation.id)}>
                  Close
                </Button>
              )}
            </Stack>
          </Paper>
        ))}
        {deviations.length === 0 && <Typography color="text.secondary">No deviations recorded.</Typography>}
      </Stack>

      <RaiseDeviationDialog
        open={open}
        onClose={() => setOpen(false)}
        onSubmitted={() => {
          setOpen(false);
          load();
        }}
        onError={setError}
      />
      <CloseDeviationDialog
        deviationId={closingId}
        onClose={() => setClosingId(null)}
        onSubmitted={() => {
          setClosingId(null);
          load();
        }}
        onError={setError}
      />
    </Box>
  );
}

function RaiseDeviationDialog({
  open,
  onClose,
  onSubmitted,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
  onError: (message: string) => void;
}) {
  const [form, setForm] = useState({
    department: '',
    description: '',
    severity: '' as DeviationSeverity | '',
    batchId: '',
  });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await apiClient.post('/qa/deviations', {
        department: form.department,
        description: form.description,
        severity: form.severity,
        batchId: form.batchId || undefined,
      });
      setForm({ department: '', description: '', severity: '', batchId: '' });
      onSubmitted();
    } catch (err: any) {
      onError(err.response?.data?.message ?? 'Failed to raise deviation');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Raise Deviation</DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Department"
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
            required
            fullWidth
          />
          <TextField
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required
            multiline
            minRows={2}
            fullWidth
          />
          <TextField
            select
            label="Severity"
            value={form.severity}
            onChange={(e) => setForm({ ...form, severity: e.target.value as DeviationSeverity })}
            required
            fullWidth
          >
            {Object.values(DeviationSeverity).map((severity) => (
              <MenuItem key={severity} value={severity}>
                {severity}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Related Batch ID (optional)"
            value={form.batchId}
            onChange={(e) => setForm({ ...form, batchId: e.target.value })}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">
            Raise
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

function CloseDeviationDialog({
  deviationId,
  onClose,
  onSubmitted,
  onError,
}: {
  deviationId: string | null;
  onClose: () => void;
  onSubmitted: () => void;
  onError: (message: string) => void;
}) {
  const [rootCause, setRootCause] = useState('');
  const [correctiveAction, setCorrectiveAction] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await apiClient.patch(`/qa/deviations/${deviationId}/close`, { rootCause, correctiveAction });
      setRootCause('');
      setCorrectiveAction('');
      onSubmitted();
    } catch (err: any) {
      onError(err.response?.data?.message ?? 'Failed to close deviation');
    }
  };

  return (
    <Dialog open={!!deviationId} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Close Deviation</DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Root Cause"
            value={rootCause}
            onChange={(e) => setRootCause(e.target.value)}
            required
            multiline
            minRows={2}
            fullWidth
          />
          <TextField
            label="Corrective Action"
            value={correctiveAction}
            onChange={(e) => setCorrectiveAction(e.target.value)}
            required
            multiline
            minRows={2}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">
            Close Deviation
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
