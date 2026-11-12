import { useMemo } from 'react';
import { formatoDistancia, formatoTiempo, type ResultadoRuta } from '../lib/rutas';
import { esVisible, ordenarPorNombre, type DatosCampus } from '../lib/tipos';

const ATAJOS = ['coliseo', 'paraninfo', 'biblioteca', 'cafeteria', 'bloque_k'];

interface Props {
  datos: DatosCampus;
  desdeId: string;
  hastaId: string | null;
  accesible: boolean;
  desdeQR: boolean;
  resultado: ResultadoRuta | null;
  onDesde: (id: string) => void;
  onHasta: (id: string | null) => void;
  onAccesible: (valor: boolean) => void;
}

export default function PanelRuta({ datos, desdeId, hastaId, accesible, desdeQR, resultado, onDesde, onHasta, onAccesible }: Props) {
  const porId = useMemo(() => new Map(datos.lugares.map((l) => [l.id, l])), [datos]);
  const enCampus = useMemo(() => ordenarPorNombre(datos.lugares.filter(esVisible)), [datos]);
  const ingresos = enCampus.filter((l) => l.tipo === 'ingreso');
  const interiores = enCampus.filter((l) => l.tipo !== 'ingreso');
  const desde = porId.get(desdeId);
  const hasta = hastaId ? porId.get(hastaId) : undefined;
  const ruta = resultado?.ok ? resultado.ruta : null;

  const opcionesCampus = (
    <>
      <optgroup label="Ingresos">
        {ingresos.map((l) => (
          <option key={l.id} value={l.id}>{l.nombre}</option>
        ))}
      </optgroup>
      <optgroup label="Bloques y lugares">
        {interiores.map((l) => (
          <option key={l.id} value={l.id}>{l.nombre}</option>
        ))}
      </optgroup>
    </>
  );

  return (
    <div className="pila">
      <h2 className="titulo-panel">Cómo llegar</h2>

      {desdeQR && desde && (
        <p className="aviso">
          Ubicación tomada del código QR: <strong>{desde.nombre}</strong>
        </p>
      )}

      <div className="formulario-ruta">
        <label className="campo">
          <span>¿Dónde estás?</span>
          <select value={desdeId} onChange={(e) => onDesde(e.target.value)}>
            {opcionesCampus}
          </select>
        </label>

        <button
          type="button"
          className="intercambiar"
          title="Intercambiar origen y destino"
          aria-label="Intercambiar origen y destino"
          disabled={!hasta}
          onClick={() => {
            if (!hastaId) return;
            onDesde(hastaId);
            onHasta(desdeId);
          }}
        >
          ⇅
        </button>

        <label className="campo">
          <span>¿A dónde vas?</span>
          <select value={hastaId ?? ''} onChange={(e) => onHasta(e.target.value || null)}>
            <option value="">Elige un destino…</option>
            {opcionesCampus}
          </select>
        </label>

        <label className="interruptor">
          <input type="checkbox" checked={accesible} onChange={(e) => onAccesible(e.target.checked)} />
          <span>Ruta sin escaleras (movilidad reducida)</span>
        </label>
      </div>

      {!hastaId && (
        <div>
          <p className="suave">Elige un destino, toca un punto del mapa o prueba uno de estos:</p>
          <div className="atajos">
            {ATAJOS.map((id) => porId.get(id)).map(
              (l) =>
                l && (
                  <button key={l.id} type="button" className="chip-boton" onClick={() => onHasta(l.id)}>
                    {l.nombre}
                  </button>
                ),
            )}
          </div>
        </div>
      )}

      {resultado && !resultado.ok && <p className="aviso aviso-error">{resultado.motivo}</p>}

      {ruta && (
        <section className="resultado" aria-live="polite">
          <div className="resumen">
            <div>
              <strong>{formatoDistancia(ruta.distancia_m)}</strong>
              <span>caminando</span>
            </div>
            <div>
              <strong>{formatoTiempo(ruta.tiempo_s)}</strong>
              <span>aprox.</span>
            </div>
            {ruta.pisos > 0 && (
              <div>
                <strong>{ruta.pisos}</strong>
                <span>{ruta.pisos === 1 ? 'piso' : 'pisos'}</span>
              </div>
            )}
          </div>

          <ol className="pasos">
            {ruta.pasos.map((p, i) => (
              <li key={i} className={p.tipo === 'escaleras' ? 'paso-escaleras' : undefined}>
                <span>{p.texto}</span>
                {p.pisos > 0 ? (
                  <small>{p.pisos} {p.pisos === 1 ? 'piso' : 'pisos'}</small>
                ) : (
                  p.distancia_m > 0 && <small>{formatoDistancia(p.distancia_m)}</small>
                )}
              </li>
            ))}
            <li className="paso-llegada">
              <span>
                Llegaste: <strong>{ruta.hasta.nombre}</strong>
              </span>
            </li>
          </ol>

          {datos.config.escala_calibrada === 0 && (
            <p className="nota">Distancias y tiempos estimados a partir del plano del campus (escala aproximada).</p>
          )}
        </section>
      )}
    </div>
  );
}
