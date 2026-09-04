import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import { pharmacyApi } from '../api/pharmacy';
import { patientsApi } from '../api/patients';
import { AsyncSelect } from './AsyncSelect';
import { money } from '../format';

function errMsg(e: unknown): string {
  return (
    (e as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? 'Request failed'
  );
}

interface DrugOpt {
  id: string;
  label: string;
  mrp: string;
}
interface PatientOpt {
  id: string;
  label: string;
}
interface Line {
  drug: DrugOpt | null;
  quantity: string;
  discount: string;
  prescriptionItemId?: string;
}

export interface DispenseDialogProps {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  /** Fix the patient (from a patient detail page). */
  fixedPatient?: PatientOpt | null;
  /** Prefill lines from this prescription. */
  prescriptionId?: string | null;
}

const emptyLine = (): Line => ({ drug: null, quantity: '1', discount: '0' });

export function DispenseDialog({
  open,
  onClose,
  onDone,
  fixedPatient,
  prescriptionId,
}: DispenseDialogProps) {
  const [patient, setPatient] = useState<PatientOpt | null>(
    fixedPatient ?? null,
  );
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [loadingRx, setLoadingRx] = useState(false);
  const [rxNote, setRxNote] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPatient(fixedPatient ?? null);
    setLines([emptyLine()]);
    setRxNote(null);
    if (prescriptionId) {
      setLoadingRx(true);
      pharmacyApi
        .prescriptionItems(prescriptionId)
        .then((res) => {
          const mapped: Line[] = res.items
            .filter((i) => i.matchedDrugId)
            .map((i) => ({
              drug: {
                id: i.matchedDrugId as string,
                label: i.matchedDrugName ?? i.drugName,
                mrp: i.matchedMrp ?? '0',
              },
              quantity: i.quantity && /^\d+$/.test(i.quantity) ? i.quantity : '1',
              discount: '0',
              prescriptionItemId: i.prescriptionItemId,
            }));
          const unmatched = res.items.filter((i) => !i.matchedDrugId).length;
          setLines(mapped.length ? mapped : [emptyLine()]);
          setRxNote(
            `Prefilled ${mapped.length} line(s) from prescription` +
              (unmatched ? `; ${unmatched} item(s) had no drug-master match` : ''),
          );
        })
        .catch((e) => setRxNote(errMsg(e)))
        .finally(() => setLoadingRx(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prescriptionId, fixedPatient?.id]);

  const total = useMemo(
    () =>
      lines.reduce((sum, l) => {
        const gross = Number(l.drug?.mrp ?? 0) * Number(l.quantity || 0);
        return sum + Math.max(0, gross - Number(l.discount || 0));
      }, 0),
    [lines],
  );

  const mut = useMutation({
    mutationFn: () =>
      pharmacyApi.createDispense({
        patientId: Number(patient!.id),
        prescriptionId: prescriptionId ? Number(prescriptionId) : undefined,
        lines: lines
          .filter((l) => l.drug && Number(l.quantity) > 0)
          .map((l) => ({
            drugId: Number(l.drug!.id),
            quantity: l.quantity,
            discount: l.discount || '0',
            prescriptionItemId: l.prescriptionItemId
              ? Number(l.prescriptionItemId)
              : undefined,
          })),
      }),
    onSuccess: () => {
      onDone();
      onClose();
    },
  });

  const canSave =
    !!patient &&
    lines.some((l) => l.drug && Number(l.quantity) > 0) &&
    !mut.isPending;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>New dispense</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {mut.isError && <Alert severity="error">{errMsg(mut.error)}</Alert>}
          {rxNote && <Alert severity="info">{rxNote}</Alert>}

          {fixedPatient ? (
            <TextField
              label="Patient"
              value={fixedPatient.label}
              disabled
              fullWidth
            />
          ) : (
            <AsyncSelect
              label="Patient"
              source="patients"
              placeholder="Search name / code"
              value={patient}
              onChange={setPatient}
              fetchPage={async ({ q, cursor }) => {
                const r = await patientsApi.list({
                  q: q || undefined,
                  cursor: cursor || undefined,
                  limit: 25,
                });
                return {
                  options: r.rows.map((p) => ({
                    id: p.id,
                    label: `${p.firstName} ${p.lastName} (${p.code})`,
                  })),
                  nextCursor: r.nextCursor,
                };
              }}
            />
          )}

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: '48%' }}>Drug</TableCell>
                <TableCell align="right">Qty</TableCell>
                <TableCell align="right">MRP</TableCell>
                <TableCell align="right">Discount</TableCell>
                <TableCell align="right">Line total</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {lines.map((l, i) => {
                const gross =
                  Number(l.drug?.mrp ?? 0) * Number(l.quantity || 0);
                const lineTotal = Math.max(
                  0,
                  gross - Number(l.discount || 0),
                );
                return (
                  <TableRow key={i}>
                    <TableCell>
                      <AsyncSelect
                        label=""
                        source="dispense-drugs"
                        placeholder="Search drug"
                        sx={{ minWidth: 240 }}
                        value={l.drug}
                        onChange={(v) =>
                          setLines((ls) =>
                            ls.map((x, xi) =>
                              xi === i ? { ...x, drug: v } : x,
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
                            })),
                            nextCursor: r.nextCursor,
                          };
                        }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small"
                        value={l.quantity}
                        onChange={(e) =>
                          setLines((ls) =>
                            ls.map((x, xi) =>
                              xi === i
                                ? { ...x, quantity: e.target.value }
                                : x,
                            ),
                          )
                        }
                        sx={{ width: 72 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {money(l.drug?.mrp ?? 0)}
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small"
                        value={l.discount}
                        onChange={(e) =>
                          setLines((ls) =>
                            ls.map((x, xi) =>
                              xi === i
                                ? { ...x, discount: e.target.value }
                                : x,
                            ),
                          )
                        }
                        sx={{ width: 84 }}
                      />
                    </TableCell>
                    <TableCell align="right">{money(lineTotal)}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() =>
                          setLines((ls) =>
                            ls.length > 1
                              ? ls.filter((_, xi) => xi !== i)
                              : ls,
                          )
                        }
                      >
                        <DeleteOutlinedIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button
              size="small"
              onClick={() => setLines((ls) => [...ls, emptyLine()])}
              disabled={loadingRx}
            >
              Add line
            </Button>
            <Typography variant="subtitle1">
              Total {money(total)}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            Batches are picked automatically, earliest expiry first (FEFO). A
            PHARMACY charge is posted to the patient's billing ledger.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!canSave} onClick={() => mut.mutate()}>
          Dispense
        </Button>
      </DialogActions>
    </Dialog>
  );
}
