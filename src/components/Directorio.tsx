import { useMemo, useState } from 'react';
import { buscarEnCampus } from '../lib/busqueda';
import { buscarAulas, claseActual, nivelDe, nombreAula, textoClase, type Interior } from '../lib/interiores';
import { esVisible, ordenarPorNombre, type DatosCampus, type Lugar } from '../lib/tipos';

interface Props {
  datos: DatosCampus;
  interiores: Interior[];
  onIr: (lugarId: string) => void;
  onVerInterior: (lugarId: string, aula?: string | null) => void;
}

export default function Directorio({ datos, interiores, onIr, onVerInterior }: Props) {
  const [consulta, setConsulta] = useState('');
  const resultados = useMemo(() => buscarEnCampus(datos, consulta), [datos, consulta]);
  const aulas = useMemo(() => buscarAulas(interiores, consulta), [interiores, consulta]);
  const dependenciasDe = useMemo(() => {
    const mapa = new Map<string, string[]>();
    for (const d of datos.dependencias) mapa.set(d.lugar_id, [...(mapa.get(d.lugar_id) ?? []), d.nombre]);
    return mapa;
  }, [datos]);
  const lugares = ordenarPorNombre(datos.lugares.filter((l) => esVisible(l) && l.tipo !== 'ingreso'));
  const conInterior = new Set(interiores.map((i) => i.lugar_id));

  const botonIr = (l: Lugar) => (
    <button type="button" className="boton pequeno" onClick={() => onIr(l.id)}>
      Cómo llegar
    </button>
  );
  const botonPisos = (lugarId: string) =>
    conInterior.has(lugarId) && (
      <button type="button" className="boton secundario pequeno" onClick={() => onVerInterior(lugarId)}>
        Pisos y aulas
      </button>
    );

  const sinResultados = resultados.length === 0 && aulas.length === 0;

  return (
    <div className="pila">
      <h2 className="titulo-panel">Directorio</h2>
      <label className="campo">
        <span>Busca una oficina, carrera, aula, materia o docente</span>
        <input
          type="search"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder="Ej.: Kardex, Caja, C-201, Control I"
        />
      </label>

      {consulta.trim() ? (
        sinResultados ? (
          <p className="suave">No encontramos «{consulta}». Prueba con otra palabra o pregunta en Informaciones (Bloque K).</p>
        ) : (
          <ul className="lista-fichas">
            {aulas.map(({ interior, aula, clases }) => {
              const nivel = nivelDe(interior, aula);
              const ahora = claseActual(aula);
              return (
                <li key={`aula-${aula.codigo}`} className="ficha">
                  <div className="ficha-cabecera">
                    <div>
                      <strong>{clases.length ? clases[0].materia : nombreAula(aula)}</strong>
                      <small className="suave">
                        {nombreAula(aula)} · {nivel?.nombre} del Bloque {interior.bloque}
                      </small>
                      {clases.length > 0 && <small className="suave">{clases.map(textoClase).join(' · ')}</small>}
                      {clases.length === 0 && ahora && <small className="estado-aula ocupada">Ahora: {ahora.materia}</small>}
                    </div>
                    <div className="acciones">
                      <button type="button" className="boton pequeno" onClick={() => onVerInterior(interior.lugar_id, aula.codigo)}>
                        Ver aula
                      </button>
                      <button type="button" className="boton secundario pequeno" onClick={() => onIr(interior.lugar_id)}>
                        Cómo llegar
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
            {resultados.map(({ lugar, detalle }, i) => (
              <li key={`${lugar.id}-${i}`} className="ficha">
                <div className="ficha-cabecera">
                  <div>
                    <strong>{detalle ?? lugar.nombre}</strong>
                    {detalle && <small className="suave">{lugar.nombre}</small>}
                  </div>
                  <div className="acciones">
                    {botonIr(lugar)}
                    {botonPisos(lugar.id)}
                  </div>
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
                  <div className="acciones">
                    {botonIr(l)}
                    {botonPisos(l.id)}
                  </div>
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
