import { useMemo, useState } from 'react';
import { enlaceGoogleMaps } from '../lib/rutas';
import { ordenarPorNombre, type DatosCampus, type Lugar } from '../lib/tipos';

const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

interface Resultado {
  lugar: Lugar;
  detalle: string | null;
}

function buscar(datos: DatosCampus, consulta: string): Resultado[] {
  const q = normalizar(consulta);
  if (!q) return [];
  const porId = new Map(datos.lugares.map((l) => [l.id, l]));
  const resultados: Resultado[] = [];

  // "D12", "aula f3", "G-2" → bloque correspondiente
  const aula = q.match(/^(?:aula\s*)?([a-z])\s*-?\s*(\d{1,2})$/);
  if (aula) {
    const letra = aula[1].toUpperCase();
    const lugar =
      datos.lugares.find((l) => l.bloque === letra && l.tipo === 'bloque') ??
      datos.lugares.find((l) => l.bloque === letra);
    if (lugar) resultados.push({ lugar, detalle: `Aula ${letra}${aula[2]} · Bloque ${letra}` });
  }

  for (const l of datos.lugares) {
    if (l.tipo === 'cruce') continue;
    if (normalizar(l.nombre).includes(q) || normalizar(l.descripcion ?? '').includes(q)) {
      resultados.push({ lugar: l, detalle: null });
    }
  }
  for (const d of datos.dependencias) {
    const lugar = porId.get(d.lugar_id);
    if (lugar && normalizar(d.nombre).includes(q)) resultados.push({ lugar, detalle: d.nombre });
  }
  return resultados.slice(0, 40);
}

interface Props {
  datos: DatosCampus;
  onIr: (lugarId: string) => void;
}

export default function Directorio({ datos, onIr }: Props) {
  const [consulta, setConsulta] = useState('');
  const resultados = useMemo(() => buscar(datos, consulta), [datos, consulta]);
  const dependenciasDe = useMemo(() => {
    const mapa = new Map<string, string[]>();
    for (const d of datos.dependencias) mapa.set(d.lugar_id, [...(mapa.get(d.lugar_id) ?? []), d.nombre]);
    return mapa;
  }, [datos]);
  const enCampus = ordenarPorNombre(datos.lugares.filter((l) => l.tipo === 'bloque' || l.tipo === 'punto'));
  const externos = ordenarPorNombre(datos.lugares.filter((l) => l.tipo === 'externo'));

  const botonIr = (l: Lugar) => (
    <button type="button" className="boton pequeno" onClick={() => onIr(l.id)}>
      Cómo llegar
    </button>
  );

  const fichaLugar = (l: Lugar) => {
    const deps = dependenciasDe.get(l.id) ?? [];
    return (
      <li key={l.id} className="ficha">
        <div className="ficha-cabecera">
          <div>
            <strong>{l.nombre}</strong>
            {l.direccion && l.tipo === 'externo' && <small className="suave">{l.direccion}</small>}
          </div>
          {botonIr(l)}
        </div>
        {deps.length > 0 && (
          <details>
            <summary>{deps.length} {deps.length === 1 ? 'dependencia' : 'dependencias'}</summary>
            <ul className="lista-deps">
              {deps.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </details>
        )}
      </li>
    );
  };

  return (
    <div className="pila">
      <h2 className="titulo-panel">Directorio</h2>
      <label className="campo">
        <span>Busca una oficina, carrera o aula</span>
        <input
          type="search"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder="Ej.: Kardex, Caja, D12, Centro Médico"
        />
      </label>

      {consulta.trim() ? (
        resultados.length === 0 ? (
          <p className="suave">No encontramos «{consulta}». Prueba con otra palabra o pregunta en Informaciones (Bloque K).</p>
        ) : (
          <ul className="lista-fichas">
            {resultados.map(({ lugar, detalle }, i) => (
              <li key={`${lugar.id}-${i}`} className="ficha">
                <div className="ficha-cabecera">
                  <div>
                    <strong>{detalle ?? lugar.nombre}</strong>
                    {detalle && <small className="suave">{lugar.nombre}</small>}
                  </div>
                  {botonIr(lugar)}
                </div>
                {lugar.tipo === 'externo' && lugar.direccion && (
                  <a className="enlace" href={enlaceGoogleMaps(lugar.direccion)} target="_blank" rel="noreferrer">
                    {lugar.direccion} · Ver en Google Maps
                  </a>
                )}
              </li>
            ))}
          </ul>
        )
      ) : (
        <>
          <h3 className="subtitulo">Campus principal</h3>
          <ul className="lista-fichas">{enCampus.map(fichaLugar)}</ul>
          <h3 className="subtitulo">Fuera del campus principal</h3>
          <ul className="lista-fichas">{externos.map(fichaLugar)}</ul>
        </>
      )}
    </div>
  );
}
