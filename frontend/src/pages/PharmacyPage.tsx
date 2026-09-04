import { useEffect, useMemo, useState } from 'react';
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
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import { pharmacyApi } from '../api/pharmacy';
import { AsyncSelect } from '../components/AsyncSelect';
import { DispenseDialog } from '../components/DispenseDialog';
import { money, todayISO } from '../format';
import { useAuth } from '../auth/AuthContext';
import {
  DrugForm,
  PHARMACY_WRITE_ROLES,
  type Drug,
  type DrugStockRow,
  type Grn,
  type Supplier,
} from '../types';

function errMsg(e: unknown): string {
  return (
    (e as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? 'Request failed'
  );
}

const PAGE_SIZE = 50;
// `page` (1-based offset) is capped server-side; keep the table in range.
const MAX_PAGE = 200;

export function PharmacyPage() {
  const { user } = useAuth();
  const canWrite = !!user && PHARMACY_WRITE_ROLES.includes(user.role);
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Pharmacy &amp; inventory
      </Typography>
      <Paper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable">
          <Tab label="Drugs" />
          <Tab label="Suppliers" />
          <Tab label="GRN" />
          <Tab label="Dispensing" />
          <Tab label="Alerts" />
          <Tab label="Dashboard" />
        </Tabs>
      </Paper>

      {tab === 0 && <DrugsTab canWrite={canWrite} />}
      {tab === 1 && <SuppliersTab canWrite={canWrite} />}
      {tab === 2 && <GrnTab canWrite={canWrite} />}
      {tab === 3 && <DispensingTab canWrite={canWrite} />}
      {tab === 4 && <AlertsTab />}
      {tab === 5 && <DashboardTab />}
    </Box>
  );
}

// ---- Drugs ---------------------------------------------------------

const DRUG_FORM_VALUES = Object.values(DrugForm);

function DrugsTab({ canWrite }: { canWrite: boolean }) {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [edit, setEdit] = useState<Drug | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => setPage(0), [q]);

  const stockQuery = useQuery({
    queryKey: ['pharmacy-drugs-stock', q, page],
    queryFn: () =>
      pharmacyApi.drugsStock({
        q: q || undefined,
        limit: PAGE_SIZE,
        page: page + 1,
      }),
    placeholderData: (prev) => prev,
  });
  const rows: DrugStockRow[] = stockQuery.data?.rows ?? [];
  const total = stockQuery.data?.total ?? 0;

  const closeForm = () => {
    setEdit(null);
    setCreating(false);
    qc.invalidateQueries({ queryKey: ['pharmacy-drugs-stock'] });
  };

  return (
    <>
      <Stack
        direction="row"
        sx={{ gap: 2, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}
      >
        <TextField
          size="small"
          label="Search drug"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          sx={{ minWidth: 260 }}
        />
        {canWrite && (
          <Button variant="contained" onClick={() => setCreating(true)}>
            New drug
          </Button>
        )}
      </Stack>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Code</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Form</TableCell>
              <TableCell align="right">On hand</TableCell>
              <TableCell align="right">Reorder</TableCell>
              <TableCell align="right">MRP</TableCell>
              <TableCell align="right">Stock value</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((d) => (
              <TableRow key={d.id}>
                <TableCell>{d.code}</TableCell>
                <TableCell>
                  {d.name}
                  {d.strength ? ` ${d.strength}` : ''}
                  {Number(d.lowStock) ? (
                    <Chip
                      size="small"
                      color="warning"
                      label="low"
                      sx={{ ml: 1 }}
                    />
                  ) : null}
                </TableCell>
                <TableCell>{d.form}</TableCell>
                <TableCell align="right">
                  {d.onHand} {d.unit}
                </TableCell>
                <TableCell align="right">{d.reorderLevel}</TableCell>
                <TableCell align="right">{money(d.mrp)}</TableCell>
                <TableCell align="right">{money(d.stockValue)}</TableCell>
                <TableCell align="right">
                  {canWrite && (
                    <Button
                      size="small"
                      onClick={() =>
                        pharmacyApi.drug(d.id).then(setEdit)
                      }
                    >
                      Edit
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  {stockQuery.isLoading ? 'Loading…' : 'No drugs.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, p) => setPage(Math.min(p, MAX_PAGE - 1))}
          rowsPerPage={PAGE_SIZE}
          rowsPerPageOptions={[PAGE_SIZE]}
        />
      </TableContainer>

      {(creating || edit) && (
        <DrugFormDialog
          drug={edit}
          onClose={closeForm}
        />
      )}
    </>
  );
}

function DrugFormDialog({
  drug,
  onClose,
}: {
  drug: Drug | null;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    code: drug?.code ?? '',
    name: drug?.name ?? '',
    genericName: drug?.genericName ?? '',
    form: drug?.form ?? DrugForm.TABLET,
    strength: drug?.strength ?? '',
    unit: drug?.unit ?? 'unit',
    gstRate: drug?.gstRate ?? '12',
    mrp: drug?.mrp ?? '0',
    purchasePrice: drug?.purchasePrice ?? '0',
    reorderLevel: String(drug?.reorderLevel ?? 0),
    rackLocation: drug?.rackLocation ?? '',
    isActive: drug?.isActive ?? true,
  });
  const set = (k: keyof typeof form, v: unknown) =>
    setForm((f) => ({ ...f, [k]: v }));

  const mut = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name,
        genericName: form.genericName || undefined,
        form: form.form,
        strength: form.strength || undefined,
        unit: form.unit || 'unit',
        gstRate: form.gstRate || '0',
        mrp: form.mrp || '0',
        purchasePrice: form.purchasePrice || '0',
        reorderLevel: Number(form.reorderLevel) || 0,
        rackLocation: form.rackLocation || undefined,
        isActive: form.isActive,
      };
      return drug
        ? pharmacyApi.updateDrug(drug.id, body)
        : pharmacyApi.createDrug({ ...body, code: form.code });
    },
    onSuccess: onClose,
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{drug ? `Edit ${drug.code}` : 'New drug'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {mut.isError && <Alert severity="error">{errMsg(mut.error)}</Alert>}
          <Grid container spacing={2}>
            <Grid size={{ xs: 4 }}>
              <TextField
                label="Code"
                fullWidth
                value={form.code}
                disabled={!!drug}
                onChange={(e) => set('code', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 8 }}>
              <TextField
                label="Name"
                fullWidth
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 8 }}>
              <TextField
                label="Generic name"
                fullWidth
                value={form.genericName}
                onChange={(e) => set('genericName', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 4 }}>
              <TextField
                select
                label="Form"
                fullWidth
                value={form.form}
                onChange={(e) => set('form', e.target.value)}
              >
                {DRUG_FORM_VALUES.map((v) => (
                  <MenuItem key={v} value={v}>
                    {v}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 4 }}>
              <TextField
                label="Strength"
                fullWidth
                value={form.strength}
                onChange={(e) => set('strength', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 4 }}>
              <TextField
                label="Unit"
                fullWidth
                value={form.unit}
                onChange={(e) => set('unit', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 4 }}>
              <TextField
                label="Reorder level"
                fullWidth
                value={form.reorderLevel}
                onChange={(e) => set('reorderLevel', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 4 }}>
              <TextField
                label="GST %"
                fullWidth
                value={form.gstRate}
                onChange={(e) => set('gstRate', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 4 }}>
              <TextField
                label="MRP"
                fullWidth
                value={form.mrp}
                onChange={(e) => set('mrp', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 4 }}>
              <TextField
                label="Purchase price"
                fullWidth
                value={form.purchasePrice}
                onChange={(e) => set('purchasePrice', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 4 }}>
              <TextField
                label="Rack"
                fullWidth
                value={form.rackLocation}
                onChange={(e) => set('rackLocation', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 4 }}>
              <TextField
                select
                label="Active"
                fullWidth
                value={form.isActive ? 'yes' : 'no'}
                onChange={(e) => set('isActive', e.target.value === 'yes')}
              >
                <MenuItem value="yes">Yes</MenuItem>
                <MenuItem value="no">No</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!form.code || !form.name || mut.isPending}
          onClick={() => mut.mutate()}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ---- Suppliers ---------------------------------------------------

function SuppliersTab({ canWrite }: { canWrite: boolean }) {
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [edit, setEdit] = useState<Supplier | null>(null);
  const [creating, setCreating] = useState(false);
  const [payFor, setPayFor] = useState<Supplier | null>(null);

  const listQuery = useQuery({
    queryKey: ['pharmacy-suppliers', page],
    queryFn: () =>
      pharmacyApi.suppliers({ limit: PAGE_SIZE, page: page + 1 }),
    placeholderData: (prev) => prev,
  });
  const rows = listQuery.data?.rows ?? [];
  const total = listQuery.data?.total ?? 0;
  const refresh = () =>
    qc.invalidateQueries({ queryKey: ['pharmacy-suppliers'] });

  return (
    <>
      <Stack direction="row" sx={{ justifyContent: 'flex-end', mb: 1 }}>
        {canWrite && (
          <Button variant="contained" onClick={() => setCreating(true)}>
            New supplier
          </Button>
        )}
      </Stack>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Code</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>City</TableCell>
              <TableCell align="right">Payable</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.code}</TableCell>
                <TableCell>{s.name}</TableCell>
                <TableCell>{s.phone || '—'}</TableCell>
                <TableCell>{s.city || '—'}</TableCell>
                <TableCell
                  align="right"
                  sx={{
                    color:
                      Number(s.outstandingPayable) > 0
                        ? 'error.main'
                        : undefined,
                  }}
                >
                  {money(s.outstandingPayable)}
                </TableCell>
                <TableCell align="right">
                  {canWrite && (
                    <>
                      <Button size="small" onClick={() => setEdit(s)}>
                        Edit
                      </Button>
                      <Button size="small" onClick={() => setPayFor(s)}>
                        Record payment
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  {listQuery.isLoading ? 'Loading…' : 'No suppliers.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, p) => setPage(Math.min(p, MAX_PAGE - 1))}
          rowsPerPage={PAGE_SIZE}
          rowsPerPageOptions={[PAGE_SIZE]}
        />
      </TableContainer>

      {(creating || edit) && (
        <SupplierFormDialog
          supplier={edit}
          onClose={() => {
            setEdit(null);
            setCreating(false);
            refresh();
          }}
        />
      )}
      {payFor && (
        <SupplierPaymentDialog
          supplier={payFor}
          onClose={() => {
            setPayFor(null);
            refresh();
          }}
        />
      )}
    </>
  );
}

function SupplierFormDialog({
  supplier,
  onClose,
}: {
  supplier: Supplier | null;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    code: supplier?.code ?? '',
    name: supplier?.name ?? '',
    gstin: supplier?.gstin ?? '',
    phone: supplier?.phone ?? '',
    email: supplier?.email ?? '',
    city: supplier?.city ?? '',
    address: supplier?.address ?? '',
  });
  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));
  const mut = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name,
        gstin: form.gstin || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        city: form.city || undefined,
        address: form.address || undefined,
      };
      return supplier
        ? pharmacyApi.updateSupplier(supplier.id, body)
        : pharmacyApi.createSupplier({ ...body, code: form.code });
    },
    onSuccess: onClose,
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {supplier ? `Edit ${supplier.code}` : 'New supplier'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {mut.isError && <Alert severity="error">{errMsg(mut.error)}</Alert>}
          <Grid container spacing={2}>
            <Grid size={{ xs: 4 }}>
              <TextField
                label="Code"
                fullWidth
                value={form.code}
                disabled={!!supplier}
                onChange={(e) => set('code', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 8 }}>
              <TextField
                label="Name"
                fullWidth
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                label="GSTIN"
                fullWidth
                value={form.gstin}
                onChange={(e) => set('gstin', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                label="Phone"
                fullWidth
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                label="Email"
                fullWidth
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                label="City"
                fullWidth
                value={form.city}
                onChange={(e) => set('city', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="Address"
                fullWidth
                value={form.address}
                onChange={(e) => set('address', e.target.value)}
              />
            </Grid>
          </Grid>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!form.code || !form.name || mut.isPending}
          onClick={() => mut.mutate()}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function SupplierPaymentDialog({
  supplier,
  onClose,
}: {
  supplier: Supplier;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('NEFT');
  const [reference, setReference] = useState('');
  const [paidAt, setPaidAt] = useState(todayISO());
  const mut = useMutation({
    mutationFn: () =>
      pharmacyApi.addSupplierPayment(supplier.id, {
        amount,
        method,
        reference: reference || undefined,
        paidAt,
      }),
    onSuccess: onClose,
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Pay {supplier.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {mut.isError && <Alert severity="error">{errMsg(mut.error)}</Alert>}
          <Typography variant="body2" color="text.secondary">
            Current payable {money(supplier.outstandingPayable)}
          </Typography>
          <TextField
            label="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <TextField
            select
            label="Method"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            {['CASH', 'NEFT', 'RTGS', 'UPI', 'CHEQUE', 'CARD', 'OTHER'].map(
              (m) => (
                <MenuItem key={m} value={m}>
                  {m}
                </MenuItem>
              ),
            )}
          </TextField>
          <TextField
            label="Reference"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
          <TextField
            type="date"
            label="Paid on"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!amount || Number(amount) <= 0 || mut.isPending}
          onClick={() => mut.mutate()}
        >
          Record
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ---- GRN -------------------------------------------------------

function GrnTab({ canWrite }: { canWrite: boolean }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => setPage(0), [status]);

  const listQuery = useQuery({
    queryKey: ['pharmacy-grns', status, page],
    queryFn: () =>
      pharmacyApi.grns({
        status: status || undefined,
        limit: PAGE_SIZE,
        page: page + 1,
      }),
    placeholderData: (prev) => prev,
  });
  const rows: Grn[] = listQuery.data?.rows ?? [];
  const total = listQuery.data?.total ?? 0;
  const refresh = () => qc.invalidateQueries({ queryKey: ['pharmacy-grns'] });

  return (
    <>
      <Stack
        direction="row"
        sx={{ gap: 2, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}
      >
        <TextField
          select
          size="small"
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">All</MenuItem>
          {['DRAFT', 'POSTED', 'CANCELLED'].map((s) => (
            <MenuItem key={s} value={s}>
              {s}
            </MenuItem>
          ))}
        </TextField>
        {canWrite && (
          <Button variant="contained" onClick={() => setCreating(true)}>
            New GRN
          </Button>
        )}
      </Stack>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>GRN #</TableCell>
              <TableCell>Supplier</TableCell>
              <TableCell>Received</TableCell>
              <TableCell>Invoice</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((g) => (
              <TableRow key={g.id}>
                <TableCell>{g.grnNo}</TableCell>
                <TableCell>{g.supplierName ?? g.supplierId}</TableCell>
                <TableCell>{g.receivedDate}</TableCell>
                <TableCell>{g.invoiceNo || '—'}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={g.status}
                    color={
                      g.status === 'POSTED'
                        ? 'success'
                        : g.status === 'CANCELLED'
                          ? 'default'
                          : 'warning'
                    }
                  />
                </TableCell>
                <TableCell align="right">{money(g.total)}</TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => setOpenId(g.id)}>
                    Open
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  {listQuery.isLoading ? 'Loading…' : 'No GRNs.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, p) => setPage(Math.min(p, MAX_PAGE - 1))}
          rowsPerPage={PAGE_SIZE}
          rowsPerPageOptions={[PAGE_SIZE]}
        />
      </TableContainer>

      {creating && (
        <CreateGrnDialog
          onClose={(id) => {
            setCreating(false);
            refresh();
            if (id) setOpenId(id);
          }}
        />
      )}
      {openId && (
        <GrnDetailDialog
          id={openId}
          canWrite={canWrite}
          onClose={() => {
            setOpenId(null);
            refresh();
          }}
        />
      )}
    </>
  );
}

function CreateGrnDialog({
  onClose,
}: {
  onClose: (createdId?: string) => void;
}) {
  const [supplier, setSupplier] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [receivedDate, setReceivedDate] = useState(todayISO());

  const mut = useMutation({
    mutationFn: () =>
      pharmacyApi.createGrn({
        supplierId: Number(supplier!.id),
        invoiceNo: invoiceNo || undefined,
        invoiceDate: invoiceDate || undefined,
        receivedDate,
      }),
    onSuccess: (g) => onClose(g.id),
  });

  return (
    <Dialog open onClose={() => onClose()} fullWidth maxWidth="sm">
      <DialogTitle>New GRN</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {mut.isError && <Alert severity="error">{errMsg(mut.error)}</Alert>}
          <AsyncSelect
            label="Supplier"
            source="suppliers"
            value={supplier}
            onChange={setSupplier}
            fetchPage={async ({ q, cursor }) => {
              const r = await pharmacyApi.suppliers({
                q: q || undefined,
                cursor: cursor || undefined,
                limit: 25,
              });
              return {
                options: r.rows.map((s) => ({
                  id: s.id,
                  label: `${s.name} (${s.code})`,
                })),
                nextCursor: r.nextCursor,
              };
            }}
          />
          <TextField
            label="Invoice no"
            value={invoiceNo}
            onChange={(e) => setInvoiceNo(e.target.value)}
          />
          <TextField
            type="date"
            label="Invoice date"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            type="date"
            label="Received date"
            value={receivedDate}
            onChange={(e) => setReceivedDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!supplier || mut.isPending}
          onClick={() => mut.mutate()}
        >
          Create draft
        </Button>
      </DialogActions>
    </Dialog>
  );
}

interface GrnLine {
  drug: { id: string; label: string; mrp: string; purchasePrice: string; gstRate: string } | null;
  batchNo: string;
  expiryDate: string;
  quantity: string;
  freeQuantity: string;
  purchasePrice: string;
  mrp: string;
  gstRate: string;
}
const emptyGrnLine = (): GrnLine => ({
  drug: null,
  batchNo: '',
  expiryDate: '',
  quantity: '',
  freeQuantity: '0',
  purchasePrice: '',
  mrp: '',
  gstRate: '12',
});

function GrnDetailDialog({
  id,
  canWrite,
  onClose,
}: {
  id: string;
  canWrite: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const grnQuery = useQuery({
    queryKey: ['pharmacy-grn', id],
    queryFn: () => pharmacyApi.grn(id),
  });
  const grn = grnQuery.data;
  const isDraft = grn?.status === 'DRAFT';
  const [lines, setLines] = useState<GrnLine[] | null>(null);

  const editable = lines ?? (isDraft ? [emptyGrnLine()] : []);

  const saveItems = useMutation({
    mutationFn: () =>
      pharmacyApi.setGrnItems(
        id,
        editable
          .filter((l) => l.drug && l.batchNo && l.expiryDate && l.quantity)
          .map((l) => ({
            drugId: Number(l.drug!.id),
            batchNo: l.batchNo,
            expiryDate: l.expiryDate,
            quantity: l.quantity,
            freeQuantity: l.freeQuantity || '0',
            purchasePrice: l.purchasePrice || '0',
            mrp: l.mrp || '0',
            gstRate: l.gstRate || '0',
          })),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pharmacy-grn', id] }),
  });
  const postMut = useMutation({
    mutationFn: () => pharmacyApi.postGrn(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pharmacy-grn', id] }),
  });
  const cancelMut = useMutation({
    mutationFn: () => pharmacyApi.cancelGrn(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pharmacy-grn', id] }),
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>
        {grn?.grnNo}{' '}
        {grn && (
          <Chip
            size="small"
            label={grn.status}
            color={
              grn.status === 'POSTED'
                ? 'success'
                : grn.status === 'CANCELLED'
                  ? 'default'
                  : 'warning'
            }
            sx={{ ml: 1 }}
          />
        )}
      </DialogTitle>
      <DialogContent>
        {saveItems.isError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errMsg(saveItems.error)}
          </Alert>
        )}
        {postMut.isError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errMsg(postMut.error)}
          </Alert>
        )}
        {grn && (
          <Typography variant="body2" sx={{ mb: 2 }} color="text.secondary">
            {grn.supplierName} · received {grn.receivedDate}
            {grn.invoiceNo ? ` · invoice ${grn.invoiceNo}` : ''} · subtotal{' '}
            {money(grn.subtotal)} · GST {money(grn.gstAmount)} · total{' '}
            {money(grn.total)}
          </Typography>
        )}

        {isDraft && canWrite ? (
          <>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: '28%' }}>Drug</TableCell>
                  <TableCell>Batch</TableCell>
                  <TableCell>Expiry</TableCell>
                  <TableCell align="right">Qty</TableCell>
                  <TableCell align="right">Free</TableCell>
                  <TableCell align="right">Cost</TableCell>
                  <TableCell align="right">MRP</TableCell>
                  <TableCell align="right">GST%</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {editable.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <AsyncSelect
                        label=""
                        source="grn-drugs"
                        sx={{ minWidth: 220 }}
                        value={l.drug}
                        onChange={(v) =>
                          setLines(
                            editable.map((x, xi) =>
                              xi === i
                                ? {
                                    ...x,
                                    drug: v,
                                    purchasePrice:
                                      x.purchasePrice ||
                                      v?.purchasePrice ||
                                      '',
                                    mrp: x.mrp || v?.mrp || '',
                                    gstRate: v?.gstRate ?? x.gstRate,
                                  }
                                : x,
                            ),
                          )
                        }
                        fetchPage={async ({ q, cursor }) => {
                          const r = await pharmacyApi.drugs({
                            q: q || undefined,
                            cursor: cursor || undefined,
                            limit: 25,
                          });
                          return {
                            options: r.rows.map((d) => ({
                              id: d.id,
                              label: `${d.name} (${d.code})`,
                              mrp: d.mrp,
                              purchasePrice: d.purchasePrice,
                              gstRate: d.gstRate,
                            })),
                            nextCursor: r.nextCursor,
                          };
                        }}
                      />
                    </TableCell>
                    {(
                      [
                        'batchNo',
                        'expiryDate',
                        'quantity',
                        'freeQuantity',
                        'purchasePrice',
                        'mrp',
                        'gstRate',
                      ] as const
                    ).map((field) => (
                      <TableCell key={field} align={field === 'batchNo' ? 'left' : 'right'}>
                        <TextField
                          size="small"
                          type={field === 'expiryDate' ? 'date' : 'text'}
                          value={l[field]}
                          onChange={(e) =>
                            setLines(
                              editable.map((x, xi) =>
                                xi === i
                                  ? { ...x, [field]: e.target.value }
                                  : x,
                              ),
                            )
                          }
                          slotProps={
                            field === 'expiryDate'
                              ? { inputLabel: { shrink: true } }
                              : undefined
                          }
                          sx={{
                            width:
                              field === 'batchNo'
                                ? 120
                                : field === 'expiryDate'
                                  ? 150
                                  : 76,
                          }}
                        />
                      </TableCell>
                    ))}
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() =>
                          setLines(
                            editable.length > 1
                              ? editable.filter((_, xi) => xi !== i)
                              : editable,
                          )
                        }
                      >
                        <DeleteOutlinedIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Button
              size="small"
              sx={{ mt: 1 }}
              onClick={() => setLines([...editable, emptyGrnLine()])}
            >
              Add line
            </Button>
          </>
        ) : (
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Drug</TableCell>
                  <TableCell>Batch</TableCell>
                  <TableCell>Expiry</TableCell>
                  <TableCell align="right">Qty</TableCell>
                  <TableCell align="right">Free</TableCell>
                  <TableCell align="right">Cost</TableCell>
                  <TableCell align="right">MRP</TableCell>
                  <TableCell align="right">Line total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(grn?.items ?? []).map((it) => (
                  <TableRow key={it.id}>
                    <TableCell>
                      {it.drugName} ({it.drugCode})
                    </TableCell>
                    <TableCell>{it.batchNo}</TableCell>
                    <TableCell>{it.expiryDate}</TableCell>
                    <TableCell align="right">{it.quantity}</TableCell>
                    <TableCell align="right">{it.freeQuantity}</TableCell>
                    <TableCell align="right">{money(it.purchasePrice)}</TableCell>
                    <TableCell align="right">{money(it.mrp)}</TableCell>
                    <TableCell align="right">{money(it.lineTotal)}</TableCell>
                  </TableRow>
                ))}
                {(grn?.items ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                      No items.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions>
        {isDraft && canWrite && (
          <>
            <Button
              color="error"
              disabled={cancelMut.isPending}
              onClick={() => cancelMut.mutate()}
            >
              Cancel GRN
            </Button>
            <Box sx={{ flex: 1 }} />
            <Button
              disabled={saveItems.isPending}
              onClick={() => saveItems.mutate()}
            >
              Save items
            </Button>
            <Button
              variant="contained"
              color="success"
              disabled={postMut.isPending || (grn?.items ?? []).length === 0}
              onClick={() => postMut.mutate()}
            >
              Post
            </Button>
          </>
        )}
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

// ---- Dispensing ----------------------------------------------

function DispensingTab({ canWrite }: { canWrite: boolean }) {
  const qc = useQueryClient();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ['pharmacy-dispenses', from, to],
    queryFn: () =>
      pharmacyApi.dispenses({
        from: from || undefined,
        to: to || undefined,
        limit: 100,
      }),
  });
  const rows = listQuery.data?.rows ?? [];
  const refresh = () =>
    qc.invalidateQueries({ queryKey: ['pharmacy-dispenses'] });

  return (
    <>
      <Stack
        direction="row"
        sx={{ gap: 2, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}
      >
        <TextField
          type="date"
          size="small"
          label="From"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          type="date"
          size="small"
          label="To"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        {canWrite && (
          <Button variant="contained" onClick={() => setOpen(true)}>
            New dispense
          </Button>
        )}
      </Stack>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Dispense #</TableCell>
              <TableCell>When</TableCell>
              <TableCell>Patient</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Discount</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((d) => (
              <TableRow key={d.id}>
                <TableCell>{d.dispenseNo}</TableCell>
                <TableCell>
                  {new Date(d.dispensedAt).toLocaleString()}
                </TableCell>
                <TableCell>
                  {d.patientName ?? `Patient #${d.patientId}`}
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={d.status}
                    color={d.status === 'DISPENSED' ? 'success' : 'default'}
                  />
                </TableCell>
                <TableCell align="right">{money(d.discount)}</TableCell>
                <TableCell align="right">{money(d.total)}</TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => setDetailId(d.id)}>
                    Open
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  No dispenses.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <DispenseDialog
        open={open}
        onClose={() => setOpen(false)}
        onDone={refresh}
      />
      {detailId && (
        <DispenseDetailDialog
          id={detailId}
          canWrite={canWrite}
          onClose={() => {
            setDetailId(null);
            refresh();
          }}
        />
      )}
    </>
  );
}

function DispenseDetailDialog({
  id,
  canWrite,
  onClose,
}: {
  id: string;
  canWrite: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['pharmacy-dispense', id],
    queryFn: () => pharmacyApi.dispense(id),
  });
  const d = q.data;
  const cancelMut = useMutation({
    mutationFn: () => pharmacyApi.cancelDispense(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pharmacy-dispense', id] }),
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        {d?.dispenseNo}{' '}
        {d && (
          <Chip
            size="small"
            label={d.status}
            color={d.status === 'DISPENSED' ? 'success' : 'default'}
            sx={{ ml: 1 }}
          />
        )}
      </DialogTitle>
      <DialogContent>
        {cancelMut.isError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errMsg(cancelMut.error)}
          </Alert>
        )}
        {d && (
          <Typography variant="body2" sx={{ mb: 2 }} color="text.secondary">
            {d.patientName ?? `Patient ${d.patientId}`} ·{' '}
            {new Date(d.dispensedAt).toLocaleString()} · subtotal{' '}
            {money(d.subtotal)} · discount {money(d.discount)} · total{' '}
            {money(d.total)}
          </Typography>
        )}
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Drug</TableCell>
                <TableCell>Batch</TableCell>
                <TableCell>Expiry</TableCell>
                <TableCell align="right">Qty</TableCell>
                <TableCell align="right">MRP</TableCell>
                <TableCell align="right">Discount</TableCell>
                <TableCell align="right">Line total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(d?.items ?? []).map((it) => (
                <TableRow key={it.id}>
                  <TableCell>
                    {it.drugName} ({it.drugCode})
                  </TableCell>
                  <TableCell>{it.batchNo}</TableCell>
                  <TableCell>{it.expiryDate}</TableCell>
                  <TableCell align="right">{it.quantity}</TableCell>
                  <TableCell align="right">{money(it.mrp)}</TableCell>
                  <TableCell align="right">{money(it.discount)}</TableCell>
                  <TableCell align="right">{money(it.lineTotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions>
        {canWrite && d?.status === 'DISPENSED' && (
          <Button
            color="error"
            disabled={cancelMut.isPending}
            onClick={() => cancelMut.mutate()}
          >
            Cancel dispense
          </Button>
        )}
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

// ---- Alerts --------------------------------------------------

function AlertsTab() {
  const q = useQuery({
    queryKey: ['pharmacy-alerts'],
    queryFn: pharmacyApi.alerts,
  });

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 6 }}>
        <Typography variant="subtitle2" gutterBottom>
          Low stock ({q.data?.lowStock.length ?? 0})
        </Typography>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Drug</TableCell>
                <TableCell>Rack</TableCell>
                <TableCell align="right">On hand</TableCell>
                <TableCell align="right">Reorder</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(q.data?.lowStock ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.code}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{r.rackLocation || '—'}</TableCell>
                  <TableCell align="right">{r.onHand}</TableCell>
                  <TableCell align="right">{r.reorderLevel}</TableCell>
                </TableRow>
              ))}
              {(q.data?.lowStock ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                    Nothing below reorder level.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <Typography variant="subtitle2" gutterBottom>
          Expiring within 90 days ({q.data?.expiring.length ?? 0})
        </Typography>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Drug</TableCell>
                <TableCell>Batch</TableCell>
                <TableCell>Expiry</TableCell>
                <TableCell align="right">On hand</TableCell>
                <TableCell align="right">Value</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(q.data?.expiring ?? []).map((r) => (
                <TableRow key={r.batchId}>
                  <TableCell>
                    {r.name} ({r.code})
                  </TableCell>
                  <TableCell>{r.batchNo}</TableCell>
                  <TableCell>{r.expiryDate}</TableCell>
                  <TableCell align="right">{r.quantityOnHand}</TableCell>
                  <TableCell align="right">{money(r.valueAtRisk)}</TableCell>
                </TableRow>
              ))}
              {(q.data?.expiring ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                    No batches expiring soon.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Grid>
    </Grid>
  );
}

// ---- Dashboard ---------------------------------------------

function DashboardTab() {
  const q = useQuery({
    queryKey: ['pharmacy-dashboard'],
    queryFn: pharmacyApi.dashboard,
  });
  const d = q.data;
  const tiles = useMemo(
    () =>
      d
        ? [
            { label: 'Low stock drugs', value: String(d.lowStockCount) },
            {
              label: 'Batches expiring ≤90d',
              value: String(d.expiringSoonCount),
            },
            {
              label: "Today's dispensing",
              value: `${money(d.dispenseTodayValue)} (${d.dispenseTodayCount})`,
            },
            {
              label: "Today's GRN",
              value: `${money(d.grnTodayValue)} (${d.grnTodayCount})`,
            },
            {
              label: 'Total stock value',
              value: money(d.totalStockValue),
            },
          ]
        : [],
    [d],
  );

  return (
    <Grid container spacing={2}>
      {tiles.map((t) => (
        <Grid size={{ xs: 12, sm: 6, md: 4 }} key={t.label}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {t.label}
            </Typography>
            <Typography variant="h5">{t.value}</Typography>
          </Paper>
        </Grid>
      ))}
      {d && (
        <Grid size={{ xs: 12 }}>
          <Typography variant="caption" color="text.secondary">
            As of {d.date}
          </Typography>
        </Grid>
      )}
    </Grid>
  );
}
