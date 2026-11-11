const { parseImageList, inferMimeType, LEGACY_MEDIA_TITLE } = require('../services/legacyMedia');

describe('legacy media JSON helpers', () => {
  it('parses hostel/room image JSON arrays and drops junk', () => {
    expect(parseImageList(null)).toEqual([]);
    expect(parseImageList([])).toEqual([]);
    expect(parseImageList([
      '/uploads/hostels/a.jpg',
      '/uploads/hostels/a.jpg',
      'http://evil',
      '/uploads/tenants/aadhar.jpg',
      '/uploads/complaints/x.jpg',
    ])).toEqual([
      '/uploads/hostels/a.jpg',
    ]);
    expect(parseImageList('["/uploads/rooms/b.png"]')).toEqual(['/uploads/rooms/b.png']);
    expect(parseImageList('/uploads/hostels/solo.webp')).toEqual(['/uploads/hostels/solo.webp']);
    expect(parseImageList([{ path: '/uploads/hostels/c.jpg' }])).toEqual(['/uploads/hostels/c.jpg']);
  });

  it('infers mime type from the stored path', () => {
    expect(inferMimeType('/uploads/hostels/x.jpg')).toBe('image/jpeg');
    expect(inferMimeType('/uploads/rooms/x.PNG')).toBe('image/png');
    expect(inferMimeType('/uploads/hostels/x.webp')).toBe('image/webp');
    expect(inferMimeType('/uploads/hostels/x.bin')).toBe('application/octet-stream');
  });

  it('keeps a recategorise title for imported rows', () => {
    expect(LEGACY_MEDIA_TITLE).toBe('Please recategorise');
  });
});
