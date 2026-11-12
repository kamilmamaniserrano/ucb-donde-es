import { normalizar } from './busqueda';

/** Clase de un horario de aula. `dia`: 1 = lunes … 6 = sábado. Horas en formato "HH:MM" de La Paz. */
export interface Clase {
  dia: number;
  inicio: string;
  fin: string;
  sigla: string | null;
  paralelo: string | null;
  materia: string;
  docente: string | null;
}

export interface Aula {
  codigo: string;
  nivel: string;
  tipo: 'aula' | 'laboratorio';
  nombre: string | null;
  capacidad: number | null;
  /** Foto del horario pegado en la puerta: es la referencia oficial. */
  foto: string | null;
  nota: string | null;
  clases: Clase[];
}

export interface Nivel {
  id: string;
  nombre: string;
  piso: number;
  croquis: string;
  contenido: string[];
}

/** Pisos, croquis y horarios de un bloque (public/datos/bloque-*.json). */
export interface Interior {
  bloque: string;
  lugar_id: string;
  nombre: string;
  semestre: string;
  fuente: string;
  niveles: Nivel[];
  aulas: Aula[];
}

export const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const ARCHIVOS = ['/datos/bloque-c.json'];

export async function cargarInteriores(): Promise<Interior[]> {
  const cargados = await Promise.all(
    ARCHIVOS.map(async (archivo) => {
      try {
        const r = await fetch(archivo);
        return r.ok ? ((await r.json()) as Interior) : null;
      } catch {
        return null;
      }
    }),
  );
  return cargados.filter((i): i is Interior => i !== null);
}

// Bolivia usa UTC-4 todo el año.
function horaLaPaz(ahora: number): { dia: number; hhmm: string } {
  const lp = new Date(ahora - 4 * 60 * 60 * 1000);
  return { dia: lp.getUTCDay(), hhmm: lp.toISOString().slice(11, 16) };
}

/** Clase en curso en el aula, o null si está libre. */
export function claseActual(aula: Aula, ahora = Date.now()): Clase | null {
  const { dia, hhmm } = horaLaPaz(ahora);
  return aula.clases.find((c) => c.dia === dia && c.inicio <= hhmm && hhmm < c.fin) ?? null;
}

/** Próxima clase de hoy en el aula. */
export function siguienteClase(aula: Aula, ahora = Date.now()): Clase | null {
  const { dia, hhmm } = horaLaPaz(ahora);
  return aula.clases.find((c) => c.dia === dia && c.inicio > hhmm) ?? null;
}

export const hoyEnLaPaz = (ahora = Date.now()) => horaLaPaz(ahora).dia;

export const nombreAula = (a: Aula) => (a.nombre ? `${a.codigo} · ${a.nombre}` : `Aula ${a.codigo}`);

export function nivelDe(interior: Interior, aula: Aula): Nivel | undefined {
  return interior.niveles.find((n) => n.id === aula.nivel);
}

export const textoClase = (c: Clase) =>
  `${DIAS[c.dia].slice(0, 3).toLowerCase()} ${c.inicio}–${c.fin}`;

export interface ResultadoAula {
  interior: Interior;
  aula: Aula;
  /** Clases que coincidieron con la búsqueda (vacío si se buscó el código del aula). */
  clases: Clase[];
}

/**
 * Busca aulas por código ("C-001", "c001", "aula c 201"), materia, sigla o docente.
 * Agrupa por aula: «Control I» devuelve cada aula donde se dicta, con sus horarios.
 */
export function buscarAulas(interiores: Interior[], consulta: string): ResultadoAula[] {
  const q = normalizar(consulta).replace(/^aula\s*/, '');
  if (q.length < 3) return [];
  const codigo = q.replace(/[\s-]/g, '');
  // Primero palabras completas («control i» no debe traer «Control II»); si nada coincide, cualquier parte.
  const palabraCompleta = new RegExp(`(^|[^a-z0-9])${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`);
  const buscar = (coincide: (materia: string) => boolean) => {
    const resultados: ResultadoAula[] = [];
    for (const interior of interiores) {
      for (const aula of interior.aulas) {
        if (normalizar(aula.codigo).replace('-', '') === codigo) {
          resultados.unshift({ interior, aula, clases: [] });
          continue;
        }
        const clases = aula.clases.filter(
          (c) =>
            coincide(normalizar(c.materia)) ||
            (c.sigla && normalizar(c.sigla).replace('-', '') === codigo) ||
            (c.docente && q.length >= 4 && normalizar(c.docente).includes(q)),
        );
        if (clases.length) resultados.push({ interior, aula, clases });
        else if (aula.nombre && normalizar(aula.nombre).includes(q)) resultados.push({ interior, aula, clases: [] });
      }
    }
    return resultados;
  };
  const exactos = buscar((m) => palabraCompleta.test(m));
  return (exactos.length ? exactos : buscar((m) => m.includes(q))).slice(0, 20);
}

export interface ResultadoPiso {
  interior: Interior;
  nivel: Nivel;
  /** Lo que coincidió del cartel del piso, por ejemplo «Laboratorio de Robótica y Automatización». */
  elemento: string;
}

const RELLENO_PISOS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'en', 'lab']);

/** Busca en lo que dice el cartel de cada piso: «laboratorio de quimica» → Piso 3 del Bloque C. */
export function buscarEnPisos(interiores: Interior[], consulta: string): ResultadoPiso[] {
  const palabras = normalizar(consulta)
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= 3 && !RELLENO_PISOS.has(p));
  if (!palabras.length) return [];
  const resultados: (ResultadoPiso & { exacto: boolean })[] = [];
  for (const interior of interiores) {
    for (const nivel of interior.niveles) {
      for (const elemento of nivel.contenido) {
        const texto = normalizar(elemento);
        if (!palabras.every((p) => texto.includes(p))) continue;
        // «química» como palabra propia va antes que dentro de «bioquímica».
        const exacto = palabras.every((p) => new RegExp(`(^|[^a-z0-9])${p}`).test(texto));
        resultados.push({ interior, nivel, elemento, exacto });
      }
    }
  }
  return resultados.sort((a, b) => Number(b.exacto) - Number(a.exacto)).slice(0, 10);
}
