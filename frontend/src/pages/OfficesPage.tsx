import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { attendanceApi } from '../api/attendance';
import { HR_WRITE_ROLES, type OfficeLocation } from '../types';
import { useAuth } from '../auth/AuthContext';

function errMsg(e: unknown): string {
  return (
    (e as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? 'Request failed'
  );
}

export function OfficesPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const canWrite = !!user && HR_WRITE_ROLES.includes(user.role);

  const officesQuery = useQuery({
    queryKey: ['att-offices'],
    queryFn: attendanceApi.offices,
  });
  const settingsQuery = useQuery({
    queryKey: ['att-settings'],
    queryFn: attendanceApi.settings,
  });

  const [edit, setEdit] = useState<OfficeLocation | null>(null);
  const [adding, setAdding] = useState(false);
  const [setForm, setSetForm] = useState<Record<string, string>>({});

  const saveSettings = useMutation({
    mutationFn: () =>
      attendanceApi.saveSettings({
        punchHalfDayHours: setForm.punchHalfDayHours,
        punchFullDayHours: setForm.punchFullDayHours,
        defaultGeofenceMeters: setForm.defaultGeofenceMeters
          ? Number(setForm.defaultGeofenceMeters)
          : undefined,
      } as never),
    onSuccess: () => {
      setSetForm({});
      qc.invalidateQueries({ queryKey: ['att-settings'] });
    },
  });
  const st = { ...settingsQuery.data, ...setForm } as Record<string, string>;

  const del = useMutation({
    mutationFn: (id: string) => attendanceApi.deleteOffice(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['att-offices'] }),
  });

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 1 }}>
        Offices &amp; geofence
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Each office defines a punch-in geofence. An employee can punch in / out
        when their device location is within the radius of <b>any active
        office</b>. Get the coordinates from Google Maps (right-click a spot →
        the lat,&nbsp;lng at the top of the menu).
      </Typography>

      {settingsQuery.data && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Rules
          </Typography>
          <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
            <TextField
              size="small"
              label="Half-day hours"
              helperText="worked ≥ this ⇒ PRESENT"
              value={st.punchHalfDayHours ?? ''}
              disabled={!canWrite}
              onChange={(e) =>
                setSetForm((f) => ({
                  ...f,
                  punchHalfDayHours: e.target.value,
                }))
              }
              sx={{ width: 150 }}
            />
            <TextField
              size="small"
              label="Full-day hours"
              helperText="reference target"
              value={st.punchFullDayHours ?? ''}
              disabled={!canWrite}
              onChange={(e) =>
                setSetForm((f) => ({
                  ...f,
                  punchFullDayHours: e.target.value,
                }))
              }
              sx={{ width: 150 }}
            />
            <TextField
              size="small"
              label="Default radius (m)"
              helperText="suggested for new offices"
              value={String(st.defaultGeofenceMeters ?? '')}
              disabled={!canWrite}
              onChange={(e) =>
                setSetForm((f) => ({
                  ...f,
                  defaultGeofenceMeters: e.target.value,
                }))
              }
              sx={{ width: 170 }}
            />
            {canWrite && Object.keys(setForm).length > 0 && (
              <Button
                variant="contained"
                disabled={saveSettings.isPending}
                onClick={() => saveSettings.mutate()}
                sx={{ alignSelf: 'flex-start' }}
              >
                Save rules
              </Button>
            )}
          </Stack>
        </Paper>
      )}

      <Stack
        direction="row"
        sx={{ justifyContent: 'flex-end', mb: 1 }}
      >
        {canWrite && (
          <Button variant="contained" onClick={() => setAdding(true)}>
            Add office
          </Button>
        )}
      </Stack>

      {del.isError && (
        <Alert severity="error" sx={{ mb: 1 }}>
          {errMsg(del.error)}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Code</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Address</TableCell>
              <TableCell align="right">Latitude</TableCell>
              <TableCell align="right">Longitude</TableCell>
              <TableCell align="right">Radius (m)</TableCell>
              <TableCell>Active</TableCell>
              {canWrite && <TableCell align="right" />}
            </TableRow>
          </TableHead>
          <TableBody>
            {(officesQuery.data ?? []).map((o) => (
              <TableRow key={o.id}>
                <TableCell>{o.code}</TableCell>
                <TableCell>{o.name}</TableCell>
                <TableCell>{o.address || '—'}</TableCell>
                <TableCell align="right">{o.latitude}</TableCell>
                <TableCell align="right">{o.longitude}</TableCell>
                <TableCell align="right">{o.radiusMeters}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={o.isActive ? 'yes' : 'no'}
                    color={o.isActive ? 'success' : 'default'}
                  />
                </TableCell>
                {canWrite && (
                  <TableCell align="right">
                    <Button size="small" onClick={() => setEdit(o)}>
                      Edit
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      onClick={() => del.mutate(o.id)}
                    >
                      Delete
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {(officesQuery.data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  No offices yet — add one so employees can punch in.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {(adding || edit) && (
        <OfficeDialog
          office={edit}
          defaultRadius={settingsQuery.data?.defaultGeofenceMeters ?? 200}
          onClose={() => {
            setAdding(false);
            setEdit(null);
            qc.invalidateQueries({ queryKey: ['att-offices'] });
          }}
        />
      )}
    </Box>
  );
}

function OfficeDialog({
  office,
  defaultRadius,
  onClose,
}: {
  office: OfficeLocation | null;
  defaultRadius: number;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    code: office?.code ?? '',
    name: office?.name ?? '',
    latitude: office?.latitude ?? '',
    longitude: office?.longitude ?? '',
    radiusMeters: String(office?.radiusMeters ?? defaultRadius),
    address: office?.address ?? '',
    isActive: office?.isActive ?? true,
  });
  const set = (k: keyof typeof form, v: unknown) =>
    setForm((f) => ({ ...f, [k]: v }));
  const mut = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        radiusMeters: Number(form.radiusMeters) || defaultRadius,
        address: form.address || undefined,
        isActive: form.isActive,
      };
      return office
        ? attendanceApi.updateOffice(office.id, body)
        : attendanceApi.createOffice({ ...body, code: form.code });
    },
    onSuccess: onClose,
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{office ? `Edit ${office.code}` : 'New office'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {mut.isError && <Alert severity="error">{errMsg(mut.error)}</Alert>}
          <Stack direction="row" spacing={2}>
            <TextField
              label="Code"
              value={form.code}
              disabled={!!office}
              onChange={(e) => set('code', e.target.value)}
              sx={{ width: 130 }}
            />
            <TextField
              label="Name"
              fullWidth
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
            />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Latitude"
              value={form.latitude}
              onChange={(e) => set('latitude', e.target.value)}
            />
            <TextField
              label="Longitude"
              value={form.longitude}
              onChange={(e) => set('longitude', e.target.value)}
            />
          </Stack>
          <TextField
            label="Radius (metres)"
            value={form.radiusMeters}
            onChange={(e) => set('radiusMeters', e.target.value)}
          />
          <TextField
            label="Address"
            value={form.address}
            onChange={(e) => set('address', e.target.value)}
          />
          <TextField
            select
            label="Active"
            value={form.isActive ? 'yes' : 'no'}
            onChange={(e) => set('isActive', e.target.value === 'yes')}
          >
            <MenuItem value="yes">Yes</MenuItem>
            <MenuItem value="no">No</MenuItem>
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={
            !form.code ||
            !form.name ||
            !form.latitude ||
            !form.longitude ||
            mut.isPending
          }
          onClick={() => mut.mutate()}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
