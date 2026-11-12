import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Ruta } from '../lib/rutas';
import { esVisible, type DatosCampus } from '../lib/tipos';

// Las coordenadas de los lugares están en píxeles del plano original (664×489).
// mapa-campus.png es el recorte de ese plano que va de (188, 58) a (664, 489); si se
// reemplaza por una imagen de mayor resolución con el mismo encuadre, todo sigue alineado.
export const ALTO_MAPA = 489;
const RECORTE = { x0: 188, y0: 58, x1: 664, y1: 489 };

const aLatLng = (x: number, y: number): L.LatLngTuple => [ALTO_MAPA - y, x];

const COLORES = {
  ingreso: '#475569',
  bloque: '#2e3192',
  punto: '#0e7c86',
  desde: '#16a34a',
  hasta: '#f7941d',
  ruta: '#e8590c',
  gps: '#2563eb',
};

interface Props {
  datos: DatosCampus;
  ruta: Ruta | null;
  desdeId: string;
  hastaId: string | null;
  /** Posición GPS en coordenadas del plano; `radio` es la precisión, también en píxeles del plano. */
  ubicacionGps: { x: number; y: number; radio: number } | null;
  modoGrafo: boolean;
  onElegirLugar: (id: string) => void;
}

export default function MapaCampus({ datos, ruta, desdeId, hastaId, ubicacionGps, modoGrafo, onElegirLugar }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const capaGrafo = useRef<L.LayerGroup | null>(null);
  const capaRuta = useRef<L.LayerGroup | null>(null);
  const capaLugares = useRef<L.LayerGroup | null>(null);
  const capaGps = useRef<L.LayerGroup | null>(null);
  const hayRuta = useRef(false);
  const habiaGps = useRef(false);
  const alElegir = useRef(onElegirLugar);

  useEffect(() => {
    alElegir.current = onElegirLugar;
  }, [onElegirLugar]);

  useEffect(() => {
    const div = contenedor.current!;
    const m = L.map(div, { crs: L.CRS.Simple, minZoom: -2, maxZoom: 3, zoomSnap: 0.25, attributionControl: false });
    const limites = L.latLngBounds(aLatLng(RECORTE.x0, RECORTE.y1), aLatLng(RECORTE.x1, RECORTE.y0));
    L.imageOverlay('/mapa-campus.png', limites).addTo(m);
    m.setMaxBounds(limites.pad(0.15));
    const vistaCampus = L.latLngBounds(aLatLng(195, 470), aLatLng(650, 75));
    m.fitBounds(vistaCampus);
    capaGrafo.current = L.layerGroup().addTo(m);
    capaRuta.current = L.layerGroup().addTo(m);
    capaLugares.current = L.layerGroup().addTo(m);
    capaGps.current = L.layerGroup().addTo(m);
    mapa.current = m;
    // Mientras la persona no mueva el mapa, se reencuadra el campus cada vez que cambia
    // el tamaño del contenedor (carga de fuentes, rotar el celular, etc.).
    let interactuo = false;
    const marcarInteraccion = () => {
      interactuo = true;
    };
    div.addEventListener('pointerdown', marcarInteraccion);
    div.addEventListener('wheel', marcarInteraccion, { passive: true });
    const observador = new ResizeObserver(() => {
      m.invalidateSize();
      if (!interactuo && !hayRuta.current) m.fitBounds(vistaCampus);
    });
    observador.observe(div);
    return () => {
      div.removeEventListener('pointerdown', marcarInteraccion);
      div.removeEventListener('wheel', marcarInteraccion);
      observador.disconnect();
      m.remove();
      mapa.current = null;
    };
  }, []);

  useEffect(() => {
    const capa = capaLugares.current;
    if (!capa) return;
    capa.clearLayers();
    for (const l of datos.lugares) {
      if (!esVisible(l)) continue;
      const esDesde = l.id === desdeId;
      const esHasta = l.id === hastaId;
      const color = esHasta ? COLORES.hasta : esDesde ? COLORES.desde : COLORES[l.tipo as 'ingreso' | 'bloque' | 'punto'];
      const marcador = L.circleMarker(aLatLng(l.x, l.y), {
        radius: esDesde || esHasta ? 10 : 7,
        color: '#fff',
        weight: 2.5,
        fillColor: color,
        fillOpacity: 1,
      });
      const etiqueta = esHasta ? `Destino · ${l.nombre}` : esDesde ? `Estás aquí · ${l.nombre}` : l.nombre;
      marcador.bindTooltip(etiqueta, {
        direction: 'top',
        offset: [0, -8],
        permanent: esDesde || esHasta,
        className: esHasta ? 'etiqueta-destino' : esDesde ? 'etiqueta-origen' : '',
      });
      marcador.on('click', () => alElegir.current(l.id));
      capa.addLayer(marcador);
    }
  }, [datos, desdeId, hastaId]);

  useEffect(() => {
    const capa = capaRuta.current;
    const m = mapa.current;
    if (!capa || !m) return;
    capa.clearLayers();
    hayRuta.current = !!ruta && ruta.segmentos.length > 0;
    if (!ruta || ruta.segmentos.length === 0) return;
    const puntos: L.LatLngTuple[] = [];
    for (const s of ruta.segmentos) {
      const linea = [aLatLng(...s.de), aLatLng(...s.a)];
      puntos.push(...linea);
      L.polyline(linea, { color: '#fff', weight: 11, opacity: 0.95, lineCap: 'round' }).addTo(capa);
      L.polyline(linea, { color: COLORES.ruta, weight: 6, lineCap: 'round' }).addTo(capa);
      if (s.tipo === 'escaleras') {
        // Las escaleras se marcan con rayas blancas sobre la línea de la ruta.
        L.polyline(linea, { color: '#fff', weight: 3, dashArray: '2 6', lineCap: 'butt' }).addTo(capa);
      }
    }
    m.flyToBounds(L.latLngBounds(puntos), { padding: [50, 50], maxZoom: 1.25, duration: 0.6 });
  }, [ruta]);

  useEffect(() => {
    const capa = capaGps.current;
    const m = mapa.current;
    if (!capa || !m) return;
    capa.clearLayers();
    if (!ubicacionGps) {
      habiaGps.current = false;
      return;
    }
    const centro = aLatLng(ubicacionGps.x, ubicacionGps.y);
    L.circle(centro, {
      radius: ubicacionGps.radio,
      color: COLORES.gps,
      weight: 1,
      fillColor: COLORES.gps,
      fillOpacity: 0.12,
      interactive: false,
    }).addTo(capa);
    L.circleMarker(centro, { radius: 8, color: '#fff', weight: 3, fillColor: COLORES.gps, fillOpacity: 1 })
      .bindTooltip('Tu ubicación (GPS)', { direction: 'top', offset: [0, -8] })
      .addTo(capa);
    // Con la primera posición se centra el mapa en la persona, salvo que ya haya una ruta a la vista.
    if (!habiaGps.current && !hayRuta.current) m.panTo(centro);
    habiaGps.current = true;
  }, [ubicacionGps]);

  useEffect(() => {
    const capa = capaGrafo.current;
    const m = mapa.current;
    if (!capa || !m) return;
    capa.clearLayers();
    if (!modoGrafo) return;
    const porId = new Map(datos.lugares.map((l) => [l.id, l]));
    for (const c of datos.caminos) {
      const a = porId.get(c.desde);
      const b = porId.get(c.hasta);
      if (a?.x == null || a.y == null || b?.x == null || b.y == null) continue;
      L.polyline([aLatLng(a.x, a.y), aLatLng(b.x, b.y)], {
        color: c.tipo === 'escaleras' ? '#dc2626' : '#2563eb',
        weight: 2,
        dashArray: c.tipo === 'escaleras' ? '4 4' : undefined,
      }).addTo(capa);
    }
    for (const l of datos.lugares) {
      if (l.x == null || l.y == null) continue;
      L.circleMarker(aLatLng(l.x, l.y), { radius: 3, color: '#111', weight: 1, fillColor: '#fff', fillOpacity: 1 })
        .bindTooltip(l.id, { permanent: true, direction: 'right', className: 'etiqueta-grafo' })
        .addTo(capa);
    }
    const alClic = (e: L.LeafletMouseEvent) => {
      const x = Math.round(e.latlng.lng);
      const y = Math.round(ALTO_MAPA - e.latlng.lat);
      L.popup().setLatLng(e.latlng).setContent(`"x": ${x}, "y": ${y}`).openOn(m);
    };
    m.on('click', alClic);
    return () => {
      m.off('click', alClic);
    };
  }, [datos, modoGrafo]);

  return <div ref={contenedor} className="mapa" aria-label="Mapa del campus" />;
}
