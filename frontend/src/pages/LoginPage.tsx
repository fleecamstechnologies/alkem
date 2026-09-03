import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import MedicationIcon from '@mui/icons-material/Medication';
import GroupsIcon from '@mui/icons-material/Groups';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useAuth } from '../auth/AuthContext';

const FEATURES = [
  {
    icon: <GroupsIcon />,
    title: 'Customers, workforce & payroll',
    body: 'CRM, HR, attendance and statutory Indian payroll in one place.',
  },
  {
    icon: <MonitorHeartIcon />,
    title: 'Patients & clinical records',
    body: 'Appointments, visits, prescriptions, labs and patient billing.',
  },
  {
    icon: <MedicationIcon />,
    title: 'Pharmacy & inventory',
    body: 'Batch + expiry (FEFO) stock, goods receipt and dispensing.',
  },
  {
    icon: <VerifiedUserIcon />,
    title: 'Role-based & audited',
    body: 'Every mutation is scoped by role and written to the audit log.',
  },
];

function redirectFor(role: string): string {
  if (role === 'EMPLOYEE') return '/portal';
  if (role === 'RECEPTION' || role === 'CLINICIAN') return '/patients';
  if (role === 'PHARMACIST') return '/pharmacy';
  return '/';
}

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={redirectFor(user.role)} replace />;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const loggedIn = await login(email, password);
      navigate(redirectFor(loggedIn.role));
    } catch {
      setError('Invalid email or password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* ---- brand panel ---- */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flex: '1 1 55%',
          position: 'relative',
          overflow: 'hidden',
          flexDirection: 'column',
          justifyContent: 'center',
          px: 8,
          color: 'common.white',
          background:
            'linear-gradient(135deg, #0d47a1 0%, #1565c0 45%, #00897b 100%)',
        }}
      >
        {/* decorative blobs */}
        <Box
          sx={{
            position: 'absolute',
            width: 460,
            height: 460,
            borderRadius: '50%',
            top: -160,
            right: -120,
            bgcolor: 'rgba(255,255,255,0.08)',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            width: 320,
            height: 320,
            borderRadius: '50%',
            bottom: -120,
            left: -80,
            bgcolor: 'rgba(255,255,255,0.06)',
          }}
        />

        <Box sx={{ position: 'relative', maxWidth: 460 }}>
          <Box
            sx={{
              width: 96,
              height: 96,
              borderRadius: 4,
              bgcolor: 'rgba(255,255,255,0.14)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 3,
              backdropFilter: 'blur(2px)',
            }}
          >
            <Box component="img" src="/logo.svg" alt="Alkem" sx={{ width: 68 }} />
          </Box>

          <Typography variant="h3" sx={{ fontWeight: 700, letterSpacing: -0.5 }}>
            Alkem HRMS
          </Typography>
          <Typography variant="h6" sx={{ mt: 1, fontWeight: 400, opacity: 0.9 }}>
            Integrated healthcare &amp; workforce management
          </Typography>

          <Stack spacing={2.5} sx={{ mt: 5 }}>
            {FEATURES.map((f) => (
              <Stack key={f.title} direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
                <Box
                  sx={{
                    flexShrink: 0,
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'rgba(255,255,255,0.16)',
                  }}
                >
                  {f.icon}
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 600 }}>{f.title}</Typography>
                  <Typography variant="body2" sx={{ opacity: 0.85 }}>
                    {f.body}
                  </Typography>
                </Box>
              </Stack>
            ))}
          </Stack>
        </Box>
      </Box>

      {/* ---- form panel ---- */}
      <Box
        sx={{
          flex: '1 1 45%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
          p: 3,
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, sm: 5 },
            width: '100%',
            maxWidth: 400,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 3,
          }}
        >
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 3 }}>
            <Box component="img" src="/logo.svg" alt="" sx={{ width: 40, height: 40 }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Alkem HRMS
            </Typography>
          </Stack>

          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Welcome back
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Sign in to your account to continue
          </Typography>

          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
              autoComplete="username"
            />
            <TextField
              label="Password"
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
              autoComplete="current-password"
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPw((s) => !s)}
                        edge="end"
                        tabIndex={-1}
                        aria-label="toggle password visibility"
                      >
                        {showPw ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={submitting}
              fullWidth
              sx={{ py: 1.25, mt: 0.5 }}
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
