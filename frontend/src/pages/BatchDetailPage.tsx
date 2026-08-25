import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { apiClient } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { Batch, QaReview, QcSample, QcTest } from '../types';
import {
  BatchStatus,
  QaDecision,
  QcSampleStatus,
  QcTestName,
  QcTestResultStatus,
  UserRole,
} from '../types';

export function BatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [samples, setSamples] = useState<QcSample[]>([]);
  const [testsBySample, setTestsBySample] = useState<Record<string, QcTest[]>>({});
  const [reviews, setReviews] = useState<QaReview[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [qcDialog, setQcDialog] = useState<'submit' | 'sample' | 'test' | null>(null);
  const [activeSampleId, setActiveSampleId] = useState<string | null>(null);
  const [resultDialogTest, setResultDialogTest] = useState<QcTest | null>(null);
  const [decisionDialog, setDecisionDialog] = useState(false);

  const load = async () => {
    if (!id) return;
    const [batchRes, samplesRes, reviewsRes] = await Promise.all([
      apiClient.get<Batch>(`/batches/${id}`),
      apiClient.get<QcSample[]>('/qc/samples'),
      apiClient.get<QaReview[]>(`/qa/batches/${id}/reviews`),
    ]);
    setBatch(batchRes.data);
    const batchSamples = samplesRes.data.filter((s) => s.batchId === id);
    setSamples(batchSamples);
    setReviews(reviewsRes.data);

    const testEntries = await Promise.all(
      batchSamples.map((s) =>
        apiClient.get<QcTest[]>(`/qc/samples/${s.id}/tests`).then((res) => [s.id, res.data] as const),
      ),
    );
    setTestsBySample(Object.fromEntries(testEntries));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!batch) {
    return <Typography>Loading…</Typography>;
  }

  const isProduction = user?.role === UserRole.PRODUCTION_MANAGER || user?.role === UserRole.SUPER_ADMIN;
  const isQc = user?.role === UserRole.QC_ANALYST || user?.role === UserRole.SUPER_ADMIN;
  const isQa = user?.role === UserRole.QA_MANAGER || user?.role === UserRole.SUPER_ADMIN;

  const runAction = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Action failed');
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Batch {batch.batchNumber}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" spacing={4} sx={{ flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Product
            </Typography>
            <Typography>{batch.product?.productName} ({batch.product?.strength})</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Status
            </Typography>
            <Box>
              <Chip label={batch.status.replaceAll('_', ' ')} color="primary" />
            </Box>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Batch Size
            </Typography>
            <Typography>{batch.batchSize}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Production Quantity
            </Typography>
            <Typography>{batch.productionQuantity ?? '—'}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Manufacturing Site
            </Typography>
            <Typography>{batch.manufacturingSite}</Typography>
          </Box>
        </Stack>

        <Divider sx={{ my: 2 }} />

        <Stack direction="row" spacing={2}>
          {isProduction && batch.status === BatchStatus.CREATED && (
            <Button
              variant="contained"
              onClick={() => runAction(() => apiClient.patch(`/batches/${id}/start-manufacturing`))}
            >
              Start Manufacturing
            </Button>
          )}
          {isProduction && batch.status === BatchStatus.MANUFACTURING && (
            <Button variant="contained" onClick={() => setQcDialog('submit')}>
              Submit for QC
            </Button>
          )}
          {isQc && batch.status === BatchStatus.QC_PENDING && (
            <Button variant="contained" onClick={() => setQcDialog('sample')}>
              Draw QC Sample
            </Button>
          )}
          {isQa && batch.status === BatchStatus.QC_APPROVED && (
            <Button
              variant="contained"
              onClick={() => runAction(() => apiClient.patch(`/qa/batches/${id}/start-review`))}
            >
              Start QA Review
            </Button>
          )}
          {isQa && batch.status === BatchStatus.QA_REVIEW && (
            <Button variant="contained" color="secondary" onClick={() => setDecisionDialog(true)}>
              Record QA Decision
            </Button>
          )}
        </Stack>
      </Paper>

      <Typography variant="h6" gutterBottom>
        QC Samples
      </Typography>
      {samples.length === 0 && (
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          No samples drawn yet.
        </Typography>
      )}
      {samples.map((sample) => (
        <Paper key={sample.id} sx={{ p: 2, mb: 2 }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle1">
              {sample.sampleType} — Qty {sample.sampleQuantity} — collected {sample.collectionDate}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Chip size="small" label={sample.status.replaceAll('_', ' ')} />
              {isQc && sample.status !== QcSampleStatus.COMPLETED && (
                <Button
                  size="small"
                  onClick={() => {
                    setActiveSampleId(sample.id);
                    setQcDialog('test');
                  }}
                >
                  Add Test
                </Button>
              )}
              {isQc && sample.status !== QcSampleStatus.COMPLETED && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => runAction(() => apiClient.patch(`/qc/samples/${sample.id}/complete`))}
                >
                  Complete Sample
                </Button>
              )}
            </Stack>
          </Stack>

          <Table size="small" sx={{ mt: 1 }}>
            <TableHead>
              <TableRow>
                <TableCell>Test</TableCell>
                <TableCell>Specification</TableCell>
                <TableCell>Actual</TableCell>
                <TableCell>Result</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {(testsBySample[sample.id] ?? []).map((test) => (
                <TableRow key={test.id}>
                  <TableCell>{test.testName.replaceAll('_', ' ')}</TableCell>
                  <TableCell>{test.specificationText}</TableCell>
                  <TableCell>{test.actualResultValue ?? test.actualResultText ?? '—'}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={test.resultStatus}
                      color={
                        test.resultStatus === QcTestResultStatus.PASS
                          ? 'success'
                          : test.resultStatus === QcTestResultStatus.FAIL
                            ? 'error'
                            : 'default'
                      }
                    />
                  </TableCell>
                  <TableCell>
                    {isQc && test.resultStatus === QcTestResultStatus.PENDING && (
                      <Button size="small" onClick={() => setResultDialogTest(test)}>
                        Record Result
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      ))}

      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        QA Reviews
      </Typography>
      {reviews.length === 0 && <Typography color="text.secondary">No QA reviews yet.</Typography>}
      {reviews.map((review) => (
        <Paper key={review.id} sx={{ p: 2, mb: 1 }}>
          <Chip
            size="small"
            label={review.decision}
            color={review.decision === QaDecision.RELEASED ? 'success' : 'error'}
            sx={{ mr: 1 }}
          />
          <Typography component="span">{review.comments}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {new Date(review.reviewedAt).toLocaleString()}
          </Typography>
        </Paper>
      ))}

      <SubmitForQcDialog
        open={qcDialog === 'submit'}
        onClose={() => setQcDialog(null)}
        onSubmit={(quantity) =>
          runAction(() => apiClient.patch(`/batches/${id}/submit-for-qc`, { productionQuantity: quantity })).then(
            () => setQcDialog(null),
          )
        }
      />
      <CreateSampleDialog
        open={qcDialog === 'sample'}
        onClose={() => setQcDialog(null)}
        onSubmit={(payload) =>
          runAction(() => apiClient.post('/qc/samples', { batchId: id, ...payload })).then(() => setQcDialog(null))
        }
      />
      <AddTestDialog
        open={qcDialog === 'test'}
        onClose={() => setQcDialog(null)}
        onSubmit={(payload) =>
          runAction(() => apiClient.post('/qc/tests', { sampleId: activeSampleId, ...payload })).then(() =>
            setQcDialog(null),
          )
        }
      />
      <RecordResultDialog
        test={resultDialogTest}
        onClose={() => setResultDialogTest(null)}
        onSubmit={(payload) =>
          runAction(() => apiClient.patch(`/qc/tests/${resultDialogTest?.id}/result`, payload)).then(() =>
            setResultDialogTest(null),
          )
        }
      />
      <QaDecisionDialog
        open={decisionDialog}
        onClose={() => setDecisionDialog(false)}
        onSubmit={(payload) =>
          runAction(() => apiClient.post(`/qa/batches/${id}/decision`, payload)).then(() =>
            setDecisionDialog(false),
          )
        }
      />
    </Box>
  );
}

function SubmitForQcDialog({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (quantity: number) => void;
}) {
  const [quantity, setQuantity] = useState('');
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(Number(quantity));
    setQuantity('');
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Submit for QC</DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent>
          <TextField
            label="Production Quantity"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">
            Submit
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

function CreateSampleDialog({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { sampleType: string; sampleQuantity: number; collectionDate: string }) => void;
}) {
  const [form, setForm] = useState({ sampleType: '', sampleQuantity: '', collectionDate: '' });
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({
      sampleType: form.sampleType,
      sampleQuantity: Number(form.sampleQuantity),
      collectionDate: form.collectionDate,
    });
    setForm({ sampleType: '', sampleQuantity: '', collectionDate: '' });
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Draw QC Sample</DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Sample Type"
            value={form.sampleType}
            onChange={(e) => setForm({ ...form, sampleType: e.target.value })}
            required
            fullWidth
          />
          <TextField
            label="Sample Quantity"
            type="number"
            value={form.sampleQuantity}
            onChange={(e) => setForm({ ...form, sampleQuantity: e.target.value })}
            required
            fullWidth
          />
          <TextField
            label="Collection Date"
            type="date"
            value={form.collectionDate}
            onChange={(e) => setForm({ ...form, collectionDate: e.target.value })}
            slotProps={{ inputLabel: { shrink: true } }}
            required
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">
            Create
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

function AddTestDialog({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    testName: QcTestName;
    specificationText: string;
    specMin?: number;
    specMax?: number;
  }) => void;
}) {
  const [form, setForm] = useState({ testName: '', specificationText: '', specMin: '', specMax: '' });
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({
      testName: form.testName as QcTestName,
      specificationText: form.specificationText,
      specMin: form.specMin ? Number(form.specMin) : undefined,
      specMax: form.specMax ? Number(form.specMax) : undefined,
    });
    setForm({ testName: '', specificationText: '', specMin: '', specMax: '' });
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Add QC Test</DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            select
            label="Test"
            value={form.testName}
            onChange={(e) => setForm({ ...form, testName: e.target.value })}
            required
            fullWidth
          >
            {Object.values(QcTestName).map((name) => (
              <MenuItem key={name} value={name}>
                {name.replaceAll('_', ' ')}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Specification (e.g. 95-105% or White tablets)"
            value={form.specificationText}
            onChange={(e) => setForm({ ...form, specificationText: e.target.value })}
            required
            fullWidth
          />
          <TextField
            label="Spec Min (numeric tests only)"
            type="number"
            value={form.specMin}
            onChange={(e) => setForm({ ...form, specMin: e.target.value })}
            fullWidth
          />
          <TextField
            label="Spec Max (numeric tests only)"
            type="number"
            value={form.specMax}
            onChange={(e) => setForm({ ...form, specMax: e.target.value })}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">
            Add
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

function RecordResultDialog({
  test,
  onClose,
  onSubmit,
}: {
  test: QcTest | null;
  onClose: () => void;
  onSubmit: (payload: { actualResultValue?: number; actualResultText?: string; manualPass?: boolean; remarks?: string }) => void;
}) {
  const [value, setValue] = useState('');
  const [text, setText] = useState('');
  const [manualPass, setManualPass] = useState<'pass' | 'fail' | ''>('');
  const [remarks, setRemarks] = useState('');

  if (!test) return null;

  const isNumeric = test.specMin !== null && test.specMax !== null;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({
      actualResultValue: isNumeric && value ? Number(value) : undefined,
      actualResultText: text || undefined,
      manualPass: !isNumeric ? manualPass === 'pass' : undefined,
      remarks: remarks || undefined,
    });
    setValue('');
    setText('');
    setManualPass('');
    setRemarks('');
  };

  return (
    <Dialog open={!!test} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Record Result — {test.testName.replaceAll('_', ' ')}</DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Specification: {test.specificationText}
          </Typography>
          {isNumeric ? (
            <TextField
              label="Actual Result Value"
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
              fullWidth
            />
          ) : (
            <TextField
              select
              label="Pass / Fail"
              value={manualPass}
              onChange={(e) => setManualPass(e.target.value as 'pass' | 'fail')}
              required
              fullWidth
            >
              <MenuItem value="pass">Pass</MenuItem>
              <MenuItem value="fail">Fail</MenuItem>
            </TextField>
          )}
          <TextField
            label="Observation / Result Text (optional)"
            value={text}
            onChange={(e) => setText(e.target.value)}
            fullWidth
          />
          <TextField
            label="Remarks (optional)"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">
            Save Result
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

function QaDecisionDialog({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { decision: QaDecision; comments: string }) => void;
}) {
  const [decision, setDecision] = useState<QaDecision | ''>('');
  const [comments, setComments] = useState('');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({ decision: decision as QaDecision, comments });
    setDecision('');
    setComments('');
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Record QA Decision</DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            select
            label="Decision"
            value={decision}
            onChange={(e) => setDecision(e.target.value as QaDecision)}
            required
            fullWidth
          >
            <MenuItem value={QaDecision.RELEASED}>Release</MenuItem>
            <MenuItem value={QaDecision.REJECTED}>Reject</MenuItem>
          </TextField>
          <TextField
            label="Comments"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            required
            multiline
            minRows={2}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">
            Submit Decision
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
