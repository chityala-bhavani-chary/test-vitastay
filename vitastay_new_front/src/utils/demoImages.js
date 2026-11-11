import { getMediaUrl } from './constants';

export const DEMO_BASE = '/images/demo';

export const DEMO_PACK = {
  exterior: [
    { file: 'exterior-1.jpg', caption: 'Facade' },
    { file: 'exterior-2.jpg', caption: 'Street' },
    { file: 'exterior-3.jpg', caption: 'Gate' },
    { file: 'exterior-4.jpg', caption: 'Parking' },
  ],
  interior: [
    { file: 'interior-1.jpg', caption: 'Lobby' },
    { file: 'interior-2.jpg', caption: 'Dining' },
    { file: 'interior-3.jpg', caption: 'Kitchen' },
    { file: 'interior-4.jpg', caption: 'Lounge' },
    { file: 'interior-5.jpg', caption: 'Terrace' },
    { file: 'interior-6.jpg', caption: 'Wash' },
  ],
  room: [
    { file: 'room-1.jpg', caption: 'Window' },
    { file: 'room-2.jpg', caption: 'Bed' },
    { file: 'room-3.jpg', caption: 'Bathroom' },
    { file: 'room-4.jpg', caption: 'Dormitory' },
    { file: 'room-5.jpg', caption: 'Single room' },
    { file: 'room-6.jpg', caption: 'Storage' },
    { file: 'room-7.jpg', caption: 'Corner' },
    { file: 'room-8.jpg', caption: 'Study desk' },
  ],
  floor: [
    { file: 'floor-1.jpg', caption: 'Corridor' },
    { file: 'floor-2.jpg', caption: 'Lobby' },
    { file: 'floor-3.jpg', caption: 'Stairs' },
    { file: 'floor-4.jpg', caption: 'Wash' },
  ],
  panorama: [
    { file: 'pano-1.jpg', caption: 'Lobby 360°' },
  ],
  avatar: [
    { file: 'avatar-1.jpg', caption: 'Guest photo' },
    { file: 'avatar-2.jpg', caption: 'Staff photo' },
  ],
};

const filesFor = (kind) => (DEMO_PACK[kind] || DEMO_PACK.exterior).map((row) => row.file);

export const demoFileUrl = (file) => `${DEMO_BASE}/${file}`;

export const demoImage = (kind = 'exterior', seed = 0) => {
  const list = filesFor(kind);
  const index = Math.abs(Number(seed) || 0) % list.length;
  return demoFileUrl(list[index]);
};

export const listingCoverSrc = (item) => (
  getMediaUrl(item?.cover_thumb_url || item?.cover_url || item?.logo)
  || demoImage('exterior', item?.id || item?.code)
);

export const hostelLogoSrc = (hostel) => (
  getMediaUrl(hostel?.logo) || demoImage('exterior', hostel?.id)
);

export const personPhotoSrc = (photo, seed = 0) => (
  getMediaUrl(photo) || demoImage('avatar', seed)
);

export const fetchDemoFile = async (file) => {
  const res = await fetch(demoFileUrl(file));
  if (!res.ok) throw new Error(`Could not load sample ${file}`);
  const blob = await res.blob();
  const type = blob.type || 'image/jpeg';
  return new File([blob], file, { type, lastModified: Date.now() });
};
