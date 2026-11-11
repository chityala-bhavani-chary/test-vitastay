/**
 * BIC-034 — owner draft/approve listing description. Never auto-publishes AI text.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import api, { extractData, getErrorMessage } from '../../services/api';

const DescriptionDraftPanel = ({ hostelId }) => {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [liveDescription, setLiveDescription] = useState('');
  const [draft, setDraft] = useState('');
  const [source, setSource] = useState(null);
  const [aiAssisted, setAiAssisted] = useState(false);

  const applyPayload = (data) => {
    setLiveDescription(data?.description || '');
    setDraft(data?.description_draft || '');
    setSource(data?.description_draft_source || null);
    setAiAssisted(Boolean(data?.ai_assisted));
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/hostels/${hostelId}/listing/description-draft`);
      applyPayload(extractData(res));
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [hostelId, enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (work, okMessage) => {
    setBusy(true);
    try {
      const data = await work();
      applyPayload(data);
      if (okMessage) enqueueSnackbar(okMessage, { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" gutterBottom>
        Listing description draft
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Generate a draft from amenities and photos, edit it, then approve. Nothing goes live until you approve.
      </Typography>

      {liveDescription ? (
        <Alert severity="success" sx={{ mb: 1.5 }}>
          Live description is set ({liveDescription.slice(0, 120)}{liveDescription.length > 120 ? '…' : ''})
        </Alert>
      ) : (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          No live description yet. Seekers see an empty description until you approve a draft.
        </Alert>
      )}

      {aiAssisted && draft ? (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          This draft was AI-assisted. Review carefully — AI text is never published automatically.
        </Alert>
      ) : null}

      <TextField
        fullWidth
        multiline
        minRows={4}
        label="Draft (not live)"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        disabled={busy}
        helperText={source ? `Source: ${source}` : 'Generate a draft or paste your own text'}
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.5 }}>
        <Button
          variant="outlined"
          disabled={busy}
          onClick={() => run(
            async () => extractData(await api.post(`/hostels/${hostelId}/listing/description-draft/generate`)),
            'Draft generated — edit before approving'
          )}
        >
          Generate draft
        </Button>
        <Button
          variant="outlined"
          disabled={busy || !draft.trim()}
          onClick={() => run(
            async () => extractData(await api.put(`/hostels/${hostelId}/listing/description-draft`, {
              description_draft: draft,
            })),
            'Draft saved'
          )}
        >
          Save draft
        </Button>
        <Button
          variant="contained"
          disabled={busy || !draft.trim()}
          onClick={() => run(
            async () => {
              await api.put(`/hostels/${hostelId}/listing/description-draft`, {
                description_draft: draft,
              });
              return extractData(await api.post(`/hostels/${hostelId}/listing/description-draft/approve`));
            },
            'Description published to the listing'
          )}
        >
          Approve & publish text
        </Button>
        <Button
          color="inherit"
          disabled={busy || !draft.trim()}
          onClick={() => run(
            async () => extractData(await api.delete(`/hostels/${hostelId}/listing/description-draft`)),
            'Draft discarded'
          )}
        >
          Discard
        </Button>
      </Stack>
    </Box>
  );
};

export default DescriptionDraftPanel;
