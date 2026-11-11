/**
 * MED-020 UI/QA contracts that have no frontend Jest runner:
 * fixture file, Media Manager copy, gallery keyboard, 360 lazy-load, storage errors.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const {
  PANO_FIXTURE,
  PANO_WIDTH,
  PANO_HEIGHT,
  ensurePanoFixture,
  loadFrontEsmAsCjs,
} = require('./helpers/mediaTest');

const front = (...parts) => path.join(__dirname, '..', '..', 'vitastay_new_front', 'src', ...parts);

describe('TC-M media QA contracts', () => {
  test('tiny 2:1 JPEG fixture exists under 100 KB', async () => {
    const file = await ensurePanoFixture();
    expect(fs.existsSync(file)).toBe(true);
    expect(file).toBe(PANO_FIXTURE);
    const stat = fs.statSync(file);
    expect(stat.size).toBeGreaterThan(80);
    expect(stat.size).toBeLessThan(100 * 1024);
    const meta = await sharp(file).metadata();
    expect(meta.width).toBe(PANO_WIDTH);
    expect(meta.height).toBe(PANO_HEIGHT);
    expect(meta.width / meta.height).toBe(2);
    expect(meta.format).toBe('jpeg');
  });

  test('TC-M-12e GIF and oversized stills show inline errors (client helper)', () => {
    const {
      storageErrorForFile,
      LISTING_PHOTO_MAX_BYTES,
    } = loadFrontEsmAsCjs(front('utils', 'mediaUploadErrors.js'));

    const gif = storageErrorForFile({ name: 'lobby.gif', type: 'image/gif', size: 1200 });
    expect(gif).toMatch(/wrong type/i);
    expect(gif).toMatch(/GIF|HEIC/i);

    const huge = storageErrorForFile({
      name: 'facade.jpg',
      type: 'image/jpeg',
      size: LISTING_PHOTO_MAX_BYTES + 1,
    });
    expect(huge).toMatch(/too big/i);
    expect(huge).toMatch(/10 MB/i);

    const ok = storageErrorForFile({ name: 'gate.jpg', type: 'image/jpeg', size: 2000 });
    expect(ok).toBeNull();
  });

  test('TC-M-12d Media Manager has category tabs, checklist, disabled publish, preview', () => {
    const manager = fs.readFileSync(front('pages', 'hostels', 'HostelMediaPage.jsx'), 'utf8');
    expect(manager).toMatch(/Outside/);
    expect(manager).toMatch(/Inside/);
    expect(manager).toMatch(/Rooms/);
    expect(manager).toMatch(/Floors/);
    expect(manager).toMatch(/360/);
    expect(manager).toMatch(/Preview listing/);
    expect(manager).toMatch(/to=\{`\/hostels\/\$\{id\}\/listing`\}/);
    expect(manager).toMatch(/storageError &&/);

    const checklist = fs.readFileSync(front('components', 'media', 'PublishChecklist.jsx'), 'utf8');
    expect(checklist).toMatch(/Publish listing/);
    expect(checklist).toMatch(/disabled=\{saving \|\| !canPublish/);
    expect(checklist).toMatch(/not the same as hostel Active/);
    expect(checklist).toMatch(/\/listing\/publish/);
    expect(checklist).toMatch(/listing\/unpublish/);
  });

  test('TC-M-31 gallery chips stay visible; 2-col / 4-col; arrow keys', () => {
    const tabs = fs.readFileSync(front('components', 'media', 'GalleryTabs.jsx'), 'utf8');
    expect(tabs).toMatch(/key: 'all'/);
    expect(tabs).toMatch(/key: 'exterior'/);
    expect(tabs).toMatch(/key: 'interior_common'/);
    expect(tabs).toMatch(/key: 'room'/);
    expect(tabs).toMatch(/key: 'floor'/);
    expect(tabs).toMatch(/key: 'panorama_360'/);
    expect(tabs).toMatch(/EMPTY_COPY/);
    expect(tabs).toMatch(/No outside photos yet/);
    expect(tabs).toMatch(/gridTemplateColumns: \{ xs: 'repeat\(2, 1fr\)', md: 'repeat\(4, 1fr\)' \}/);
    expect(tabs).toMatch(/ArrowRight/);
    expect(tabs).toMatch(/ArrowLeft/);
    expect(tabs).toMatch(/Home/);
    expect(tabs).toMatch(/End/);
    expect(tabs).toMatch(/role="tablist"/);
  });

  test('TC-M-33 360 original loads only after open; reduced-motion / no-WebGL still', () => {
    const pano = fs.readFileSync(front('components', 'media', 'PanoramaViewer.jsx'), 'utf8');
    expect(pano).toMatch(/if \(!open \|\| !entered \|\| !url/);
    expect(pano).toMatch(/panorama: url/);
    expect(pano).toMatch(/prefersReducedMotion/);
    expect(pano).toMatch(/hasWebGL/);
    expect(pano).toMatch(/Esc to close/);
    expect(pano).toMatch(/touchAction: 'none'/);
  });

  test('TC-M-37 / TC-M-38 lightbox swipe + keyboard', () => {
    const light = fs.readFileSync(front('components', 'media', 'PhotoLightbox.jsx'), 'utf8');
    expect(light).toMatch(/SWIPE_PX = 50/);
    expect(light).toMatch(/onTouchStart/);
    expect(light).toMatch(/onTouchEnd/);
    expect(light).toMatch(/ArrowRight/);
    expect(light).toMatch(/ArrowLeft/);
    expect(light).toMatch(/Escape/);
    expect(light).toMatch(/swipe or arrows · Esc to close/);

    const listing = fs.readFileSync(front('pages', 'public', 'ListingPage.jsx'), 'utf8');
    expect(listing).toMatch(/PhotoLightbox/);
    expect(listing).toMatch(/PanoramaViewer/);
    expect(listing).toMatch(/panoItem \? getMediaUrl\(panoItem\.url\) : ''/);
    expect(listing).toMatch(/Create account to book/);
    expect(listing).toMatch(/Request to book/);
    expect(listing).toMatch(/\/bookings/);
    expect(listing).toMatch(/og:image/);
    expect(listing).toMatch(/Preview only/);
    expect(listing).toMatch(/share_image/);
  });
});
