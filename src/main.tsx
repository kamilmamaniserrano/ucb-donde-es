import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import App from './App';
import Admin from './pages/Admin';
import CodigosQR from './pages/CodigosQR';

const ruta = window.location.pathname.replace(/\/+$/, '');
const Pagina = ruta === '/admin' ? Admin : ruta === '/qr' ? CodigosQR : App;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Pagina />
  </StrictMode>,
);
