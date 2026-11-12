import puntosControl from '../data/georreferencia.json';
import { INGRESO_PRINCIPAL } from './rutas';
import { esVisible, type DatosCampus, type Lugar } from './tipos';

/** Punto que se reconoce en el plano (x, y en píxeles) y en Google Maps (lat, lng). */
export interface PuntoControl {
  nombre: string;
  x: number;
  y: number;
  lat: number;
  lng: number;
}

export interface Georreferencia {
  /** Convierte una posición GPS a coordenadas del plano. */
  aPlano(lat: number, lng: number): { x: number; y: number };
  /** Metros reales por píxel del plano según los puntos de control. */
  metrosPorPixel: number;
}

const rad = (grados: number) => (grados * Math.PI) / 180;

/**
 * Ajusta por mínimos cuadrados una similaridad (escala, rotación y traslación) entre las
 * coordenadas GPS de los puntos de control y su posición en el plano.
 */
export function crearGeorreferencia(puntos: PuntoControl[]): Georreferencia {
  const promedio = (valor: (p: PuntoControl) => number) => puntos.reduce((s, p) => s + valor(p), 0) / puntos.length;
  const lat0 = promedio((p) => p.lat);
  const lng0 = promedio((p) => p.lng);
  // Metros por grado alrededor del campus: basta una aproximación local para unos cientos de metros.
  const mLat = 111132.92 - 559.82 * Math.cos(2 * rad(lat0));
  const mLng = 111412.84 * Math.cos(rad(lat0));

  // El plano se usa con y hacia arriba para que sus ejes tengan la misma orientación que este/norte.
  const pares = puntos.map((p) => ({ e: (p.lng - lng0) * mLng, n: (p.lat - lat0) * mLat, u: p.x, v: -p.y }));
  const centro = (valor: (p: (typeof pares)[number]) => number) => pares.reduce((s, p) => s + valor(p), 0) / pares.length;
  const me = centro((p) => p.e);
  const mn = centro((p) => p.n);
  const mu = centro((p) => p.u);
  const mv = centro((p) => p.v);

  let suma = 0;
  let a = 0;
  let b = 0;
  for (const p of pares) {
    const e = p.e - me;
    const n = p.n - mn;
    const u = p.u - mu;
    const v = p.v - mv;
    suma += e * e + n * n;
    a += e * u + n * v;
    b += e * v - n * u;
  }
  a /= suma;
  b /= suma;

  return {
    metrosPorPixel: 1 / Math.hypot(a, b),
    aPlano(lat, lng) {
      const e = (lng - lng0) * mLng - me;
      const n = (lat - lat0) * mLat - mn;
      return { x: mu + a * e - b * n, y: -(mv + b * e + a * n) };
    },
  };
}

export const georreferencia = crearGeorreferencia(puntosControl);

// Rectángulo del campus en el plano: fuera de él, la persona no está dentro del campus.
const CAMPUS = { x0: 190, y0: 70, x1: 645, y1: 475 };

export interface OrigenGps {
  lugar: Lugar;
  fuera: boolean;
}

/**
 * Lugar del mapa más cercano a una posición del plano. Solo considera la planta baja,
 * porque el GPS no distingue pisos. Fuera del campus devuelve el ingreso principal.
 */
export function origenDesdeGps(datos: DatosCampus, x: number, y: number): OrigenGps | null {
  if (x < CAMPUS.x0 || x > CAMPUS.x1 || y < CAMPUS.y0 || y > CAMPUS.y1) {
    const ingreso = datos.lugares.find((l) => l.id === INGRESO_PRINCIPAL);
    return ingreso ? { lugar: ingreso, fuera: true } : null;
  }
  let cercano: Lugar | null = null;
  let minimo = Infinity;
  for (const l of datos.lugares) {
    if (!esVisible(l) || l.piso !== 0) continue;
    const d = Math.hypot(l.x - x, l.y - y);
    if (d < minimo) {
      minimo = d;
      cercano = l;
    }
  }
  return cercano ? { lugar: cercano, fuera: false } : null;
}
