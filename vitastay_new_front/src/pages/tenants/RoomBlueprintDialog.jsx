import { useEffect, useMemo, useState } from 'react';
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel,
  Paper, Stack, Switch, Tooltip, Typography, alpha,
} from '@mui/material';
import SingleBedIcon from '@mui/icons-material/SingleBed';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { brand } from '../../styles/theme';
import { formatCurrency } from '../../utils/constants';
import { BED_META } from '../rooms/roomUtils';

const vacantCount = (room) => (room.beds || []).filter((b) => b.status === 'vacant').length;

const sortBeds = (beds = []) => [...beds].sort(
  (a, b) => String(a.bed_number).localeCompare(String(b.bed_number), undefined, { numeric: true }),
);

const floorLabel = (floor) => (Number(floor) === 0 ? 'Ground Floor' : `Floor ${floor}`);

const RoomBlueprintDialog = ({
  open, onClose, rooms, roomTypeLabel, hostelName, selectedBedId, onConfirm,
}) => {
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [pick, setPick] = useState(null);

  useEffect(() => {
    if (!open) return;
    const room = rooms.find((r) => (r.beds || []).some((b) => b.id === selectedBedId));
    const bed = room?.beds.find((b) => b.id === selectedBedId);
    setPick(room && bed ? { room, bed } : null);
  }, [open, rooms, selectedBedId]);

  const floors = useMemo(() => {
    const visible = onlyAvailable ? rooms.filter((r) => vacantCount(r) > 0) : rooms;
    const grouped = visible.reduce((acc, room) => {
      const key = Number(room.floor ?? 0);
      (acc[key] = acc[key] || []).push(room);
      return acc;
    }, {});
    return Object.keys(grouped)
      .map(Number)
      .sort((a, b) => b - a)
      .map((floor) => ({
        floor,
        rooms: grouped[floor].sort((a, b) => String(a.room_number).localeCompare(String(b.room_number), undefined, { numeric: true })),
      }));
  }, [rooms, onlyAvailable]);

  const totalVacant = rooms.reduce((sum, r) => sum + vacantCount(r), 0);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h6" fontWeight={700}>Available Rooms — {roomTypeLabel}</Typography>
        <Typography variant="body2" color="text.secondary">
          {hostelName ? `${hostelName} · ` : ''}{rooms.length} room(s) · {totalVacant} bed(s) available. Click a green bed to select it.
        </Typography>
      </DialogTitle>
      <DialogContent dividers sx={{ bgcolor: (t) => (t.palette.mode === 'dark' ? 'background.default' : brand.mist) }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1} sx={{ mb: 2 }}>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            {Object.entries(BED_META).map(([key, meta]) => (
              <Stack key={key} direction="row" spacing={0.75} alignItems="center">
                <Box sx={{ width: 14, height: 14, borderRadius: 0.5, bgcolor: meta.color }} />
                <Typography variant="caption">{meta.label}</Typography>
              </Stack>
            ))}
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Box sx={{ width: 14, height: 14, borderRadius: 0.5, border: `2px solid ${brand.teal}`, bgcolor: alpha(brand.teal, 0.25) }} />
              <Typography variant="caption">Selected</Typography>
            </Stack>
          </Stack>
          <FormControlLabel
            control={<Switch size="small" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} />}
            label={<Typography variant="body2">Only rooms with free beds</Typography>}
          />
        </Stack>

        {floors.length === 0 && (
          <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
            No rooms of this type are available in the selected hostel.
          </Typography>
        )}

        {floors.map(({ floor, rooms: floorRooms }) => (
          <Paper key={floor} variant="outlined" sx={{ mb: 2, overflow: 'hidden' }}>
            <Box sx={{ px: 2, py: 1, bgcolor: brand.navy, color: '#fff', display: 'flex', justifyContent: 'space-between' }}>
              <Typography fontWeight={700} variant="body2">{floorLabel(floor)}</Typography>
              <Typography variant="caption">
                {floorRooms.reduce((s, r) => s + vacantCount(r), 0)} free bed(s)
              </Typography>
            </Box>
            <Box
              sx={{
                p: 2,
                display: 'grid',
                gap: 1.5,
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                backgroundImage: (t) => `linear-gradient(${alpha(t.palette.divider, 0.4)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(t.palette.divider, 0.4)} 1px, transparent 1px)`,
                backgroundSize: '16px 16px',
              }}
            >
              {floorRooms.map((room) => {
                const free = vacantCount(room);
                const isPickedRoom = pick?.room.id === room.id;
                return (
                  <Paper
                    key={room.id}
                    elevation={0}
                    sx={{
                      p: 1.25,
                      border: '2px solid',
                      borderColor: isPickedRoom ? brand.teal : free ? alpha('#16A34A', 0.5) : 'divider',
                      opacity: free ? 1 : 0.65,
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                      <Typography fontWeight={700}>Room {room.room_number}</Typography>
                      {room.is_ac && (
                        <Tooltip title="AC room"><AcUnitIcon fontSize="small" color="info" /></Tooltip>
                      )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {formatCurrency(room.rent)}/month · {free}/{room.beds?.length || 0} free
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.75, mt: 1 }}>
                      {sortBeds(room.beds).map((bed) => {
                        const meta = BED_META[bed.status] || BED_META.maintenance;
                        const selectable = bed.status === 'vacant';
                        const selected = pick?.bed.id === bed.id;
                        return (
                          <Tooltip key={bed.id} title={`Bed ${bed.bed_number} · ${meta.label}`}>
                            <span>
                              <Button
                                fullWidth
                                size="small"
                                disabled={!selectable}
                                onClick={() => setPick({ room, bed })}
                                sx={{
                                  minWidth: 0,
                                  flexDirection: 'column',
                                  py: 0.5,
                                  color: selected ? brand.tealDark : '#fff',
                                  bgcolor: selected ? alpha(brand.teal, 0.25) : meta.color,
                                  border: '2px solid',
                                  borderColor: selected ? brand.teal : 'transparent',
                                  '&:hover': { bgcolor: selected ? alpha(brand.teal, 0.35) : alpha(meta.color, 0.85) },
                                  '&.Mui-disabled': { color: '#fff', bgcolor: meta.color, opacity: 0.8 },
                                }}
                              >
                                {selected ? <CheckCircleIcon fontSize="small" /> : <SingleBedIcon fontSize="small" />}
                                <Typography variant="caption" fontWeight={700} lineHeight={1.2}>B{bed.bed_number}</Typography>
                              </Button>
                            </span>
                          </Tooltip>
                        );
                      })}
                    </Box>
                  </Paper>
                );
              })}
            </Box>
          </Paper>
        ))}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5, justifyContent: 'space-between' }}>
        <Box>
          {pick ? (
            <Chip
              color="success"
              label={`Room ${pick.room.room_number} · Bed ${pick.bed.bed_number} · ${formatCurrency(pick.room.rent)}/month`}
            />
          ) : (
            <Typography variant="body2" color="text.secondary">No bed selected</Typography>
          )}
        </Box>
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" disabled={!pick} onClick={() => onConfirm(pick.room, pick.bed)}>
            Confirm Bed
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
};

export default RoomBlueprintDialog;
