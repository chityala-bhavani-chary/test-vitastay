/**
 * Phone install hint. Native Play / App Store builds are later (BIC-088 / 089).
 */
import { useEffect, useState } from 'react';
import { Alert, Box, Button, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { isStandaloneDisplay } from '../../pwa';

const DISMISS_KEY = 'vs_pwa_install_dismissed';

const isIos = () => {
  const ua = window.navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

const InstallAppBanner = () => {
  const [deferred, setDeferred] = useState(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandaloneDisplay()) return undefined;
    if (sessionStorage.getItem(DISMISS_KEY) === '1') return undefined;

    const onPrompt = (event) => {
      event.preventDefault();
      setDeferred(event);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    const narrow = window.matchMedia('(max-width: 900px)').matches;
    if (isIos()) {
      setIosHint(true);
      setVisible(true);
    } else if (narrow) {
      setVisible(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    try {
      await deferred.userChoice;
    } catch {
      /* user dismissed the browser sheet */
    }
    setDeferred(null);
    dismiss();
  };

  const copy = iosHint
    ? 'Install Vita Stay: tap Share, then Add to Home Screen. Play Store / App Store apps come later — this website is the phone app.'
    : deferred
      ? 'Install Vita Stay on this phone. Same search and booking as the website. Native store apps are not ready yet.'
      : 'On your phone, open the browser menu and choose Add to Home Screen. That is the Vita Stay app until the stores ship.';

  return (
    <Alert
      severity="info"
      sx={{ mb: 2, alignItems: 'center' }}
      action={(
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {deferred && (
            <Button color="inherit" size="small" onClick={install}>Install</Button>
          )}
          <IconButton aria-label="Dismiss install hint" size="small" color="inherit" onClick={dismiss}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      )}
    >
      {copy}
    </Alert>
  );
};

export default InstallAppBanner;
