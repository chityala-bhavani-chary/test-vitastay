import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { SnackbarProvider } from 'notistack';
import App from './App';
import store from './redux/store';
import { registerPwa } from './pwa';
import './styles/global.css';

registerPwa();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <SnackbarProvider
          maxSnack={3}
          autoHideDuration={4000}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          preventDuplicate
        >
          <App />
        </SnackbarProvider>
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);
