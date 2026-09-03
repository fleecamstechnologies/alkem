import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { payrollApi, type StructureLineInput } from '../api/payroll';
import { CalculationType, type SalaryStructure } from '../types';
import { money } from '../format';
import { todayISO } from '../format';

interface Props {
  open: boolean;
  current: SalaryStructure | null;
  onClose: () => void;
  onSubmit: (payload: {
    effectiveFrom: string;
    basicMonthly: string;
    lines: StructureLineInput[];
    note?: string;
  }) => void;
  submitting: boolean;
  error: string | null;
}

interface DraftLine {
  componentId: string;
  calculationType: string;
  value: string;
}

export function SalaryStructureDialog({
  open,
  current,
  onClose,
  onSubmit,
  submitting,
  error,
}: Props) {
  const { data: components } = useQuery({
    queryKey: ['salary-components'],
    queryFn: payrollApi.components,
  });

  const [effectiveFrom, setEffectiveFrom] = useState(todayISO());
  const [basic, setBasic] = useState('0');
  const [lines, setLines] = useState<DraftLine[]>([]);

  useEffect(() => {
    if (!open) return;
    if (current) {
      setEffectiveFrom(current.effectiveFrom);
      setBasic(current.basicMonthly);
      setLines(
        current.lines
          .filter((l) => l.component?.code !== 'BASIC')
          .map((l) => ({
            componentId: l.componentId,
            calculationType: l.calculationType,
            value: l.value,
          })),
      );
    } else {
      setEffectiveFrom(todayISO());
      setBasic('0');
      setLines([]);
    }
  }, [open, current]);

  const assignable = (components ?? []).filter(
    (c) => c.active && c.code !== 'BASIC' && c.code !== 'LOP',
  );

  const preview = (l: DraftLine): string => {
    const b = Number(basic) || 0;
    const v = Number(l.value) || 0;
    return l.calculationType === CalculationType.PERCENT_OF_BASIC
      ? money((b * v) / 100)
      : money(v);
  };

  const submit = () => {
    onSubmit({
      effectiveFrom,
      basicMonthly: basic,
      lines: lines
        .filter((l) => l.componentId)
        .map((l) => ({
          componentId: Number(l.componentId),
          calculationType: l.calculationType,
          value: l.value || '0',
        })),
    });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Revise salary structure</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Stack direction="row" spacing={2}>
            <TextField
              label="Effective from"
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Basic (monthly)"
              value={basic}
              onChange={(e) => setBasic(e.target.value)}
            />
          </Stack>

          <Typography variant="subtitle2">Components</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Component</TableCell>
                <TableCell>Calc</TableCell>
                <TableCell>Value</TableCell>
                <TableCell align="right">Monthly</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {lines.map((l, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <TextField
                      select
                      size="small"
                      value={l.componentId}
                      onChange={(e) =>
                        setLines((ls) =>
                          ls.map((x, xi) =>
                            xi === i
                              ? { ...x, componentId: e.target.value }
                              : x,
                          ),
                        )
                      }
                      sx={{ minWidth: 180 }}
                    >
                      {assignable.map((c) => (
                        <MenuItem key={c.id} value={c.id}>
                          {c.name} ({c.type})
                        </MenuItem>
                      ))}
                    </TextField>
                  </TableCell>
                  <TableCell>
                    <TextField
                      select
                      size="small"
                      value={l.calculationType}
                      onChange={(e) =>
                        setLines((ls) =>
                          ls.map((x, xi) =>
                            xi === i
                              ? { ...x, calculationType: e.target.value }
                              : x,
                          ),
                        )
                      }
                    >
                      <MenuItem value={CalculationType.FIXED}>Fixed</MenuItem>
                      <MenuItem value={CalculationType.PERCENT_OF_BASIC}>
                        % of basic
                      </MenuItem>
                    </TextField>
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      value={l.value}
                      onChange={(e) =>
                        setLines((ls) =>
                          ls.map((x, xi) =>
                            xi === i ? { ...x, value: e.target.value } : x,
                          ),
                        )
                      }
                      sx={{ width: 90 }}
                    />
                  </TableCell>
                  <TableCell align="right">{preview(l)}</TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() =>
                        setLines((ls) => ls.filter((_, xi) => xi !== i))
                      }
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Button
            size="small"
            onClick={() =>
              setLines((ls) => [
                ...ls,
                {
                  componentId: assignable[0]?.id ?? '',
                  calculationType: CalculationType.FIXED,
                  value: '0',
                },
              ])
            }
          >
            Add component
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={submit}
          disabled={submitting || !effectiveFrom || Number(basic) <= 0}
        >
          {submitting ? 'Saving…' : 'Save structure'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
