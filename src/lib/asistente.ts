import { buscarEnCampus, normalizar, type ResultadoBusqueda } from './busqueda';
import {
  buscarAulas,
  buscarEnPisos,
  claseActual,
  nivelDe,
  nombreAula,
  siguienteClase,
  textoClase,
  type Interior,
} from './interiores';
import { calcularRuta, formatoDistancia, formatoTiempo, INGRESO_PRINCIPAL } from './rutas';
import { claveDia, estadoEvento, rangoEvento } from './tiempo';
import { esVisible, type DatosCampus, type Evento, type Lugar } from './tipos';

/**
 * Asistente de la página: entiende preguntas frecuentes por palabras clave (sin servicios externos)
 * y responde con texto y botones que ejecutan acciones en la app.
 */

export type Accion =
  | { tipo: 'ir'; etiqueta: string; lugarId: string; desdeId?: string; accesible?: boolean }
  | { tipo: 'eventos' | 'directorio' | 'vista3d' | 'gps' | 'accesible'; etiqueta: string }
  /** Abre los pisos y horarios de un bloque, en un aula (codigo) o en un piso (nivel) si se indican. */
  | { tipo: 'aula'; etiqueta: string; lugarId: string; codigo: string | null; nivel?: string }
  | { tipo: 'pregunta'; etiqueta: string; texto: string };

export interface Respuesta {
  texto: string;
  acciones?: Accion[];
  /** "baja": el asistente local no entendió la pregunta; conviene preguntarle a la IA. */
  confianza?: 'baja';
}

export interface Contexto {
  datos: DatosCampus;
  desdeId: string;
  accesible: boolean;
  /** Pisos y horarios de aulas (por ahora, del Bloque C). */
  interiores?: Interior[];
  ahora?: number;
}

const pregunta = (texto: string): Accion => ({ tipo: 'pregunta', etiqueta: texto, texto });
const conPunto = (s: string) => (/[.!?…]$/.test(s) ? s : `${s}.`);

export const SUGERENCIAS: Accion[] = [
  pregunta('¿Qué eventos hay?'),
  pregunta('¿Cómo llego al Coliseo?'),
  pregunta('¿Dónde queda Kardex?'),
  pregunta('¿Cómo uso el GPS?'),
  pregunta('Necesito una ruta sin escaleras'),
  pregunta('¿Qué puedes hacer?'),
];

export function saludo(): Respuesta {
  return {
    texto:
      '¡Hola! Soy el asistente de ¿Dónde es?. Te digo cómo llegar a cualquier bloque, oficina o aula del campus, ' +
      'qué eventos hay y cómo usar la página. ¿En qué te ayudo?',
    acciones: SUGERENCIAS.slice(0, 4),
  };
}

const ACCESIBLE = /escalera|gradas|silla de ruedas|movilidad|accesib|rampa|ascensor|discapacidad|muleta/;

/** La pregunta pide evitar escaleras (silla de ruedas, muletas, etc.). */
export const pideSinEscaleras = (pregunta: string) => ACCESIBLE.test(normalizar(pregunta));

// Temas de ayuda sobre la página, reconocidos por palabras clave (texto ya sin tildes).
const AYUDAS: { claves: RegExp; respuesta: Respuesta }[] = [
  {
    claves: /\bgps\b|mi ubicacion|ubicarme|donde estoy|mi posicion|localizarme/,
    respuesta: {
      texto:
        'En «Cómo llegar», toca «Usar mi ubicación (GPS)» y acepta el permiso. Verás un punto azul donde estás y la ruta ' +
        'saldrá del lugar más cercano.\n\nConsejos: funciona mejor al aire libre; activa la «ubicación precisa» del celular ' +
        'y deja el wifi encendido. Dentro de los edificios es más exacto escanear un código QR.',
      acciones: [{ tipo: 'gps', etiqueta: 'Activar mi ubicación' }],
    },
  },
  {
    claves: /\bqr\b|escanear/,
    respuesta: {
      texto:
        'En puntos clave del campus hay códigos QR. Escanéalo con la cámara del celular: la página se abre sabiendo ' +
        'exactamente dónde estás, y desde ahí te muestra los eventos y cómo llegar a cualquier lugar.',
    },
  },
  {
    claves: /\b3d\b|tres d|tridimensional/,
    respuesta: {
      texto:
        'Toca «Ver en 3D» arriba a la derecha del mapa. Arrastra para girar y pellizca (o usa la rueda del mouse) para ' +
        'acercar. Si tu destino está en un piso alto, como el Paraninfo (piso 5 del Bloque D), ese piso se ilumina en naranja.',
      acciones: [{ tipo: 'vista3d', etiqueta: 'Abrir la vista 3D' }],
    },
  },
  {
    claves: /calendario|recordatorio|agendar/,
    respuesta: {
      texto:
        'En la pestaña «Eventos», cada evento tiene el botón «Agregar a mi calendario»: lo guarda en Google Calendar con ' +
        'la fecha, el lugar y el enlace para llegar.',
      acciones: [{ tipo: 'eventos', etiqueta: 'Ver los eventos' }],
    },
  },
  {
    claves: /\badmin|administra|publicar|(subir|crear|cargar|editar|registrar|agregar) (un |mi |el )?evento/,
    respuesta: {
      texto:
        'Los eventos los publica el personal autorizado desde la página /admin, con su correo y contraseña. Ahí se crean, ' +
        'editan y eliminan eventos, y se calibran la escala del mapa y el GPS. Si necesitas publicar un evento, pide una ' +
        'cuenta al equipo que administra la página.',
    },
  },
  {
    claves: /compartir|\benlace\b|\blink\b|(enviar|mandar) la ruta/,
    respuesta: {
      texto:
        'La dirección de la página guarda la ruta que estás viendo: cópiala y compártela (por ejemplo, por WhatsApp). ' +
        'Quien la abra verá el mismo origen y destino.',
    },
  },
  {
    claves: /\bdirectorio\b/,
    respuesta: {
      texto:
        'En la pestaña «Directorio» puedes buscar oficinas, carreras o aulas (por ejemplo: Kardex, Caja, D12) y ver cómo ' +
        'llegar. También puedes preguntarme directamente, por ejemplo: «¿Dónde queda Caja?».',
      acciones: [{ tipo: 'directorio', etiqueta: 'Abrir el directorio' }],
    },
  },
];

const AYUDA_ACCESIBLE: Respuesta = {
  texto:
    'Marca «Ruta sin escaleras (movilidad reducida)» en «Cómo llegar»: la ruta evitará gradas y calculará el tiempo a un ' +
    'paso más tranquilo. Si a un lugar no se puede llegar sin escaleras con los datos actuales (por ejemplo, el Paraninfo, ' +
    'en el piso 5), te lo indicaré: en ese caso pide ayuda en la Oficina de Informaciones (Bloque K).\n\n' +
    'También puedes preguntarme: «¿Cómo llego a la Biblioteca sin escaleras?».',
  acciones: [{ tipo: 'accesible', etiqueta: 'Activar ruta sin escaleras' }],
};

const CAPACIDADES: Respuesta = {
  texto:
    'Puedo ayudarte con:\n' +
    '• Cómo llegar a un bloque, oficina o aula: «¿Cómo llego a Caja?», «¿Dónde queda el aula D12?».\n' +
    '• Los eventos de la UCB: «¿Qué eventos hay hoy?», «¿Cuándo es la Meca Gala?».\n' +
    '• Aulas y horarios del Bloque C: «¿Dónde es Control I?», «¿Qué clase hay ahora en el C-201?».\n' +
    '• Usar el GPS, los códigos QR, la vista 3D o la ruta sin escaleras.\n' +
    '• Encontrar oficinas y carreras en el directorio.',
  acciones: SUGERENCIAS.slice(0, 5),
};

// Palabras que rodean al nombre del lugar en una pregunta ("cómo llego al ...", "dónde queda la ...").
const RELLENO = new Set(
  (
    'como llego llegar llegamos voy ir donde queda quedan esta estan es son se encuentra encuentro encontrar ubicado ' +
    'ubicada quiero necesito busco buscar llevame lleva ruta camino hacia hasta para por favor el la los las lo de del al ' +
    'a un una en que cual mi me hay y o cuanto tardo demoro tiempo distancia tengo puedo podria ayudame ayuda dime decime ' +
    'oficina bloque bloques edificio campus universidad ucb aula piso sin escaleras escalera gradas silla ruedas ' +
    'clase clases materia materias horario horarios dicta dictan da dan pasa pasan toca tengo hoy ahora docente ' +
    'profesor profesora ingeniero ingeniera licenciado licenciada ing lic'
  ).split(' '),
);

// Formas comunes de pedir un lugar sin decir su nombre.
const SINONIMOS: [RegExp, string][] = [
  [/\b(comer|almorzar|comida|cafe|snack|desayunar|merienda)\b/, 'cafeteria'],
  [/\b(libros?|prestamo|estudiar)\b/, 'biblioteca'],
  [/\b(misa|rezar|orar)\b/, 'capilla'],
  [/\b(medico|enfermeria|doctor|primeros auxilios)\b/, 'centro medico'],
  [/\b(pagar|pago|pagos|tesoreria|mensualidad)\b/, 'caja'],
  [/\b(notas|certificados?|kardex)\b/, 'kardex'],
  [/\b(informacion|informaciones|consultas)\b/, 'informaciones'],
  [/\b(deportes?|basquet|futbol|partido|cancha)\b/, 'coliseo'],
  [/\b(inscripcion|inscribirme|admision)\b/, 'admision'],
];

// Palabras que aparecen en muchas oficinas: no sirven para decidir de qué lugar se habla.
const GENERICAS = new Set(
  (
    'carrera carreras departamento sala docentes laboratorio laboratorios oficinas centro unidad facultad decanatura ' +
    'postgrado aulas instituto servicio servicios coordinacion direccion gestion'
  ).split(' '),
);

const INTENCION_LUGAR =/como (llego|llegar|voy)|donde|\bir a|llevame|\bruta\b|queda|busco|encuentro|cuanto (tardo|demoro|camino)/;

/** Lo que se pregunta, sin las palabras de alrededor: «dónde es control i» → «control i». */
function fraseCentral(texto: string): string {
  const palabras = texto.split(/[^a-z0-9ñ]+/).filter(Boolean);
  let i = 0;
  let j = palabras.length;
  while (i < j && RELLENO.has(palabras[i])) i++;
  while (j > i && RELLENO.has(palabras[j - 1])) j--;
  return palabras.slice(i, j).join(' ');
}

function resolverLugar(datos: DatosCampus, texto: string): ResultadoBusqueda | null {
  const bloque = texto.match(/\bbloque\s+([a-z])\b/);
  if (bloque) {
    const letra = bloque[1].toUpperCase();
    const lugar = datos.lugares.find((l) => esVisible(l) && l.tipo === 'bloque' && l.bloque === letra);
    if (lugar) return { lugar, detalle: null };
  }
  const aula = texto.match(/\baula\s*([a-z])\s*-?\s*(\d{1,2})\b/) ?? texto.match(/\b([a-z])-?(\d{1,2})\b/);
  if (aula) {
    const [primero] = buscarEnCampus(datos, `${aula[1]}${aula[2]}`);
    if (primero) return primero;
  }

  const palabras = texto.split(/[^a-z0-9ñ]+/).filter(Boolean);
  const frase = fraseCentral(texto);
  if (frase) {
    const [primero] = buscarEnCampus(datos, frase);
    if (primero) return primero;
  }

  for (const [patron, consulta] of SINONIMOS) {
    if (patron.test(texto)) {
      const [primero] = buscarEnCampus(datos, consulta);
      if (primero) return primero;
    }
  }

  // Último intento: palabra por palabra, gana el lugar que más coincide.
  const votos = new Map<string, { resultado: ResultadoBusqueda; n: number }>();
  for (const p of palabras) {
    if (p.length < 4 || RELLENO.has(p) || GENERICAS.has(p)) continue;
    const vistos = new Set<string>();
    for (const r of buscarEnCampus(datos, p)) {
      if (vistos.has(r.lugar.id)) continue;
      vistos.add(r.lugar.id);
      const v = votos.get(r.lugar.id);
      if (v) v.n++;
      else votos.set(r.lugar.id, { resultado: r, n: 1 });
    }
  }
  let mejor: { resultado: ResultadoBusqueda; n: number } | null = null;
  for (const v of votos.values()) if (!mejor || v.n > mejor.n) mejor = v;
  return mejor?.resultado ?? null;
}

function resumenRuta(ctx: Contexto, lugar: Lugar, accesible: boolean, desdeId = ctx.desdeId): string {
  const r = calcularRuta(ctx.datos, desdeId, lugar.id, accesible);
  if (!r.ok) return r.motivo === 'Ya estás en ese lugar.' ? 'Según la página, ya estás ahí.' : r.motivo;
  const { ruta } = r;
  const pisos = ruta.pisos ? ` y subir ${ruta.pisos} ${ruta.pisos === 1 ? 'piso' : 'pisos'}` : '';
  const sinEscaleras = accesible ? ' sin escaleras' : '';
  const texto = `Desde ${ruta.desde.nombre} son unos ${formatoDistancia(ruta.distancia_m)}${sinEscaleras} (${formatoTiempo(ruta.tiempo_s)} caminando)${pisos}.`;
  return desdeId === INGRESO_PRINCIPAL
    ? `${texto} Lo calculé desde el ingreso principal: si estás en otro lugar, cámbialo en «¿Dónde estás?» o usa el GPS.`
    : texto;
}

/** Resumen de la ruta (metros, minutos y pisos) hasta un lugar, calculado por la app. */
export function resumenDeRuta(ctx: Contexto, lugarId: string, accesible: boolean): string | null {
  const lugar = ctx.datos.lugares.find((l) => l.id === lugarId);
  return lugar ? resumenRuta(ctx, lugar, accesible) : null;
}

function respuestaLugar(ctx: Contexto, { lugar, detalle }: ResultadoBusqueda, accesible: boolean, desdeId?: string): Respuesta {
  const donde = detalle
    ? conPunto(`${detalle.split(' · ')[0]} está en ${lugar.nombre}`)
    : conPunto(`${lugar.nombre}${lugar.descripcion ? `: ${lugar.descripcion}` : ''}`);
  return {
    texto: `${donde}\n\n${resumenRuta(ctx, lugar, accesible, desdeId)}`,
    acciones: [
      { tipo: 'ir', lugarId: lugar.id, desdeId, accesible, etiqueta: accesible ? 'Ver la ruta sin escaleras' : 'Ver la ruta en el mapa' },
    ],
  };
}

// Preguntas sobre aulas y clases: se responden con los horarios antes de buscar lugares.
const PIDE_AULA = /\baula\b|\bclases?\b|\bmaterias?\b|horario|docente|profesor|\bc\s*-?\s*\d{3}\b|\bsigla|paralelo/;

/** «en la Planta Baja», «en el Piso 2». */
const enNivel = (nombre: string) => `en ${/^(planta|terraza)/i.test(nombre) ? 'la' : 'el'} ${nombre}`;

function respuestaAulas(ctx: Contexto, texto: string, porPalabras: boolean): Respuesta | null {
  const interiores = ctx.interiores ?? [];
  if (!interiores.length) return null;
  const codigo = texto.match(/\bc\s*-?\s*(\d{3})\b/);
  // Primero la frase completa («control i»); si la pregunta es claramente sobre clases,
  // también cada palabra importante («¿en qué aula da clases Clavijo?» → «clavijo»).
  const frase = fraseCentral(texto);
  const palabras = porPalabras ? frase.split(' ').filter((p) => p.length >= 4 && !GENERICAS.has(p)) : [];
  const candidatas = codigo ? [`c${codigo[1]}`] : [frase, ...palabras.sort((a, b) => b.length - a.length)];
  let resultados: ReturnType<typeof buscarAulas> = [];
  for (const c of candidatas) {
    resultados = buscarAulas(interiores, c);
    if (resultados.length) break;
  }
  if (!resultados.length) return null;
  const [primero] = resultados;
  const { interior } = primero;
  const lugar = ctx.datos.lugares.find((l) => l.id === interior.lugar_id);
  const irAlBloque: Accion[] = lugar ? [{ tipo: 'ir', lugarId: lugar.id, etiqueta: `Cómo llegar al Bloque ${interior.bloque}` }] : [];

  // Se preguntó por un aula concreta: dónde está y qué hay ahora.
  if (!primero.clases.length) {
    const { aula } = primero;
    const actual = claseActual(aula, ctx.ahora);
    const siguiente = siguienteClase(aula, ctx.ahora);
    const estado = actual
      ? `Ahora hay ${actual.materia} (hasta las ${actual.fin}).`
      : siguiente
        ? `Ahora está libre; hoy la próxima clase es ${siguiente.materia} a las ${siguiente.inicio}.`
        : 'Ahora está libre y hoy ya no tiene más clases.';
    const capacidad = aula.capacidad ? `, con capacidad para ${aula.capacidad}` : '';
    const ruta = lugar ? `\n\n${resumenRuta(ctx, lugar, ctx.accesible)}` : '';
    return {
      texto: `${nombreAula(aula)} está ${enNivel(nivelDe(interior, aula)?.nombre ?? '')} del Bloque ${interior.bloque}${capacidad}. ${estado}${ruta}`,
      acciones: [{ tipo: 'aula', lugarId: interior.lugar_id, codigo: aula.codigo, etiqueta: `Horario del ${aula.codigo}` }, ...irAlBloque],
    };
  }

  // Se preguntó por una materia o un docente: en qué aulas y a qué hora.
  const materia = primero.clases[0].materia;
  const unaMateria = resultados.every((r) => r.clases.every((c) => c.materia === materia));
  const lineas = resultados.slice(0, 4).map(({ aula, clases }) => {
    const donde = `• ${nombreAula(aula)}, ${nivelDe(interior, aula)?.nombre}`;
    if (!clases.length) return donde;
    const cuando = clases.map((c) => (unaMateria ? textoClase(c) : `${c.materia} (${textoClase(c)})`)).join(', ');
    return `${donde}: ${cuando}`;
  });
  const titulo = unaMateria ? `«${materia}» se dicta en el Bloque ${interior.bloque}:` : `Encontré estas clases en el Bloque ${interior.bloque}:`;
  const mas = resultados.length > 4 ? `\n…y en ${resultados.length - 4} aulas más (búscalas en el Directorio).` : '';
  return {
    texto: `${titulo}\n${lineas.join('\n')}${mas}\n\nSegún los horarios del ${interior.semestre.toLowerCase()}.`,
    acciones: [
      ...resultados.slice(0, 2).map(({ aula }): Accion => ({ tipo: 'aula', lugarId: interior.lugar_id, codigo: aula.codigo, etiqueta: `Ver ${aula.codigo}` })),
      ...irAlBloque,
    ],
  };
}

/** Laboratorios u otros espacios que figuran en el cartel de cada piso. */
function respuestaPiso(ctx: Contexto, texto: string): Respuesta | null {
  const [r] = buscarEnPisos(ctx.interiores ?? [], fraseCentral(texto));
  if (!r) return null;
  const lugar = ctx.datos.lugares.find((l) => l.id === r.interior.lugar_id);
  const ruta = lugar ? `\n\n${resumenRuta(ctx, lugar, ctx.accesible)}` : '';
  return {
    texto: `${r.elemento} está ${enNivel(r.nivel.nombre)} del Bloque ${r.interior.bloque}.${ruta}`,
    acciones: [
      { tipo: 'aula', lugarId: r.interior.lugar_id, codigo: null, nivel: r.nivel.id, etiqueta: `Ver ${r.nivel.nombre}` },
      ...(lugar ? [{ tipo: 'ir', lugarId: lugar.id, etiqueta: `Cómo llegar al Bloque ${r.interior.bloque}` } as Accion] : []),
    ],
  };
}

// Palabras de los títulos de eventos que también aparecen en lugares u oficinas (ej. "marketing")
// no bastan por sí solas para reconocer un evento.
function eventoMencionado(datos: DatosCampus, texto: string): Evento | null {
  const nombresCampus = [...datos.lugares.map((l) => l.nombre), ...datos.dependencias.map((d) => d.nombre)].map(normalizar).join(' ');
  let mejor: { evento: Evento; puntos: number } | null = null;
  for (const evento of datos.eventos) {
    const claves = new Set(normalizar(evento.titulo).split(/[^a-z0-9]+/).filter((p) => p.length >= 4 && !/^\d+$/.test(p)));
    let fuertes = 0;
    let total = 0;
    for (const clave of claves) {
      if (!new RegExp(`\\b${clave}\\b`).test(texto)) continue;
      total++;
      if (!nombresCampus.includes(clave)) fuertes++;
    }
    const puntos = fuertes * 2 + total;
    if ((fuertes >= 1 || total >= 2) && (!mejor || puntos > mejor.puntos)) mejor = { evento, puntos };
  }
  return mejor?.evento ?? null;
}

function respuestaEvento(ctx: Contexto, evento: Evento): Respuesta {
  const lugar = ctx.datos.lugares.find((l) => l.id === evento.lugar_id);
  const estado = estadoEvento(evento, ctx.ahora);
  const cuando =
    estado === 'en-curso' ? ' ¡Está en curso ahora!' : estado === 'finalizado' ? ' Este evento ya terminó.' : '';
  const confirmar = evento.por_confirmar ? ' (La fecha o el horario están por confirmar.)' : '';
  const donde = evento.ambiente ?? lugar?.nombre ?? 'lugar por confirmar';
  const texto = `${evento.titulo}: ${rangoEvento(evento)}, en ${conPunto(donde)}${cuando}${confirmar}`;
  if (!lugar || estado === 'finalizado') return { texto };
  return {
    texto: `${texto}\n\n${resumenRuta(ctx, lugar, ctx.accesible)}`,
    acciones: [{ tipo: 'ir', lugarId: lugar.id, etiqueta: `Cómo llegar a ${lugar.nombre}` }],
  };
}

function respuestaEventos(ctx: Contexto, soloHoy: boolean): Respuesta {
  const ahora = ctx.ahora ?? Date.now();
  const hoy = claveDia(new Date(ahora));
  const vigentes = ctx.datos.eventos
    .map((e) => ({ e, estado: estadoEvento(e, ahora) }))
    .filter(({ e, estado }) =>
      soloHoy ? estado === 'en-curso' || claveDia(new Date(e.inicio)) === hoy : estado !== 'finalizado',
    )
    .sort((a, b) =>
      a.estado === b.estado ? Date.parse(a.e.inicio) - Date.parse(b.e.inicio) : a.estado === 'en-curso' ? -1 : 1,
    )
    .slice(0, 4);
  if (!vigentes.length) {
    return {
      texto: soloHoy ? 'Hoy no hay eventos programados.' : 'Por ahora no hay eventos próximos publicados.',
      acciones: [{ tipo: 'eventos', etiqueta: 'Ver todos los eventos' }],
    };
  }
  const porId = new Map(ctx.datos.lugares.map((l) => [l.id, l]));
  const lineas = vigentes.map(({ e, estado }) => {
    const donde = e.ambiente ?? porId.get(e.lugar_id)?.nombre ?? '';
    return `• ${e.titulo} — ${rangoEvento(e)} — ${donde}${estado === 'en-curso' ? ' (en curso)' : ''}`;
  });
  const acciones: Accion[] = vigentes.slice(0, 3).map(({ e }) => ({
    tipo: 'ir',
    lugarId: e.lugar_id,
    etiqueta: `Ir a: ${e.titulo.length > 26 ? `${e.titulo.slice(0, 25)}…` : e.titulo}`,
  }));
  acciones.push({ tipo: 'eventos', etiqueta: 'Ver todos los eventos' });
  return { texto: `${soloHoy ? 'Eventos de hoy:' : 'Estos son los próximos eventos:'}\n${lineas.join('\n')}`, acciones };
}

export function responder(pregunta: string, ctx: Contexto): Respuesta {
  const texto = normalizar(pregunta)
    .replace(/[¿?¡!.,;:]/g, ' ')
    .replace(/\bgraduaci(o|on|ones)\b/g, 'colacion')
    .replace(/\bhackat(h)?on\b/g, 'mecaton')
    .replace(/\s+/g, ' ')
    .trim();
  const palabras = texto ? texto.split(' ').length : 0;
  if (!texto) return saludo();

  if (palabras <= 4 && /\b(gracias|genial|perfecto|listo|vale|ok)\b/.test(texto)) {
    return { texto: '¡De nada! Si necesitas algo más, aquí estoy.' };
  }
  if (palabras <= 4 && /^(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|que tal)\b/.test(texto)) {
    return saludo();
  }

  for (const ayuda of AYUDAS) if (ayuda.claves.test(texto)) return ayuda.respuesta;

  const evento = eventoMencionado(ctx.datos, texto);
  if (evento) return respuestaEvento(ctx, evento);
  if (/\beventos?\b|actividad|que hay|\bagenda\b|programa|cartelera|\bhoy\b|esta semana|proxim/.test(texto)) {
    return respuestaEventos(ctx, /\bhoy\b/.test(texto));
  }

  const accesible = ctx.accesible || ACCESIBLE.test(texto);
  // "desde la biblioteca hasta el coliseo"
  const tramo = texto.match(/\bdesde (.+?) (?:hasta|hacia|al|a) (.+)/);
  if (tramo) {
    const desde = resolverLugar(ctx.datos, tramo[1]);
    const hasta = resolverLugar(ctx.datos, tramo[2]);
    if (desde && hasta && esVisible(desde.lugar)) return respuestaLugar(ctx, hasta, accesible, desde.lugar.id);
  }
  const pideAula = PIDE_AULA.test(texto);
  const aula = pideAula ? respuestaAulas(ctx, texto, true) : null;
  if (aula) return aula;
  const lugar = resolverLugar(ctx.datos, texto);
  if (lugar) return respuestaLugar(ctx, lugar, accesible);
  const piso = respuestaPiso(ctx, texto);
  if (piso) return piso;
  const materia = pideAula ? null : respuestaAulas(ctx, texto, false);
  if (materia) return materia;

  if (ACCESIBLE.test(texto)) return AYUDA_ACCESIBLE;
  if (/que (puedes|sabes) hacer|\bayuda\b|como funciona|para que sirve|que es esta pagina|\bmenu\b|opciones/.test(texto)) {
    return CAPACIDADES;
  }
  if (INTENCION_LUGAR.test(texto)) {
    return {
      texto:
        'No encontré ese lugar en el mapa del campus. Prueba con el nombre del bloque, la oficina o el aula (por ejemplo: ' +
        '«Bloque F», «Caja», «D12»). Si buscas algo que no está en el mapa, pregunta en la Oficina de Informaciones (Bloque K).',
      acciones: [{ tipo: 'directorio', etiqueta: 'Buscar en el directorio' }],
      confianza: 'baja',
    };
  }
  return {
    texto:
      'No entendí bien tu pregunta. Prueba con algo como «¿Cómo llego a la Biblioteca?», «¿Dónde queda Caja?» o ' +
      '«¿Qué eventos hay hoy?».',
    acciones: SUGERENCIAS.slice(0, 4),
    confianza: 'baja',
  };
}
