import { useState } from 'react';
import {
  Button, CircularProgress, ListItemIcon, ListItemText, Menu, MenuItem,
} from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import GridOnIcon from '@mui/icons-material/GridOn';
import DescriptionIcon from '@mui/icons-material/Description';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { useSnackbar } from 'notistack';
import { getErrorMessage } from '../../services/api';
import { exportCsv, exportExcel, exportPdf } from '../../utils/exportData';
import { atmosphereOutlinedBtnSx } from '../../styles/atmosphere';

/** getData: async () => ({ title, subtitle?, columns, rows, summary? }) */
const ExportMenu = ({ getData, disabled, onAtmosphere = true }) => {
  const { enqueueSnackbar } = useSnackbar();
  const [anchor, setAnchor] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async (format) => {
    setAnchor(null);
    setBusy(true);
    try {
      const data = await getData();
      if (!data?.rows?.length) {
        enqueueSnackbar('Nothing to export for the current filters', { variant: 'info' });
        return;
      }
      if (format === 'excel') await exportExcel(data);
      else if (format === 'csv') exportCsv(data);
      else if (!exportPdf(data)) {
        enqueueSnackbar('Allow pop-ups to export as PDF', { variant: 'warning' });
        return;
      }
      if (format !== 'pdf') enqueueSnackbar(`Exported ${data.rows.length} record(s)`, { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="outlined"
        startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <FileDownloadIcon />}
        disabled={disabled || busy}
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={onAtmosphere ? atmosphereOutlinedBtnSx : undefined}
      >
        Export
      </Button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <MenuItem onClick={() => run('excel')}>
          <ListItemIcon><GridOnIcon fontSize="small" color="success" /></ListItemIcon>
          <ListItemText primary="Excel (.xlsx)" />
        </MenuItem>
        <MenuItem onClick={() => run('csv')}>
          <ListItemIcon><DescriptionIcon fontSize="small" color="primary" /></ListItemIcon>
          <ListItemText primary="CSV" />
        </MenuItem>
        <MenuItem onClick={() => run('pdf')}>
          <ListItemIcon><PictureAsPdfIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText primary="PDF / Print" />
        </MenuItem>
      </Menu>
    </>
  );
};

export default ExportMenu;
