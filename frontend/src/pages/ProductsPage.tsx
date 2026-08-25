import { useEffect, useState, type FormEvent } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Chip,
} from '@mui/material';
import { apiClient } from '../api/client';
import type { Product } from '../types';
import { useAuth } from '../auth/AuthContext';
import { UserRole } from '../types';

const emptyForm = {
  productCode: '',
  productName: '',
  genericName: '',
  brandName: '',
  composition: '',
  strength: '',
  dosageForm: '',
  packSize: '',
  manufacturingSite: '',
  storageCondition: '',
  shelfLifeMonths: '',
};

export function ProductsPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const canCreate =
    user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.PRODUCTION_MANAGER;

  const loadProducts = () => {
    apiClient.get<Product[]>('/products').then((res) => setProducts(res.data));
  };

  useEffect(loadProducts, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await apiClient.post('/products', {
        ...form,
        brandName: form.brandName || undefined,
        storageCondition: form.storageCondition || undefined,
        shelfLifeMonths: form.shelfLifeMonths ? Number(form.shelfLifeMonths) : undefined,
      });
      setOpen(false);
      setForm(emptyForm);
      loadProducts();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Failed to create product');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">Product / Drug Master</Typography>
        {canCreate && (
          <Button variant="contained" onClick={() => setOpen(true)}>
            New Product
          </Button>
        )}
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Code</TableCell>
              <TableCell>Product</TableCell>
              <TableCell>Strength</TableCell>
              <TableCell>Dosage Form</TableCell>
              <TableCell>Site</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell>{product.productCode}</TableCell>
                <TableCell>{product.productName}</TableCell>
                <TableCell>{product.strength}</TableCell>
                <TableCell>{product.dosageForm}</TableCell>
                <TableCell>{product.manufacturingSite}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={product.isActive ? 'Active' : 'Inactive'}
                    color={product.isActive ? 'success' : 'default'}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Product</DialogTitle>
        <Box component="form" onSubmit={handleSubmit}>
          <DialogContent>
            {error && (
              <Typography color="error" sx={{ mb: 2 }}>
                {error}
              </Typography>
            )}
            <Grid container spacing={2}>
              {(
                [
                  ['productCode', 'Product Code'],
                  ['productName', 'Product Name'],
                  ['genericName', 'Generic Name'],
                  ['brandName', 'Brand Name (optional)'],
                  ['composition', 'Composition'],
                  ['strength', 'Strength'],
                  ['dosageForm', 'Dosage Form'],
                  ['packSize', 'Pack Size'],
                  ['manufacturingSite', 'Manufacturing Site'],
                  ['storageCondition', 'Storage Condition (optional)'],
                ] as const
              ).map(([field, label]) => (
                <Grid key={field} size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label={label}
                    value={form[field]}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                    required={!label.includes('optional')}
                    fullWidth
                  />
                </Grid>
              ))}
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Shelf Life (months, optional)"
                  type="number"
                  value={form.shelfLifeMonths}
                  onChange={(e) => setForm({ ...form, shelfLifeMonths: e.target.value })}
                  fullWidth
                />
              </Grid>
            </Grid>
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
