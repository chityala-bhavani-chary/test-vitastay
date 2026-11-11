/**
 * Dev helper: write placeholder JPEGs for hostel 1 rows whose disk files are missing.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.join(__dirname, '..', 'uploads');

const toAbs = (publicPath) => {
  if (!publicPath || !publicPath.startsWith('/uploads/')) return null;
  return path.join(root, publicPath.slice('/uploads/'.length));
};

(async () => {
  const login = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@vitastay.com', password: 'Admin@123' }),
  });
  const body = await login.json();
  const token = body.data?.accessToken;
  const mediaRes = await fetch('http://localhost:5000/api/hostels/1/media', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await mediaRes.json();
  const items = json.data?.items || [];
  const written = [];

  for (const item of items) {
    for (const p of [item.url, item.thumb_url]) {
      const abs = toAbs(p);
      if (!abs) continue;
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      if (fs.existsSync(abs) && fs.statSync(abs).size > 100) continue;
      const isPano = item.category === 'panorama_360' && p === item.url;
      const buf = await sharp({
        create: {
          width: isPano ? 1600 : 800,
          height: isPano ? 800 : 600,
          channels: 3,
          background: { r: 0, g: 168, b: 150 },
        },
      }).jpeg({ quality: 70 }).toBuffer();
      fs.writeFileSync(abs, buf);
      written.push(p);
    }
  }

  const check = await fetch('http://127.0.0.1:5000/uploads/media/1/204ba2eb-04c3-4fa3-a455-25915d41fe0c_thumb.jpg');
  console.log(JSON.stringify({ items: items.length, wrote: written.length, thumb: check.status }, null, 2));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
