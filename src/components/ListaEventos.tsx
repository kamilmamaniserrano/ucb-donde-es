import { enlaceGoogleCalendar, estadoEvento, partesFecha, rangoEvento, type EstadoEvento } from '../lib/tiempo';
import type { DatosCampus, Evento } from '../lib/tipos';

const ETIQUETA_ESTADO: Record<EstadoEvento, string> = {
  'en-curso': 'En curso',
  proximo: 'Próximo',
  finalizado: 'Finalizado',
};

interface Props {
  datos: DatosCampus;
  onComoLlegar: (lugarId: string) => void;
}

export default function ListaEventos({ datos, onComoLlegar }: Props) {
  const ahora = Date.now();
  const porId = new Map(datos.lugares.map((l) => [l.id, l]));
  const conEstado = datos.eventos.map((e) => ({ e, estado: estadoEvento(e, ahora) }));
  const vigentes = conEstado
    .filter((x) => x.estado !== 'finalizado')
    .sort((a, b) =>
      a.estado === b.estado ? Date.parse(a.e.inicio) - Date.parse(b.e.inicio) : a.estado === 'en-curso' ? -1 : 1,
    );
  const pasados = conEstado
    .filter((x) => x.estado === 'finalizado')
    .sort((a, b) => Date.parse(b.e.inicio) - Date.parse(a.e.inicio));

  const tarjeta = (e: Evento, estado: EstadoEvento) => {
    const lugar = porId.get(e.lugar_id);
    const donde = e.ambiente ?? lugar?.nombre ?? 'Lugar por confirmar';
    const { dia, mes } = partesFecha(e.inicio);
    const urlRuta = `${window.location.origin}/?hacia=${encodeURIComponent(e.lugar_id)}`;
    return (
      <article key={e.id} className={`evento evento-${estado}`}>
        <div className="fecha-bloque" aria-hidden="true">
          <span className="dia">{dia}</span>
          <span className="mes">{mes}</span>
        </div>
        <div className="evento-cuerpo">
          <div className="chips">
            <span className={`chip chip-${estado}`}>{ETIQUETA_ESTADO[estado]}</span>
            {e.por_confirmar && <span className="chip chip-confirmar">Por confirmar</span>}
          </div>
          <h3>{e.titulo}</h3>
          <p className="cuando">{rangoEvento(e)}</p>
          <p className="donde">{donde}</p>
          {e.descripcion && estado !== 'finalizado' && <p className="suave">{e.descripcion}</p>}
          {estado !== 'finalizado' && (
            <div className="acciones">
              <button type="button" className="boton" onClick={() => onComoLlegar(e.lugar_id)}>
                Cómo llegar
              </button>
              <a
                className="boton secundario"
                href={enlaceGoogleCalendar(e, donde, urlRuta)}
                target="_blank"
                rel="noreferrer"
              >
                Agregar a mi calendario
              </a>
            </div>
          )}
        </div>
      </article>
    );
  };

  return (
    <div className="pila">
      <h2 className="titulo-panel">Eventos en la UCB</h2>
      {vigentes.length === 0 && <p className="suave">No hay eventos próximos por ahora.</p>}
      {vigentes.map(({ e, estado }) => tarjeta(e, estado))}
      {pasados.length > 0 && (
        <details className="pasados">
          <summary>Eventos pasados ({pasados.length})</summary>
          <div className="pila">{pasados.map(({ e, estado }) => tarjeta(e, estado))}</div>
        </details>
      )}
    </div>
  );
}
