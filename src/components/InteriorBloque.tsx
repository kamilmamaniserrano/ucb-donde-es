import { useEffect, useState } from 'react';
import {
  claseActual,
  DIAS,
  hoyEnLaPaz,
  nombreAula,
  siguienteClase,
  type Aula,
  type Clase,
  type Interior,
  type Nivel,
} from '../lib/interiores';

const etiquetaPiso = (n: Nivel) => (n.id === 'pb' ? 'PB' : n.id === 'terraza' ? 'Terraza' : n.id.toUpperCase().replace('P', ''));

const detalleClase = (c: Clase) =>
  [c.sigla && `${c.sigla}${c.paralelo ? ` · Par. ${c.paralelo}` : ''}`, c.docente].filter(Boolean).join(' · ');

function EstadoAula({ aula, ahora }: { aula: Aula; ahora: number }) {
  const actual = claseActual(aula, ahora);
  if (actual) {
    return (
      <small className="estado-aula ocupada">
        Ahora: <strong>{actual.materia}</strong> (hasta {actual.fin})
      </small>
    );
  }
  const siguiente = siguienteClase(aula, ahora);
  return (
    <small className="estado-aula libre">
      Libre ahora{siguiente ? ` · luego: ${siguiente.materia} a las ${siguiente.inicio}` : ' el resto del día'}
    </small>
  );
}

function DetalleAula({ aula, nivel, ahora, onVolver }: { aula: Aula; nivel: Nivel; ahora: number; onVolver: () => void }) {
  const hoy = hoyEnLaPaz(ahora);
  const actual = claseActual(aula, ahora);
  // Hoy primero; después el resto de la semana en orden.
  const dias = [1, 2, 3, 4, 5, 6]
    .filter((d) => aula.clases.some((c) => c.dia === d))
    .sort((a, b) => Number(b === hoy) - Number(a === hoy) || a - b);
  return (
    <div className="pila">
      <button type="button" className="enlace-volver" onClick={onVolver}>
        ← {nivel.nombre}
      </button>
      <div>
        <h3>{nombreAula(aula)}</h3>
        <p className="suave">
          {nivel.nombre}
          {aula.capacidad ? ` · capacidad ${aula.capacidad}` : ''}
        </p>
      </div>
      <EstadoAula aula={aula} ahora={ahora} />
      {aula.nota && <p className="aviso">{aula.nota}</p>}
      {dias.map((d) => (
        <section key={d} className={`dia-horario${d === hoy ? ' hoy' : ''}`}>
          <h4>
            {DIAS[d]}
            {d === hoy && <span className="chip chip-en-curso">Hoy</span>}
          </h4>
          <ul>
            {aula.clases
              .filter((c) => c.dia === d)
              .map((c, i) => (
                <li key={i} className={c === actual ? 'clase-actual' : undefined}>
                  <span className="hora-clase">
                    {c.inicio}–{c.fin}
                  </span>
                  <span>
                    <strong>{c.materia}</strong>
                    {detalleClase(c) && <small>{detalleClase(c)}</small>}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      ))}
      {aula.foto && (
        <a className="boton secundario" href={aula.foto} target="_blank" rel="noreferrer">
          Ver la foto del horario (referencia oficial)
        </a>
      )}
    </div>
  );
}

interface Props {
  interior: Interior;
  aulaInicial?: string | null;
  nivelInicial?: string;
  onCerrar: () => void;
  onComoLlegar: () => void;
}

/** Pisos, croquis y horarios de las aulas de un bloque. */
export default function InteriorBloque({ interior, aulaInicial, nivelInicial, onCerrar, onComoLlegar }: Props) {
  const inicial = aulaInicial ? interior.aulas.find((a) => a.codigo === aulaInicial) : undefined;
  const [nivelId, setNivelId] = useState(inicial?.nivel ?? nivelInicial ?? 'pb');
  const [aulaId, setAulaId] = useState<string | null>(inicial?.codigo ?? null);
  const ahora = Date.now();
  const nivel = interior.niveles.find((n) => n.id === nivelId) ?? interior.niveles[0];
  const aula = aulaId ? interior.aulas.find((a) => a.codigo === aulaId) : undefined;
  const aulasDelPiso = interior.aulas.filter((a) => a.nivel === nivel.id);

  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
    };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [onCerrar]);

  return (
    <div className="interior-fondo" onClick={onCerrar}>
      <section
        className="interior"
        role="dialog"
        aria-modal="true"
        aria-label={`${interior.nombre} por dentro`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="interior-cabecera">
          <div>
            <strong>{interior.nombre}</strong>
            <small>Pisos, laboratorios y horarios · {interior.semestre}</small>
          </div>
          <button type="button" className="cerrar" aria-label="Cerrar" onClick={onCerrar}>
            ×
          </button>
        </header>

        <nav className="interior-pisos" role="tablist" aria-label="Pisos">
          {[...interior.niveles].reverse().map((n) => (
            <button
              key={n.id}
              type="button"
              role="tab"
              title={n.nombre}
              aria-selected={n.id === nivel.id}
              onClick={() => {
                setNivelId(n.id);
                setAulaId(null);
              }}
            >
              {etiquetaPiso(n)}
            </button>
          ))}
        </nav>

        <div className="interior-cuerpo">
          {aula ? (
            <DetalleAula aula={aula} nivel={nivel} ahora={ahora} onVolver={() => setAulaId(null)} />
          ) : (
            <div className="pila">
              <h3>{nivel.nombre}</h3>
              <a className="interior-croquis" href={nivel.croquis} target="_blank" rel="noreferrer">
                <img src={nivel.croquis} alt={`Cartel con el croquis del ${nivel.nombre} del ${interior.nombre}`} loading="lazy" />
                <span>Toca para ampliar</span>
              </a>
              <div>
                <h4>En este piso</h4>
                <ul className="lista-deps">
                  {nivel.contenido.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
              {aulasDelPiso.length > 0 ? (
                <div className="pila">
                  <h4>Aulas y laboratorios con horario</h4>
                  <ul className="lista-fichas">
                    {aulasDelPiso.map((a) => (
                      <li key={a.codigo} className="ficha">
                        <div className="ficha-cabecera">
                          <div>
                            <strong>{nombreAula(a)}</strong>
                            {a.capacidad && <small className="suave">Capacidad {a.capacidad}</small>}
                            <EstadoAula aula={a} ahora={ahora} />
                          </div>
                          <button type="button" className="boton pequeno" onClick={() => setAulaId(a.codigo)}>
                            Horario
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="suave">Todavía no tenemos los horarios de las aulas de este piso.</p>
              )}
            </div>
          )}
        </div>

        <footer className="interior-pie">
          <small className="suave">{interior.fuente}</small>
          <button type="button" className="boton" onClick={onComoLlegar}>
            Cómo llegar al Bloque {interior.bloque}
          </button>
        </footer>
      </section>
    </div>
  );
}
