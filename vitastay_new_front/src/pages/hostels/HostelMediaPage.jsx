/**
 * Hostel Media Manager — Outside / Inside / Rooms / Floors / 360° / Video (MED-012 + BIC-035).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, FormControlLabel, IconButton, MenuItem,
  Switch, Tab, Tabs, TextField, Tooltip, Typography, alpha, useMediaQuery, useTheme,
} from '@mui/material';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import ThreeSixtyIcon from '@mui/icons-material/ThreeSixty';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ReplayIcon from '@mui/icons-material/Replay';
import CollectionsOutlinedIcon from '@mui/icons-material/CollectionsOutlined';
import { useSnackbar } from 'notistack';
import PageHeader from '../../components/common/PageHeader';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import PublishChecklist from '../../components/media/PublishChecklist';
import PanoramaViewer from '../../components/media/PanoramaViewer';
import ImageSourceBar from '../../components/media/ImageSourceBar';
import CameraCaptureDialog from '../../components/media/CameraCaptureDialog';
import api, { extractData, getErrorMessage } from '../../services/api';
import { compressListingPhoto, inspectPanoramaFile } from '../../utils/compressImage';
import { storageErrorForFiles } from '../../utils/mediaUploadErrors';
import { getMediaUrl } from '../../utils/constants';
import { brand } from '../../styles/theme';
import useAuth from '../../hooks/useAuth';

const TABS = {
  outside: {
    key: 'outside',
    category: 'exterior',
    min: 3,
    title: 'Outside photos',
    subtitle: 'Building, gate, street, parking — seekers decide in a few seconds from these shots',
    crumb: 'Outside',
    heading: 'Outside',
    dropLabel: 'Drop outside photos here',
    empty: 'Add outside photos first. Listings need a visual pack before tenants can book.',
    alert:
      'Shot list: Building facade — the face seekers see first · Main gate / entrance · Street or approach from the road · Parking, if you have it. Do not paste photos from Google or another listing. We compress large files but keep the building face readable.',
    captionPlaceholder: 'Caption (gate, parking…)',
    chipReady: '3+ outside photos',
    uploadOne: 'Outside photo uploaded',
    uploadMany: (n) => `${n} outside photos uploaded`,
    deleteTitle: 'Remove this outside photo?',
    autoCoverIfNone: true,
    hints: ['Facade', 'Gate', 'Street', 'Parking'],
  },
  inside: {
    key: 'inside',
    category: 'interior_common',
    min: 4,
    title: 'Inside PG photos',
    subtitle: 'Lobby, dining, kitchen, lounge, wash, terrace — the “home” of a maintained PG, not a bedroom',
    crumb: 'Inside PG',
    heading: 'Inside PG',
    dropLabel: 'Drop inside / common-area photos here',
    empty: 'No inside photos yet. Start with lobby and dining — seekers judge cleanliness here.',
    alert:
      'Shot list: Lobby / reception · Dining hall · Kitchen · Lounge / TV · Wash area · Terrace or sit-out · Store room last. Captions are optional. Use the arrows so dining appears before the store room. Do not dump bedroom interiors here — that hides mess or oversells a room.',
    captionPlaceholder: 'Caption (lobby, dining…)',
    chipReady: '4+ inside photos',
    uploadOne: 'Inside photo uploaded',
    uploadMany: (n) => `${n} inside photos uploaded`,
    deleteTitle: 'Remove this inside photo?',
    autoCoverIfNone: false,
    hints: ['Lobby', 'Dining', 'Kitchen', 'Lounge', 'Wash', 'Terrace', 'Store room'],
  },
  rooms: {
    key: 'rooms',
    category: 'room',
    min: 2,
    title: 'Room photos',
    subtitle: 'Window, bed, bathroom of THAT room — seekers will not book a type they cannot see',
    crumb: 'Rooms',
    heading: 'Inside room',
    dropLabel: 'Drop photos of this room here',
    empty: 'No photos for this room yet. Shoot the window, the bed, and the bathroom.',
    alert:
      'Pick a room first. At least 2 photos per listed room type (single, double, triple, dormitory). Do not use a different room to sell this one. Captions optional — Window, Bed, Bathroom help seekers.',
    captionPlaceholder: 'Caption (window, bed, bathroom…)',
    chipReady: '2+ photos for this type',
    uploadOne: 'Room photo uploaded',
    uploadMany: (n) => `${n} room photos uploaded`,
    deleteTitle: 'Remove this room photo?',
    autoCoverIfNone: false,
    hints: ['Window', 'Bed', 'Bathroom', 'Storage', 'Corner'],
  },
  floors: {
    key: 'floors',
    category: 'floor',
    min: 1,
    title: 'Floor photos',
    subtitle: 'Corridor, floor lobby, floor wash — seekers want to know if their floor is dark or bright',
    crumb: 'Floors',
    heading: 'Floor-wise',
    dropLabel: 'Drop photos of this floor here',
    empty: 'No photos for this floor yet. Shoot the corridor and the floor wash area.',
    alert:
      'Pick a floor from 1 through the hostel’s floor count. At least 1 photo per floor that has bookable rooms. Floor 99 on a 4-floor PG is rejected. Captions optional — Corridor, Lobby, Wash.',
    captionPlaceholder: 'Caption (corridor, wash…)',
    chipReady: 'floors covered',
    uploadOne: 'Floor photo uploaded',
    uploadMany: (n) => `${n} floor photos uploaded`,
    deleteTitle: 'Remove this floor photo?',
    autoCoverIfNone: false,
    hints: ['Corridor', 'Lobby', 'Wash', 'Stairs'],
  },
  360: {
    key: '360',
    category: 'panorama_360',
    min: 1,
    requiredForPublish: false,
    title: '360° panoramas',
    subtitle: 'Recommended — seekers love looking around. Not required to publish',
    crumb: '360°',
    heading: '360°',
    dropLabel: 'Drop a 360° (equirectangular) photo here',
    empty: 'No 360° yet (optional to publish). Export a wide ~2:1 JPEG or WebP from a 360 camera or phone 360 mode.',
    alert:
      'Recommended, not required to publish. Upload a 360° (equirectangular) photo, usually 2:1. Phone 360 mode or a 360 camera works. A normal wide photo is not a 360. 25 MB max. Listings without a 360 show a “No 360 yet” badge for seekers.',
    captionPlaceholder: 'Caption (entrance, lobby…)',
    chipReady: '1+ 360°',
    uploadOne: '360° uploaded',
    uploadMany: (n) => `${n} 360° files uploaded`,
    deleteTitle: 'Remove this 360°?',
    autoCoverIfNone: false,
    hints: ['Entrance', 'Lobby', 'Dining', 'Room', 'Floor'],
  },
  video: {
    key: 'video',
    category: 'walkthrough_video',
    min: 0,
    requiredForPublish: false,
    title: 'Walkthrough video',
    subtitle: 'Optional short MP4 — does not replace 360° and never blocks publish',
    crumb: 'Video',
    heading: 'Video',
    dropLabel: 'Drop an MP4 walkthrough here',
    empty: 'No walkthrough video yet. Upload a short MP4 (max 50 MB). Transcoding comes later.',
    alert:
      'Optional. Short MP4 walkthrough for seekers who already have a reel. Does not replace 360°. Max 50 MB. No autoplay with sound on the public listing.',
    captionPlaceholder: 'Caption (entrance tour…)',
    chipReady: '1+ video',
    uploadOne: 'Walkthrough video uploaded',
    uploadMany: (n) => `${n} walkthrough videos uploaded`,
    deleteTitle: 'Remove this walkthrough video?',
    autoCoverIfNone: false,
    hints: ['Entrance', 'Common area', 'Room'],
    accept: 'video/mp4,.mp4',
  },
};

const roomLabel = (room) => {
  const type = String(room.room_type || '').replace(/_/g, ' ');
  const ac = room.is_ac ? ' AC' : '';
  return `${room.room_number} · ${type}${ac} · floor ${room.floor}`;
};

const tabFromSearch = (searchParams) => {
  const raw = searchParams.get('tab');
  if (raw === 'inside' || raw === 'rooms' || raw === 'floors' || raw === '360' || raw === 'video') return raw;
  return 'outside';
};

const HostelMediaPage = () => {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { isSuperAdmin, isOwner, isSupervisor } = useAuth();
  const theme = useTheme();
  const wide = useMediaQuery(theme.breakpoints.up('md'));
  const inputRef = useRef(null);
  const [hostel, setHostel] = useState(null);
  const [togglingSupervisorMedia, setTogglingSupervisorMedia] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [packTick, setPackTick] = useState(0);
  const [rooms, setRooms] = useState([]);
  const [panoRoomId, setPanoRoomId] = useState('');
  const [panoFloor, setPanoFloor] = useState('');
  const [panoViewFloor, setPanoViewFloor] = useState('');
  const [storageError, setStorageError] = useState('');
  const [viewing, setViewing] = useState(null);
  const [cover, setCoverMeta] = useState(null);
  const [quota, setQuota] = useState({ used: 0, max: 200, remaining: 200 });
  const [showRemoved, setShowRemoved] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [replacingId, setReplacingId] = useState(null);
  const replaceInputRef = useRef(null);
  const [panoCaptureOpen, setPanoCaptureOpen] = useState(false);
  const [seedingDemo, setSeedingDemo] = useState(false);

  const tabKey = tabFromSearch(searchParams);
  const tab = TABS[tabKey];
  const roomParam = searchParams.get('room');
  const floorParam = searchParams.get('floor');

  const load = useCallback(async () => {
    const requests = [
      api.get(`/hostels/${id}`),
      api.get(`/hostels/${id}/media`, {
        params: { category: tab.category, include_deleted: showRemoved ? 'true' : undefined },
      }),
    ];
    if (tab.category === 'room' || tab.category === 'floor' || tab.category === 'panorama_360') {
      requests.push(api.get(`/hostels/${id}/blueprint`));
    }
    const [hostelRes, mediaRes, blueprintRes] = await Promise.all(requests);
    setHostel(extractData(hostelRes));
    const payload = extractData(mediaRes);
    setItems(payload.items || []);
    setCoverMeta(payload.cover || null);
    if (payload.quota) setQuota(payload.quota);
    if (blueprintRes) {
      const plan = extractData(blueprintRes);
      setRooms(plan.rooms || []);
    }
    setPackTick((n) => n + 1);
  }, [id, tab.category, showRemoved]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        await load();
      } catch (err) {
        if (!cancelled) {
          enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
          navigate('/hostels');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [load, enqueueSnackbar, navigate]);

  const selectedRoom = useMemo(() => {
    if (tabKey !== 'rooms' || !rooms.length) return null;
    return rooms.find((room) => String(room.id) === String(roomParam)) || rooms[0];
  }, [tabKey, rooms, roomParam]);

  const maxFloors = Math.max(
    Number(hostel?.total_floors) || 1,
    ...rooms.map((room) => Number(room.floor) || 0),
    1
  );
  const floorOptions = useMemo(
    () => Array.from({ length: maxFloors }, (_, i) => i + 1),
    [maxFloors]
  );
  const floorsWithRooms = useMemo(
    () => [...new Set(
      rooms.map((room) => Number(room.floor)).filter((n) => Number.isInteger(n) && n >= 1)
    )].sort((a, b) => a - b),
    [rooms]
  );

  const selectedFloor = useMemo(() => {
    if (tabKey !== 'floors') return null;
    const requested = Number(floorParam);
    if (Number.isInteger(requested) && requested >= 1 && requested <= maxFloors) return requested;
    return floorsWithRooms[0] || 1;
  }, [tabKey, floorParam, maxFloors, floorsWithRooms]);

  const liveItems = useMemo(() => items.filter((item) => !item.deleted_at), [items]);
  const removedItems = useMemo(() => items.filter((item) => item.deleted_at), [items]);

  const visibleItems = useMemo(() => {
    if (tabKey === 'rooms') {
      if (!selectedRoom) return [];
      return liveItems.filter((item) => Number(item.room_id) === Number(selectedRoom.id));
    }
    if (tabKey === 'floors') {
      if (!selectedFloor) return [];
      return liveItems.filter((item) => Number(item.floor_number) === Number(selectedFloor));
    }
    if (tabKey === '360' && panoViewFloor) {
      return liveItems.filter((item) => Number(item.floor_number) === Number(panoViewFloor));
    }
    return liveItems;
  }, [tabKey, liveItems, selectedRoom, selectedFloor, panoViewFloor]);

  const typeStats = useMemo(() => {
    const byType = {};
    rooms.forEach((room) => {
      const type = room.room_type || 'other';
      if (!byType[type]) byType[type] = { type, roomIds: new Set(), count: 0 };
      byType[type].roomIds.add(Number(room.id));
    });
    liveItems.forEach((item) => {
      Object.values(byType).forEach((row) => {
        if (row.roomIds.has(Number(item.room_id))) row.count += 1;
      });
    });
    return Object.values(byType);
  }, [rooms, liveItems]);

  const typesReady = typeStats.length > 0 && typeStats.every((row) => row.count >= 2);

  const floorStats = useMemo(
    () => floorsWithRooms.map((floor) => ({
      floor,
      count: liveItems.filter((item) => Number(item.floor_number) === floor).length,
    })),
    [floorsWithRooms, liveItems]
  );
  const floorsReady = floorStats.every((row) => row.count >= 1);

  const hasCoverSomewhere = Boolean(cover?.id);

  const setTab = (next) => {
    if (next === 'outside') setSearchParams({});
    else if (next === 'rooms' && selectedRoom) setSearchParams({ tab: 'rooms', room: String(selectedRoom.id) });
    else if (next === 'floors' && selectedFloor) setSearchParams({ tab: 'floors', floor: String(selectedFloor) });
    else setSearchParams({ tab: next });
  };

  const pickRoom = (roomId) => {
    setSearchParams({ tab: 'rooms', room: String(roomId) });
  };

  const pickFloor = (floor) => {
    setSearchParams({ tab: 'floors', floor: String(floor) });
  };

  const acceptFiles = async (fileList, { category } = {}) => {
    const picked = [...(fileList || [])];
    if (!picked.length) return;
    const uploadCategory = category || tab.category;
    if (uploadCategory === 'room' && !selectedRoom) {
      enqueueSnackbar('Pick a room first', { variant: 'warning' });
      return;
    }
    if (uploadCategory === 'floor' && !selectedFloor) {
      enqueueSnackbar('Pick a floor first', { variant: 'warning' });
      return;
    }
    if (picked.length > 40) {
      enqueueSnackbar('Upload at most 40 files at once', { variant: 'warning' });
      return;
    }
    if (picked.length > quota.remaining) {
      enqueueSnackbar(`Hostel can hold ${quota.max} photos. ${quota.remaining} remaining.`, { variant: 'warning' });
      return;
    }
    const clientErr = storageErrorForFiles(picked, {
      panorama: uploadCategory === 'panorama_360',
      video: uploadCategory === 'walkthrough_video',
    });
    if (clientErr) {
      setStorageError(clientErr);
      enqueueSnackbar(clientErr, { variant: 'error' });
      return;
    }
    setStorageError('');
    setUploading(true);
    try {
      const prepared = [];
      let aspectWarned = false;
      for (const file of picked) {
        if (uploadCategory === 'walkthrough_video') {
          prepared.push(file);
        } else if (uploadCategory === 'panorama_360') {
          const inspected = await inspectPanoramaFile(file);
          if (!inspected.aspectOk && !aspectWarned) {
            aspectWarned = true;
            enqueueSnackbar(
              'This file is not ~2:1. It may look stretched in the viewer — uploading anyway if it is a real 360.',
              { variant: 'warning' }
            );
          }
          prepared.push(inspected.file);
        } else {
          prepared.push(await compressListingPhoto(file));
        }
      }
      const form = new FormData();
      form.append('category', uploadCategory);
      if (uploadCategory === 'room') form.append('room_id', String(selectedRoom.id));
      if (uploadCategory === 'floor') form.append('floor_number', String(selectedFloor));
      if (uploadCategory === 'panorama_360' && (panoRoomId || selectedRoom)) {
        form.append('room_id', String(panoRoomId || selectedRoom.id));
      }
      if (uploadCategory === 'panorama_360' && (panoFloor || selectedFloor)) {
        form.append('floor_number', String(panoFloor || selectedFloor));
      }
      prepared.forEach((file) => form.append('files', file));
      if (uploadCategory === 'exterior' && tab.autoCoverIfNone && !hasCoverSomewhere) form.append('is_cover', 'true');
      await api.post(`/hostels/${id}/media`, form, { timeout: 120000 });
      const uploadedTab = Object.values(TABS).find((row) => row.category === uploadCategory) || tab;
      enqueueSnackbar(
        prepared.length === 1 ? uploadedTab.uploadOne : uploadedTab.uploadMany(prepared.length),
        { variant: 'success' }
      );
      if (uploadCategory === 'panorama_360' && tabKey !== '360') setTab('360');
      if (uploadCategory === 'walkthrough_video' && tabKey !== 'video') setTab('video');
      await load();
    } catch (err) {
      const message = getErrorMessage(err);
      setStorageError(message);
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const fillDemoPack = async () => {
    setSeedingDemo(true);
    try {
      const { data } = await api.post(`/hostels/${id}/media/demo`);
      enqueueSnackbar(data?.message || 'Sample photos added for testing', { variant: 'success' });
      await load();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setSeedingDemo(false);
    }
  };

  const setCover = async (item) => {
    if (cover?.id === item.id) {
      enqueueSnackbar('This is already the listing cover', { variant: 'info' });
      return;
    }
    try {
      await api.patch(`/hostels/${id}/media/${item.id}`, { is_cover: true });
      if (item.category === 'exterior') {
        enqueueSnackbar('Cover updated — seekers see this on search cards', { variant: 'success' });
      } else {
        enqueueSnackbar(
          'Cover updated. A sharp outside photo usually works better on search cards than an interior or 360.',
          { variant: 'warning' }
        );
      }
      await load();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    }
  };

  const saveCaption = async (item, caption) => {
    const next = String(caption || '').slice(0, 200);
    if (next === (item.caption || '')) return;
    try {
      await api.patch(`/hostels/${id}/media/${item.id}`, { caption: next });
      await load();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    }
  };

  const moveItem = async (index, dir) => {
    const swap = index + dir;
    if (swap < 0 || swap >= visibleItems.length) return;
    const a = visibleItems[index];
    const b = visibleItems[swap];
    try {
      await api.put(`/hostels/${id}/media/reorder`, {
        items: [
          { id: a.id, sort_order: b.sort_order },
          { id: b.id, sort_order: a.sort_order },
        ],
      });
      await load();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    }
  };

  const prepareUploadFile = async (file, category = tab.category) => {
    if (category === 'walkthrough_video') return file;
    if (category === 'panorama_360') {
      const inspected = await inspectPanoramaFile(file);
      return inspected.file;
    }
    return compressListingPhoto(file);
  };

  const replaceItem = async (item, fileList) => {
    const picked = [...(fileList || [])];
    if (!item || !picked.length) return;
    if (picked.length !== 1) {
      enqueueSnackbar('Replace one file at a time', { variant: 'warning' });
      return;
    }
    const clientErr = storageErrorForFiles(picked, {
      panorama: item.category === 'panorama_360',
      video: item.category === 'walkthrough_video',
    });
    if (clientErr) {
      setStorageError(clientErr);
      enqueueSnackbar(clientErr, { variant: 'error' });
      return;
    }
    setStorageError('');
    setUploading(true);
    try {
      const prepared = await prepareUploadFile(picked[0], item.category);
      const form = new FormData();
      form.append('files', prepared);
      await api.post(`/hostels/${id}/media/${item.id}/replace`, form, { timeout: 120000 });
      enqueueSnackbar(item.category === 'walkthrough_video' ? 'Video replaced' : 'Photo replaced', { variant: 'success' });
      await load();
    } catch (err) {
      const message = getErrorMessage(err);
      setStorageError(message);
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setUploading(false);
      setReplacingId(null);
      if (replaceInputRef.current) replaceInputRef.current.value = '';
    }
  };

  const restoreItem = async (item) => {
    try {
      await api.post(`/hostels/${id}/media/${item.id}/restore`);
      enqueueSnackbar('Photo restored', { variant: 'success' });
      await load();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    }
  };

  const dropTile = async (toIndex, event) => {
    const droppedFiles = event.dataTransfer?.files;
    if (droppedFiles?.length) {
      await replaceItem(visibleItems[toIndex], droppedFiles);
      return;
    }
    if (dragIndex == null || dragIndex === toIndex) return;
    const next = [...visibleItems];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(toIndex, 0, moved);
    const payload = next.map((item, idx) => ({
      id: item.id,
      sort_order: visibleItems[idx].sort_order,
    }));
    try {
      await api.put(`/hostels/${id}/media/reorder`, { items: payload });
      await load();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setDragIndex(null);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/hostels/${id}/media/${pendingDelete.id}`);
      enqueueSnackbar('Photo removed', { variant: 'success' });
      setPendingDelete(null);
      await load();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const canEditMedia = Boolean(
    isSuperAdmin
    || isOwner
    || (isSupervisor && hostel?.supervisor_media_upload !== false),
  );

  const setSupervisorMediaUpload = async (enabled) => {
    setTogglingSupervisorMedia(true);
    try {
      const form = new FormData();
      form.append('supervisor_media_upload', enabled ? 'true' : 'false');
      const { data } = await api.put(`/hostels/${id}`, form);
      const updated = extractData(data);
      setHostel((prev) => ({ ...prev, ...updated, supervisor_media_upload: enabled }));
      enqueueSnackbar(
        enabled
          ? 'Supervisors can upload listing photos for this branch'
          : 'Only you and Vita tech can change listing photos now',
        { variant: 'success' },
      );
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setTogglingSupervisorMedia(false);
    }
  };

  if (loading) return <LoadingSkeleton variant="dashboard" />;

  const count = visibleItems.length;
  const needed = Math.max(0, tab.min - count);
  const packReadyLabel = tabKey === 'rooms'
    ? (typesReady ? 'room types are covered' : 'need 2 photos per listed type')
    : tabKey === 'floors'
      ? (floorsReady ? 'floors with rooms are covered' : 'need 1 photo per floor with rooms')
      : tabKey === '360'
        ? (count >= tab.min ? '360 pack is ready' : 'recommended — not required to publish')
        : (tabKey === 'inside' ? 'inside pack is ready' : 'outside pack is ready');

  return (
    <Box>
      <PageHeader
        dense
        title={hostel?.name || 'Photos'}
        subtitle={tab.subtitle}
        breadcrumbs={[
          { label: 'Hostels', path: '/hostels' },
          { label: hostel?.name || 'Hostel', path: `/hostels/${id}` },
          { label: 'Photos' },
          { label: tab.crumb },
        ]}
      >
        {canEditMedia && (
          <Button
            variant="outlined"
            startIcon={<CollectionsOutlinedIcon />}
            onClick={fillDemoPack}
            disabled={seedingDemo || uploading}
          >
            {seedingDemo ? 'Adding samples…' : 'Add sample photos'}
          </Button>
        )}
        {Boolean(hostel?.entitlements?.listing_publish) && (
          <Button
            component={RouterLink}
            to={`/hostels/${id}/listing`}
            variant="contained"
            startIcon={<VisibilityOutlinedIcon />}
          >
            Preview listing
          </Button>
        )}
        <Button component={RouterLink} to={`/hostels/${id}`} variant="outlined">
          Back to hostel
        </Button>
      </PageHeader>

      {isSuperAdmin && (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          Tech onboarding — you can upload and fix photos for any PG, including 360° the owner cannot shoot.
          {hostel?.owner
            ? ` Owner: ${[hostel.owner.first_name, hostel.owner.last_name].filter(Boolean).join(' ')}.`
            : ''}
          {hostel?.entitlements?.listing_publish
            ? ' If the checklist is still red, use Override & publish with a written reason.'
            : ' This PG is Regular — guests cannot find it online until you assign Silver or Gold.'}
        </Alert>
      )}

      {(isOwner || isSuperAdmin) && (
        <Card sx={{ mb: 1.5 }}>
          <CardContent sx={{ py: 1.25, '&:last-child': { pb: 1.25 } }}>
            <FormControlLabel
              control={(
                <Switch
                  checked={hostel?.supervisor_media_upload !== false}
                  onChange={(event) => setSupervisorMediaUpload(event.target.checked)}
                  disabled={togglingSupervisorMedia}
                  color="primary"
                />
              )}
              label="Supervisors may upload listing photos"
            />
            <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 0.5 }}>
              Default on — wardens shoot on site. Turn off if only the owner or Vita tech should change public photos.
            </Typography>
          </CardContent>
        </Card>
      )}

      {isSupervisor && hostel?.supervisor_media_upload === false && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          The owner turned off supervisor photo uploads for this branch. You can still view the pack; ask them to unlock edits, or have the owner / Vita tech upload.
        </Alert>
      )}

      <PublishChecklist hostelId={id} reloadToken={packTick} variant="manager" />

      <Card sx={{ mb: 1.5 }}>
        <CardContent sx={{ p: 1.5, display: 'flex', gap: 1.5, alignItems: 'center', '&:last-child': { pb: 1.5 } }}>
          {cover?.thumb_url ? (
            <Box
              component="img"
              src={getMediaUrl(cover.thumb_url)}
              alt={cover.caption || 'Listing cover'}
              sx={{ width: 72, height: 56, objectFit: 'cover', borderRadius: 1, flexShrink: 0 }}
            />
          ) : (
            <Box sx={{ width: 72, height: 56, bgcolor: alpha(brand.navy, 0.08), borderRadius: 1, flexShrink: 0 }} />
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography fontWeight={700}>Listing cover</Typography>
            <Typography variant="caption" color="text.secondary">
              {cover
                ? (cover.category === 'exterior'
                  ? 'Seekers see this thumbnail on search cards and as the listing hero. Star another photo to replace it.'
                  : 'Seekers see this on search cards. Star a sharp outside photo — a washroom or 360 makes the listing look broken.')
                : 'Star one photo, preferably a sharp building facade. Search cards need exactly one cover.'}
            </Typography>
          </Box>
          <Chip
            size="small"
            color={cover ? (cover.category === 'exterior' ? 'success' : 'warning') : 'error'}
            icon={<StarIcon />}
            label={cover ? (cover.caption || 'Cover') : 'No cover'}
          />
        </CardContent>
      </Card>

      <Card>
        <Box sx={{ display: 'flex', flexDirection: wide ? 'row' : 'column', alignItems: 'stretch' }}>
          <Tabs
            value={tabKey}
            onChange={(_, next) => setTab(next)}
            orientation={wide ? 'vertical' : 'horizontal'}
            variant={wide ? 'standard' : 'scrollable'}
            allowScrollButtonsMobile
            sx={{
              minWidth: wide ? 140 : undefined,
              borderRight: wide ? `1px solid ${alpha(brand.navy, 0.12)}` : undefined,
              borderBottom: wide ? undefined : `1px solid ${alpha(brand.navy, 0.12)}`,
              '& .MuiTab-root': {
                fontWeight: 600,
                textTransform: 'none',
                fontSize: 14,
                alignItems: wide ? 'flex-start' : 'center',
                minHeight: 44,
              },
            }}
          >
            <Tab value="outside" label="Outside" />
            <Tab value="inside" label="Inside PG" />
            <Tab value="rooms" label="Rooms" />
            <Tab value="floors" label="Floors" />
            <Tab value="360" label="360°" />
            <Tab value="video" label="Video" />
          </Tabs>
        <CardContent sx={{ p: 2, flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
            <Box>
              <Typography fontWeight={750}>{tab.heading}</Typography>
              <Typography variant="caption" color="text.secondary">
                {tabKey === 'rooms'
                  ? `${count} photo${count === 1 ? '' : 's'} on this room · ${packReadyLabel}`
                  : tabKey === 'floors'
                    ? `${count} photo${count === 1 ? '' : 's'} on this floor · ${packReadyLabel}`
                    : tabKey === '360'
                      ? `${count}/${tab.min} recommended${needed > 0 ? ` · add ${needed} more` : ` · ${packReadyLabel}`}`
                      : `${count}/${tab.min} minimum to publish${needed > 0 ? ` · add ${needed} more` : ` · ${packReadyLabel}`}`}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
            {tabKey === 'rooms' ? (
              <Chip size="small" color={typesReady ? 'success' : 'error'} label={typesReady ? 'types covered' : '2 per type'} />
            ) : tabKey === 'floors' ? (
              <Chip size="small" color={floorsReady ? 'success' : 'error'} label={floorsReady ? 'floors covered' : '1 per floor'} />
            ) : (
              <Chip
                size="small"
                color={count >= tab.min ? 'success' : (tab.requiredForPublish === false ? 'warning' : 'error')}
                label={count >= tab.min ? tab.chipReady : (tab.requiredForPublish === false ? `${count}/${tab.min} recommended` : `${count}/${tab.min}`)}
              />
            )}
              <Chip size="small" variant="outlined" label={`${quota.used}/${quota.max} photos`} />
              <Button size="small" onClick={() => setShowRemoved((v) => !v)}>
                {showRemoved ? 'Hide removed' : 'Removed photos'}
              </Button>
            </Box>
          </Box>

          {tabKey === 'rooms' && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
              {typeStats.map((row) => (
                <Chip
                  key={row.type}
                  size="small"
                  color={row.count >= 2 ? 'success' : 'error'}
                  variant={row.count >= 2 ? 'filled' : 'outlined'}
                  label={`${row.type.replace(/_/g, ' ')} ${row.count}/2`}
                />
              ))}
              {!typeStats.length && (
                <Typography variant="caption" color="text.secondary">No rooms on this hostel yet.</Typography>
              )}
            </Box>
          )}

          {tabKey === 'floors' && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
              {floorStats.map((row) => (
                <Chip
                  key={row.floor}
                  size="small"
                  color={row.count >= 1 ? 'success' : 'error'}
                  variant={row.floor === selectedFloor ? 'filled' : (row.count >= 1 ? 'filled' : 'outlined')}
                  label={`Floor ${row.floor} ${row.count}/1`}
                  onClick={() => pickFloor(row.floor)}
                />
              ))}
              {!floorStats.length && (
                <Typography variant="caption" color="text.secondary">
                  No floors with rooms yet — add rooms first, or still photograph a floor from the list.
                </Typography>
              )}
            </Box>
          )}

          {tabKey === 'rooms' && (
            <TextField
              select
              size="small"
              fullWidth
              label="Room"
              value={selectedRoom ? String(selectedRoom.id) : ''}
              onChange={(event) => pickRoom(event.target.value)}
              sx={{ mb: 1.5, bgcolor: '#fff' }}
              disabled={!rooms.length}
            >
              {rooms.map((room) => (
                <MenuItem key={room.id} value={String(room.id)}>
                  {roomLabel(room)}
                </MenuItem>
              ))}
            </TextField>
          )}

          {tabKey === 'floors' && (
            <TextField
              select
              size="small"
              fullWidth
              label="Floor"
              value={selectedFloor ? String(selectedFloor) : ''}
              onChange={(event) => pickFloor(event.target.value)}
              sx={{ mb: 1.5, bgcolor: '#fff' }}
            >
              {floorOptions.map((floor) => {
                const hasRooms = floorsWithRooms.includes(floor);
                return (
                  <MenuItem key={floor} value={String(floor)}>
                    {`Floor ${floor}${hasRooms ? ' · has rooms (required)' : ' · no rooms yet'}`}
                  </MenuItem>
                );
              })}
            </TextField>
          )}

          {tabKey === '360' && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 1, mb: 1.5 }}>
              <TextField
                select
                size="small"
                fullWidth
                label="Floor filter"
                value={panoViewFloor}
                onChange={(event) => setPanoViewFloor(event.target.value)}
                sx={{ bgcolor: '#fff' }}
              >
                <MenuItem value="">All floors</MenuItem>
                {floorOptions.map((floor) => (
                  <MenuItem key={floor} value={String(floor)}>
                    {`Floor ${floor}`}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                fullWidth
                label="Room (optional)"
                value={panoRoomId}
                onChange={(event) => setPanoRoomId(event.target.value)}
                sx={{ bgcolor: '#fff' }}
              >
                <MenuItem value="">No room — whole PG</MenuItem>
                {rooms.map((room) => (
                  <MenuItem key={room.id} value={String(room.id)}>
                    {roomLabel(room)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                fullWidth
                label="Floor (optional)"
                value={panoFloor}
                onChange={(event) => setPanoFloor(event.target.value)}
                sx={{ bgcolor: '#fff' }}
              >
                <MenuItem value="">No floor</MenuItem>
                {floorOptions.map((floor) => (
                  <MenuItem key={floor} value={String(floor)}>
                    {`Floor ${floor}`}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
          )}

          {storageError && (
            <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setStorageError('')}>
              {storageError}
            </Alert>
          )}

          <Alert severity={tabKey === 'inside' || tabKey === 'rooms' || tabKey === 'floors' ? 'warning' : 'info'} sx={{ mb: 1.5 }}>
            {tab.alert}
          </Alert>

          {canEditMedia ? (
            <Box
              onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragOver(false);
                acceptFiles(event.dataTransfer.files);
              }}
              onClick={() => {
                if (uploading) return;
                if (tab.category === 'room' && !selectedRoom) {
                  enqueueSnackbar('Pick a room first', { variant: 'warning' });
                  return;
                }
                if (tab.category === 'floor' && !selectedFloor) {
                  enqueueSnackbar('Pick a floor first', { variant: 'warning' });
                  return;
                }
                inputRef.current?.click();
              }}
              sx={{
                border: '2px dashed',
                borderColor: dragOver ? brand.teal : alpha(brand.navy, 0.2),
                bgcolor: dragOver ? alpha(brand.teal, 0.08) : alpha(brand.navy, 0.03),
                borderRadius: 2,
                p: 3,
                textAlign: 'center',
                cursor: uploading ? 'wait' : 'pointer',
                mb: 2,
              }}
            >
              {uploading ? (
                <CircularProgress size={28} />
              ) : (
                <>
                  <CloudUploadIcon sx={{ fontSize: 36, color: brand.navy, mb: 0.5 }} />
                  <Typography fontWeight={700}>{tab.dropLabel}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {tab.category === 'walkthrough_video'
                      ? 'MP4 only · 50 MB max · optional · does not block publish'
                      : tab.category === 'panorama_360'
                        ? 'JPEG, PNG, or WebP · 25 MB · usually 2:1 · drop many at once (40 max)'
                        : 'JPEG, PNG, or WebP · 10 MB each · drop many at once (40 max)'}
                  </Typography>
                  {tab.category === 'walkthrough_video' ? (
                    <Button
                      variant="outlined"
                      size="small"
                      sx={{ mt: 1.5 }}
                      disabled={uploading}
                      onClick={(event) => {
                        event.stopPropagation();
                        inputRef.current?.click();
                      }}
                    >
                      Choose MP4
                    </Button>
                  ) : (
                    <ImageSourceBar
                      disabled={uploading}
                      showPano
                      libraryLabel={tab.category === 'panorama_360' ? 'Choose 360 photos' : 'Choose photos'}
                      cameraLabel={tab.category === 'panorama_360' ? 'Phone 360 camera' : 'Use camera'}
                      panoLabel="Capture 360°"
                      onOpenPano={() => setPanoCaptureOpen(true)}
                      onFiles={acceptFiles}
                    />
                  )}
                </>
              )}
              <input
                ref={inputRef}
                type="file"
                hidden
                multiple={tab.category !== 'walkthrough_video'}
                accept={tab.accept || 'image/jpeg,image/png,image/webp'}
                onChange={(event) => acceptFiles(event.target.files)}
              />
            </Box>
          ) : (
            <Alert severity="info" sx={{ mb: 2 }}>
              Viewing only — upload and edits are locked for supervisors on this branch.
            </Alert>
          )}

          {visibleItems.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {tabKey === 'rooms' && !rooms.length
                ? 'Add rooms on the Rooms page first, then come back and photograph each type.'
                : tab.empty}
            </Typography>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 1.5 }}>
              {visibleItems.map((item, index) => (
                <Box
                  key={item.id}
                  draggable={canEditMedia}
                  onDragStart={() => { if (canEditMedia) setDragIndex(index); }}
                  onDragEnd={() => setDragIndex(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (!canEditMedia) return;
                    event.stopPropagation();
                    dropTile(index, event);
                  }}
                  sx={{
                    border: '1px solid',
                    borderColor: item.is_cover ? brand.teal : alpha(brand.navy, 0.12),
                    borderRadius: 2,
                    overflow: 'hidden',
                    bgcolor: '#fff',
                    opacity: dragIndex === index ? 0.55 : 1,
                    cursor: 'grab',
                  }}
                >
                  <Box sx={{ position: 'relative' }}>
                    <Box
                      component="img"
                      src={getMediaUrl(item.thumb_url || item.url)}
                      alt={item.caption || tab.heading}
                      onClick={() => tabKey === '360' && setViewing(item)}
                      sx={{
                        width: '100%',
                        height: 120,
                        objectFit: 'cover',
                        display: 'block',
                        cursor: tabKey === '360' ? 'pointer' : 'default',
                      }}
                    />
                    {tabKey === '360' && (
                      <>
                        <ThreeSixtyIcon
                          sx={{
                            position: 'absolute',
                            left: '50%',
                            top: '52%',
                            transform: 'translate(-50%, -50%)',
                            fontSize: 40,
                            color: '#fff',
                            pointerEvents: 'none',
                            filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.8))',
                          }}
                        />
                        <Chip
                          size="small"
                          icon={<ThreeSixtyIcon />}
                          label="Preview"
                          onClick={() => setViewing(item)}
                          sx={{
                            position: 'absolute',
                            left: 6,
                            top: 6,
                            height: 24,
                            bgcolor: 'rgba(0,0,0,0.72)',
                            color: '#fff',
                            '& .MuiChip-icon': { color: '#fff' },
                          }}
                        />
                      </>
                    )}
                    {canEditMedia && (
                      <Box sx={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 0.25 }}>
                        <Tooltip title={item.is_cover ? 'Listing cover' : 'Use as listing cover (search card)'}>
                          <IconButton
                            size="small"
                            onClick={() => setCover(item)}
                            sx={{ bgcolor: 'rgba(255,255,255,0.9)' }}
                          >
                            {item.is_cover ? <StarIcon fontSize="small" color="warning" /> : <StarBorderIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Replace this photo">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setReplacingId(item.id);
                              replaceInputRef.current?.click();
                            }}
                            sx={{ bgcolor: 'rgba(255,255,255,0.9)' }}
                          >
                            <SwapHorizIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Remove">
                          <IconButton
                            size="small"
                            onClick={() => setPendingDelete(item)}
                            sx={{ bgcolor: 'rgba(255,255,255,0.9)' }}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    )}
                    {item.is_cover && (
                      <Chip
                        size="small"
                        label="Cover"
                        color="warning"
                        sx={{ position: 'absolute', left: 6, bottom: 6, height: 22 }}
                      />
                    )}
                    {item.title === 'Please recategorise' && (
                      <Chip
                        size="small"
                        label="Please recategorise"
                        color="warning"
                        sx={{ position: 'absolute', left: 6, bottom: item.is_cover ? 32 : 6, height: 22 }}
                      />
                    )}
                    {tabKey === '360' && item.aspect_ok === false && (
                      <Chip
                        size="small"
                        label="Not 2:1"
                        color="warning"
                        sx={{ position: 'absolute', right: 6, bottom: 6, height: 22 }}
                      />
                    )}
                  </Box>
                  <Box sx={{ p: 1 }}>
                    <TextField
                      key={`${item.id}-${item.caption || ''}`}
                      size="small"
                      fullWidth
                      placeholder={tab.captionPlaceholder}
                      defaultValue={item.caption || ''}
                      inputProps={{ maxLength: 200, readOnly: !canEditMedia }}
                      helperText={canEditMedia ? '200 max' : undefined}
                      onBlur={(event) => {
                        if (canEditMedia) saveCaption(item, event.target.value);
                      }}
                    />
                    {canEditMedia && tab.hints?.length > 0 && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.4, mt: 0.75 }}>
                        {tab.hints.map((hint) => (
                          <Chip
                            key={hint}
                            size="small"
                            variant={item.caption === hint ? 'filled' : 'outlined'}
                            label={hint}
                            onClick={() => saveCaption(item, hint)}
                            sx={{ height: 20, fontSize: 11 }}
                          />
                        ))}
                      </Box>
                    )}
                    {tabKey === '360' && (item.room_number || item.floor_number) && (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                        {[
                          item.room_number ? `Room ${item.room_number}` : null,
                          item.floor_number ? `Floor ${item.floor_number}` : null,
                        ].filter(Boolean).join(' · ')}
                      </Typography>
                    )}
                    {canEditMedia && visibleItems.length > 1 && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
                        <Tooltip title="Move earlier (seekers see this first)">
                          <span>
                            <IconButton size="small" disabled={index === 0} onClick={() => moveItem(index, -1)}>
                              <KeyboardArrowUpIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Drag the tile to reorder">
                          <DragIndicatorIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                        </Tooltip>
                        <Tooltip title="Move later">
                          <span>
                            <IconButton
                              size="small"
                              disabled={index === visibleItems.length - 1}
                              onClick={() => moveItem(index, 1)}
                            >
                              <KeyboardArrowDownIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Box>
                    )}
                  </Box>
                </Box>
              ))}
            </Box>
          )}

          {showRemoved && (
            <Box sx={{ mt: 2 }}>
              <Typography fontWeight={700} sx={{ mb: 1 }}>Removed photos</Typography>
              {removedItems.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nothing in the bin for this tab. Restore puts a photo back on the listing.
                </Typography>
              ) : (
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 1.5 }}>
                  {removedItems.map((item) => (
                    <Box
                      key={item.id}
                      sx={{
                        border: '1px dashed',
                        borderColor: alpha(brand.navy, 0.25),
                        borderRadius: 2,
                        overflow: 'hidden',
                        bgcolor: alpha(brand.navy, 0.04),
                      }}
                    >
                      <Box
                        component="img"
                        src={getMediaUrl(item.thumb_url || item.url)}
                        alt={item.caption || 'Removed'}
                        sx={{ width: '100%', height: 90, objectFit: 'cover', display: 'block', opacity: 0.7 }}
                      />
                      <Box sx={{ p: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="caption" noWrap>{item.caption || 'Removed'}</Typography>
                        <Tooltip title="Restore to the listing">
                          <IconButton size="small" onClick={() => restoreItem(item)}>
                            <ReplayIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          )}

          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
            {tabKey === '360'
              ? 'The tile is a still preview with a panorama icon. Click Preview to spin. We do not squash the original 360 file. Cover photo stays the listing hero.'
              : tabKey === 'floors'
                ? 'Empty floors without rooms do not block publish. A floor number outside 1…total floors is rejected.'
                : tabKey === 'rooms'
                  ? 'Two photos per listed type is the publish minimum — photograph the actual room, not a show unit.'
                  : tabKey === 'inside'
                    ? 'Keep bedrooms off the Inside tab — those belong on Rooms, linked to a room number.'
                    : 'Star the best facade as cover. Drop many files at once, drag tiles to reorder, or replace a misleading shot.'}
          </Typography>
        </CardContent>
        </Box>
      </Card>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={tab.deleteTitle}
        message="It is hidden from the listing, not erased. Open Removed photos to restore it, or replace the file on the tile."
        confirmLabel="Remove"
        severity="error"
        loading={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />

      <input
        ref={replaceInputRef}
        type="file"
        hidden
        accept={
          liveItems.find((item) => item.id === replacingId)?.category === 'walkthrough_video'
            ? 'video/mp4,.mp4'
            : 'image/jpeg,image/png,image/webp'
        }
        onChange={(event) => {
          const target = liveItems.find((item) => item.id === replacingId);
          replaceItem(target, event.target.files);
        }}
      />

      <CameraCaptureDialog
        open={panoCaptureOpen}
        onClose={() => setPanoCaptureOpen(false)}
        onCapture={(file) => acceptFiles([file], { category: 'panorama_360' })}
      />

      <PanoramaViewer
        open={Boolean(viewing)}
        url={viewing ? getMediaUrl(viewing.url) : ''}
        stillUrl={viewing ? getMediaUrl(viewing.thumb_url || viewing.url) : ''}
        caption={viewing?.caption}
        context={[
          viewing?.room_number ? `Room ${viewing.room_number}` : null,
          viewing?.floor_number ? `Floor ${viewing.floor_number}` : null,
        ].filter(Boolean).join(' · ')}
        onClose={() => setViewing(null)}
      />
    </Box>
  );
};

export default HostelMediaPage;
