import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { fieldApi } from '../api/field';
import { doctorsApi } from '../api/doctors';
import { customersApi } from '../api/customers';
import { money } from '../format';
import { PromoItemType, type CallReportRow, type FieldRepRow } from '../types';

function errMsg(e: unknown): string {
  return (
    (e as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? 'Request failed'
  );
}
const monthNow = () => new Date().toISOString().slice(0, 7);

export function FieldPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);

  const repsQuery = useQuery({ queryKey: ['field-reps'], queryFn: fieldApi.reps });
  const itemsQuery = useQuery({
    queryKey: ['promo-items'],
    queryFn: fieldApi.promoItems,
  });

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Field force
      </Typography>
      <Paper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable">
          <Tab label="Reps" />
          <Tab label="Promo items" />
          <Tab label="Stock" />
          <Tab label="Tour plans" />
          <Tab label="Call reports" />
          <Tab label="Dashboard" />
        </Tabs>
      </Paper>

      {tab === 0 && (
        <RepsTab reps={repsQuery.data ?? []} onChanged={() => qc.invalidateQueries({ queryKey: ['field-reps'] })} />
      )}
      {tab === 1 && <PromoItemsTab items={itemsQuery.data ?? []} onChanged={() => qc.invalidateQueries({ queryKey: ['promo-items'] })} />}
      {tab === 2 && <StockTab reps={repsQuery.data ?? []} items={itemsQuery.data ?? []} />}
      {tab === 3 && <TourPlansTab />}
      {tab === 4 && <CallReportsTab reps={repsQuery.data ?? []} />}
      {tab === 5 && <DashboardTab />}
    </Box>
  );
}

// ---- Reps ---------------------------------------------------------

function RepsTab({
  reps,
  onChanged,
}: {
  reps: FieldRepRow[];
  onChanged: () => void;
}) {
  const [assignOpen, setAssignOpen] = useState<FieldRepRow | null>(null);
  const [entityType, setEntityType] = useState<'DOCTOR' | 'CUSTOMER'>('DOCTOR');
  const [picked, setPicked] = useState<{ id: string; label: string } | null>(
    null,
  );
  const [options, setOptions] = useState<{ id: string; label: string }[]>([]);

  const assignMut = useMutation({
    mutationFn: () =>
      fieldApi.assign({
        entityType,
        entityId: Number(picked!.id),
        repEmployeeId: Number(assignOpen!.employeeId),
      }),
    onSuccess: () => {
      onChanged();
      setAssignOpen(null);
      setPicked(null);
    },
  });

  const search = async (term: string) => {
    if (term.length < 2) return;
    if (entityType === 'DOCTOR') {
      const r = await doctorsApi.list({ q: term, limit: 10 });
      setOptions(r.rows.map((d) => ({ id: d.id, label: `${d.name} (${d.code})` })));
    } else {
      const r = await customersApi.list({ q: term, limit: 10 });
      setOptions(
        r.rows.map((c) => ({ id: c.id, label: `${c.name} (${c.code})` })),
      );
    }
  };

  return (
    <>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Code</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>HQ</TableCell>
              <TableCell>Territory</TableCell>
              <TableCell align="right">Doctors</TableCell>
              <TableCell align="right">Chemists</TableCell>
              <TableCell>Active</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {reps.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.employeeCode}</TableCell>
                <TableCell>{r.employeeName}</TableCell>
                <TableCell>{r.hq || '—'}</TableCell>
                <TableCell>{r.territory || '—'}</TableCell>
                <TableCell align="right">{r.doctors}</TableCell>
                <TableCell align="right">{r.chemists}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={r.active ? 'yes' : 'no'}
                    color={r.active ? 'success' : 'default'}
                  />
                </TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => setAssignOpen(r)}>
                    Assign
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {reps.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  No field reps. Create a portal login linked to an employee,
                  then set a rep profile via PUT /field/reps/:employeeId.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={!!assignOpen}
        onClose={() => setAssignOpen(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          Assign to {assignOpen?.employeeName}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {assignMut.isError && (
              <Alert severity="error">{errMsg(assignMut.error)}</Alert>
            )}
            <TextField
              select
              label="Type"
              value={entityType}
              onChange={(e) => {
                setEntityType(e.target.value as 'DOCTOR' | 'CUSTOMER');
                setPicked(null);
                setOptions([]);
              }}
            >
              <MenuItem value="DOCTOR">Doctor</MenuItem>
              <MenuItem value="CUSTOMER">Chemist / customer</MenuItem>
            </TextField>
            <Autocomplete
              options={options}
              getOptionLabel={(o) => o.label}
              value={picked}
              onChange={(_, v) => setPicked(v)}
              onInputChange={(_, v) => void search(v)}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              renderInput={(p) => <TextField {...p} label="Search" />}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignOpen(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!picked || assignMut.isPending}
            onClick={() => assignMut.mutate()}
          >
            Assign
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ---- Promo items ------------------------------------------------

function PromoItemsTab({
  items,
  onChanged,
}: {
  items: import('../types').PromoItem[];
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    code: '',
    name: '',
    type: PromoItemType.SAMPLE as string,
    unit: 'unit',
  });
  const createMut = useMutation({
    mutationFn: () =>
      fieldApi.createPromoItem(form as Partial<import('../types').PromoItem>),
    onSuccess: () => {
      onChanged();
      setOpen(false);
      setForm({ code: '', name: '', type: PromoItemType.SAMPLE, unit: 'unit' });
    },
  });
  const toggleMut = useMutation({
    mutationFn: (v: { id: string; active: boolean }) =>
      fieldApi.updatePromoItem(v.id, { active: v.active }),
    onSuccess: onChanged,
  });

  return (
    <>
      <Stack direction="row" sx={{ justifyContent: 'flex-end', mb: 1 }}>
        <Button variant="contained" onClick={() => setOpen(true)}>
          New promo item
        </Button>
      </Stack>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Code</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Unit</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((i) => (
              <TableRow key={i.id}>
                <TableCell>{i.code}</TableCell>
                <TableCell>{i.name}</TableCell>
                <TableCell>{i.type}</TableCell>
                <TableCell>{i.unit}</TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    onClick={() =>
                      toggleMut.mutate({ id: i.id, active: !i.active })
                    }
                  >
                    {i.active ? 'Deactivate' : 'Activate'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>New promo item</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1, minWidth: 320 }}>
            {createMut.isError && (
              <Alert severity="error">{errMsg(createMut.error)}</Alert>
            )}
            <TextField
              label="Code"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            />
            <TextField
              label="Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <TextField
              select
              label="Type"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            >
              {Object.values(PromoItemType).map((t) => (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Unit"
              value={form.unit}
              onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!form.code || !form.name || createMut.isPending}
            onClick={() => createMut.mutate()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ---- Stock -----------------------------------------------------

function StockTab({
  reps,
  items,
}: {
  reps: FieldRepRow[];
  items: import('../types').PromoItem[];
}) {
  const qc = useQueryClient();
  const [repId, setRepId] = useState('');
  const [issueOpen, setIssueOpen] = useState(false);
  const [lines, setLines] = useState<{ promoItemId: string; qty: string }[]>([]);

  const stockQuery = useQuery({
    queryKey: ['field-stock', repId],
    queryFn: () => fieldApi.stock(repId),
    enabled: !!repId,
  });
  const movQuery = useQuery({
    queryKey: ['field-movements', repId],
    queryFn: () => fieldApi.movements(repId),
    enabled: !!repId,
  });
  const issueMut = useMutation({
    mutationFn: () =>
      fieldApi.issueStock({
        repEmployeeId: Number(repId),
        lines: lines
          .filter((l) => l.promoItemId && l.qty)
          .map((l) => ({ promoItemId: Number(l.promoItemId), qty: l.qty })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['field-stock'] });
      qc.invalidateQueries({ queryKey: ['field-movements'] });
      setIssueOpen(false);
      setLines([]);
    },
  });

  return (
    <>
      <Stack
        direction="row"
        sx={{ gap: 2, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}
      >
        <TextField
          select
          size="small"
          label="Rep"
          value={repId}
          onChange={(e) => setRepId(e.target.value)}
          sx={{ minWidth: 220 }}
        >
          {reps.map((r) => (
            <MenuItem key={r.employeeId} value={r.employeeId}>
              {r.employeeName} ({r.employeeCode})
            </MenuItem>
          ))}
        </TextField>
        <Button
          variant="contained"
          disabled={!repId}
          onClick={() => {
            setLines([{ promoItemId: '', qty: '' }]);
            setIssueOpen(true);
          }}
        >
          Issue stock
        </Button>
      </Stack>

      {repId && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 5 }}>
            <Typography variant="subtitle2" gutterBottom>
              Balances
            </Typography>
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Item</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">Balance</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(stockQuery.data ?? []).map((s) => (
                    <TableRow key={s.promoItemId}>
                      <TableCell>
                        {s.name} ({s.code})
                      </TableCell>
                      <TableCell>{s.type}</TableCell>
                      <TableCell
                        align="right"
                        sx={{ color: Number(s.balance) < 0 ? 'error.main' : undefined }}
                      >
                        {s.balance}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
          <Grid size={{ xs: 12, md: 7 }}>
            <Typography variant="subtitle2" gutterBottom>
              Recent movements
            </Typography>
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Item</TableCell>
                    <TableCell>Kind</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell>Ref</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(movQuery.data ?? []).map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>{m.movementDate}</TableCell>
                      <TableCell>{m.itemCode}</TableCell>
                      <TableCell>{m.kind}</TableCell>
                      <TableCell align="right">{m.qty}</TableCell>
                      <TableCell>
                        {m.refType ? `${m.refType} ${m.refId ?? ''}` : m.note || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
        </Grid>
      )}

      <Dialog open={issueOpen} onClose={() => setIssueOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Issue stock</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {issueMut.isError && (
              <Alert severity="error">{errMsg(issueMut.error)}</Alert>
            )}
            {lines.map((l, i) => (
              <Stack direction="row" spacing={1} key={i}>
                <TextField
                  select
                  size="small"
                  label="Item"
                  value={l.promoItemId}
                  onChange={(e) =>
                    setLines((ls) =>
                      ls.map((x, xi) =>
                        xi === i ? { ...x, promoItemId: e.target.value } : x,
                      ),
                    )
                  }
                  sx={{ flex: 1 }}
                >
                  {items
                    .filter((it) => it.type !== 'PRODUCT')
                    .map((it) => (
                      <MenuItem key={it.id} value={it.id}>
                        {it.name}
                      </MenuItem>
                    ))}
                </TextField>
                <TextField
                  size="small"
                  label="Qty"
                  value={l.qty}
                  onChange={(e) =>
                    setLines((ls) =>
                      ls.map((x, xi) =>
                        xi === i ? { ...x, qty: e.target.value } : x,
                      ),
                    )
                  }
                  sx={{ width: 100 }}
                />
              </Stack>
            ))}
            <Button
              size="small"
              onClick={() =>
                setLines((ls) => [...ls, { promoItemId: '', qty: '' }])
              }
            >
              Add line
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIssueOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={issueMut.isPending}
            onClick={() => issueMut.mutate()}
          >
            Issue
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ---- Tour plans -----------------------------------------------

function TourPlansTab() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('SUBMITTED');
  const listQuery = useQuery({
    queryKey: ['field-tour-plans', status],
    queryFn: () => fieldApi.tourPlans({ status: status || undefined }),
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const detailQuery = useQuery({
    queryKey: ['field-tour-plan', openId],
    queryFn: () => fieldApi.tourPlan(openId!),
    enabled: !!openId,
  });
  const decideMut = useMutation({
    mutationFn: (v: { id: string; decision: string }) =>
      fieldApi.decideTourPlan(v.id, v.decision),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['field-tour-plans'] });
      qc.invalidateQueries({ queryKey: ['field-tour-plan'] });
    },
  });

  return (
    <>
      <TextField
        select
        size="small"
        label="Status"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        sx={{ minWidth: 160, mb: 2 }}
      >
        <MenuItem value="">All</MenuItem>
        {['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'].map((s) => (
          <MenuItem key={s} value={s}>
            {s}
          </MenuItem>
        ))}
      </TextField>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Rep</TableCell>
              <TableCell>Month</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Days</TableCell>
              <TableCell align="right">Planned calls</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {(listQuery.data ?? []).map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  {t.repName} ({t.repCode})
                </TableCell>
                <TableCell>{t.periodMonth}</TableCell>
                <TableCell>{t.status}</TableCell>
                <TableCell align="right">{t.dayCount}</TableCell>
                <TableCell align="right">{t.plannedCalls}</TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => setOpenId(t.id)}>
                    Open
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={!!openId} onClose={() => setOpenId(null)} fullWidth maxWidth="sm">
        <DialogTitle>Tour plan {detailQuery.data?.periodMonth}</DialogTitle>
        <DialogContent>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Area</TableCell>
                <TableCell align="right">Planned calls</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(detailQuery.data?.days ?? []).map((d) => (
                <TableRow key={d.id}>
                  <TableCell>{d.planDate}</TableCell>
                  <TableCell>{d.area}</TableCell>
                  <TableCell align="right">{d.plannedCalls}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
        <DialogActions>
          {detailQuery.data?.status === 'SUBMITTED' && (
            <>
              <Button
                color="error"
                onClick={() =>
                  decideMut.mutate({ id: openId!, decision: 'REJECTED' })
                }
              >
                Reject
              </Button>
              <Button
                variant="contained"
                color="success"
                onClick={() =>
                  decideMut.mutate({ id: openId!, decision: 'APPROVED' })
                }
              >
                Approve
              </Button>
            </>
          )}
          <Button onClick={() => setOpenId(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ---- Call reports --------------------------------------------

function CallReportsTab({ reps }: { reps: FieldRepRow[] }) {
  const [repId, setRepId] = useState('');
  const [from, setFrom] = useState(`${monthNow()}-01`);
  const [to, setTo] = useState(`${monthNow()}-31`);
  const q = useQuery({
    queryKey: ['field-calls', repId, from, to],
    queryFn: () =>
      fieldApi.callReports({
        repEmployeeId: repId ? Number(repId) : undefined,
        from,
        to,
        limit: 100,
      }),
  });
  const rows: CallReportRow[] = q.data?.rows ?? [];

  return (
    <>
      <Stack direction="row" sx={{ gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          select
          size="small"
          label="Rep"
          value={repId}
          onChange={(e) => setRepId(e.target.value)}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="">All</MenuItem>
          {reps.map((r) => (
            <MenuItem key={r.employeeId} value={r.employeeId}>
              {r.employeeName}
            </MenuItem>
          ))}
        </TextField>
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
      </Stack>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Rep</TableCell>
              <TableCell>Kind</TableCell>
              <TableCell>Doctor / Chemist</TableCell>
              <TableCell>Planned</TableCell>
              <TableCell align="right">Samples</TableCell>
              <TableCell align="right">POB</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.callDate}</TableCell>
                <TableCell>{r.repCode}</TableCell>
                <TableCell>{r.kind}</TableCell>
                <TableCell>{r.partyName || '—'}</TableCell>
                <TableCell>{r.wasPlanned ? 'Y' : 'N'}</TableCell>
                <TableCell align="right">{r.sampleLines}</TableCell>
                <TableCell align="right">{money(r.pobValue)}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  No calls in range.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}

// ---- Dashboard ---------------------------------------------

function DashboardTab() {
  const [periodMonth, setPeriodMonth] = useState(monthNow());
  const q = useQuery({
    queryKey: ['field-dashboard', periodMonth],
    queryFn: () => fieldApi.dashboard(periodMonth),
  });

  const rows = useMemo(() => q.data?.rows ?? [], [q.data]);

  return (
    <>
      <TextField
        type="month"
        size="small"
        label="Month"
        value={periodMonth}
        onChange={(e) => setPeriodMonth(e.target.value)}
        slotProps={{ inputLabel: { shrink: true } }}
        sx={{ mb: 2 }}
      />
      {q.data?.totals && (
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid size={{ xs: 4 }}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Planned calls
              </Typography>
              <Typography variant="h5">{q.data.totals.planned}</Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 4 }}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Actual calls
              </Typography>
              <Typography variant="h5">{q.data.totals.actual}</Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 4 }}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                POB value
              </Typography>
              <Typography variant="h5">
                {money(q.data.totals.pobValue)}
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      )}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Rep</TableCell>
              <TableCell align="right">Planned</TableCell>
              <TableCell align="right">Actual</TableCell>
              <TableCell align="right">Compliance %</TableCell>
              <TableCell align="right">Call avg</TableCell>
              <TableCell align="right">Doctors met</TableCell>
              <TableCell align="right">Coverage %</TableCell>
              <TableCell align="right">POB</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.repEmployeeId}>
                <TableCell>
                  {r.repName} ({r.repCode})
                </TableCell>
                <TableCell align="right">{r.planned}</TableCell>
                <TableCell align="right">{r.actual}</TableCell>
                <TableCell align="right">{r.compliancePct ?? '—'}</TableCell>
                <TableCell align="right">{r.callAverage}</TableCell>
                <TableCell align="right">{r.doctorsMet}</TableCell>
                <TableCell align="right">{r.coveragePct ?? '—'}</TableCell>
                <TableCell align="right">{money(r.pobValue)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}
