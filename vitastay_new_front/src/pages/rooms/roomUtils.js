import { brand } from '../../styles/theme';

export const BED_META = {
  vacant: { color: '#16A34A', label: 'Available' },
  occupied: { color: brand.navy, label: 'Occupied' },
  reserved: { color: '#E6A23C', label: 'Reserved' },
  maintenance: { color: '#D64545', label: 'Maintenance' },
};

export const roomCapacity = (room) => {
  const map = { single: 1, double: 2, triple: 3 };
  return map[room.room_type] || Number(room.sharing_type) || (room.beds?.length ?? 0);
};

export const roomPath = (room, suffix = '') => {
  const hostelId = room.hostel_id || room.hostel?.id;
  return `/rooms/${room.id}${suffix}${hostelId ? `?hostelId=${hostelId}` : ''}`;
};
