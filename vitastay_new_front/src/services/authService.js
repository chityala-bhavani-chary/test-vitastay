import api, { extractData } from './api';
import authStorage from '../utils/authStorage';

const authService = {
  login: async ({ email, password, rememberMe, portal }) => {
    const path = portal === 'seeker' ? '/public/auth/login' : '/auth/login';
    const { data } = await api.post(path, { email, password, rememberMe });
    const result = extractData(data);
    authStorage.setAuth({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
      rememberMe: !!rememberMe,
    });
    return result;
  },

  logout: async () => {
    const refreshToken = authStorage.getRefreshToken();
    try {
      await api.post('/auth/logout', { refreshToken });
    } finally {
      authStorage.clearAuth();
    }
  },

  getProfile: async () => {
    const { data } = await api.get('/auth/profile');
    return extractData(data);
  },

  requestSeekerOtp: async ({ email, phone }) => {
    const { data } = await api.post('/public/auth/otp', { email, phone });
    return extractData(data);
  },

  registerSeeker: async (payload) => {
    const { data } = await api.post('/public/auth/register', payload);
    const result = extractData(data);
    authStorage.setAuth({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
      rememberMe: false,
    });
    return result;
  },

  forgotPassword: async (email) => {
    const { data } = await api.post('/auth/forgot-password', { email });
    return extractData(data);
  },

  resetPassword: async (payload) => {
    const { data } = await api.post('/auth/reset-password', payload);
    return extractData(data);
  },

  changePassword: async (payload) => {
    const { data } = await api.post('/auth/change-password', payload);
    return extractData(data);
  },

  getLoginHistory: async (params) => {
    const { data } = await api.get('/auth/login-history', { params });
    return data;
  },

  updateProfile: async (payload) => {
    const { data } = await api.put('/auth/profile', payload);
    return extractData(data);
  },

  uploadAvatar: async (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    const { data } = await api.post('/auth/avatar', formData);
    return extractData(data);
  },
};

export default authService;
