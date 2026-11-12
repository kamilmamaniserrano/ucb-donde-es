import { esVisible, type DatosCampus, type Lugar } from './tipos';

/** Minúsculas y sin tildes, para comparar texto escrito de cualquier forma. */
export const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export interface ResultadoBusqueda {
  lugar: Lugar;
  /** Dependencia o aula que coincidió, si la búsqueda no fue por el nombre del lugar. */
  detalle: string | null;
}

/**
 * Busca lugares del mapa por código de aula ("D12", "aula f3"), nombre, dependencia o descripción,
 * en ese orden de prioridad: así «biblioteca» encuentra la Biblioteca antes que un lugar que la menciona.
 */
export function buscarEnCampus(datos: DatosCampus, consulta: string): ResultadoBusqueda[] {
  const q = normalizar(consulta);
  if (!q) return [];
  const enMapa = datos.lugares.filter(esVisible);
  const porId = new Map(enMapa.map((l) => [l.id, l]));
  const resultados: ResultadoBusqueda[] = [];

  const aula = q.match(/^(?:aula\s*)?([a-z])\s*-?\s*(\d{1,2})$/);
  if (aula) {
    const letra = aula[1].toUpperCase();
    const lugar = enMapa.find((l) => l.bloque === letra && l.tipo === 'bloque');
    if (lugar) resultados.push({ lugar, detalle: `Aula ${letra}${aula[2]} · Bloque ${letra}` });
  }

  for (const l of enMapa) {
    if (normalizar(l.nombre).includes(q)) resultados.push({ lugar: l, detalle: null });
  }
  for (const d of datos.dependencias) {
    const lugar = porId.get(d.lugar_id);
    if (lugar && normalizar(d.nombre).includes(q)) resultados.push({ lugar, detalle: d.nombre });
  }
  for (const l of enMapa) {
    if (!normalizar(l.nombre).includes(q) && normalizar(l.descripcion ?? '').includes(q)) {
      resultados.push({ lugar: l, detalle: null });
    }
  }
  return resultados.slice(0, 40);
}
