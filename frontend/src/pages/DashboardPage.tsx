import { useEffect, useState } from 'react';
import { Box, Grid, Paper, Typography, CircularProgress } from '@mui/material';
import { apiClient } from '../api/client';
import type { DashboardSummary } from '../types';

const TILES: { key: keyof DashboardSummary; label: string; color: string }[] = [
  { key: 'totalProducts', label: 'Total Products', color: '#1565c0' },
  { key: 'activeProducts', label: 'Active Products', color: '#2e7d32' },
  { key: 'totalBatches', label: 'Total Batches', color: '#6a1b9a' },
  { key: 'qcPending', label: 'QC Pending', color: '#ef6c00' },
  { key: 'qaPending', label: 'QA Pending', color: '#c62828' },
  { key: 'released', label: 'Released', color: '#2e7d32' },
  { key: 'rejected', label: 'Rejected', color: '#b71c1c' },
  { key: 'openDeviations', label: 'Open Deviations', color: '#ff8f00' },
];

export function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<DashboardSummary>('/dashboard/summary')
      .then((res) => setSummary(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <CircularProgress />;
  }

  if (!summary) {
    return <Typography>Could not load dashboard.</Typography>;
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Executive Dashboard
      </Typography>
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {TILES.map((tile) => (
          <Grid key={tile.key} size={{ xs: 12, sm: 6, md: 3 }}>
            <Paper sx={{ p: 2, borderTop: `4px solid ${tile.color}` }}>
              <Typography variant="body2" color="text.secondary">
                {tile.label}
              </Typography>
              <Typography variant="h4">{summary[tile.key] as number}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Typography variant="h6" gutterBottom>
        Batches by Status
      </Typography>
      <Grid container spacing={2}>
        {summary.batchesByStatus.map((row) => (
          <Grid key={row.status} size={{ xs: 12, sm: 6, md: 3 }}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {row.status.replaceAll('_', ' ')}
              </Typography>
              <Typography variant="h5">{row.count}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
