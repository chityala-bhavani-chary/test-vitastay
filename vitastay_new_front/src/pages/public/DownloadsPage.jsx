/**
 * WEB-008 / APP-004 — public Downloads page (store badges + desktop installers).
 * Store / binary URLs come from Vite env; missing links show Coming soon (APP-002+).
 */
import { Box, Button, Chip, Link, Stack, Typography, alpha } from '@mui/material';
import AndroidIcon from '@mui/icons-material/Android';
import AppleIcon from '@mui/icons-material/Apple';
import DesktopWindowsOutlinedIcon from '@mui/icons-material/DesktopWindowsOutlined';
import LaptopMacOutlinedIcon from '@mui/icons-material/LaptopMacOutlined';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import { Link as RouterLink } from 'react-router-dom';
import { brand } from '../../styles/theme';

const links = {
  play: import.meta.env.VITE_PLAY_STORE_URL || '',
  appStore: import.meta.env.VITE_APP_STORE_URL || '',
  windows: import.meta.env.VITE_WINDOWS_EXE_URL || '',
  mac: import.meta.env.VITE_MAC_DMG_URL || '',
};

const platforms = [
  {
    key: 'android',
    title: 'Android',
    subtitle: 'Google Play',
    icon: AndroidIcon,
    href: links.play,
    cta: 'Get on Google Play',
  },
  {
    key: 'ios',
    title: 'iPhone & iPad',
    subtitle: 'App Store',
    icon: AppleIcon,
    href: links.appStore,
    cta: 'Download on the App Store',
  },
  {
    key: 'windows',
    title: 'Windows',
    subtitle: 'Desktop EXE',
    icon: DesktopWindowsOutlinedIcon,
    href: links.windows,
    cta: 'Download for Windows',
  },
  {
    key: 'mac',
    title: 'Mac',
    subtitle: 'macOS app',
    icon: LaptopMacOutlinedIcon,
    href: links.mac,
    cta: 'Download for Mac',
  },
];

const detectHint = () => {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Windows/i.test(ua)) return 'windows';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'mac';
  return '';
};

const DownloadsPage = () => {
  const preferred = detectHint();

  return (
    <Box sx={{ maxWidth: 820, mx: 'auto' }}>
      <Typography variant="h3" fontWeight={800} letterSpacing="-0.03em" sx={{ mb: 1, color: brand.navy }}>
        Downloads
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 560 }}>
        Install Vita Stay for your phone or desktop. Search, availability, and booking use the same API as this website.
        Until store builds ship, use the website or Add to Home Screen on your phone.
      </Typography>

      <Stack spacing={1.5} sx={{ mb: 3 }}>
        {platforms.map((row) => {
          const Icon = row.icon;
          const ready = Boolean(row.href);
          const highlight = preferred === row.key;
          return (
            <Box
              key={row.key}
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 1.5,
                p: 2,
                borderRadius: 2,
                bgcolor: highlight ? alpha(brand.teal || brand.navy, 0.08) : '#fff',
                border: '1px solid',
                borderColor: highlight ? alpha(brand.navy, 0.28) : alpha(brand.navy, 0.1),
              }}
            >
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 1.5,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: alpha(brand.navy, 0.08),
                  color: brand.navy,
                }}
              >
                <Icon />
              </Box>
              <Box sx={{ flex: 1, minWidth: 160 }}>
                <Typography fontWeight={750}>{row.title}</Typography>
                <Typography variant="body2" color="text.secondary">{row.subtitle}</Typography>
              </Box>
              {ready ? (
                <Button
                  component={Link}
                  href={row.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant={highlight ? 'contained' : 'outlined'}
                  sx={{ fontWeight: 700 }}
                >
                  {row.cta}
                </Button>
              ) : (
                <Chip label="Coming soon" size="small" />
              )}
            </Box>
          );
        })}
      </Stack>

      <Box
        sx={{
          p: 2,
          borderRadius: 2,
          bgcolor: alpha(brand.navy, 0.04),
          border: `1px solid ${alpha(brand.navy, 0.08)}`,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <PhoneIphoneIcon fontSize="small" sx={{ color: brand.navy }} />
          <Typography fontWeight={700}>Use the website on your phone now</Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Open Find a PG in Safari or Chrome, then Add to Home Screen. Native Play / App Store / EXE / DMG
          links appear here when APP-002…006 publish.
        </Typography>
        <Button component={RouterLink} to="/search" variant="contained" sx={{ fontWeight: 700 }}>
          Find a PG
        </Button>
      </Box>
    </Box>
  );
};

export default DownloadsPage;
