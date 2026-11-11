import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import authService from '../../services/authService';
import authStorage from '../../utils/authStorage';

const loadStoredAuth = () => {
  const token = authStorage.getAccessToken();
  const user = authStorage.getUser();
  return {
    token,
    user,
    isAuthenticated: !!token,
  };
};

export const login = createAsyncThunk(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const data = await authService.login(credentials);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || 'Login failed');
    }
  }
);

export const fetchProfile = createAsyncThunk(
  'auth/fetchProfile',
  async (_, { rejectWithValue }) => {
    try {
      const profile = await authService.getProfile();
      return profile;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch profile');
    }
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await authService.logout();
    } catch {
      // Continue logout even if API fails
    }
    return null;
  }
);

const initialState = {
  ...loadStoredAuth(),
  loading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      state.token = action.payload.accessToken;
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.error = null;
    },
    clearAuth: (state) => {
      state.token = null;
      state.user = null;
      state.isAuthenticated = false;
      state.error = null;
    },
    clearError: (state) => {
      state.error = null;
    },
    updateUser: (state, action) => {
      state.user = { ...state.user, ...action.payload };
      authStorage.setUser(state.user);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.accessToken;
        state.user = action.payload.user;
        state.isAuthenticated = true;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.user = action.payload;
        authStorage.setUser(action.payload);
      })
      .addCase(logout.fulfilled, (state) => {
        state.token = null;
        state.user = null;
        state.isAuthenticated = false;
        state.loading = false;
      });
  },
});

export const { setCredentials, clearAuth, clearError, updateUser } = authSlice.actions;
export default authSlice.reducer;
