import { useMemo, useState } from 'react';
import { esVisible, ordenarPorNombre, type DatosCampus, type Lugar } from '../lib/tipos';

const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

interface Resultado {
  lugar: Lugar;
  detalle: string | null;
}

function buscar(datos: DatosCampus, consulta: string): Resultado[] {
  const q = normalizar(consulta);
  if (!q) return [];
  const enMapa = datos.lugares.filter(esVisible);
  const porId = new Map(enMapa.map((l) => [l.id, l]));
  const resultados: Resultado[] = [];

  // "D12", "aula f3", "G-2" → bloque correspondiente
  const aula = q.match(/^(?:aula\s*)?([a-z])\s*-?\s*(\d{1,2})$/);
  if (aula) {
    const letra = aula[1].toUpperCase();
    const lugar = enMapa.find((l) => l.bloque === letra && l.tipo === 'bloque');
    if (lugar) resultados.push({ lugar, detalle: `Aula ${letra}${aula[2]} · Bloque ${letra}` });
  }

  for (const l of enMapa) {
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
  const lugares = ordenarPorNombre(datos.lugares.filter((l) => esVisible(l) && l.tipo !== 'ingreso'));

  const botonIr = (l: Lugar) => (
    <button type="button" className="boton pequeno" onClick={() => onIr(l.id)}>
      Cómo llegar
    </button>
  );

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
              </li>
            ))}
          </ul>
        )
      ) : (
        <ul className="lista-fichas">
          {lugares.map((l) => {
            const deps = dependenciasDe.get(l.id) ?? [];
            return (
              <li key={l.id} className="ficha">
                <div className="ficha-cabecera">
                  <strong>{l.nombre}</strong>
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
          })}
        </ul>
      )}
    </div>
  );
}
