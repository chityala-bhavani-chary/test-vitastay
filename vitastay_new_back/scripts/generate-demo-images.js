/**
 * Builds royalty-free tester photos into vitastay_new_front/public/images/demo.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const outDir = path.join(__dirname, '..', '..', 'vitastay_new_front', 'public', 'images', 'demo');

const STILLS = [
  { file: 'exterior-1.jpg', caption: 'Building facade', kind: 'exterior', id: '1545324418-cc1a3fa10c00' },
  { file: 'exterior-2.jpg', caption: 'Street approach', kind: 'exterior', id: '1486406146926-c627a92ad1ab' },
  { file: 'exterior-3.jpg', caption: 'Main gate', kind: 'exterior', id: '1460317442991-0ec209397118' },
  { file: 'exterior-4.jpg', caption: 'Parking', kind: 'exterior', id: '1506521781260-9b0eec7a27f7' },
  { file: 'interior-1.jpg', caption: 'Lobby', kind: 'interior', id: '1566073771259-6a8506099945' },
  { file: 'interior-2.jpg', caption: 'Dining', kind: 'interior', id: '1517248135467-4c7edcad34c4' },
  { file: 'interior-3.jpg', caption: 'Kitchen', kind: 'interior', id: '1556912172-45b7abe8b7e1' },
  { file: 'interior-4.jpg', caption: 'Lounge', kind: 'interior', id: '1616486338812-3dadae4b4ace' },
  { file: 'interior-5.jpg', caption: 'Terrace', kind: 'interior', id: '1600585154340-be6161a56a0c' },
  { file: 'interior-6.jpg', caption: 'Wash area', kind: 'interior', id: '1584622650111-993a426fbf0a' },
  { file: 'room-1.jpg', caption: 'Window', kind: 'room', id: '1522771739844-6a9f6d5f14af' },
  { file: 'room-2.jpg', caption: 'Bed', kind: 'room', id: '1505693416388-ac5ce068fe85' },
  { file: 'room-3.jpg', caption: 'Bathroom', kind: 'room', id: '1552321554-5fefe8c9ef14' },
  { file: 'room-4.jpg', caption: 'Dormitory', kind: 'room', id: '1555854877-bab0e564b8d5' },
  { file: 'room-5.jpg', caption: 'Single room', kind: 'room', id: '1631049307264-da0ec9d70304' },
  { file: 'room-6.jpg', caption: 'Storage', kind: 'room', id: '1616594039964-ae9021a400a0' },
  { file: 'room-7.jpg', caption: 'Corner', kind: 'room', id: '1595526114035-0d45ed16cfbf' },
  { file: 'room-8.jpg', caption: 'Study desk', kind: 'room', id: '1560185893-a55cbc8c57bb' },
  { file: 'floor-1.jpg', caption: 'Corridor', kind: 'floor', id: '1502673530728-f99e1e4356b0' },
  { file: 'floor-2.jpg', caption: 'Floor lobby', kind: 'floor', id: '1493809842364-78817add7ffb' },
  { file: 'floor-3.jpg', caption: 'Stairs', kind: 'floor', id: '1600607687939-ce8a6c25118c' },
  { file: 'floor-4.jpg', caption: 'Floor wash', kind: 'floor', id: '1560448204-603b3fc33ddc' },
  { file: 'avatar-1.jpg', caption: 'Guest photo', kind: 'avatar', id: '1507003211169-0a1dd7228f2d' },
  { file: 'avatar-2.jpg', caption: 'Staff photo', kind: 'avatar', id: '1494790108377-be9c29b29330' },
];

const PALETTES = {
  exterior: ['#1B3A4B', '#4A7C8A', '#C4A574', '#E8D5B5'],
  interior: ['#5C4033', '#C4A484', '#F5E6D3', '#8B7355'],
  room: ['#3D5A80', '#98C1D9', '#E0FBFC', '#EE6C4D'],
  floor: ['#2B2D42', '#8D99AE', '#EDF2F4', '#D4A373'],
  avatar: ['#14213D', '#FCA311', '#E5E5E5', '#FFFFFF'],
};

const svgFor = (caption, kind, w = 1400, h = 933) => {
  const [a, b, c, d] = PALETTES[kind] || PALETTES.interior;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${a}"/>
        <stop offset="55%" stop-color="${b}"/>
        <stop offset="100%" stop-color="${c}"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <rect x="${w * 0.08}" y="${h * 0.22}" width="${w * 0.84}" height="${h * 0.56}" rx="28" fill="${d}" fill-opacity="0.28"/>
    <text x="50%" y="48%" text-anchor="middle" font-family="Arial, sans-serif" font-size="54" font-weight="700" fill="#fff">${caption}</text>
    <text x="50%" y="58%" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="#fff" fill-opacity="0.85">Vita Stay sample · royalty-free</text>
  </svg>`);
};

const fetchUnsplash = async (photoId) => {
  const url = `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=1400&q=78`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'VitaStayDemoImages/1.0' },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 8000) throw new Error('too small');
  return buf;
};

const writeStill = async (item) => {
  const dest = path.join(outDir, item.file);
  try {
    const buf = await fetchUnsplash(item.id);
    await sharp(buf).rotate().resize({ width: 1400, withoutEnlargement: true }).jpeg({ quality: 78 }).toFile(dest);
    return 'unsplash';
  } catch {
    await sharp(svgFor(item.caption, item.kind)).jpeg({ quality: 82 }).toFile(dest);
    return 'generated';
  }
};

const writePano = async () => {
  const dest = path.join(outDir, 'pano-1.jpg');
  const w = 2048;
  const h = 1024;
  const panoUrl = 'https://threejs.org/examples/textures/2294472375_24a3b8ef46_o.jpg';
  try {
    const res = await fetch(panoUrl, {
      headers: { 'User-Agent': 'VitaStayDemoImages/1.0' },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await sharp(buf).rotate().resize({ width: w, height: h, fit: 'cover' }).jpeg({ quality: 82 }).toFile(dest);
    return 'equirectangular';
  } catch {
    const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#7EC8E3"/>
          <stop offset="55%" stop-color="#C4A574"/>
          <stop offset="100%" stop-color="#5C4033"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#sky)"/>
      <text x="50%" y="52%" text-anchor="middle" font-family="Arial, sans-serif" font-size="42" font-weight="700" fill="#fff">Sample 360°</text>
    </svg>`);
    await sharp(svg).jpeg({ quality: 82 }).toFile(dest);
    return 'generated-equirect';
  }
};

const run = async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const sources = {};
  for (const item of STILLS) {
    sources[item.file] = await writeStill(item);
    console.log(item.file, sources[item.file]);
  }
  sources['pano-1.jpg'] = await writePano();
  console.log('pano-1.jpg', sources['pano-1.jpg']);

  const pick = (kind) => STILLS.filter((i) => i.kind === kind).map(({ file, caption }) => ({ file, caption }));
  const manifest = {
    license: 'Stills try Unsplash License (https://unsplash.com/license). Fallback art and the 360 file are original Vita Stay tester assets.',
    exterior: pick('exterior'),
    interior: pick('interior'),
    room: pick('room'),
    floor: pick('floor'),
    panorama: [{ file: 'pano-1.jpg', caption: 'Lobby 360°' }],
    avatar: pick('avatar'),
    sources,
  };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('Wrote', outDir);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
