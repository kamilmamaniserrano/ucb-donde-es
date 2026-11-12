import { INGRESO_PRINCIPAL } from './rutas';
import { esVisible, type DatosCampus, type Lugar, type PuntoControl } from './tipos';

export interface Georreferencia {
  /** Convierte una posición GPS a coordenadas del plano. */
  aPlano(lat: number, lng: number): { x: number; y: number };
  /** Metros reales por píxel del plano según los puntos de control. */
  metrosPorPixel: number;
}

const rad = (grados: number) => (grados * Math.PI) / 180;

/**
 * Convierte GPS a plano a partir de los puntos de control:
 * 1. Un ajuste lineal por mínimos cuadrados: similaridad (escala, rotación, traslación) con 3 puntos,
 *    afín con 4 o más (admite que el plano tenga distinta escala a lo ancho y a lo largo).
 * 2. Una corrección local: el error que deja el ajuste en cada punto se reparte por distancia
 *    (inverso de la distancia al cuadrado). Así cada punto de control cae exacto y el plano,
 *    que no está dibujado perfectamente a escala, se corrige por zonas.
 */
export function crearGeorreferencia(puntos: PuntoControl[]): Georreferencia {
  const promedio = (valor: (p: PuntoControl) => number) => puntos.reduce((s, p) => s + valor(p), 0) / puntos.length;
  const lat0 = promedio((p) => p.lat);
  const lng0 = promedio((p) => p.lng);
  // Metros por grado alrededor del campus: basta una aproximación local para unos cientos de metros.
  const mLat = 111132.92 - 559.82 * Math.cos(2 * rad(lat0));
  const mLng = 111412.84 * Math.cos(rad(lat0));
  const aMetros = (lat: number, lng: number) => ({ e: (lng - lng0) * mLng, n: (lat - lat0) * mLat });

  const pares = puntos.map((p) => ({ ...aMetros(p.lat, p.lng), x: p.x, y: p.y }));
  const centro = (valor: (p: (typeof pares)[number]) => number) => pares.reduce((s, p) => s + valor(p), 0) / pares.length;
  const me = centro((p) => p.e);
  const mn = centro((p) => p.n);
  const mx = centro((p) => p.x);
  const my = centro((p) => p.y);

  // Matriz [[a, b], [c, d]]: x = mx + a·e + b·n ; y = my + c·e + d·n (e, n centrados).
  // Primero la similaridad; el plano se usa con y hacia arriba para que sus ejes coincidan con este/norte.
  let suma = 0, s = 0, r = 0;
  for (const p of pares) {
    const e = p.e - me, n = p.n - mn, u = p.x - mx, v = -(p.y - my);
    suma += e * e + n * n;
    s += e * u + n * v;
    r += e * v - n * u;
  }
  s /= suma;
  r /= suma;
  let [a, b, c, d] = [s, -r, -r, -s];

  if (pares.length >= 4) {
    let see = 0, sen = 0, snn = 0, sex = 0, snx = 0, sey = 0, sny = 0;
    for (const p of pares) {
      const e = p.e - me, n = p.n - mn, x = p.x - mx, y = p.y - my;
      see += e * e; sen += e * n; snn += n * n;
      sex += e * x; snx += n * x; sey += e * y; sny += n * y;
    }
    const det = see * snn - sen * sen;
    // Con puntos casi alineados el ajuste afín es inestable: se queda la similaridad.
    if (det > 1e-3 * see * snn) {
      a = (sex * snn - snx * sen) / det;
      b = (snx * see - sex * sen) / det;
      c = (sey * snn - sny * sen) / det;
      d = (sny * see - sey * sen) / det;
    }
  }
  const lineal = (e: number, n: number) => ({ x: mx + a * (e - me) + b * (n - mn), y: my + c * (e - me) + d * (n - mn) });
  const residuos = pares.map((p) => {
    const q = lineal(p.e, p.n);
    return { e: p.e, n: p.n, dx: p.x - q.x, dy: p.y - q.y };
  });

  return {
    metrosPorPixel: 1 / Math.sqrt(Math.abs(a * d - b * c)),
    aPlano(lat, lng) {
      const { e, n } = aMetros(lat, lng);
      const base = lineal(e, n);
      let w = 0, dx = 0, dy = 0;
      for (const r of residuos) {
        const d2 = (r.e - e) ** 2 + (r.n - n) ** 2;
        if (d2 < 0.25) return { x: base.x + r.dx, y: base.y + r.dy };
        w += 1 / d2;
        dx += r.dx / d2;
        dy += r.dy / d2;
      }
      return { x: base.x + dx / w, y: base.y + dy / w };
    },
  };
}

/**
 * Error de cada punto de control al quitarlo y predecirlo con los demás (en metros).
 * Un valor alto delata un punto mal tomado. Necesita al menos 4 puntos.
 */
export function errorDeCadaPunto(puntos: PuntoControl[]): (number | null)[] {
  if (puntos.length < 4) return puntos.map(() => null);
  return puntos.map((p, i) => {
    const geo = crearGeorreferencia(puntos.filter((_, j) => j !== i));
    const q = geo.aPlano(p.lat, p.lng);
    return Math.hypot(q.x - p.x, q.y - p.y) * geo.metrosPorPixel;
  });
}

// Rectángulo del campus en el plano: fuera de él, la persona no está dentro del campus.
const CAMPUS = { x0: 190, y0: 70, x1: 645, y1: 475 };
// El origen no cambia por diferencias menores a esto: evita que salte con el ruido del GPS.
const HISTERESIS_M = 6;

export interface OrigenGps {
  lugar: Lugar;
  fuera: boolean;
}

/**
 * Lugar del mapa más cercano a una posición del plano. Solo considera la planta baja,
 * porque el GPS no distingue pisos. Fuera del campus devuelve el ingreso principal.
 */
export function origenDesdeGps(datos: DatosCampus, x: number, y: number, actualId: string | null): OrigenGps | null {
  if (x < CAMPUS.x0 || x > CAMPUS.x1 || y < CAMPUS.y0 || y > CAMPUS.y1) {
    const ingreso = datos.lugares.find((l) => l.id === INGRESO_PRINCIPAL);
    return ingreso ? { lugar: ingreso, fuera: true } : null;
  }
  const candidatos = datos.lugares.filter((l): l is Lugar & { x: number; y: number } => esVisible(l) && l.piso === 0);
  let cercano: (typeof candidatos)[number] | null = null;
  let minimo = Infinity;
  for (const l of candidatos) {
    const d = Math.hypot(l.x - x, l.y - y);
    if (d < minimo) {
      minimo = d;
      cercano = l;
    }
  }
  const actual = candidatos.find((l) => l.id === actualId);
  if (actual && cercano && actual.id !== cercano.id) {
    const diferencia = (Math.hypot(actual.x - x, actual.y - y) - minimo) * datos.config.metros_por_pixel;
    if (diferencia < HISTERESIS_M) return { lugar: actual, fuera: false };
  }
  return cercano ? { lugar: cercano, fuera: false } : null;
}

/**
 * Lleva una posición al punto más cercano de un camino (en planta baja) si está a menos de
 * `maximoM` metros: así el punto azul se ve sobre los caminos y no dentro de un jardín o un muro.
 */
export function ajustarACamino(datos: DatosCampus, x: number, y: number, maximoM = 12): { x: number; y: number } {
  const porId = new Map(datos.lugares.map((l) => [l.id, l]));
  let mejor: { x: number; y: number } | null = null;
  let minimo = Infinity;
  for (const c of datos.caminos) {
    const p = porId.get(c.desde);
    const q = porId.get(c.hasta);
    if (p?.x == null || p.y == null || q?.x == null || q.y == null || p.piso !== 0 || q.piso !== 0) continue;
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const largo2 = dx * dx + dy * dy;
    const t = largo2 ? Math.max(0, Math.min(1, ((x - p.x) * dx + (y - p.y) * dy) / largo2)) : 0;
    const px = p.x + t * dx;
    const py = p.y + t * dy;
    const d = Math.hypot(px - x, py - y);
    if (d < minimo) {
      minimo = d;
      mejor = { x: px, y: py };
    }
  }
  return mejor && minimo * datos.config.metros_por_pixel <= maximoM ? mejor : { x, y };
}
