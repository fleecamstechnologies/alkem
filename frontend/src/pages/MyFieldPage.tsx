import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
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
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { fieldApi, type CallProductInput } from '../api/field';
import { doctorsApi } from '../api/doctors';
import { customersApi } from '../api/customers';
import { money, todayISO } from '../format';
import { CallKind, CallProductAction, type PromoItem } from '../types';
import { useAuth } from '../auth/AuthContext';

function errMsg(e: unknown): string {
  return (
    (e as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? 'Request failed'
  );
}
const monthNow = () => new Date().toISOString().slice(0, 7);

export function MyFieldPage() {
  const { user } = useAuth();
  const repId = user?.employeeId ? Number(user.employeeId) : undefined;
  const [tab, setTab] = useState(0);

  const repQuery = useQuery({
    queryKey: ['my-rep'],
    queryFn: fieldApi.myRep,
    retry: false,
  });

  if (repQuery.isError) {
    return (
      <Alert severity="info">
        You are not registered as a field rep. Ask your admin to set up a rep
        profile for you.
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        My field work
      </Typography>
      <Paper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable">
          <Tab label="Tour plan" />
          <Tab label="New call report" />
          <Tab label="My calls" />
          <Tab label="My stock" />
        </Tabs>
      </Paper>
      {repId && tab === 0 && <TourPlanTab repId={repId} />}
      {repId && tab === 1 && <NewCallTab repId={repId} />}
      {repId && tab === 2 && <MyCallsTab repId={repId} />}
      {repId && tab === 3 && <MyStockTab repId={repId} />}
    </Box>
  );
}

// ---- Tour plan -------------------------------------------------

function TourPlanTab({ repId }: { repId: number }) {
  const qc = useQueryClient();
  const [periodMonth, setPeriodMonth] = useState(monthNow());
  const [days, setDays] = useState<
    { planDate: string; area: string; plannedCalls: number }[]
  >([]);

  const planQuery = useQuery({
    queryKey: ['my-tour-plan', periodMonth],
    queryFn: () => fieldApi.createTourPlan({ periodMonth, repEmployeeId: repId }),
  });

  useEffect(() => {
    if (planQuery.data) {
      setDays(
        planQuery.data.days.map((d) => ({
          planDate: d.planDate,
          area: d.area,
          plannedCalls: d.plannedCalls,
        })),
      );
    }
  }, [planQuery.data]);

  const saveMut = useMutation({
    mutationFn: () => fieldApi.setTourDays(planQuery.data!.id, days),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['my-tour-plan', periodMonth] }),
  });
  const submitMut = useMutation({
    mutationFn: () => fieldApi.submitTourPlan(planQuery.data!.id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['my-tour-plan', periodMonth] }),
  });

  const status = planQuery.data?.status ?? 'DRAFT';
  const editable = status === 'DRAFT';

  return (
    <>
      <Stack direction="row" sx={{ gap: 2, mb: 2, alignItems: 'center' }}>
        <TextField
          type="month"
          size="small"
          label="Month"
          value={periodMonth}
          onChange={(e) => setPeriodMonth(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <Chip label={status} color={status === 'APPROVED' ? 'success' : 'default'} />
      </Stack>

      {(saveMut.isError || submitMut.isError) && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errMsg(saveMut.error ?? submitMut.error)}
        </Alert>
      )}

      <TableContainer component={Paper} sx={{ mb: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Area</TableCell>
              <TableCell align="right">Planned calls</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {days.map((d, i) => (
              <TableRow key={i}>
                <TableCell>
                  <TextField
                    type="date"
                    size="small"
                    value={d.planDate}
                    disabled={!editable}
                    onChange={(e) =>
                      setDays((ds) =>
                        ds.map((x, xi) =>
                          xi === i ? { ...x, planDate: e.target.value } : x,
                        ),
                      )
                    }
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    value={d.area}
                    disabled={!editable}
                    onChange={(e) =>
                      setDays((ds) =>
                        ds.map((x, xi) =>
                          xi === i ? { ...x, area: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </TableCell>
                <TableCell align="right">
                  <TextField
                    size="small"
                    type="number"
                    value={d.plannedCalls}
                    disabled={!editable}
                    onChange={(e) =>
                      setDays((ds) =>
                        ds.map((x, xi) =>
                          xi === i
                            ? { ...x, plannedCalls: Number(e.target.value) }
                            : x,
                        ),
                      )
                    }
                    sx={{ width: 90 }}
                  />
                </TableCell>
                <TableCell align="right">
                  {editable && (
                    <IconButton
                      size="small"
                      onClick={() =>
                        setDays((ds) => ds.filter((_, xi) => xi !== i))
                      }
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {editable && (
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            onClick={() =>
              setDays((ds) => [
                ...ds,
                { planDate: `${periodMonth}-01`, area: '', plannedCalls: 8 },
              ])
            }
          >
            Add day
          </Button>
          <Button
            variant="outlined"
            size="small"
            disabled={saveMut.isPending}
            onClick={() => saveMut.mutate()}
          >
            Save
          </Button>
          <Button
            variant="contained"
            size="small"
            disabled={submitMut.isPending || days.length === 0}
            onClick={async () => {
              await saveMut.mutateAsync();
              submitMut.mutate();
            }}
          >
            Save &amp; submit
          </Button>
        </Stack>
      )}
    </>
  );
}

// ---- New call report --------------------------------------

function NewCallTab({ repId }: { repId: number }) {
  const qc = useQueryClient();
  const itemsQuery = useQuery({
    queryKey: ['promo-items'],
    queryFn: fieldApi.promoItems,
  });
  const [callDate, setCallDate] = useState(todayISO());
  const [kind, setKind] = useState<string>(CallKind.DOCTOR);
  const [party, setParty] = useState<{ id: string; label: string } | null>(null);
  const [options, setOptions] = useState<{ id: string; label: string }[]>([]);
  const [area, setArea] = useState('');
  const [wasPlanned, setWasPlanned] = useState(true);
  const [remarks, setRemarks] = useState('');
  const [products, setProducts] = useState<CallProductInput[]>([]);
  const [rx, setRx] = useState<{ brand: string; rxPerDay: number }[]>([]);
  const [rcpa, setRcpa] = useState<
    { brand: string; company: string; units: number }[]
  >([]);

  const search = async (term: string) => {
    if (term.length < 2) return;
    if (kind === CallKind.DOCTOR) {
      const r = await doctorsApi.list({ q: term, limit: 10 });
      setOptions(r.rows.map((d) => ({ id: d.id, label: `${d.name} (${d.code})` })));
    } else {
      const r = await customersApi.list({ q: term, limit: 10 });
      setOptions(
        r.rows.map((c) => ({ id: c.id, label: `${c.name} (${c.code})` })),
      );
    }
  };

  const createMut = useMutation({
    mutationFn: () =>
      fieldApi.createCallReport({
        repEmployeeId: repId,
        callDate,
        kind,
        doctorId:
          kind === CallKind.DOCTOR && party ? Number(party.id) : undefined,
        customerId:
          kind === CallKind.CHEMIST && party ? Number(party.id) : undefined,
        area: area || undefined,
        wasPlanned,
        remarks: remarks || undefined,
        products: products.filter((p) => p.promoItemId),
        rx: rx.filter((r) => r.brand),
        rcpa: rcpa.filter((r) => r.brand),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-calls'] });
      qc.invalidateQueries({ queryKey: ['field-stock'] });
      setParty(null);
      setArea('');
      setRemarks('');
      setProducts([]);
      setRx([]);
      setRcpa([]);
    },
  });

  const items: PromoItem[] = itemsQuery.data ?? [];

  return (
    <Paper sx={{ p: 2 }}>
      <Stack spacing={2}>
        {createMut.isError && (
          <Alert severity="error">{errMsg(createMut.error)}</Alert>
        )}
        {createMut.isSuccess && <Alert severity="success">Call report saved.</Alert>}

        <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
          <TextField
            type="date"
            size="small"
            label="Date"
            value={callDate}
            onChange={(e) => setCallDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            select
            size="small"
            label="Kind"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setParty(null);
              setOptions([]);
            }}
          >
            <MenuItem value={CallKind.DOCTOR}>Doctor</MenuItem>
            <MenuItem value={CallKind.CHEMIST}>Chemist</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            label="Planned?"
            value={wasPlanned ? 'y' : 'n'}
            onChange={(e) => setWasPlanned(e.target.value === 'y')}
          >
            <MenuItem value="y">Yes</MenuItem>
            <MenuItem value="n">No</MenuItem>
          </TextField>
        </Stack>

        <Autocomplete
          options={options}
          getOptionLabel={(o) => o.label}
          value={party}
          onChange={(_, v) => setParty(v)}
          onInputChange={(_, v) => void search(v)}
          isOptionEqualToValue={(o, v) => o.id === v.id}
          renderInput={(p) => (
            <TextField
              {...p}
              size="small"
              label={kind === CallKind.DOCTOR ? 'Doctor' : 'Chemist'}
            />
          )}
        />
        <TextField
          size="small"
          label="Area"
          value={area}
          onChange={(e) => setArea(e.target.value)}
        />

        <Typography variant="subtitle2">Products</Typography>
        {products.map((p, i) => (
          <Stack direction="row" spacing={1} key={i}>
            <TextField
              select
              size="small"
              label="Item"
              value={String(p.promoItemId || '')}
              onChange={(e) =>
                setProducts((ps) =>
                  ps.map((x, xi) =>
                    xi === i
                      ? { ...x, promoItemId: Number(e.target.value) }
                      : x,
                  ),
                )
              }
              sx={{ minWidth: 160 }}
            >
              {items.map((it) => (
                <MenuItem key={it.id} value={it.id}>
                  {it.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Action"
              value={p.action}
              onChange={(e) =>
                setProducts((ps) =>
                  ps.map((x, xi) =>
                    xi === i ? { ...x, action: e.target.value } : x,
                  ),
                )
              }
            >
              {Object.values(CallProductAction).map((a) => (
                <MenuItem key={a} value={a}>
                  {a}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              label="Qty"
              value={p.qty ?? ''}
              onChange={(e) =>
                setProducts((ps) =>
                  ps.map((x, xi) =>
                    xi === i ? { ...x, qty: e.target.value } : x,
                  ),
                )
              }
              sx={{ width: 80 }}
            />
            <TextField
              size="small"
              label="Value"
              value={p.value ?? ''}
              onChange={(e) =>
                setProducts((ps) =>
                  ps.map((x, xi) =>
                    xi === i ? { ...x, value: e.target.value } : x,
                  ),
                )
              }
              sx={{ width: 90 }}
            />
          </Stack>
        ))}
        <Button
          size="small"
          onClick={() =>
            setProducts((ps) => [
              ...ps,
              { promoItemId: 0, action: CallProductAction.DETAILED },
            ])
          }
        >
          Add product line
        </Button>

        <Typography variant="subtitle2">
          {kind === CallKind.DOCTOR ? 'Prescription (Rx)' : 'RCPA'}
        </Typography>
        {kind === CallKind.DOCTOR
          ? rx.map((r, i) => (
              <Stack direction="row" spacing={1} key={i}>
                <TextField
                  size="small"
                  label="Brand"
                  value={r.brand}
                  onChange={(e) =>
                    setRx((rs) =>
                      rs.map((x, xi) =>
                        xi === i ? { ...x, brand: e.target.value } : x,
                      ),
                    )
                  }
                />
                <TextField
                  size="small"
                  type="number"
                  label="Rx/day"
                  value={r.rxPerDay}
                  onChange={(e) =>
                    setRx((rs) =>
                      rs.map((x, xi) =>
                        xi === i
                          ? { ...x, rxPerDay: Number(e.target.value) }
                          : x,
                      ),
                    )
                  }
                  sx={{ width: 90 }}
                />
              </Stack>
            ))
          : rcpa.map((r, i) => (
              <Stack direction="row" spacing={1} key={i}>
                <TextField
                  size="small"
                  label="Brand"
                  value={r.brand}
                  onChange={(e) =>
                    setRcpa((rs) =>
                      rs.map((x, xi) =>
                        xi === i ? { ...x, brand: e.target.value } : x,
                      ),
                    )
                  }
                />
                <TextField
                  size="small"
                  label="Company"
                  value={r.company}
                  onChange={(e) =>
                    setRcpa((rs) =>
                      rs.map((x, xi) =>
                        xi === i ? { ...x, company: e.target.value } : x,
                      ),
                    )
                  }
                />
                <TextField
                  size="small"
                  type="number"
                  label="Units"
                  value={r.units}
                  onChange={(e) =>
                    setRcpa((rs) =>
                      rs.map((x, xi) =>
                        xi === i ? { ...x, units: Number(e.target.value) } : x,
                      ),
                    )
                  }
                  sx={{ width: 90 }}
                />
              </Stack>
            ))}
        <Button
          size="small"
          onClick={() =>
            kind === CallKind.DOCTOR
              ? setRx((rs) => [...rs, { brand: '', rxPerDay: 0 }])
              : setRcpa((rs) => [
                  ...rs,
                  { brand: '', company: '', units: 0 },
                ])
          }
        >
          Add line
        </Button>

        <TextField
          size="small"
          label="Remarks"
          multiline
          minRows={2}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />

        <Box>
          <Button
            variant="contained"
            disabled={createMut.isPending || !party}
            onClick={() => createMut.mutate()}
          >
            Save call report
          </Button>
        </Box>
      </Stack>
    </Paper>
  );
}

// ---- My calls -------------------------------------------

function MyCallsTab({ repId }: { repId: number }) {
  const [from, setFrom] = useState(`${monthNow()}-01`);
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const q = useQuery({
    queryKey: ['my-calls', repId, from, to],
    queryFn: () =>
      fieldApi.callReports({ repEmployeeId: repId, from, to, limit: 100 }),
  });
  return (
    <>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
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
              <TableCell>Kind</TableCell>
              <TableCell>Doctor / Chemist</TableCell>
              <TableCell>Planned</TableCell>
              <TableCell align="right">Samples</TableCell>
              <TableCell align="right">POB</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(q.data?.rows ?? []).map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.callDate}</TableCell>
                <TableCell>{r.kind}</TableCell>
                <TableCell>{r.partyName || '—'}</TableCell>
                <TableCell>{r.wasPlanned ? 'Y' : 'N'}</TableCell>
                <TableCell align="right">{r.sampleLines}</TableCell>
                <TableCell align="right">{money(r.pobValue)}</TableCell>
              </TableRow>
            ))}
            {(q.data?.rows ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
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

// ---- My stock ------------------------------------------

function MyStockTab({ repId }: { repId: number }) {
  const stockQuery = useQuery({
    queryKey: ['my-stock', repId],
    queryFn: () => fieldApi.stock(repId),
  });
  const movQuery = useQuery({
    queryKey: ['my-movements', repId],
    queryFn: () => fieldApi.movements(repId),
  });
  return (
    <Stack spacing={3}>
      <Box>
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
                    sx={{
                      color: Number(s.balance) < 0 ? 'error.main' : undefined,
                    }}
                  >
                    {s.balance}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
      <Box>
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
              </TableRow>
            </TableHead>
            <TableBody>
              {(movQuery.data ?? []).map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{m.movementDate}</TableCell>
                  <TableCell>{m.itemCode}</TableCell>
                  <TableCell>{m.kind}</TableCell>
                  <TableCell align="right">{m.qty}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Stack>
  );
}
