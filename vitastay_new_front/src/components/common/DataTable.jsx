import { memo } from 'react';
import {
  Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, Paper, Typography, IconButton, Tooltip, Button, alpha,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import LoadingSkeleton from './LoadingSkeleton';
import { brand } from '../../styles/theme';

const DataTable = ({
  columns,
  rows,
  loading = false,
  page = 0,
  rowsPerPage = 10,
  totalCount = 0,
  onPageChange,
  onRowsPerPageChange,
  onView,
  onEdit,
  onDelete,
  primaryAction,
  customActions,
  endActions,
  emptyMessage = 'No records found',
  showActions = true,
}) => {
  if (loading) {
    return <LoadingSkeleton variant="table" rows={rowsPerPage} />;
  }

  const hasActions = showActions && (onView || onEdit || onDelete || customActions || endActions || primaryAction);

  return (
    <Paper
      elevation={0}
      sx={{
        width: '100%',
        overflow: 'hidden',
        border: `1px solid ${alpha(brand.navy, 0.08)}`,
      }}
    >
      <TableContainer>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell
                  key={col.field}
                  align={col.align || 'left'}
                  sx={{
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    bgcolor: brand.mist,
                    color: brand.navy,
                    borderBottom: `1px solid ${alpha(brand.navy, 0.1)}`,
                    py: 1.25,
                    fontSize: '0.75rem',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  {col.headerName}
                </TableCell>
              ))}
              {hasActions && (
                <TableCell
                  align="right"
                  sx={{
                    fontWeight: 700,
                    bgcolor: brand.mist,
                    color: brand.navy,
                    borderBottom: `1px solid ${alpha(brand.navy, 0.1)}`,
                    py: 1.25,
                    fontSize: '0.75rem',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  Actions
                </TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + (hasActions ? 1 : 0)} align="center" sx={{ py: 6 }}>
                  <Typography color="text.secondary">{emptyMessage}</Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, index) => (
                <TableRow
                  key={row.id || index}
                  hover
                  sx={{
                    '& td': { borderBottom: `1px solid ${alpha(brand.navy, 0.06)}`, py: 1 },
                  }}
                >
                  {columns.map((col) => (
                    <TableCell key={col.field} align={col.align || 'left'}>
                      {col.renderCell ? col.renderCell({ row, value: row[col.field] }) : row[col.field]}
                    </TableCell>
                  ))}
                  {hasActions && (
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
                        {primaryAction?.(row)}
                        {customActions?.(row)}
                        {onView && (
                          <Tooltip title="View">
                            <IconButton size="small" onClick={() => onView(row)} sx={{ color: alpha(brand.navy, 0.7) }}>
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {onEdit && (
                          <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => onEdit(row)}>
                            Edit
                          </Button>
                        )}
                        {endActions?.(row)}
                        {onDelete && (
                          <Tooltip title="Delete">
                            <IconButton size="small" color="error" onClick={() => onDelete(row)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {totalCount > 0 && (
        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={(_, newPage) => onPageChange?.(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => onRowsPerPageChange?.(parseInt(e.target.value, 10))}
          rowsPerPageOptions={[5, 10, 25, 50]}
        />
      )}
    </Paper>
  );
};

export default memo(DataTable);
