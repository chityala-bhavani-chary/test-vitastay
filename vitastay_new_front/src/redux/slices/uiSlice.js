import { createSlice } from '@reduxjs/toolkit';

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    sidebarOpen: true,
    sidebarCollapsed: false,
    globalSearchOpen: false,
    notifications: [],
    unreadCount: 0,
  },
  reducers: {
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen: (state, action) => {
      state.sidebarOpen = action.payload;
    },
    toggleSidebarCollapsed: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    setGlobalSearchOpen: (state, action) => {
      state.globalSearchOpen = action.payload;
    },
    setNotifications: (state, action) => {
      state.notifications = action.payload;
      state.unreadCount = action.payload.filter((n) => !n.is_read).length;
    },
    markNotificationRead: (state, action) => {
      const notification = state.notifications.find((n) => n.id === action.payload);
      if (notification && !notification.is_read) {
        notification.is_read = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    },
    markAllNotificationsRead: (state) => {
      state.notifications.forEach((n) => { n.is_read = true; });
      state.unreadCount = 0;
    },
  },
});

export const {
  toggleSidebar,
  setSidebarOpen,
  toggleSidebarCollapsed,
  setGlobalSearchOpen,
  setNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} = uiSlice.actions;

export default uiSlice.reducer;
