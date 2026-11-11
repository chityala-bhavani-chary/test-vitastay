import { createSlice } from '@reduxjs/toolkit';
import { STORAGE_KEYS } from '../../utils/constants';

const getInitialMode = () => {
  const stored = localStorage.getItem(STORAGE_KEYS.THEME);
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const themeSlice = createSlice({
  name: 'theme',
  initialState: {
    mode: getInitialMode(),
  },
  reducers: {
    toggleTheme: (state) => {
      state.mode = state.mode === 'light' ? 'dark' : 'light';
      localStorage.setItem(STORAGE_KEYS.THEME, state.mode);
    },
    setTheme: (state, action) => {
      state.mode = action.payload;
      localStorage.setItem(STORAGE_KEYS.THEME, action.payload);
    },
  },
});

export const { toggleTheme, setTheme } = themeSlice.actions;
export default themeSlice.reducer;
