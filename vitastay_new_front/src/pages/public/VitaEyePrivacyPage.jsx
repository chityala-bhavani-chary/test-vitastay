/**
 * PKG-012 — public Vita Eye privacy policy (DPDP). Not a marketplace home.
 */
import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Typography } from '@mui/material';
import api, { extractData, getErrorMessage } from '../../services/api';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';

const VitaEyePrivacyPage = () => {
  const [policy, setPolicy] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.get('/public/vita-eye-privacy')
      .then((res) => {
        if (!cancelled) setPolicy(extractData(res));
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err));
      });
    return () => { cancelled = true; };
  }, []);

  if (!policy && !error) return <LoadingSkeleton variant="dashboard" />;

  return (
    <Box sx={{ maxWidth: 720 }}>
      <Typography variant="h4" fontWeight={750} sx={{ mb: 1 }}>Vita Eye privacy</Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Version {policy?.version || 'pkg-012.v1'}
      </Typography>
      {error ? <Alert severity="error">{error}</Alert> : (
        <Card>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Typography variant="body1" sx={{ mb: 1.5 }}>{policy.text}</Typography>
            <Typography variant="body2" color="text.secondary">
              Purpose: premises security at that PG only.
              Unknown gate stills: about {policy.unknown_retention_days} days.
              Enrolled faces: for the stay.
              Embeddings sold: {policy.sold ? 'yes' : 'no'}.
              Platform-wide face graph: {policy.platform_wide_graph ? 'yes' : 'no'}.
            </Typography>
            <Button component={RouterLink} to="/search" sx={{ mt: 2 }} variant="outlined">
              Back to search
            </Button>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default VitaEyePrivacyPage;
