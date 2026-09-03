import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, Chip, Snackbar } from '@mui/material';
import { portalApi } from '../api/portal';
import { useAuth } from '../auth/AuthContext';

function errMsg(e: unknown): string {
  return (
    (e as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? 'Request failed'
  );
}
const localToday = () => new Date().toLocaleDateString('en-CA');
const hhmm = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

/**
 * Compact punch in / break / punch out control shown in the app header for
 * every employee-linked login.
 */
export function PunchWidget() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [snack, setSnack] = useState<{ msg: string; sev: 'error' | 'success' } | null>(
    null,
  );

  const statusQuery = useQuery({
    queryKey: ['punch-widget-status'],
    queryFn: () => portalApi.punchStatus(),
    enabled: !!user?.employeeId,
    refetchInterval: 60_000,
  });

  const mut = useMutation({
    mutationFn: (type: string) =>
      new Promise((resolve, reject) => {
        if (!('geolocation' in navigator)) {
          reject(new Error('This device has no location support.'));
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) =>
            portalApi
              .punch({
                type: type as never,
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracyM: Math.round(pos.coords.accuracy),
                localDate: localToday(),
              })
              .then(resolve, reject),
          (err) =>
            reject(
              new Error(
                err.code === err.PERMISSION_DENIED
                  ? 'Location permission denied — allow location access to punch.'
                  : 'Could not get your location. Move to an open area and retry.',
              ),
            ),
          { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
        );
      }),
    onSuccess: (_data, type) => {
      qc.invalidateQueries({ queryKey: ['punch-widget-status'] });
      qc.invalidateQueries({ queryKey: ['me-punch-status'] });
      qc.invalidateQueries({ queryKey: ['me-attendance'] });
      setSnack({
        msg:
          type === 'PUNCH_IN'
            ? 'Punched in'
            : type === 'PUNCH_OUT'
              ? 'Punched out'
              : type === 'BREAK_START'
                ? 'Break started'
                : 'Break ended',
        sev: 'success',
      });
    },
    onError: (e) => setSnack({ msg: errMsg(e), sev: 'error' }),
  });

  if (!user?.employeeId) return null;
  const s = statusQuery.data;
  const busy = mut.isPending;

  const stateChip =
    s?.state === 'IN'
      ? { label: `In ${hhmm(s.since)}`, color: 'success' as const }
      : s?.state === 'ON_BREAK'
        ? { label: `Break ${hhmm(s.since)}`, color: 'warning' as const }
        : { label: 'Punched out', color: 'default' as const };

  const secondaryBtn = {
    color: '#fff',
    borderColor: 'rgba(255,255,255,0.6)',
    '&:hover': { borderColor: '#fff' },
  };

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Chip
          size="small"
          label={stateChip.label}
          color={stateChip.color}
          sx={{
            display: { xs: 'none', sm: 'inline-flex' },
            ...(stateChip.color === 'default'
              ? { bgcolor: 'rgba(255,255,255,0.18)', color: '#fff' }
              : {}),
          }}
        />
        {s?.state === 'OUT' && (
          <Button
            size="small"
            variant="contained"
            color="secondary"
            disabled={busy}
            onClick={() => mut.mutate('PUNCH_IN')}
          >
            Punch in
          </Button>
        )}
        {s?.state === 'IN' && (
          <>
            <Button
              size="small"
              variant="outlined"
              disabled={busy}
              sx={secondaryBtn}
              onClick={() => mut.mutate('BREAK_START')}
            >
              Break
            </Button>
            <Button
              size="small"
              variant="contained"
              color="secondary"
              disabled={busy}
              onClick={() => mut.mutate('PUNCH_OUT')}
            >
              Punch out
            </Button>
          </>
        )}
        {s?.state === 'ON_BREAK' && (
          <>
            <Button
              size="small"
              variant="contained"
              color="secondary"
              disabled={busy}
              onClick={() => mut.mutate('BREAK_END')}
            >
              End break
            </Button>
            <Button
              size="small"
              variant="outlined"
              disabled={busy}
              sx={secondaryBtn}
              onClick={() => mut.mutate('PUNCH_OUT')}
            >
              Punch out
            </Button>
          </>
        )}
      </Box>

      <Snackbar
        open={!!snack}
        autoHideDuration={5000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        {snack ? (
          <Alert
            severity={snack.sev}
            onClose={() => setSnack(null)}
            sx={{ width: '100%' }}
          >
            {snack.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </>
  );
}
