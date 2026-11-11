import { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { Chart as ChartJS } from 'chart.js';

/** Chart area that scales with viewport and browser zoom instead of a fixed pixel box. */
const FitChartBox = ({ children, min = 170, max = 360, vh = 30 }) => {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const resize = () => {
      el.querySelectorAll('canvas').forEach((canvas) => {
        ChartJS.getChart(canvas)?.resize();
      });
    };

    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => {
        requestAnimationFrame(resize);
      });
    observer?.observe(el);
    window.addEventListener('resize', resize);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <Box
      ref={ref}
      sx={{
        position: 'relative',
        width: '100%',
        height: `clamp(${min}px, ${vh}vh, ${max}px)`,
        minHeight: min,
        minWidth: 0,
      }}
    >
      <Box sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', minWidth: 0 }}>
        {children}
      </Box>
    </Box>
  );
};

export default FitChartBox;
