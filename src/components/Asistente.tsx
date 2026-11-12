import { useEffect, useRef, useState } from 'react';
import { responder, saludo, type Accion, type Respuesta } from '../lib/asistente';
import { IANoDisponible, preguntarIA } from '../lib/asistenteIA';
import type { Interior } from '../lib/interiores';
import type { DatosCampus } from '../lib/tipos';

interface Mensaje extends Respuesta {
  id: number;
  de: 'asistente' | 'persona';
  /** Respuesta generada por la IA (Gemini). */
  ia?: boolean;
}

export type AccionAsistente = Exclude<Accion, { tipo: 'pregunta' }>;

interface Props {
  datos: DatosCampus;
  interiores: Interior[];
  desdeId: string;
  accesible: boolean;
  onAccion: (accion: AccionAsistente) => void;
}

/** Botón flotante con un chat que responde dudas sobre el campus y el uso de la página. */
export default function Asistente({ datos, interiores, desdeId, accesible, onAccion }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState('');
  const [escribiendo, setEscribiendo] = useState(false);
  const iaDisponible = useRef(true);
  const fin = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const siguienteId = useRef(0);

  const agregar = (...nuevos: Omit<Mensaje, 'id'>[]) =>
    setMensajes((actuales) => [...actuales, ...nuevos.map((m) => ({ ...m, id: siguienteId.current++ }))]);

  useEffect(() => {
    if (!abierto) return;
    if (siguienteId.current === 0) agregar({ de: 'asistente', ...saludo() });
    entrada.current?.focus();
  }, [abierto]);

  useEffect(() => {
    fin.current?.scrollIntoView({ block: 'end' });
  }, [mensajes, abierto, escribiendo]);

  // Lo que el asistente local entiende (rutas, aulas, horarios, eventos) se responde al instante y con
  // cálculo exacto; la IA solo contesta lo demás. Si la IA no está configurada o falla, queda la respuesta local.
  const preguntar = async (pregunta: string) => {
    const limpia = pregunta.trim();
    if (!limpia || escribiendo) return;
    const historial = [...mensajes, { de: 'persona' as const, texto: limpia }].map(({ de, texto }) => ({ de, texto }));
    const ctx = { datos, interiores, desdeId, accesible };
    agregar({ de: 'persona', texto: limpia });
    setTexto('');
    const local = responder(limpia, ctx);
    if (local.confianza === 'baja' && iaDisponible.current) {
      setEscribiendo(true);
      try {
        agregar({ de: 'asistente', ia: true, ...(await preguntarIA(historial, ctx)) });
        return;
      } catch (error) {
        if (error instanceof IANoDisponible) iaDisponible.current = false;
        else console.warn('La IA no respondió; responde el asistente local.', error);
      } finally {
        setEscribiendo(false);
      }
    }
    agregar({ de: 'asistente', ...local });
  };

  const ejecutar = (accion: Accion) => {
    if (accion.tipo === 'pregunta') {
      preguntar(accion.texto);
      return;
    }
    onAccion(accion);
    // En el celular el chat tapa el mapa: se cierra para que se vea el resultado.
    if (window.matchMedia('(max-width: 820px)').matches) setAbierto(false);
  };

  return (
    <>
      {abierto && (
        <section className="asistente" role="dialog" aria-label="Asistente de la página">
          <header className="asistente-cabecera">
            <div>
              <strong>Asistente</strong>
              <small>Pregúntame cómo llegar o cómo usar la página</small>
            </div>
            <button type="button" className="cerrar" aria-label="Cerrar el asistente" onClick={() => setAbierto(false)}>
              ×
            </button>
          </header>
          <div className="asistente-mensajes" aria-live="polite">
            {mensajes.map((m) => (
              <div key={m.id} className={`mensaje mensaje-${m.de}`}>
                <p>{m.texto}</p>
                {m.ia && <small className="mensaje-nota">Respuesta generada con IA · puede equivocarse</small>}
                {m.acciones && m.acciones.length > 0 && (
                  <div className="mensaje-acciones">
                    {m.acciones.map((a, i) => (
                      <button
                        key={i}
                        type="button"
                        className={a.tipo === 'pregunta' ? 'chip-boton' : 'boton pequeno'}
                        onClick={() => ejecutar(a)}
                      >
                        {a.etiqueta}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {escribiendo && (
              <div className="mensaje mensaje-asistente">
                <p className="escribiendo" aria-label="El asistente está escribiendo">
                  <span />
                  <span />
                  <span />
                </p>
              </div>
            )}
            <div ref={fin} />
          </div>
          <p className="asistente-aviso">No compartas datos personales: si el asistente no sabe la respuesta, la conversación se envía a una IA (Gemini de Google).</p>
          <form
            className="asistente-entrada"
            onSubmit={(e) => {
              e.preventDefault();
              preguntar(texto);
            }}
          >
            <input
              ref={entrada}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escribe tu pregunta…"
              aria-label="Tu pregunta"
              enterKeyHint="send"
            />
            <button className="boton" disabled={!texto.trim() || escribiendo}>
              Enviar
            </button>
          </form>
        </section>
      )}
      <button
        type="button"
        className="boton-asistente"
        aria-expanded={abierto}
        aria-label={abierto ? 'Cerrar el asistente' : 'Abrir el asistente'}
        onClick={() => setAbierto((a) => !a)}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.6c-.5.4-1.3.1-1.3-.6V16A2.5 2.5 0 0 1 4 13.5z"
            fill="currentColor"
          />
          <circle cx="8.5" cy="9.5" r="1.2" fill="#c2410c" />
          <circle cx="12" cy="9.5" r="1.2" fill="#c2410c" />
          <circle cx="15.5" cy="9.5" r="1.2" fill="#c2410c" />
        </svg>
        <span>{abierto ? 'Cerrar' : '¿Necesitas ayuda?'}</span>
      </button>
    </>
  );
}
