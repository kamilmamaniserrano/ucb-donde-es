import type { Evento } from './tipos';

const ZONA = 'America/La_Paz';
// Bolivia usa UTC-4 todo el año (no tiene horario de verano).
const DESFASE_MS = 4 * 60 * 60 * 1000;

const formato = (opciones: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('es-BO', { timeZone: ZONA, ...opciones });

const fDia = formato({ weekday: 'short', day: 'numeric', month: 'short' });
const fHora = formato({ hour: '2-digit', minute: '2-digit', hour12: false });
const fNumero = formato({ day: 'numeric' });
const fMes = formato({ month: 'short' });
const fClaveDia = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' });

/** Fecha en La Paz como "AAAA-MM-DD", para comparar días. */
export const claveDia = (fecha: Date) => fClaveDia.format(fecha);

export type EstadoEvento = 'en-curso' | 'proximo' | 'finalizado';

export function estadoEvento(e: Evento, ahora = Date.now()): EstadoEvento {
  if (ahora < Date.parse(e.inicio)) return 'proximo';
  if (ahora <= Date.parse(e.fin)) return 'en-curso';
  return 'finalizado';
}

export function rangoEvento(e: Evento): string {
  const inicio = new Date(e.inicio);
  const fin = new Date(e.fin);
  if (fClaveDia.format(inicio) === fClaveDia.format(fin)) {
    return `${fDia.format(inicio)} · ${fHora.format(inicio)}–${fHora.format(fin)}`;
  }
  return `${fDia.format(inicio)}, ${fHora.format(inicio)} – ${fDia.format(fin)}, ${fHora.format(fin)}`;
}

export function partesFecha(iso: string): { dia: string; mes: string } {
  const d = new Date(iso);
  return { dia: fNumero.format(d), mes: fMes.format(d).replace('.', '') };
}

const formatoCalendario = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export function enlaceGoogleCalendar(e: Evento, lugar: string, urlComoLlegar: string): string {
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.titulo,
    dates: `${formatoCalendario(e.inicio)}/${formatoCalendario(e.fin)}`,
    details: `${e.descripcion ?? ''}\n\nCómo llegar: ${urlComoLlegar}`.trim(),
    location: `${lugar}, UCB La Paz`,
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

/** ISO → valor para <input type="datetime-local"> en hora de La Paz. */
export function isoAEntrada(iso: string): string {
  return new Date(Date.parse(iso) - DESFASE_MS).toISOString().slice(0, 16);
}

/** Valor de <input type="datetime-local"> (hora de La Paz) → ISO con zona horaria. */
export function entradaAIso(valor: string): string {
  return `${valor}:00-04:00`;
}
