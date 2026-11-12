import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cargarPuntosGps } from '../lib/datos';
import { errorDeCadaPunto } from '../lib/gps';
import { supabase } from '../lib/supabase';
import { esVisible, ordenarPorNombre, type DatosCampus, type PuntoControl } from '../lib/tipos';
import { promedioPonderado, type Lectura } from '../lib/useUbicacionGps';

const SEGUNDOS_MEDICION = 15;
const PRECISION_ACEPTADA_M = 25;
// Lugares repartidos por el campus: con ellos la corrección cubre bordes y centro.
const SUGERIDOS = ['ingreso_vehicular_oeste', 'bloque_c', 'ingreso_vehicular_este', 'bloque_l', 'bloque_d', 'biblioteca', 'bloque_f', 'cafeteria'];

type Mensaje = { texto: string; error: boolean } | null;

function leerCoordenadas(texto: string): { lat: number; lng: number } | null {
  const m = texto.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
}

/** Puntos de control del GPS: se miden en el campus (o se copian de Google Maps) y se guardan en Supabase. */
export default function CalibracionGps({ datos, alGuardar }: { datos: DatosCampus; alGuardar: () => void }) {
  const lugares = useMemo(() => ordenarPorNombre(datos.lugares.filter((l) => esVisible(l) && l.piso === 0)), [datos]);
  const [puntos, setPuntos] = useState<PuntoControl[]>([]);
  const [errorTabla, setErrorTabla] = useState<string | null>(null);
  const [lugarId, setLugarId] = useState(SUGERIDOS[0]);
  const [coordenadas, setCoordenadas] = useState('');
  const [precisionMedida, setPrecisionMedida] = useState<number | null>(null);
  const [midiendo, setMidiendo] = useState<{ restante: number; lecturas: number; precision: number | null } | null>(null);
  const [mensaje, setMensaje] = useState<Mensaje>(null);
  const medicion = useRef<{ vigilancia: number; reloj: number } | null>(null);

  const recargar = useCallback(() => {
    cargarPuntosGps().then(({ puntos, error }) => {
      setPuntos(puntos);
      setErrorTabla(error);
    });
  }, []);
  useEffect(recargar, [recargar]);

  const cancelarMedicion = () => {
    if (!medicion.current) return;
    navigator.geolocation.clearWatch(medicion.current.vigilancia);
    window.clearInterval(medicion.current.reloj);
    medicion.current = null;
  };
  useEffect(() => cancelarMedicion, []);

  const errores = useMemo(() => errorDeCadaPunto(puntos), [puntos]);
  const yaMedidos = new Set(puntos.map((p) => `${p.x},${p.y}`));

  const medir = () => {
    if (!('geolocation' in navigator)) {
      setMensaje({ texto: 'Este navegador no permite usar la ubicación.', error: true });
      return;
    }
    cancelarMedicion();
    setMensaje(null);
    const lecturas: Lectura[] = [];
    const inicio = Date.now();
    let ultimaPrecision: number | null = null;
    setMidiendo({ restante: SEGUNDOS_MEDICION, lecturas: 0, precision: null });
    const vigilancia = navigator.geolocation.watchPosition(
      (pos) => {
        ultimaPrecision = pos.coords.accuracy;
        if (pos.coords.accuracy <= PRECISION_ACEPTADA_M) {
          lecturas.push({ lat: pos.coords.latitude, lng: pos.coords.longitude, precision: pos.coords.accuracy, t: pos.timestamp });
        }
      },
      (error) => {
        cancelarMedicion();
        setMidiendo(null);
        setMensaje({ texto: `No se pudo leer el GPS: ${error.message}`, error: true });
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
    const reloj = window.setInterval(() => {
      const restante = SEGUNDOS_MEDICION - Math.floor((Date.now() - inicio) / 1000);
      if (restante > 0) {
        setMidiendo({ restante, lecturas: lecturas.length, precision: ultimaPrecision });
        return;
      }
      cancelarMedicion();
      setMidiendo(null);
      if (!lecturas.length) {
        setMensaje({ texto: `Ninguna lectura tuvo precisión de ±${PRECISION_ACEPTADA_M} m o mejor. Sal al aire libre, espera unos segundos e intenta de nuevo.`, error: true });
        return;
      }
      const { lat, lng } = promedioPonderado(lecturas);
      const mejor = Math.min(...lecturas.map((l) => l.precision));
      setCoordenadas(`${lat.toFixed(7)}, ${lng.toFixed(7)}`);
      setPrecisionMedida(mejor);
      setMensaje({ texto: `Listo: ${lecturas.length} lecturas promediadas (mejor precisión ±${Math.round(mejor)} m). Revisa y guarda el punto.`, error: false });
    }, 1000);
    medicion.current = { vigilancia, reloj };
  };

  const guardar = async () => {
    const lugar = lugares.find((l) => l.id === lugarId);
    const gps = leerCoordenadas(coordenadas);
    if (!supabase || !lugar || !gps) return;
    if (Math.abs(gps.lat + 16.523) > 0.01 || Math.abs(gps.lng + 68.112) > 0.01) {
      setMensaje({ texto: 'Esas coordenadas están a más de 1 km del campus. Revisa que estén bien copiadas.', error: true });
      return;
    }
    const { error } = await supabase.from('georreferencia').insert({
      nombre: lugar.nombre,
      x: lugar.x,
      y: lugar.y,
      lat: gps.lat,
      lng: gps.lng,
      precision_m: precisionMedida,
    });
    if (error) {
      setMensaje({ texto: `No se pudo guardar: ${error.message}`, error: true });
      return;
    }
    setMensaje({ texto: `Punto guardado: ${lugar.nombre}.`, error: false });
    setCoordenadas('');
    setPrecisionMedida(null);
    recargar();
    alGuardar();
  };

  const eliminar = async (p: PuntoControl) => {
    if (!supabase || p.id == null || !window.confirm(`¿Eliminar el punto «${p.nombre}»?`)) return;
    const { error } = await supabase.from('georreferencia').delete().eq('id', p.id);
    if (error) setMensaje({ texto: `No se pudo eliminar: ${error.message}`, error: true });
    recargar();
    alGuardar();
  };

  if (errorTabla) {
    return (
      <section className="tarjeta">
        <h2>Calibrar el GPS</h2>
        <p className="aviso aviso-error">
          Falta la tabla de calibración. Ejecuta <code>supabase/georreferencia.sql</code> en el SQL Editor de Supabase y
          recarga esta página.
        </p>
      </section>
    );
  }

  return (
    <section className="tarjeta">
      <h2>Calibrar el GPS</h2>
      <p>
        Para que el punto azul caiga en el lugar correcto, registra la posición real de varios lugares{' '}
        <strong>repartidos por todo el campus</strong> (ideal: 8 o más, incluidas las esquinas). Párate en la{' '}
        <strong>entrada</strong> del lugar, al aire libre, y presiona «Medir aquí». También puedes pegar coordenadas de
        Google Maps (clic derecho sobre el punto → copiar).
      </p>
      <p className="suave">
        La app usa {puntos.length >= 3 ? `estos ${puntos.length} puntos` : 'los 3 puntos de respaldo (hacen falta al menos 3 aquí)'}.
        Sugeridos que faltan:{' '}
        {SUGERIDOS.map((id) => lugares.find((l) => l.id === id))
          .filter((l) => l && !yaMedidos.has(`${l.x},${l.y}`))
          .map((l) => l!.nombre)
          .join(', ') || 'ninguno'}
        .
      </p>

      <div className="dos-campos">
        <label className="campo">
          <span>Lugar donde estás parado</span>
          <select value={lugarId} onChange={(e) => setLugarId(e.target.value)}>
            {lugares.map((l) => (
              <option key={l.id} value={l.id}>{l.nombre}</option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>Coordenadas (lat, lng)</span>
          <input
            inputMode="decimal"
            placeholder="-16.5229, -68.1118"
            value={coordenadas}
            onChange={(e) => {
              setCoordenadas(e.target.value);
              setPrecisionMedida(null);
            }}
          />
        </label>
      </div>
      {midiendo && (
        <p className="aviso">
          Midiendo… quédate quieto {midiendo.restante} s · {midiendo.lecturas} lecturas buenas
          {midiendo.precision != null && ` · precisión actual ±${Math.round(midiendo.precision)} m`}
        </p>
      )}
      {mensaje && <p className={`aviso ${mensaje.error ? 'aviso-error' : 'aviso-ok'}`}>{mensaje.texto}</p>}
      <div className="acciones">
        <button type="button" className="boton secundario" onClick={medir} disabled={!!midiendo}>
          {midiendo ? 'Midiendo…' : `Medir aquí (${SEGUNDOS_MEDICION} s)`}
        </button>
        <button type="button" className="boton" onClick={guardar} disabled={!leerCoordenadas(coordenadas) || !!midiendo}>
          Guardar punto
        </button>
      </div>

      {puntos.length > 0 && (
        <ul className="lista-fichas">
          {puntos.map((p, i) => {
            const error = errores[i];
            // Con menos de 6 puntos, al quitar uno quedan muy pocos para juzgarlo: se muestra pero no se alerta.
            const sospechoso = error != null && puntos.length >= 6 && error > 12;
            return (
              <li key={p.id ?? i} className="ficha">
                <div className="ficha-cabecera">
                  <div>
                    <strong>{p.nombre}</strong>
                    <small className="suave">
                      {p.lat.toFixed(6)}, {p.lng.toFixed(6)}
                      {p.precision_m != null && ` · medido con ±${Math.round(p.precision_m)} m`}
                    </small>
                    {error != null && (
                      <small className={sospechoso ? 'texto-error' : 'suave'}>
                        Diferencia con los demás puntos: {Math.round(error)} m
                        {sospechoso && ' · revisar: puede estar mal tomado'}
                      </small>
                    )}
                  </div>
                  <button type="button" className="boton peligro pequeno" onClick={() => eliminar(p)}>
                    Eliminar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
