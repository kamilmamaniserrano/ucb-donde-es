import type { Camino, Config, DatosCampus, Lugar, TipoCamino } from './tipos';

export const INGRESO_PRINCIPAL = 'ingreso_principal';

export interface Paso {
  texto: string;
  /** Metros recorridos en horizontal. */
  distancia_m: number;
  /** Pisos que se suben o bajan en este paso. */
  pisos: number;
  tipo: TipoCamino;
}

export interface Segmento {
  de: [number, number];
  a: [number, number];
  pisoDe: number;
  pisoA: number;
  tipo: TipoCamino;
}

export interface Ruta {
  desde: Lugar;
  hasta: Lugar;
  pasos: Paso[];
  segmentos: Segmento[];
  /** Metros caminados en horizontal (sin contar los pisos). */
  distancia_m: number;
  tiempo_s: number;
  pisos: number;
}

export type ResultadoRuta = { ok: true; ruta: Ruta } | { ok: false; motivo: string };

interface Arista {
  destino: string;
  camino: Camino;
  inversa: boolean;
  largo: number;
}

/** Metros que «cuesta» subir o bajar pisos en un tramo: en ascensor no se camina. */
const metrosVerticales = (c: Camino, a: Lugar, b: Lugar, cfg: Config) =>
  c.tipo === 'ascensor' ? 0 : Math.abs(a.piso - b.piso) * cfg.metros_por_piso;

export function largoCamino(c: Camino, a: Lugar, b: Lugar, cfg: Config): number {
  if (c.distancia_m != null) return c.distancia_m;
  const plano =
    a.x != null && a.y != null && b.x != null && b.y != null
      ? Math.hypot(a.x - b.x, a.y - b.y) * cfg.metros_por_pixel
      : 0;
  return plano + metrosVerticales(c, a, b, cfg);
}

function tiempoTramo(c: Camino, largo: number, pisos: number, cfg: Config, accesible: boolean): number {
  if (c.tipo === 'ascensor') return 30 + 5 * pisos;
  if (c.tipo === 'escaleras') return largo / cfg.velocidad_escaleras_m_s;
  return largo / (accesible ? cfg.velocidad_accesible_m_s : cfg.velocidad_m_s);
}

/**
 * Ruta más corta (Dijkstra, peso = metros) entre dos lugares.
 * Con `accesible` se descartan los tramos con escaleras.
 */
export function calcularRuta(datos: DatosCampus, desdeId: string, hastaId: string, accesible: boolean): ResultadoRuta {
  const cfg = datos.config;
  const porId = new Map(datos.lugares.map((l) => [l.id, l]));
  const desde = porId.get(desdeId);
  const hasta = porId.get(hastaId);
  if (!desde || !hasta) return { ok: false, motivo: 'Elige de dónde sales y a dónde vas.' };
  if (desde.id === hasta.id) return { ok: false, motivo: 'Ya estás en ese lugar.' };

  const ady = new Map<string, Arista[]>();
  const agregar = (id: string, arista: Arista) => {
    const lista = ady.get(id);
    if (lista) lista.push(arista);
    else ady.set(id, [arista]);
  };
  for (const c of datos.caminos) {
    if (accesible && c.tipo === 'escaleras') continue;
    const a = porId.get(c.desde);
    const b = porId.get(c.hasta);
    if (!a || !b) continue;
    const largo = largoCamino(c, a, b, cfg);
    agregar(a.id, { destino: b.id, camino: c, inversa: false, largo });
    agregar(b.id, { destino: a.id, camino: c, inversa: true, largo });
  }

  // El grafo tiene pocas decenas de nodos: basta con buscar el mínimo de forma lineal.
  const dist = new Map<string, number>([[desde.id, 0]]);
  const previo = new Map<string, { desde: string; arista: Arista }>();
  const visitados = new Set<string>();
  for (;;) {
    let actual: string | null = null;
    let minimo = Infinity;
    for (const [id, d] of dist) {
      if (!visitados.has(id) && d < minimo) {
        minimo = d;
        actual = id;
      }
    }
    if (actual === null || actual === hasta.id) break;
    visitados.add(actual);
    for (const arista of ady.get(actual) ?? []) {
      const nueva = minimo + arista.largo;
      if (nueva < (dist.get(arista.destino) ?? Infinity)) {
        dist.set(arista.destino, nueva);
        previo.set(arista.destino, { desde: actual, arista });
      }
    }
  }

  if (!dist.has(hasta.id)) {
    return {
      ok: false,
      motivo: accesible
        ? 'No hay una ruta sin escaleras registrada hasta este lugar. Pide ayuda en la Oficina de Informaciones (Bloque K).'
        : 'No hay caminos registrados hasta este lugar.',
    };
  }

  const tramos: { arista: Arista; hacia: Lugar; de: Lugar }[] = [];
  for (let id = hasta.id; id !== desde.id; ) {
    const p = previo.get(id)!;
    tramos.unshift({ arista: p.arista, hacia: porId.get(id)!, de: porId.get(p.desde)! });
    id = p.desde;
  }

  const pasos: Paso[] = [];
  const segmentos: Segmento[] = [];
  let tiempo = 0;
  let pisos = 0;
  let caminado = 0;
  for (const { arista, hacia, de } of tramos) {
    const c = arista.camino;
    const cambioPiso = Math.abs(hacia.piso - de.piso);
    const horizontal = c.distancia_m ?? arista.largo - metrosVerticales(c, de, hacia, cfg);
    pisos += cambioPiso;
    caminado += horizontal;
    tiempo += tiempoTramo(c, arista.largo, cambioPiso, cfg, accesible);
    const propia = arista.inversa ? c.indicacion_vuelta : c.indicacion;
    const generica = hacia.tipo === 'cruce' ? `Camina hacia ${hacia.nombre}` : `Camina hasta ${hacia.nombre}`;
    pasos.push({ texto: propia ?? generica, distancia_m: horizontal, pisos: cambioPiso, tipo: c.tipo });
    if (de.x != null && de.y != null && hacia.x != null && hacia.y != null) {
      segmentos.push({ de: [de.x, de.y], a: [hacia.x, hacia.y], pisoDe: de.piso, pisoA: hacia.piso, tipo: c.tipo });
    }
  }

  return {
    ok: true,
    ruta: {
      desde,
      hasta,
      pasos,
      segmentos,
      distancia_m: caminado,
      tiempo_s: tiempo,
      pisos,
    },
  };
}

export function formatoDistancia(m: number): string {
  return `${Math.max(5, Math.round(m / 5) * 5)} m`;
}

export function formatoTiempo(s: number): string {
  const min = Math.max(1, Math.round(s / 60));
  return `${min} min`;
}
