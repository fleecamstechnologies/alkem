import type { ReactNode } from 'react';
import {
  AppBar,
  Box,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Toolbar,
  Typography,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import GroupsIcon from '@mui/icons-material/Groups';
import PaymentsIcon from '@mui/icons-material/Payments';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import BadgeIcon from '@mui/icons-material/Badge';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import BeachAccessIcon from '@mui/icons-material/BeachAccess';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import AssessmentIcon from '@mui/icons-material/Assessment';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import PersonalInjuryIcon from '@mui/icons-material/PersonalInjury';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import LocalPharmacyIcon from '@mui/icons-material/LocalPharmacy';
import PlaceIcon from '@mui/icons-material/Place';
import LogoutIcon from '@mui/icons-material/Logout';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { PunchWidget } from '../components/PunchWidget';
import {
  CLINIC_READ_ROLES,
  HR_READ_ROLES,
  HR_WRITE_ROLES,
  PHARMACY_READ_ROLES,
  UserRole,
} from '../types';

const DRAWER_WIDTH = 236;

interface NavItem {
  label: string;
  path: string;
  icon: ReactNode;
  roles?: UserRole[];
}

const MAIN_NAV: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: <DashboardIcon /> },
  { label: 'Customers', path: '/customers', icon: <GroupsIcon /> },
  { label: 'Payments', path: '/payments', icon: <PaymentsIcon /> },
  { label: 'Doctors', path: '/doctors', icon: <LocalHospitalIcon /> },
  {
    label: 'Field force',
    path: '/field',
    icon: <TravelExploreIcon />,
    roles: [UserRole.SUPER_ADMIN, UserRole.SALES_MANAGER],
  },
];

const HR_NAV: NavItem[] = [
  { label: 'Employees', path: '/employees', icon: <BadgeIcon />, roles: HR_READ_ROLES },
  { label: 'Attendance', path: '/attendance', icon: <EventAvailableIcon />, roles: HR_READ_ROLES },
  { label: 'Leave', path: '/leave', icon: <BeachAccessIcon />, roles: HR_READ_ROLES },
  { label: 'Payroll', path: '/payroll', icon: <ReceiptLongIcon />, roles: HR_READ_ROLES },
  { label: 'Offices', path: '/offices', icon: <PlaceIcon />, roles: HR_WRITE_ROLES },
];

const REPORTS_NAV: NavItem[] = [
  { label: 'Reports', path: '/reports', icon: <AssessmentIcon /> },
];

const PORTAL_NAV: NavItem[] = [
  { label: 'My space', path: '/portal', icon: <AccountCircleIcon /> },
  { label: 'My field', path: '/portal/field', icon: <TravelExploreIcon /> },
  { label: 'Approvals', path: '/portal/approvals', icon: <FactCheckIcon /> },
];

const CLINIC_NAV: NavItem[] = [
  {
    label: 'Patients',
    path: '/patients',
    icon: <PersonalInjuryIcon />,
    roles: CLINIC_READ_ROLES,
  },
  {
    label: 'Appointments',
    path: '/appointments',
    icon: <CalendarMonthIcon />,
    roles: CLINIC_READ_ROLES,
  },
  {
    label: 'Pharmacy',
    path: '/pharmacy',
    icon: <LocalPharmacyIcon />,
    roles: PHARMACY_READ_ROLES,
  },
];

const PHARMACY_NAV: NavItem[] = [
  { label: 'Pharmacy', path: '/pharmacy', icon: <LocalPharmacyIcon /> },
];

const ADMIN_NAV: NavItem[] = [
  {
    label: 'Imports',
    path: '/imports',
    icon: <UploadFileIcon />,
    roles: [
      UserRole.SUPER_ADMIN,
      UserRole.DATA_ENTRY,
      UserRole.FINANCE,
      UserRole.HR_ADMIN,
    ],
  },
  {
    label: 'Users',
    path: '/users',
    icon: <ManageAccountsIcon />,
    roles: [UserRole.SUPER_ADMIN, UserRole.HR_ADMIN],
  },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();

  const visible = (items: NavItem[]) =>
    items.filter(
      (item) => !item.roles || (user && item.roles.includes(user.role)),
    );

  const renderGroup = (heading: string | null, items: NavItem[]) => {
    const rows = visible(items);
    if (rows.length === 0) return null;
    return (
      <List
        dense
        subheader={
          heading ? (
            <ListSubheader disableSticky>{heading}</ListSubheader>
          ) : undefined
        }
      >
        {rows.map((item) => (
          <ListItemButton
            key={item.path}
            component={Link}
            to={item.path}
            selected={
              item.path === '/' || item.path === '/portal'
                ? location.pathname === item.path
                : location.pathname.startsWith(item.path)
            }
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>
    );
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 2 }}>
          <PaymentsIcon />
          <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
            Alkem HRMS
          </Typography>
          {user && (
            <>
              <PunchWidget />
              <Chip
                label={user.role.replaceAll('_', ' ')}
                color="secondary"
                size="small"
                sx={{ display: { xs: 'none', md: 'inline-flex' } }}
              />
              <Typography
                variant="body2"
                sx={{ display: { xs: 'none', sm: 'block' } }}
              >
                {user.name}
              </Typography>
              <IconButton color="inherit" onClick={logout} title="Log out">
                <LogoutIcon />
              </IconButton>
            </>
          )}
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
          },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>
          {user?.role === UserRole.EMPLOYEE ? (
            renderGroup(null, PORTAL_NAV)
          ) : user?.role === UserRole.PHARMACIST ? (
            <>
              {renderGroup('Pharmacy', PHARMACY_NAV)}
              <Divider />
              {renderGroup(null, REPORTS_NAV)}
            </>
          ) : user?.role === UserRole.RECEPTION ||
            user?.role === UserRole.CLINICIAN ? (
            <>
              {renderGroup('Clinic', CLINIC_NAV)}
              {user.role === UserRole.RECEPTION && (
                <>
                  <Divider />
                  {renderGroup(null, REPORTS_NAV)}
                </>
              )}
            </>
          ) : (
            <>
              {renderGroup(null, MAIN_NAV)}
              <Divider />
              {renderGroup('Clinic', CLINIC_NAV)}
              <Divider />
              {renderGroup('HR', HR_NAV)}
              <Divider />
              {renderGroup(null, REPORTS_NAV)}
              {user?.employeeId && (
                <>
                  <Divider />
                  {renderGroup('My space', PORTAL_NAV)}
                </>
              )}
              <Divider />
              {renderGroup('Admin', ADMIN_NAV)}
            </>
          )}
        </Box>
      </Drawer>
      <Box
        component="main"
        sx={{ flexGrow: 1, p: 3, minHeight: '100vh', width: 0 }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
