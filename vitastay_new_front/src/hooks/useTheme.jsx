import { useDispatch, useSelector } from 'react-redux';
import { toggleTheme, setTheme } from '../redux/slices/themeSlice';

const useTheme = () => {
  const dispatch = useDispatch();
  const { mode } = useSelector((state) => state.theme);

  return {
    mode,
    isDark: mode === 'dark',
    toggleTheme: () => dispatch(toggleTheme()),
    setTheme: (newMode) => dispatch(setTheme(newMode)),
  };
};

export default useTheme;
