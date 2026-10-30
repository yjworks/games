import React from 'react';
import ReactDOM from 'react-dom/client';
import '../../shared/base.css';
import './growup.css';
import App from './App';
import { registerServiceWorker } from '../../shared/pwa';
import { HUB_HREF } from '../../shared/registry';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

registerServiceWorker(HUB_HREF);
