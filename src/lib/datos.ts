import type { Camino, Config, DatosCampus, Dependencia, Evento, Lugar, PuntoControl } from './tipos';
import { supabase } from './supabase';
import lugaresJson from '../data/lugares.json';
import caminosJson from '../data/caminos.json';
import dependenciasJson from '../data/dependencias.json';
import eventosJson from '../data/eventos.json';
import configJson from '../data/config.json';
import georreferenciaJson from '../data/georreferencia.json';

export const CONFIG_BASE: Config = configJson;
/** Puntos de control de respaldo, por si la tabla `georreferencia` no existe o tiene menos de 3 puntos. */
export const PUNTOS_GPS_LOCALES: PuntoControl[] = georreferenciaJson;

/** Datos incluidos en la app. Se usan si Supabase no está configurado o no responde. */
export function datosLocales(): DatosCampus {
  return {
    lugares: lugaresJson as unknown as Lugar[],
    caminos: caminosJson as unknown as Camino[],
    dependencias: dependenciasJson as Dependencia[],
    eventos: eventosJson as Evento[],
    config: CONFIG_BASE,
    puntosGps: PUNTOS_GPS_LOCALES,
    origen: 'local',
  };
}

const numeroONull = (v: unknown) => (v == null ? null : Number(v));

/** Puntos de control guardados con la calibración de /admin. */
export async function cargarPuntosGps(): Promise<{ puntos: PuntoControl[]; error: string | null }> {
  if (!supabase) return { puntos: [], error: 'Supabase no está configurado.' };
  const { data, error } = await supabase.from('georreferencia').select('id, nombre, x, y, lat, lng, precision_m').order('id');
  if (error) return { puntos: [], error: error.message };
  return {
    puntos: (data ?? []).map((p) => ({
      ...p,
      x: Number(p.x),
      y: Number(p.y),
      lat: Number(p.lat),
      lng: Number(p.lng),
      precision_m: numeroONull(p.precision_m),
    })),
    error: null,
  };
}

export async function cargarDatos(): Promise<DatosCampus> {
  if (!supabase) return datosLocales();
  try {
    const [lugares, caminos, dependencias, eventos, config, gps] = await Promise.all([
      supabase.from('lugares').select('*'),
      supabase.from('caminos').select('*'),
      supabase.from('dependencias').select('lugar_id, nombre'),
      supabase.from('eventos').select('*').order('inicio'),
      supabase.from('config').select('clave, valor'),
      cargarPuntosGps(),
    ]);
    const error = lugares.error ?? caminos.error ?? dependencias.error ?? eventos.error ?? config.error;
    if (error) throw error;
    if (!lugares.data?.length) throw new Error('La base de datos está vacía: falta ejecutar supabase/seed.sql');

    const cfg = { ...CONFIG_BASE };
    for (const fila of config.data ?? []) {
      if (fila.clave in cfg) cfg[fila.clave as keyof Config] = Number(fila.valor);
    }
    return {
      lugares: lugares.data.map((l) => ({ ...l, x: numeroONull(l.x), y: numeroONull(l.y), piso: Number(l.piso) })),
      caminos: (caminos.data ?? []).map((c) => ({ ...c, distancia_m: numeroONull(c.distancia_m) })),
      dependencias: dependencias.data ?? [],
      eventos: eventos.data ?? [],
      config: cfg,
      // La tabla de georreferencia es opcional: sin ella (o con menos de 3 puntos) se usan los de respaldo.
      puntosGps: gps.puntos.length >= 3 ? gps.puntos : PUNTOS_GPS_LOCALES,
      origen: 'supabase',
    };
  } catch (e) {
    console.warn('No se pudo leer Supabase; se usan los datos locales.', e);
    return datosLocales();
  }
}
