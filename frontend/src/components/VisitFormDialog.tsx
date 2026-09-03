import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import type { CreateVisitInput, MedicineInput } from '../api/clinic';

interface Props {
  open: boolean;
  patientId: number;
  doctorId: number;
  appointmentId?: number;
  onClose: () => void;
  onSubmit: (payload: CreateVisitInput) => void;
  submitting: boolean;
  error: string | null;
}

const emptyForm = () => ({
  chiefComplaint: '',
  bpSystolic: '',
  bpDiastolic: '',
  pulse: '',
  temperature: '',
  weightKg: '',
  spo2: '',
  diagnosis: '',
  clinicalNotes: '',
  followUpDate: '',
});

export function VisitFormDialog({
  open,
  patientId,
  doctorId,
  appointmentId,
  onClose,
  onSubmit,
  submitting,
  error,
}: Props) {
  const [f, setF] = useState(emptyForm());
  const [meds, setMeds] = useState<MedicineInput[]>([]);
  const [labs, setLabs] = useState<{ testName: string }[]>([]);

  useEffect(() => {
    if (open) {
      setF(emptyForm());
      setMeds([]);
      setLabs([]);
    }
  }, [open]);

  const set = (k: keyof ReturnType<typeof emptyForm>, v: string) =>
    setF((x) => ({ ...x, [k]: v }));
  const num = (v: string) => (v === '' ? undefined : Number(v));

  const submit = () => {
    onSubmit({
      patientId,
      doctorId,
      appointmentId,
      chiefComplaint: f.chiefComplaint || undefined,
      bpSystolic: num(f.bpSystolic),
      bpDiastolic: num(f.bpDiastolic),
      pulse: num(f.pulse),
      temperature: f.temperature || undefined,
      weightKg: f.weightKg || undefined,
      spo2: num(f.spo2),
      diagnosis: f.diagnosis || undefined,
      clinicalNotes: f.clinicalNotes || undefined,
      followUpDate: f.followUpDate || undefined,
      medicines: meds.filter((m) => m.drugName),
      labs: labs.filter((l) => l.testName),
    });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Record visit</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Chief complaint"
            value={f.chiefComplaint}
            onChange={(e) => set('chiefComplaint', e.target.value)}
            fullWidth
          />
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            <TextField label="BP sys" size="small" value={f.bpSystolic} onChange={(e) => set('bpSystolic', e.target.value)} sx={{ width: 90 }} />
            <TextField label="BP dia" size="small" value={f.bpDiastolic} onChange={(e) => set('bpDiastolic', e.target.value)} sx={{ width: 90 }} />
            <TextField label="Pulse" size="small" value={f.pulse} onChange={(e) => set('pulse', e.target.value)} sx={{ width: 90 }} />
            <TextField label="Temp °F" size="small" value={f.temperature} onChange={(e) => set('temperature', e.target.value)} sx={{ width: 90 }} />
            <TextField label="Weight kg" size="small" value={f.weightKg} onChange={(e) => set('weightKg', e.target.value)} sx={{ width: 100 }} />
            <TextField label="SpO2" size="small" value={f.spo2} onChange={(e) => set('spo2', e.target.value)} sx={{ width: 90 }} />
          </Stack>
          <TextField
            label="Diagnosis"
            value={f.diagnosis}
            onChange={(e) => set('diagnosis', e.target.value)}
            fullWidth
            multiline
            minRows={2}
          />
          <TextField
            label="Clinical notes"
            value={f.clinicalNotes}
            onChange={(e) => set('clinicalNotes', e.target.value)}
            fullWidth
            multiline
            minRows={2}
          />
          <TextField
            label="Follow-up date"
            type="date"
            value={f.followUpDate}
            onChange={(e) => set('followUpDate', e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: 200 }}
          />

          <Typography variant="subtitle2">Prescription</Typography>
          {meds.map((m, i) => (
            <Stack direction="row" spacing={1} key={i}>
              <TextField size="small" label="Drug" value={m.drugName} onChange={(e) => setMeds((ms) => ms.map((x, xi) => (xi === i ? { ...x, drugName: e.target.value } : x)))} sx={{ flex: 1 }} />
              <TextField size="small" label="Strength" value={m.strength ?? ''} onChange={(e) => setMeds((ms) => ms.map((x, xi) => (xi === i ? { ...x, strength: e.target.value } : x)))} sx={{ width: 110 }} />
              <TextField size="small" label="Dosage" value={m.dosage ?? ''} onChange={(e) => setMeds((ms) => ms.map((x, xi) => (xi === i ? { ...x, dosage: e.target.value } : x)))} sx={{ width: 100 }} />
              <TextField size="small" label="Days" value={m.durationDays ?? ''} onChange={(e) => setMeds((ms) => ms.map((x, xi) => (xi === i ? { ...x, durationDays: Number(e.target.value) } : x)))} sx={{ width: 70 }} />
              <IconButton size="small" onClick={() => setMeds((ms) => ms.filter((_, xi) => xi !== i))}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
          <Button size="small" onClick={() => setMeds((ms) => [...ms, { drugName: '' }])}>
            Add medicine
          </Button>

          <Typography variant="subtitle2">Lab orders</Typography>
          {labs.map((l, i) => (
            <Stack direction="row" spacing={1} key={i}>
              <TextField size="small" label="Test name" value={l.testName} onChange={(e) => setLabs((ls) => ls.map((x, xi) => (xi === i ? { testName: e.target.value } : x)))} sx={{ flex: 1 }} />
              <IconButton size="small" onClick={() => setLabs((ls) => ls.filter((_, xi) => xi !== i))}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
          <Button size="small" onClick={() => setLabs((ls) => [...ls, { testName: '' }])}>
            Add lab
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={submitting}>
          {submitting ? 'Saving…' : 'Save visit'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
