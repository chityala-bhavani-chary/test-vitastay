/**
 * Attach royalty-free tester photos so listings, rooms, and 360 have something to show.
 */
const fs = require('fs');
const path = require('path');
const { PropertyMedia } = require('../models');
const mediaStorage = require('./mediaStorage');
const { getModelsForHostel } = require('../helpers/hostelContext');

const DEMO_DIR = path.join(__dirname, '..', '..', 'vitastay_new_front', 'public', 'images', 'demo');

const PACK = {
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
};

const demoAbs = (file) => path.join(DEMO_DIR, file);

const storeDemoFile = async (hostelId, fileName, isPano) => {
  const src = demoAbs(fileName);
  if (!fs.existsSync(src)) throw new Error(`Missing sample photo ${fileName}`);
  const dir = mediaStorage.hostelDir(hostelId);
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `demo-${fileName}`);
  if (!fs.existsSync(dest)) fs.copyFileSync(src, dest);
  const thumb = isPano
    ? await mediaStorage.writePanoPreview(dest)
    : await mediaStorage.writeThumbnail(dest);
  const stat = fs.statSync(dest);
  return {
    file_path: mediaStorage.toPublicPath(dest),
    thumb_path: thumb.thumbPath,
    mime_type: 'image/jpeg',
    file_size: stat.size,
    width: thumb.width,
    height: thumb.height,
  };
};

const createRow = async ({ hostel, userId, category, spec, extra, isCover, sortOrder }) => {
  const isPano = category === 'panorama_360';
  const stored = await storeDemoFile(hostel.id, spec.file, isPano);
  return PropertyMedia.create({
    hostel_id: hostel.id,
    category,
    capture_kind: isPano ? 'panorama_360' : 'photo',
    caption: spec.caption,
    file_path: stored.file_path,
    thumb_path: stored.thumb_path,
    mime_type: stored.mime_type,
    file_size: stored.file_size,
    width: stored.width,
    height: stored.height,
    sort_order: sortOrder,
    is_cover: Boolean(isCover),
    is_published: true,
    uploaded_by: userId,
    ...extra,
  });
};

const attachToHostel = async (hostel, user) => {
  if (!hostel?.id) throw new Error('Hostel is required');
  const userId = user?.id;
  if (!userId) throw new Error('User is required');

  const ctx = await getModelsForHostel(hostel);
  const rooms = await ctx.models.Room.findAll({
    where: ctx.isolated ? {} : { hostel_id: hostel.id },
    order: [['floor', 'ASC'], ['room_number', 'ASC']],
  });

  const existingRows = await PropertyMedia.findAll({
    where: { hostel_id: hostel.id },
    paranoid: false,
  });
  for (const row of existingRows) {
    const abs = mediaStorage.absoluteFromPublic(row.file_path);
    if (!abs || !fs.existsSync(abs)) {
      await row.destroy({ force: true });
    }
  }

  const live = await PropertyMedia.findAll({ where: { hostel_id: hostel.id } });
  const paths = new Set(live.map((row) => row.file_path));
  const hasCover = live.some((row) => row.is_cover);
  let sortOrder = live.reduce((max, row) => Math.max(max, Number(row.sort_order) || 0), -1) + 1;
  const added = [];

  const addIfNew = async (category, spec, extra = {}, isCover = false) => {
    const previewPath = `/uploads/media/${hostel.id}/demo-${spec.file}`;
    if (paths.has(previewPath)) return null;
    const row = await createRow({
      hostel,
      userId,
      category,
      spec,
      extra,
      isCover: isCover && !hasCover,
      sortOrder,
    });
    sortOrder += 1;
    paths.add(row.file_path);
    added.push(row);
    return row;
  };

  const exteriors = live.filter((row) => row.category === 'exterior').length;
  for (let i = exteriors; i < PACK.exterior.length; i += 1) {
    await addIfNew('exterior', PACK.exterior[i], {}, i === 0 && exteriors === 0);
  }

  const interiors = live.filter((row) => row.category === 'interior_common').length;
  for (let i = interiors; i < PACK.interior.length; i += 1) {
    await addIfNew('interior_common', PACK.interior[i]);
  }

  const typeRoom = {};
  rooms.forEach((room) => {
    const type = room.room_type || 'other';
    if (!typeRoom[type]) typeRoom[type] = room;
  });
  let roomFile = 0;
  for (const room of Object.values(typeRoom)) {
    const count = live.filter((row) => row.category === 'room' && Number(row.room_id) === Number(room.id)).length;
    for (let i = count; i < 2; i += 1) {
      const spec = PACK.room[roomFile % PACK.room.length];
      roomFile += 1;
      await addIfNew('room', spec, {
        room_id: room.id,
        room_number: room.room_number,
        floor_number: room.floor || null,
      });
    }
  }

  const floors = [...new Set(rooms.map((room) => Number(room.floor)).filter((n) => Number.isInteger(n) && n >= 1))];
  for (let index = 0; index < floors.length; index += 1) {
    const floor = floors[index];
    const count = live.filter((row) => row.category === 'floor' && Number(row.floor_number) === floor).length;
    if (count >= 1) continue;
    await addIfNew('floor', PACK.floor[index % PACK.floor.length], { floor_number: floor });
  }

  const panos = live.filter((row) => row.category === 'panorama_360').length;
  if (panos < 1) {
    await addIfNew('panorama_360', PACK.panorama[0], {
      floor_number: floors[0] || 1,
    });
  }

  if (!hostel.logo && fs.existsSync(demoAbs('exterior-1.jpg'))) {
    const logoDir = path.join(mediaStorage.uploadsRoot, 'hostels');
    fs.mkdirSync(logoDir, { recursive: true });
    const dest = path.join(logoDir, `demo-logo-${hostel.id}.jpg`);
    if (!fs.existsSync(dest)) fs.copyFileSync(demoAbs('exterior-1.jpg'), dest);
    const logoPath = mediaStorage.toPublicPath(dest);
    await hostel.update({ logo: logoPath });
    hostel.logo = logoPath;
  }

  return {
    added: added.length,
    logo: hostel.logo,
    message: added.length
      ? `Added ${added.length} sample photos for testing`
      : 'Sample photos are already on this hostel',
  };
};

module.exports = { attachToHostel, DEMO_DIR, PACK };
