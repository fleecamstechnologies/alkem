import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { importsApi, type ImportEntity } from '../api/imports';
import type { ImportJob } from '../types';

const CUSTOMER_FIELDS = [
  'code', 'name', 'type', 'phone', 'email', 'gstin', 'addressLine1',
  'addressLine2', 'city', 'state', 'pincode', 'territory', 'assignedRepId',
  'creditLimit', 'status',
];
const PAYMENT_FIELDS = [
  'customerId', 'customerCode', 'kind', 'amount', 'method', 'referenceNo',
  'paymentDate', 'status', 'notes',
];
const EMPLOYEE_FIELDS = [
  'code', 'firstName', 'lastName', 'email', 'phone', 'designation',
  'employmentType', 'status', 'dateOfJoining', 'dateOfBirth', 'departmentId',
  'workLocation', 'bankAccountName', 'bankAccountNumber', 'bankName', 'bankIfsc',
  'panNumber', 'aadhaarNumber', 'pfNumber', 'uanNumber', 'esiNumber', 'ctcAnnual',
];
const ATTENDANCE_FIELDS = [
  'employeeId', 'employeeCode', 'date', 'status', 'workedHours', 'note',
];
const PATIENT_FIELDS = [
  'code', 'firstName', 'lastName', 'gender', 'dateOfBirth', 'phone', 'altPhone',
  'email', 'bloodGroup', 'maritalStatus', 'addressLine1', 'addressLine2',
  'city', 'state', 'pincode', 'emergencyName', 'emergencyPhone',
  'assignedDoctorId', 'assignedDoctorCode', 'registrationDate', 'status',
  'allergies', 'chronicConditions',
];
const VISIT_FIELDS = [
  'patientCode', 'patientId', 'doctorCode', 'doctorId', 'visitDate', 'visitType',
  'chiefComplaint', 'bpSystolic', 'bpDiastolic', 'pulse', 'temperature',
  'weightKg', 'heightCm', 'spo2', 'bmi', 'diagnosis', 'icdCodes',
  'clinicalNotes', 'followUpDate',
];
const DRUG_FIELDS = [
  'code', 'name', 'genericName', 'form', 'strength', 'unit', 'hsnCode',
  'gstRate', 'mrp', 'purchasePrice', 'reorderLevel', 'rackLocation',
  'scheduleH', 'isActive',
];
const DOCTOR_FIELDS = [
  'code', 'name', 'speciality', 'registrationNo', 'qualification', 'phone',
  'email', 'hospitalName', 'city', 'state', 'territory', 'status',
];

const FIELD_MAP: Record<ImportEntity, string[]> = {
  customers: CUSTOMER_FIELDS,
  payments: PAYMENT_FIELDS,
  employees: EMPLOYEE_FIELDS,
  attendance: ATTENDANCE_FIELDS,
  patients: PATIENT_FIELDS,
  visits: VISIT_FIELDS,
  drugs: DRUG_FIELDS,
  doctors: DOCTOR_FIELDS,
};

function readHeaders(file: File): Promise<string[]> {
  return new Promise((resolve) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      resolve([]);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const firstLine = text.split(/\r?\n/)[0] ?? '';
      resolve(firstLine.split(',').map((h) => h.trim()).filter(Boolean));
    };
    reader.onerror = () => resolve([]);
    reader.readAsText(file.slice(0, 8192));
  });
}

export function ImportsPage() {
  const [entity, setEntity] = useState<ImportEntity>('customers');
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [upsert, setUpsert] = useState(true);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<ImportJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const targetFields = FIELD_MAP[entity];

  useEffect(() => {
    if (!jobId) return;
    pollRef.current = setInterval(async () => {
      try {
        const j = await importsApi.job(jobId);
        setJob(j);
        if (j.status !== 'running' && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } catch {
        /* keep polling */
      }
    }, 1000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [jobId]);

  const onPickFile = async (f: File | null) => {
    setFile(f);
    setHeaders([]);
    setMapping({});
    if (f) {
      const h = await readHeaders(f);
      setHeaders(h);
      // Auto-map headers that exactly match a target field.
      const auto: Record<string, string> = {};
      h.forEach((header) => {
        if (targetFields.includes(header)) auto[header] = header;
      });
      setMapping(auto);
    }
  };

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setJob(null);
    try {
      const { jobId: id } = await importsApi.upload(
        entity,
        file,
        mapping,
        upsert,
      );
      setJobId(id);
    } catch (e) {
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Upload failed',
      );
    } finally {
      setBusy(false);
    }
  };

  const downloadErrors = () => {
    if (!job) return;
    const csv = ['row,reason']
      .concat(job.errors.map((e) => `${e.row},"${e.reason.replaceAll('"', "'")}"`))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `import-${job.id}-errors.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Data import
      </Typography>

      <Paper sx={{ p: 3, mb: 2 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <TextField
              label="Import into"
              select
              value={entity}
              onChange={(e) => {
                setEntity(e.target.value as ImportEntity);
                onPickFile(null);
              }}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="customers">Customers</MenuItem>
              <MenuItem value="payments">Payments</MenuItem>
              <MenuItem value="employees">Employees</MenuItem>
              <MenuItem value="attendance">Attendance</MenuItem>
              <MenuItem value="patients">Patients</MenuItem>
              <MenuItem value="visits">Patient history (visits)</MenuItem>
              <MenuItem value="doctors">Doctors</MenuItem>
              <MenuItem value="drugs">Drugs</MenuItem>
            </TextField>
            <Button variant="outlined" component="label">
              {file ? file.name : 'Choose CSV / XLSX'}
              <input
                type="file"
                hidden
                accept=".csv,.xlsx,.xlsm"
                onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              />
            </Button>
            <FormControlLabel
              control={
                <Switch
                  checked={upsert}
                  onChange={(e) => setUpsert(e.target.checked)}
                />
              }
              label="Update existing rows (upsert)"
            />
          </Stack>

          <Typography variant="body2" color="text.secondary">
            The first row must be a <b>header row</b>. Column names are matched to
            the fields below ignoring case, spaces and punctuation (so{' '}
            <code>First Name</code>, <code>Employee Code</code>,{' '}
            <code>DOJ</code> all work). Employees need{' '}
            <code>code</code> + <code>firstName</code> + <code>lastName</code> +{' '}
            <code>dateOfJoining</code>; patients need <code>code</code> (UHID) +{' '}
            <code>firstName</code>/<code>lastName</code> (add{' '}
            <code>assignedDoctorCode</code> to link each patient to a doctor);
            drugs need <code>code</code> + <code>name</code>; patient-history
            (visits) rows need <code>patientCode</code> + <code>doctorCode</code>{' '}
            + <code>visitDate</code>; for payments include{' '}
            <code>customerCode</code> (or <code>customerId</code>). Dates must be{' '}
            <code>YYYY-MM-DD</code> (real Excel dates are converted for you). CSV
            uploads also get a per-column mapping picker below.
          </Typography>

          <Typography variant="caption" color="text.secondary">
            <b>{entity} fields:</b> {targetFields.join(', ')}
          </Typography>

          {headers.length > 0 && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Column mapping
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>File column</TableCell>
                    <TableCell>Maps to field</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {headers.map((h) => (
                    <TableRow key={h}>
                      <TableCell>{h}</TableCell>
                      <TableCell>
                        <TextField
                          select
                          size="small"
                          value={mapping[h] ?? ''}
                          onChange={(e) =>
                            setMapping((m) => ({ ...m, [h]: e.target.value }))
                          }
                          sx={{ minWidth: 200 }}
                        >
                          <MenuItem value="">— ignore —</MenuItem>
                          {targetFields.map((f) => (
                            <MenuItem key={f} value={f}>
                              {f}
                            </MenuItem>
                          ))}
                        </TextField>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}

          {error && <Alert severity="error">{error}</Alert>}

          <Box>
            <Button
              variant="contained"
              disabled={!file || busy}
              onClick={run}
            >
              {busy ? 'Uploading…' : 'Start import'}
            </Button>
          </Box>
        </Stack>
      </Paper>

      {job && (
        <Paper sx={{ p: 3 }}>
          <Stack
            direction="row"
            sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}
          >
            <Typography variant="h6">{job.fileName}</Typography>
            <Chip
              label={job.status}
              color={
                job.status === 'completed'
                  ? 'success'
                  : job.status === 'failed'
                    ? 'error'
                    : 'warning'
              }
            />
          </Stack>
          {job.status === 'running' && <LinearProgress sx={{ mb: 2 }} />}
          {job.message && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {job.message}
            </Typography>
          )}
          <Stack direction="row" spacing={4} sx={{ mb: 2 }}>
            <Stat label="Rows read" value={job.total} />
            <Stat label="Inserted" value={job.inserted} />
            <Stat label="Updated" value={job.updated} />
            <Stat label="Failed" value={job.failed} />
          </Stack>
          {job.errors.length > 0 && (
            <>
              <Button size="small" onClick={downloadErrors} sx={{ mb: 1 }}>
                Download error rows
              </Button>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Row</TableCell>
                    <TableCell>Reason</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {job.errors.slice(0, 50).map((e, i) => (
                    <TableRow key={i}>
                      <TableCell>{e.row}</TableCell>
                      <TableCell>{e.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </Paper>
      )}
    </Box>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Box>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5">{value}</Typography>
    </Box>
  );
}
