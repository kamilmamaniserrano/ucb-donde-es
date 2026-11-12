import { pideSinEscaleras, resumenDeRuta, type Accion, type Contexto, type Respuesta } from './asistente';
import { esVisible } from './tipos';

export interface MensajeChat {
  de: 'persona' | 'asistente';
  texto: string;
}

/** El servidor no tiene la IA configurada: no tiene sentido volver a intentar en esta visita. */
export class IANoDisponible extends Error {}

const TIPOS = new Set(['ir', 'eventos', 'directorio', 'vista3d', 'gps', 'accesible', 'aula']);

/**
 * Pregunta a la IA (Gemini, a través de /api/chat) y valida su respuesta: solo se aceptan acciones
 * conocidas y lugares que existen en el mapa. La distancia y el tiempo los agrega la app, no la IA.
 */
export async function preguntarIA(historial: MensajeChat[], ctx: Contexto): Promise<Respuesta> {
  const r = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mensajes: historial.slice(-8) }),
    // El servidor prueba hasta dos modelos de 9 s cada uno.
    signal: AbortSignal.timeout(22_000),
  });
  if (r.status === 503 || r.status === 404) throw new IANoDisponible();
  if (!r.ok) throw new Error(`La IA respondió ${r.status}`);

  const cuerpo = (await r.json()) as { texto?: unknown; acciones?: unknown };
  if (typeof cuerpo.texto !== 'string' || !cuerpo.texto.trim()) throw new Error('Respuesta vacía');

  const enMapa = new Set(ctx.datos.lugares.filter(esVisible).map((l) => l.id));
  // La necesidad de evitar escaleras se toma de la pregunta misma, no solo de lo que marque la IA.
  const ultimaPregunta = [...historial].reverse().find((m) => m.de === 'persona')?.texto ?? '';
  const sinEscaleras = ctx.accesible || pideSinEscaleras(ultimaPregunta);
  const acciones: Accion[] = [];
  for (const valor of Array.isArray(cuerpo.acciones) ? cuerpo.acciones : []) {
    const a = (valor ?? {}) as Record<string, unknown>;
    if (typeof a.tipo !== 'string' || !TIPOS.has(a.tipo)) continue;
    const etiqueta = typeof a.etiqueta === 'string' && a.etiqueta.trim() ? a.etiqueta.trim().slice(0, 40) : 'Ver';
    if (a.tipo === 'ir') {
      // A veces el modelo pega texto al id ("biblioteca accesible=true"): se toma la primera palabra.
      const lugarId = typeof a.lugarId === 'string' ? a.lugarId.trim().split(/[\s,;:]+/)[0] : '';
      if (enMapa.has(lugarId) && !acciones.some((x) => x.tipo === 'ir' && x.lugarId === lugarId)) {
        acciones.push({ tipo: 'ir', lugarId, accesible: a.accesible === true || sinEscaleras, etiqueta });
      }
    } else if (a.tipo === 'aula') {
      // Solo aulas que existen en los horarios cargados.
      const codigo = typeof a.aula === 'string' ? a.aula.trim().toUpperCase() : '';
      const interior = ctx.interiores?.find((i) => i.aulas.some((x) => x.codigo === codigo));
      if (interior) acciones.push({ tipo: 'aula', lugarId: interior.lugar_id, codigo, etiqueta });
    } else {
      acciones.push({ tipo: a.tipo as Exclude<Accion['tipo'], 'ir' | 'aula' | 'pregunta'>, etiqueta });
    }
  }

  let texto = cuerpo.texto.trim();
  const ir = acciones.find((a): a is Extract<Accion, { tipo: 'ir' }> => a.tipo === 'ir');
  // Si la IA sugiere la ruta sin escaleras junto a un destino, el botón de ir ya la aplica.
  if (ir && acciones.some((a) => a.tipo === 'accesible')) ir.accesible = true;
  const visibles = ir?.accesible ? acciones.filter((a) => a.tipo !== 'accesible') : acciones;
  const ruta = ir ? resumenDeRuta(ctx, ir.lugarId, ir.accesible === true || ctx.accesible) : null;
  if (ruta) texto += `\n\n${ruta}`;
  return { texto, acciones: visibles.slice(0, 3) };
}
