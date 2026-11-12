export type TipoLugar = 'ingreso' | 'bloque' | 'punto' | 'cruce';

/** Punto del grafo. x/y están en píxeles del plano (mapa-campus.png, 664×489). */
export interface Lugar {
  id: string;
  nombre: string;
  tipo: TipoLugar;
  bloque: string | null;
  x: number | null;
  y: number | null;
  piso: number;
  descripcion: string | null;
  direccion: string | null;
}

export type TipoCamino = 'camino' | 'escaleras' | 'rampa' | 'ascensor';

/** Tramo caminable entre dos lugares; se puede recorrer en ambos sentidos. */
export interface Camino {
  desde: string;
  hasta: string;
  tipo: TipoCamino;
  /** Distancia medida en metros. Si es null se calcula con la escala del plano. */
  distancia_m: number | null;
  indicacion: string | null;
  indicacion_vuelta: string | null;
}

export interface Dependencia {
  lugar_id: string;
  nombre: string;
}

export interface Evento {
  id: string;
  titulo: string;
  descripcion: string | null;
  inicio: string;
  fin: string;
  lugar_id: string;
  ambiente: string | null;
  organizador: string | null;
  por_confirmar: boolean;
}

export interface Config {
  metros_por_pixel: number;
  escala_calibrada: number;
  velocidad_m_s: number;
  velocidad_accesible_m_s: number;
  velocidad_escaleras_m_s: number;
  metros_por_piso: number;
}

/** Punto que se reconoce en el plano (x, y en píxeles) y en el GPS (lat, lng). */
export interface PuntoControl {
  id?: number;
  nombre: string;
  x: number;
  y: number;
  lat: number;
  lng: number;
  precision_m?: number | null;
}

export interface DatosCampus {
  lugares: Lugar[];
  caminos: Camino[];
  dependencias: Dependencia[];
  eventos: Evento[];
  config: Config;
  /** Puntos de control para ubicar el GPS sobre el plano (mínimo 3). */
  puntosGps: PuntoControl[];
  origen: 'supabase' | 'local';
}

/** Lugares que se dibujan en el mapa: los únicos que se ofrecen como origen o destino. */
export function esVisible(l: Lugar): l is Lugar & { x: number; y: number } {
  return l.tipo !== 'cruce' && l.x != null && l.y != null;
}

export function ordenarPorNombre<T extends { nombre: string }>(lista: T[]): T[] {
  return [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}
