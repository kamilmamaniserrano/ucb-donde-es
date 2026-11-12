import { useMemo } from 'react';
import type { OrigenGps } from '../lib/gps';
import { formatoDistancia, formatoTiempo, type ResultadoRuta } from '../lib/rutas';
import { esVisible, ordenarPorNombre, type DatosCampus } from '../lib/tipos';
import type { EstadoGps } from '../lib/useUbicacionGps';

const ATAJOS = ['coliseo', 'paraninfo', 'biblioteca', 'cafeteria', 'bloque_k'];

interface Props {
  datos: DatosCampus;
  desdeId: string;
  hastaId: string | null;
  accesible: boolean;
  desdeQR: boolean;
  resultado: ResultadoRuta | null;
  gps: EstadoGps;
  origenGps: OrigenGps | null;
  siguiendoGps: boolean;
  onDesde: (id: string) => void;
  onHasta: (id: string | null) => void;
  onAccesible: (valor: boolean) => void;
  onUsarGps: () => void;
  onDejarGps: () => void;
}

function mensajeGps(gps: EstadoGps, origen: OrigenGps | null, siguiendo: boolean): string | null {
  if (gps.estado === 'buscando') return 'Buscando tu ubicación… Acepta el permiso si el navegador lo pide.';
  if (gps.estado === 'error') return gps.mensaje;
  if (gps.estado !== 'activo' || !siguiendo || !origen) return null;
  const precision = `precisión ±${Math.round(gps.precision_m)} m`;
  if (origen.fuera) return `Estás fuera del campus (${precision}). Te guiamos desde el ingreso principal.`;
  const extra =
    gps.precision_m > 30
      ? ' La señal es débil: sal al aire libre o escanea un código QR.'
      : gps.precision_m > 15
        ? ' Mejorando la precisión…'
        : '';
  return `Estás cerca de ${origen.lugar.nombre} (${precision}).${extra}`;
}

export default function PanelRuta({
  datos,
  desdeId,
  hastaId,
  accesible,
  desdeQR,
  resultado,
  gps,
  origenGps,
  siguiendoGps,
  onDesde,
  onHasta,
  onAccesible,
  onUsarGps,
  onDejarGps,
}: Props) {
  const porId = useMemo(() => new Map(datos.lugares.map((l) => [l.id, l])), [datos]);
  const enCampus = useMemo(() => ordenarPorNombre(datos.lugares.filter(esVisible)), [datos]);
  const ingresos = enCampus.filter((l) => l.tipo === 'ingreso');
  const interiores = enCampus.filter((l) => l.tipo !== 'ingreso');
  const desde = porId.get(desdeId);
  const hasta = hastaId ? porId.get(hastaId) : undefined;
  const ruta = resultado?.ok ? resultado.ruta : null;
  const gpsEnUso = siguiendoGps && (gps.estado === 'buscando' || gps.estado === 'activo');
  const avisoGps = mensajeGps(gps, origenGps, siguiendoGps);

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
          className={`boton-gps${gpsEnUso ? ' activo' : ''}`}
          aria-pressed={gpsEnUso}
          onClick={gpsEnUso ? onDejarGps : onUsarGps}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <circle cx="12" cy="12" r="4" fill="currentColor" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
          {gpsEnUso ? 'Dejar de usar el GPS' : 'Usar mi ubicación (GPS)'}
        </button>
        {avisoGps && <p className={`estado-gps${gps.estado === 'error' ? ' error' : ''}`}>{avisoGps}</p>}

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
