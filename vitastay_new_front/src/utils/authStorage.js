import { STORAGE_KEYS } from './constants';

const storages = [localStorage, sessionStorage];

const isRemembered = () => localStorage.getItem(STORAGE_KEYS.REMEMBER_ME) === 'true';

const getActiveStorage = () => {
  if (localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)) return localStorage;
  if (sessionStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)) return sessionStorage;
  return isRemembered() ? localStorage : sessionStorage;
};

export const authStorage = {
  isRemembered,
  getRememberMePreference: () => localStorage.getItem(STORAGE_KEYS.REMEMBER_ME) === 'true',

  getAccessToken: () =>
    localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)
    || sessionStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN),

  getRefreshToken: () =>
    localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)
    || sessionStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN),

  getUser: () => {
    const raw =
      localStorage.getItem(STORAGE_KEYS.USER)
      || sessionStorage.getItem(STORAGE_KEYS.USER);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  setAuth: ({ accessToken, refreshToken, user, rememberMe }) => {
    const storage = rememberMe ? localStorage : sessionStorage;
    const other = rememberMe ? sessionStorage : localStorage;

    localStorage.setItem(STORAGE_KEYS.REMEMBER_ME, rememberMe ? 'true' : 'false');

    storage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    storage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    storage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));

    other.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    other.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    other.removeItem(STORAGE_KEYS.USER);

    if (rememberMe && user?.email) {
      localStorage.setItem(STORAGE_KEYS.SAVED_EMAIL, user.email);
    } else {
      localStorage.removeItem(STORAGE_KEYS.SAVED_EMAIL);
    }
  },

  setAccessToken: (token) => {
    getActiveStorage().setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
  },

  setUser: (user) => {
    getActiveStorage().setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  },

  clearAuth: () => {
    storages.forEach((storage) => {
      storage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      storage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      storage.removeItem(STORAGE_KEYS.USER);
    });
  },

  getSavedEmail: () => localStorage.getItem(STORAGE_KEYS.SAVED_EMAIL) || '',
};

export default authStorage;
