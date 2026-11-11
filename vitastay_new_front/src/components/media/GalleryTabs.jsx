/**
 * Public listing gallery chips (MED-014) + open stills/360 (MED-015).
 * Always shows All / Outside / Inside / Rooms / Floors / 360° — empty categories stay visible.
 * Keyboard: Left/Right/Home/End on the tablist. Grid is 2 columns on mobile, 4 on desktop.
 * Tiles use thumbs only; 360 originals load in PanoramaViewer after tap.
 */
import { useMemo, useRef } from 'react';
import { Box, Chip, Typography } from '@mui/material';
import { brand } from '../../styles/theme';
import GalleryTile from './GalleryTile';
import ListingRoomCards from './ListingRoomCards';
import ListingFloorGroups from './ListingFloorGroups';
import { isPanoramaItem, isVideoItem, itemAlt, panoramaContext } from './mediaHelpers';

export { isPanoramaItem, isVideoItem, itemAlt, panoramaContext };

export const GALLERY_TABS = [
  { key: 'all', label: 'All', category: null },
  { key: 'exterior', label: 'Outside', category: 'exterior' },
  { key: 'interior_common', label: 'Inside', category: 'interior_common' },
  { key: 'room', label: 'Rooms', category: 'room' },
  { key: 'floor', label: 'Floors', category: 'floor' },
  { key: 'panorama_360', label: '360°', category: 'panorama_360' },
  { key: 'walkthrough_video', label: 'Video', category: 'walkthrough_video' },
];

const EMPTY_COPY = {
  all: 'No photos on this listing yet.',
  exterior: 'No outside photos yet.',
  interior_common: 'No inside photos yet.',
  room: 'No room photos yet.',
  floor: 'No floor photos yet.',
  panorama_360: 'No 360° yet.',
  walkthrough_video: 'No walkthrough video yet.',
};

const countFromItems = (items, category) => {
  if (!category) return items.length;
  return items.filter((item) => item.category === category).length;
};

const GalleryTabs = ({
  hostelName,
  items = [],
  rooms = {},
  floors = {},
  counts: countsProp,
  selected = 'all',
  onSelect,
  onOpenStill,
  onOpenPano,
  onOpenVideo,
}) => {
  const tabRefs = useRef([]);
  const counts = useMemo(() => {
    const next = {};
    GALLERY_TABS.forEach((tab) => {
      const fromApi = countsProp?.[tab.key === 'all' ? 'all' : tab.category || 'all'];
      next[tab.key] = Number.isFinite(fromApi) ? fromApi : countFromItems(items, tab.category);
    });
    return next;
  }, [countsProp, items]);

  const visible = useMemo(() => {
    if (selected === 'all') return items;
    return items.filter((item) => item.category === selected);
  }, [items, selected]);

  const selectedTab = GALLERY_TABS.find((tab) => tab.key === selected) || GALLERY_TABS[0];

  const focusTab = (index) => {
    const next = (index + GALLERY_TABS.length) % GALLERY_TABS.length;
    onSelect?.(GALLERY_TABS[next].key);
    requestAnimationFrame(() => tabRefs.current[next]?.focus());
  };

  const onTabKeyDown = (event, index) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusTab(index + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusTab(index - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusTab(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusTab(GALLERY_TABS.length - 1);
    }
  };

  return (
    <Box>
      <Box
        role="tablist"
        aria-label="Photo categories"
        sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2 }}
      >
        {GALLERY_TABS.map((tab, index) => {
          const active = selected === tab.key;
          return (
            <Chip
              key={tab.key}
              component="button"
              type="button"
              role="tab"
              aria-selected={active}
              id={`listing-tab-${tab.key}`}
              aria-controls="listing-gallery-panel"
              tabIndex={active ? 0 : -1}
              ref={(node) => { tabRefs.current[index] = node; }}
              clickable
              color={active ? 'primary' : 'default'}
              variant={active ? 'filled' : 'outlined'}
              label={`${tab.label} (${counts[tab.key] || 0})`}
              onClick={() => onSelect?.(tab.key)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              sx={{
                minHeight: 44,
                px: 1.25,
                fontWeight: 650,
                fontSize: 14,
                '&.MuiChip-filled.MuiChip-colorPrimary': {
                  color: '#fff',
                  bgcolor: brand.navy,
                },
              }}
            />
          );
        })}
      </Box>

      <Box
        role="tabpanel"
        id="listing-gallery-panel"
        aria-labelledby={`listing-tab-${selectedTab.key}`}
      >
        {selected === 'room' ? (
          <ListingRoomCards
            rooms={rooms}
            hostelName={hostelName}
            onOpenStill={onOpenStill}
            onOpenPano={onOpenPano}
          />
        ) : selected === 'floor' ? (
          <ListingFloorGroups
            floors={floors}
            hostelName={hostelName}
            onOpenStill={onOpenStill}
            onOpenPano={onOpenPano}
          />
        ) : visible.length === 0 ? (
          <Typography color="text.secondary">
            {EMPTY_COPY[selected] || 'Nothing in this category yet.'}
          </Typography>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
              gap: 1.25,
            }}
          >
            {visible.map((item, index) => (
              <GalleryTile
                key={item.id}
                item={item}
                stillPool={visible.filter((row) => !isPanoramaItem(row) && !isVideoItem(row))}
                onOpenStill={onOpenStill}
                onOpenPano={onOpenPano}
                onOpenVideo={onOpenVideo}
                alt={itemAlt(item, hostelName, index, visible.length, selectedTab.label)}
              />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default GalleryTabs;
