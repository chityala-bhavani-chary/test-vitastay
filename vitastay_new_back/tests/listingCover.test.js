const { selectListingCover, toCoverObject } = require('../services/listingCover');

describe('listing cover pick', () => {
  test('uses the marked is_cover even if it is not first', () => {
    const picked = selectListingCover([
      { id: 1, category: 'exterior', is_cover: false },
      { id: 2, category: 'interior_common', is_cover: true, caption: 'lobby' },
    ]);
    expect(picked.id).toBe(2);
  });

  test('hero fallback prefers an outside photo over a room or toilet still', () => {
    const picked = selectListingCover([
      { id: 9, category: 'room', is_cover: false },
      { id: 8, category: 'interior_common', is_cover: false, caption: 'wash' },
      { id: 3, category: 'exterior', is_cover: false, caption: 'gate' },
    ]);
    expect(picked.id).toBe(3);
    expect(toCoverObject(picked).caption).toBe('gate');
  });
});
