import { memo, useState, useCallback, useEffect, useRef } from 'react';
import {
  TextField, InputAdornment, IconButton, Paper, List, ListItemButton,
  ListItemText, Popper, ClickAwayListener, Box, CircularProgress, alpha,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import { useNavigate } from 'react-router-dom';
import api, { extractData, getErrorMessage } from '../../services/api';
import { brand } from '../../styles/theme';

const SEARCH_DELAY_MS = 350;

const SearchBar = ({ placeholder = 'Search...', onSearch, globalSearch = false, sx = {} }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const navigate = useNavigate();
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleSearch = useCallback(async (value) => {
    onSearch?.(value);

    if (globalSearch && value.length >= 2) {
      setAnchorEl(document.getElementById('global-search-input'));
      setLoading(true);
      try {
        const { data } = await api.get('/reports/search', { params: { q: value } });
        setResults(extractData(data) || []);
      } catch (err) {
        setResults([]);
      } finally {
        setLoading(false);
      }
    } else {
      setResults([]);
      setAnchorEl(null);
    }
  }, [onSearch, globalSearch]);

  const handleInput = (value) => {
    setQuery(value);
    clearTimeout(timerRef.current);
    // Typing waits for a pause so each keystroke doesn't hit the API; clearing applies at once.
    if (!value) handleSearch('');
    else timerRef.current = setTimeout(() => handleSearch(value), SEARCH_DELAY_MS);
  };

  const handleResultClick = (result) => {
    const routes = {
      tenant: `/tenants/${result.id}/edit`,
      room: `/rooms/${result.id}/edit`,
      hostel: `/hostels/${result.id}/edit`,
      staff: `/staff`,
    };
    const path = routes[result.type];
    if (path) navigate(path);
    setQuery('');
    setResults([]);
    setAnchorEl(null);
  };

  return (
    <ClickAwayListener onClickAway={() => { setAnchorEl(null); setResults([]); }}>
      <Box sx={{ position: 'relative', ...sx }}>
        <TextField
          id={globalSearch ? 'global-search-input' : undefined}
          size="small"
          fullWidth
          placeholder={placeholder}
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: alpha(brand.navy, 0.45) }} />
              </InputAdornment>
            ),
            endAdornment: query && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => handleInput('')} sx={{ color: alpha(brand.navy, 0.5) }}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: '#fff',
              color: brand.charcoal,
              borderRadius: 3,
              '& fieldset': { borderColor: 'transparent' },
              '&:hover fieldset': { borderColor: alpha(brand.navy, 0.12) },
              '&.Mui-focused fieldset': { borderColor: brand.teal },
            },
            '& .MuiInputBase-input::placeholder': {
              color: alpha(brand.navy, 0.45),
              opacity: 1,
            },
          }}
        />
        {globalSearch && (
          <Popper open={Boolean(anchorEl) && (loading || results.length > 0)} anchorEl={anchorEl} placement="bottom-start" sx={{ zIndex: 1300, width: anchorEl?.offsetWidth }}>
            <Paper elevation={8} sx={{ mt: 1, maxHeight: 300, overflow: 'auto', borderRadius: 2 }}>
              {loading ? (
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
                  <CircularProgress size={24} />
                </Box>
              ) : (
                <List dense disablePadding>
                  {results.map((result, i) => (
                    <ListItemButton key={i} onClick={() => handleResultClick(result)}>
                      <ListItemText
                        primary={result.title || result.name}
                        secondary={`${result.type} • ${result.subtitle || ''}`}
                      />
                    </ListItemButton>
                  ))}
                  {results.length === 0 && query.length >= 2 && (
                    <ListItemButton disabled>
                      <ListItemText primary="No results found" />
                    </ListItemButton>
                  )}
                </List>
              )}
            </Paper>
          </Popper>
        )}
      </Box>
    </ClickAwayListener>
  );
};

export default memo(SearchBar);
