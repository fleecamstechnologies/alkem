import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { apiClient } from '../api/client';
import type { Batch, Product } from '../types';
import { BatchStatus, UserRole } from '../types';
import { useAuth } from '../auth/AuthContext';

const STATUS_COLORS: Record<BatchStatus, 'default' | 'primary' | 'warning' | 'success' | 'error' | 'info'> = {
  [BatchStatus.CREATED]: 'default',
  [BatchStatus.MANUFACTURING]: 'info',
  [BatchStatus.QC_PENDING]: 'warning',
  [BatchStatus.QC_APPROVED]: 'primary',
  [BatchStatus.QA_REVIEW]: 'warning',
  [BatchStatus.RELEASED]: 'success',
  [BatchStatus.REJECTED]: 'error',
};

export function BatchesPage() {
  const { user } = useAuth();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    batchNumber: '',
    productId: '',
    batchSize: '',
    manufacturingSite: '',
    manufacturingDate: '',
  });

  const canCreate =
    user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.PRODUCTION_MANAGER;

  const loadBatches = () => {
    apiClient.get<Batch[]>('/batches').then((res) => setBatches(res.data));
  };

  useEffect(() => {
    loadBatches();
    apiClient.get<Product[]>('/products').then((res) => setProducts(res.data));
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await apiClient.post('/batches', {
        batchNumber: form.batchNumber,
        productId: form.productId,
        batchSize: Number(form.batchSize),
        manufacturingSite: form.manufacturingSite,
        manufacturingDate: form.manufacturingDate || undefined,
      });
      setOpen(false);
      setForm({
        batchNumber: '',
        productId: '',
        batchSize: '',
        manufacturingSite: '',
        manufacturingDate: '',
      });
      loadBatches();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Failed to create batch');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">Batch Management</Typography>
        {canCreate && (
          <Button variant="contained" onClick={() => setOpen(true)}>
            New Batch
          </Button>
        )}
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Batch No.</TableCell>
              <TableCell>Product</TableCell>
              <TableCell>Site</TableCell>
              <TableCell>Batch Size</TableCell>
              <TableCell>Status</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {batches.map((batch) => (
              <TableRow key={batch.id} hover>
                <TableCell>{batch.batchNumber}</TableCell>
                <TableCell>{batch.product?.productName}</TableCell>
                <TableCell>{batch.manufacturingSite}</TableCell>
                <TableCell>{batch.batchSize}</TableCell>
                <TableCell>
                  <Chip size="small" label={batch.status.replaceAll('_', ' ')} color={STATUS_COLORS[batch.status]} />
                </TableCell>
                <TableCell>
                  <Button component={Link} to={`/batches/${batch.id}`} size="small">
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Batch</DialogTitle>
        <Box component="form" onSubmit={handleSubmit}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {error && <Typography color="error">{error}</Typography>}
            <TextField
              label="Batch Number"
              value={form.batchNumber}
              onChange={(e) => setForm({ ...form, batchNumber: e.target.value })}
              required
              fullWidth
            />
            <TextField
              select
              label="Product"
              value={form.productId}
              onChange={(e) => setForm({ ...form, productId: e.target.value })}
              required
              fullWidth
            >
              {products.map((product) => (
                <MenuItem key={product.id} value={product.id}>
                  {product.productName} ({product.productCode})
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Batch Size"
              type="number"
              value={form.batchSize}
              onChange={(e) => setForm({ ...form, batchSize: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Manufacturing Site"
              value={form.manufacturingSite}
              onChange={(e) => setForm({ ...form, manufacturingSite: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Manufacturing Date"
              type="date"
              value={form.manufacturingDate}
              onChange={(e) => setForm({ ...form, manufacturingDate: e.target.value })}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">
              Create
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
