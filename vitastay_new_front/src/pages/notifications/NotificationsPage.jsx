import { useEffect, useState, useCallback } from 'react';
import {
  Box, List, ListItem, ListItemText, ListItemAvatar, Avatar, Typography,
  IconButton, Button, Divider, Badge, alpha,
} from '@mui/material';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import CircleIcon from '@mui/icons-material/Circle';
import dayjs from 'dayjs';
import { useDispatch } from 'react-redux';
import { useSnackbar } from 'notistack';
import PageHeader from '../../components/common/PageHeader';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import api, { extractPaginated, getErrorMessage } from '../../services/api';
import { markAllNotificationsRead, markNotificationRead, setNotifications } from '../../redux/slices/uiSlice';
import { DEFAULT_PAGE_SIZE } from '../../utils/constants';
import { atmosphereOutlinedBtnSx } from '../../styles/atmosphere';
import { brand } from '../../styles/theme';

const NotificationsPage = () => {
  const dispatch = useDispatch();
  const { enqueueSnackbar } = useSnackbar();
  const [notifications, setLocalNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/settings/notifications', {
        params: { page: page + 1, limit: DEFAULT_PAGE_SIZE },
      });
      const { data: list, pagination } = extractPaginated(data);
      setLocalNotifications(list);
      setTotalCount(pagination.total);
      dispatch(setNotifications(list));
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, dispatch, enqueueSnackbar]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const handleMarkRead = async (id) => {
    try {
      await api.patch(`/settings/notifications/${id}/read`);
      dispatch(markNotificationRead(id));
      setLocalNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.patch('/settings/notifications/read-all');
      dispatch(markAllNotificationsRead());
      setLocalNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      enqueueSnackbar('All notifications marked as read', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <Box>
      <PageHeader title="Notifications" subtitle={`${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`}>
        {unreadCount > 0 && (
          <Button startIcon={<DoneAllIcon />} onClick={handleMarkAllRead} variant="outlined" size="small" sx={atmosphereOutlinedBtnSx}>
            Mark all read
          </Button>
        )}
      </PageHeader>

      {loading ? (
        <LoadingSkeleton variant="table" rows={5} />
      ) : notifications.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <NotificationsActiveIcon sx={{ fontSize: 64, color: alpha(brand.navy, 0.28), mb: 2 }} />
          <Typography color="text.secondary">No notifications yet</Typography>
        </Box>
      ) : (
        <List sx={{ bgcolor: 'background.paper', borderRadius: 3, overflow: 'hidden' }}>
          {notifications.map((notification, index) => (
            <Box key={notification.id}>
              {index > 0 && <Divider />}
              <ListItem
                secondaryAction={
                  !notification.is_read && (
                    <IconButton edge="end" size="small" onClick={() => handleMarkRead(notification.id)} title="Mark as read">
                      <DoneAllIcon fontSize="small" />
                    </IconButton>
                  )
                }
                sx={{
                  py: 2,
                  bgcolor: notification.is_read ? 'transparent' : 'action.hover',
                }}
              >
                <ListItemAvatar>
                  <Badge variant="dot" color="primary" invisible={notification.is_read}>
                    <Avatar sx={{ bgcolor: notification.is_read ? 'grey.300' : 'primary.main', width: 40, height: 40 }}>
                      <NotificationsActiveIcon fontSize="small" />
                    </Avatar>
                  </Badge>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {!notification.is_read && <CircleIcon sx={{ fontSize: 8, color: 'primary.main' }} />}
                      <Typography fontWeight={notification.is_read ? 400 : 600} fontSize="0.875rem">
                        {notification.title}
                      </Typography>
                    </Box>
                  }
                  secondary={
                    <>
                      <Typography variant="body2" color="text.secondary" component="span" display="block">
                        {notification.message}
                      </Typography>
                      <Typography variant="caption" color="text.disabled">
                        {dayjs(notification.created_at).format('DD MMM YYYY, HH:mm')}
                      </Typography>
                    </>
                  }
                />
              </ListItem>
            </Box>
          ))}
        </List>
      )}

      {totalCount > DEFAULT_PAGE_SIZE && (
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 2 }}>
          <Button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <Button disabled={(page + 1) * DEFAULT_PAGE_SIZE >= totalCount} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </Box>
      )}
    </Box>
  );
};

export default NotificationsPage;
