import { useMemo, useState } from 'react';
import {
  Box, Button, Menu, MenuItem, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import {
  currentMonthKey,
  defaultPeriod,
  formatMonthLabel,
  listPreviousMonths,
} from '../../utils/periodRange';
import { brand } from '../../styles/theme';
import { alpha } from '@mui/material/styles';

const RANGES = [
  { value: 3, label: '3M' },
  { value: 6, label: '6M' },
  { value: 12, label: '12M' },
];

const PeriodToolbar = ({ value, onChange, monthsBack = 24, size = 'small' }) => {
  const period = value || defaultPeriod();
  const [anchor, setAnchor] = useState(null);
  const months = useMemo(() => listPreviousMonths(monthsBack), [monthsBack]);
  const thisKey = currentMonthKey();
  const monthMode = period.kind === 'month';
  const isCurrentMonth = monthMode && period.month === thisKey;
  const groupValue = isCurrentMonth ? 'month' : (monthMode ? null : Number(period.months));

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
      <ToggleButtonGroup
        exclusive
        size={size}
        value={groupValue}
        onChange={(_, next) => {
          if (next == null) return;
          if (next === 'month') onChange?.({ kind: 'month', month: thisKey });
          else onChange?.({ kind: 'range', months: next });
        }}
        sx={{
          bgcolor: '#fff',
          border: `1px solid ${alpha(brand.navy, 0.1)}`,
          boxShadow: `0 1px 4px ${alpha(brand.navy, 0.08)}`,
          borderRadius: 999,
          p: 0.25,
          '& .MuiToggleButtonGroup-grouped': {
            border: 0,
            mx: 0.15,
          },
          '& .MuiToggleButton-root': {
            py: 0.35,
            px: 1.15,
            fontSize: '0.72rem',
            fontWeight: 700,
            lineHeight: 1.4,
            textTransform: 'none',
            borderRadius: '999px !important',
            color: 'text.secondary',
            '&.Mui-selected': {
              bgcolor: `${brand.navy} !important`,
              color: '#fff',
              boxShadow: `0 1px 4px ${alpha(brand.navy, 0.28)}`,
            },
          },
        }}
      >
        <ToggleButton
          value="month"
          aria-label="This month"
          onClick={(event) => {
            if (isCurrentMonth || monthMode) setAnchor(event.currentTarget);
          }}
        >
          This month
        </ToggleButton>
        {RANGES.map((item) => (
          <ToggleButton key={item.value} value={item.value}>
            {item.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <Button
        size={size}
        variant={monthMode ? 'contained' : 'outlined'}
        endIcon={<ArrowDropDownIcon />}
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={{
          textTransform: 'none',
          py: 0.4,
          px: 1.25,
          fontSize: '0.75rem',
          minWidth: 0,
          borderRadius: 999,
        }}
      >
        {monthMode ? formatMonthLabel(period.month) : 'Pick a month'}
      </Button>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        slotProps={{ paper: { sx: { maxHeight: 320, minWidth: 168 } } }}
      >
        {months.map((ym, index) => (
          <MenuItem
            key={ym}
            selected={monthMode && period.month === ym}
            onClick={() => {
              setAnchor(null);
              onChange?.({ kind: 'month', month: ym });
            }}
          >
            {formatMonthLabel(ym)}
            {index === 0 ? ' · current' : ''}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
};

export default PeriodToolbar;
