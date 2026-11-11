import { useState, useEffect, useMemo } from 'react';
import { Outlet, useNavigate, useLocation, Link as RouterLink, NavLink } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, Drawer, AppBar, Toolbar, ListItemButton, ListItemIcon, ListItemText,
  IconButton, Avatar, Typography, Badge, Menu, MenuItem, Divider, Tooltip,
  useMediaQuery, useTheme, alpha,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import DashboardIcon from '@mui/icons-material/Dashboard';
import BusinessIcon from '@mui/icons-material/Business';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import PeopleIcon from '@mui/icons-material/People';
import PaymentsIcon from '@mui/icons-material/Payments';
import ReceiptIcon from '@mui/icons-material/Receipt';
import BadgeIcon from '@mui/icons-material/Badge';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import BuildIcon from '@mui/icons-material/Build';
import CampaignIcon from '@mui/icons-material/Campaign';
import GroupsIcon from '@mui/icons-material/Groups';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import InventoryIcon from '@mui/icons-material/Inventory';
import AssessmentIcon from '@mui/icons-material/Assessment';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SettingsIcon from '@mui/icons-material/Settings';
import EventNoteIcon from '@mui/icons-material/EventNote';
import InsightsIcon from '@mui/icons-material/Insights';
import CardMembershipIcon from '@mui/icons-material/CardMembership';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import NotificationsIcon from '@mui/icons-material/Notifications';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import useAuth from '../hooks/useAuth';
import { useEntitlements } from '../hooks/useEntitlements';
import useThemeHook from '../hooks/useTheme';
import SearchBar from '../components/common/SearchBar';
import { NAV_ITEMS, getInitials, getDashboardPath, getMediaUrl } from '../utils/constants';
import { setSidebarOpen, setNotifications, toggleSidebarCollapsed } from '../redux/slices/uiSlice';
import api, { extractData } from '../services/api';
import { brand } from '../styles/theme';
import BrandLockup from '../components/common/BrandLockup';

const DRAWER_COLLAPSED = 56;
const LABEL_CHAR_PX = 7.6;
const NAV_CHROME_PX = 12 + 20 + 8 + 14;

const drawerWidthForLabels = (labels) => {
  const longest = labels.reduce((max, label) => Math.max(max, String(label || '').length), 8);
  return Math.min(188, Math.max(148, Math.ceil(NAV_CHROME_PX + longest * LABEL_CHAR_PX)));
};

const NAV_SECTIONS = [
  { id: 'home', label: 'Home' },
  { id: 'property', label: 'Property' },
  { id: 'finance', label: 'Finance' },
  { id: 'ops', label: 'Operations' },
  { id: 'admin', label: 'More' },
];

const sectionForPath = (path) => {
  if (path.startsWith('/dashboard')) return 'home';
  if (path.startsWith('/hostels') || path.startsWith('/booking-requests') || path.startsWith('/listing-analytics') || path.startsWith('/rooms') || path.startsWith('/tenants') || path.startsWith('/super-admin')) return 'property';
  if (path.startsWith('/rent') || path.startsWith('/revenue') || path.startsWith('/expenses')) return 'finance';
  if (
    path.startsWith('/visitors') || path.startsWith('/complaints') || path.startsWith('/maintenance')
    || path.startsWith('/notices') || path.startsWith('/staff') || path.startsWith('/attendance')
    || path.startsWith('/inventory')
  ) return 'ops';
  return 'admin';
};

const ICON_MAP = {
  Dashboard: DashboardIcon,
  Business: BusinessIcon,
  MeetingRoom: MeetingRoomIcon,
  People: PeopleIcon,
  Payments: PaymentsIcon,
  Receipt: ReceiptIcon,
  Badge: BadgeIcon,
  ReportProblem: ReportProblemIcon,
  Build: BuildIcon,
  Campaign: CampaignIcon,
  Groups: GroupsIcon,
  EventAvailable: EventAvailableIcon,
  Inventory: InventoryIcon,
  Assessment: AssessmentIcon,
  TrendingUp: TrendingUpIcon,
  Settings: SettingsIcon,
  EventNote: EventNoteIcon,
  Insights: InsightsIcon,
  CardMembership: CardMembershipIcon,
  SupportAgent: SupportAgentIcon,
};

const DashboardLayout = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { user, logout, isSuperAdmin } = useAuth();
  const { ready: entitlementsReady, flags: entitlementFlags } = useEntitlements();
  const { mode, toggleTheme } = useThemeHook();
  const { sidebarOpen, sidebarCollapsed, unreadCount } = useSelector((state) => state.ui);
  const [anchorEl, setAnchorEl] = useState(null);

  useEffect(() => {
    dispatch(setSidebarOpen(!isMobile));
  }, [isMobile, dispatch]);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const { data } = await api.get('/settings/notifications', { params: { limit: 5 } });
        const notifications = extractData(data) || data.data || [];
        dispatch(setNotifications(Array.isArray(notifications) ? notifications : []));
      } catch {
        // Silently fail
      }
    };
    if (user) fetchNotifications();
  }, [user, dispatch]);

  const navSections = useMemo(() => {
    const navItems = NAV_ITEMS.filter((item) => {
      if (!item.roles.includes(user?.role)) return false;
      if (isSuperAdmin || !item.entitlement) return true;
      if (!entitlementsReady) return false;
      return Boolean(entitlementFlags[item.entitlement]);
    });
    return NAV_SECTIONS
      .map((section) => ({
        ...section,
        items: navItems.filter((item) => sectionForPath(item.path) === section.id),
      }))
      .filter((section) => section.items.length > 0);
  }, [user?.role, isSuperAdmin, entitlementsReady, entitlementFlags]);

  const expandedDrawerWidth = useMemo(
    () => drawerWidthForLabels(navSections.flatMap((section) => [
      section.label,
      ...section.items.map((item) => item.label),
    ])),
    [navSections],
  );
  const drawerWidth = sidebarCollapsed ? DRAWER_COLLAPSED : expandedDrawerWidth;

  const closeMobileNav = () => {
    if (isMobile) dispatch(setSidebarOpen(false));
  };

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, color: '#fff' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
          px: sidebarCollapsed ? 0.75 : 1.25,
          py: 1.25,
          minHeight: 56,
          width: '100%',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        <BrandLockup size={40} showName={!sidebarCollapsed} />
      </Box>
      <Divider sx={{ borderColor: alpha('#fff', 0.12) }} />
      <Box sx={{ flex: 1, px: 0.5, py: 0.75, overflowY: 'auto' }}>
        {navSections.map((section) => (
          <Box key={section.id} sx={{ mb: 0.25 }}>
            {!sidebarCollapsed && (
              <Typography
                sx={{
                  px: 1,
                  pt: 1,
                  pb: 0.25,
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: alpha('#fff', 0.42),
                }}
              >
                {section.label}
              </Typography>
            )}
            {section.items.map((item) => {
              const Icon = ICON_MAP[item.icon] || DashboardIcon;
              const to = item.path === '/dashboard' ? getDashboardPath(user?.role) : item.path;
              const isActive = location.pathname.startsWith(item.path);
              return (
                <Tooltip key={item.path} title={sidebarCollapsed ? item.label : ''} placement="right">
                  <ListItemButton
                    component={NavLink}
                    to={to}
                    onClick={closeMobileNav}
                    selected={isActive}
                    disableRipple
                    sx={{
                      borderRadius: 1.5,
                      mb: 0.25,
                      minHeight: 34,
                      py: 0.4,
                      justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                      px: sidebarCollapsed ? 0.5 : 1,
                      color: alpha('#fff', 0.85),
                      '&:hover': { bgcolor: alpha('#fff', 0.08) },
                      '&.Mui-selected': {
                        bgcolor: alpha(brand.teal, 0.22),
                        color: '#fff',
                        '&:hover': { bgcolor: alpha(brand.teal, 0.3) },
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: sidebarCollapsed ? 0 : 22,
                        justifyContent: 'center',
                        color: isActive ? brand.tealLight : alpha('#fff', 0.75),
                      }}
                    >
                      <Icon sx={{ fontSize: 18 }} />
                    </ListItemIcon>
                    {!sidebarCollapsed && (
                      <ListItemText
                        primary={item.label}
                        sx={{ flex: '0 1 auto', m: 0 }}
                        primaryTypographyProps={{
                          fontSize: '0.8125rem',
                          fontWeight: isActive ? 600 : 400,
                          lineHeight: 1.2,
                          noWrap: true,
                        }}
                      />
                    )}
                  </ListItemButton>
                </Tooltip>
              );
            })}
          </Box>
        ))}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100dvh', position: 'relative', bgcolor: brand.mist }}>
      <AppBar
        position="fixed"
        color="inherit"
        sx={{
          width: { md: sidebarOpen ? `calc(100% - ${drawerWidth}px)` : '100%' },
          ml: { md: sidebarOpen ? `${drawerWidth}px` : 0 },
          transition: theme.transitions.create(['width', 'margin'], { duration: theme.transitions.duration.shorter }),
          bgcolor: brand.navyDark,
          borderBottom: `1px solid ${alpha(brand.teal, 0.2)}`,
          color: '#fff',
          boxShadow: 'none',
          pt: 'env(safe-area-inset-top)',
        }}
      >
        <Toolbar sx={{ gap: 1, minHeight: '52px !important', px: { xs: 1.5, sm: 2 } }}>
          {isMobile && (
            <IconButton edge="start" onClick={() => dispatch(setSidebarOpen(!sidebarOpen))} sx={{ color: '#fff' }}>
              <MenuIcon />
            </IconButton>
          )}
          <Box sx={{ width: '100%', maxWidth: 480, display: { xs: 'none', sm: 'block' } }}>
            <SearchBar placeholder="Search tenants, rooms, hostels..." globalSearch />
          </Box>
          <Box sx={{ flex: 1 }} />
          <Tooltip title={mode === 'dark' ? 'Light mode' : 'Dark mode'}>
            <IconButton onClick={toggleTheme} sx={{ color: '#fff' }}>
              {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Notifications">
            <IconButton onClick={() => navigate('/notifications')} sx={{ color: '#fff' }}>
              <Badge badgeContent={unreadCount} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
          </Tooltip>
          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
            <Avatar
              src={getMediaUrl(user?.avatar) || undefined}
              sx={{ width: 36, height: 36, bgcolor: brand.teal, fontSize: '0.875rem' }}
            >
              {getInitials(user?.first_name, user?.last_name)}
            </Avatar>
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            PaperProps={{ sx: { minWidth: 200, borderRadius: 2, mt: 1 } }}
          >
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="subtitle2" fontWeight={600}>
                {user?.first_name} {user?.last_name}
              </Typography>
              <Typography variant="caption" color="text.secondary" textTransform="capitalize">
                {user?.role}
              </Typography>
            </Box>
            <Divider />
            <MenuItem component={RouterLink} to="/profile" onClick={() => setAnchorEl(null)}>
              <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
              Profile
            </MenuItem>
            <MenuItem onClick={() => { setAnchorEl(null); logout(); }}>
              <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Drawer
        variant={isMobile ? 'temporary' : 'persistent'}
        open={sidebarOpen}
        onClose={() => dispatch(setSidebarOpen(false))}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            transition: theme.transitions.create('width', { duration: theme.transitions.duration.shorter }),
            overflowX: 'hidden',
            bgcolor: brand.navyDark,
            borderRight: `1px solid ${alpha(brand.teal, 0.2)}`,
            color: '#fff',
            backgroundImage: 'none',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        {drawerContent}
        {!isMobile && (
          <Box sx={{ p: 0.75, borderTop: `1px solid ${alpha('#fff', 0.12)}` }}>
            <IconButton
              onClick={() => dispatch(toggleSidebarCollapsed())}
              sx={{ width: '100%', borderRadius: 2, color: alpha('#fff', 0.8) }}
            >
              <ChevronLeftIcon sx={{ transform: sidebarCollapsed ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
            </IconButton>
          </Box>
        )}
      </Drawer>

      <Box
        component="main"
        sx={{
          position: 'relative',
          zIndex: 1,
          flexGrow: 1,
          minWidth: 0,
          maxWidth: '100%',
          p: { xs: 1.5, sm: 2 },
          mt: '52px',
          width: { md: sidebarOpen ? `calc(100% - ${drawerWidth}px)` : '100%' },
          transition: theme.transitions.create(['width', 'margin'], { duration: theme.transitions.duration.shorter }),
          bgcolor: brand.mist,
          minHeight: 'calc(100dvh - 52px)',
        }}
        className="page-container"
      >
        <Outlet />
      </Box>
    </Box>
  );
};

export default DashboardLayout;
