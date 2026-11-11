import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { createAppTheme } from '../styles/theme';

const AppThemeProvider = ({ children }) => {
  const mode = useSelector((state) => state.theme.mode);
  const theme = useMemo(() => createAppTheme(mode), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      {children}
    </ThemeProvider>
  );
};

export default AppThemeProvider;
