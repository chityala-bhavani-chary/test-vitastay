import { useEffect, useState } from 'react';
import {
  Box, Grid, Card, CardContent, TextField, MenuItem, Button, Typography,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, CircularProgress,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { useSnackbar } from 'notistack';
import dayjs from 'dayjs';
import PageHeader from '../../components/common/PageHeader';
import StatusChip from '../../components/common/StatusChip';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import api, { extractData, extractPaginated, getErrorMessage } from '../../services/api';
import { atmosphereFilterSx, atmosphereSelectMenuProps } from '../../styles/atmosphere';

const AttendancePage = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [hostels, setHostels] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const { control, watch, setValue } = useForm({
    defaultValues: { hostel_id: '', date: dayjs().format('YYYY-MM-DD') },
  });

  const hostelId = watch('hostel_id');
  const date = watch('date');

  useEffect(() => {
    api.get('/hostels', { params: { limit: 100 } })
      .then(({ data }) => {
        const list = extractPaginated(data).data;
        setHostels(list);
        if (list.length > 0) setValue('hostel_id', String(list[0].id));
      })
      .catch(() => {});
  }, [setValue]);

  useEffect(() => {
    if (!hostelId) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [staffRes, attendanceRes] = await Promise.all([
          api.get('/staff', { params: { hostelId, limit: 100 } }),
          api.get('/staff/attendance', { params: { hostelId, date } }),
        ]);
        setStaffList(extractPaginated(staffRes.data).data);
        setAttendance(extractData(attendanceRes.data) || []);
      } catch (err) {
        enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [hostelId, date, enqueueSnackbar]);

  const getAttendanceStatus = (staffId) => {
    const record = attendance.find((a) => a.staff_id === staffId);
    return record?.status || 'absent';
  };

  const markAttendance = async (staffId, status) => {
    setSubmitting(true);
    try {
      await api.post('/staff/attendance', { staff_id: staffId, date, status });
      enqueueSnackbar('Attendance marked', { variant: 'success' });
      const { data } = await api.get('/staff/attendance', { params: { hostelId, date } });
      setAttendance(extractData(data) || []);
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      <PageHeader title="Staff Attendance" subtitle="Mark daily attendance for hostel staff" />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Controller
            name="hostel_id"
            control={control}
            render={({ field }) => (
              <TextField select fullWidth size="small" label="Hostel" {...field} sx={atmosphereFilterSx} SelectProps={{ MenuProps: atmosphereSelectMenuProps }}>
                {hostels.map((h) => <MenuItem key={h.id} value={String(h.id)}>{h.name}</MenuItem>)}
              </TextField>
            )}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <Controller
            name="date"
            control={control}
            render={({ field }) => (
              <TextField fullWidth size="small" label="Date" type="date" InputLabelProps={{ shrink: true }} {...field} sx={atmosphereFilterSx} />
            )}
          />
        </Grid>
      </Grid>

      {loading ? (
        <LoadingSkeleton variant="table" rows={5} />
      ) : (
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Staff Member</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Designation</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {staffList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">No staff members found</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  staffList.map((staff) => {
                    const status = getAttendanceStatus(staff.id);
                    return (
                      <TableRow key={staff.id} hover>
                        <TableCell>{staff.user?.first_name} {staff.user?.last_name}</TableCell>
                        <TableCell>{staff.designation?.replace(/_/g, ' ')}</TableCell>
                        <TableCell><StatusChip status={status} /></TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                            <Button size="small" variant={status === 'present' ? 'contained' : 'outlined'} color="success" disabled={submitting} onClick={() => markAttendance(staff.id, 'present')}>Present</Button>
                            <Button size="small" variant={status === 'absent' ? 'contained' : 'outlined'} color="error" disabled={submitting} onClick={() => markAttendance(staff.id, 'absent')}>Absent</Button>
                            <Button size="small" variant={status === 'half_day' ? 'contained' : 'outlined'} color="warning" disabled={submitting} onClick={() => markAttendance(staff.id, 'half_day')}>Half Day</Button>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
};

export default AttendancePage;
