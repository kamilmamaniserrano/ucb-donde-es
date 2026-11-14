import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Asistente, { type AccionAsistente } from './components/Asistente';
import MapaCampus from './components/MapaCampus';
import PanelRuta from './components/PanelRuta';
import ListaEventos from './components/ListaEventos';
import Directorio from './components/Directorio';
import InteriorBloque from './components/InteriorBloque';
import Marca from './components/Marca';
import VisorFotos from './components/VisorFotos';
import { cargarDatos, PUNTOS_GPS_LOCALES } from './lib/datos';
import { fotosDe } from './lib/fotos';
import { ajustarACamino, crearGeorreferencia, origenDesdeGps } from './lib/gps';
import { cargarInteriores, type Interior } from './lib/interiores';
import { calcularRuta, INGRESO_PRINCIPAL } from './lib/rutas';
import { esVisible, type DatosCampus } from './lib/tipos';
import { useUbicacionGps } from './lib/useUbicacionGps';

// La vista 3D (three.js) se descarga solo cuando alguien la abre.
const Vista3D = lazy(() => import('./components/Vista3D'));

type Pestana = 'eventos' | 'ruta' | 'directorio';

const PESTANAS: { id: Pestana; texto: string }[] = [
  { id: 'eventos', texto: 'Eventos' },
  { id: 'ruta', texto: 'Cómo llegar' },
  { id: 'directorio', texto: 'Directorio' },
];

const inicial = new URLSearchParams(window.location.search);
const modoGrafo = inicial.get('grafo') === '1';

export default function App() {
  const [datos, setDatos] = useState<DatosCampus | null>(null);
  const [pestana, setPestana] = useState<Pestana>(inicial.has('hacia') ? 'ruta' : 'eventos');
  const [desdeId, setDesdeId] = useState(inicial.get('desde') ?? INGRESO_PRINCIPAL);
  const [hastaId, setHastaId] = useState<string | null>(inicial.get('hacia'));
  const [accesible, setAccesible] = useState(inicial.get('accesible') === '1');
  const [desdeQR, setDesdeQR] = useState(inicial.has('desde'));
  const [tocadoId, setTocadoId] = useState<string | null>(null);
  const [vista3d, setVista3d] = useState(inicial.get('vista') === '3d');
  const { gps, iniciar: iniciarGps, detener: detenerGps } = useUbicacionGps();
  const [siguiendoGps, setSiguiendoGps] = useState(false);
  const [interiores, setInteriores] = useState<Interior[]>([]);
  // Bloque abierto en la vista de pisos y aulas (y el aula a mostrar, si se pidió una).
  const [interiorAbierto, setInteriorAbierto] = useState<{ lugarId: string; aula: string | null; nivel?: string } | null>(null);
  // Lugar cuyas fotos se ven a pantalla completa.
  const [fotosAbiertasId, setFotosAbiertasId] = useState<string | null>(null);

  useEffect(() => {
    cargarDatos().then((d) => {
      const ids = new Set(d.lugares.filter(esVisible).map((l) => l.id));
      // Un QR o enlace a un lugar que ya no está en el mapa no debe romper la app.
      setDesdeId((actual) => (ids.has(actual) ? actual : INGRESO_PRINCIPAL));
      setDesdeQR((qr) => qr && ids.has(inicial.get('desde') ?? ''));
      setHastaId((actual) => (actual && ids.has(actual) ? actual : null));
      setDatos(d);
    });
    cargarInteriores().then((lista) => {
      setInteriores(lista);
      // Enlaces del tipo ?aula=C-001 abren directamente el horario de esa aula.
      const aula = inicial.get('aula')?.toUpperCase();
      const conAula = aula ? lista.find((i) => i.aulas.some((a) => a.codigo === aula)) : undefined;
      if (conAula) setInteriorAbierto({ lugarId: conAula.lugar_id, aula: aula ?? null });
    });
  }, []);

  useEffect(() => {
    const p = new URLSearchParams();
    if (desdeId !== INGRESO_PRINCIPAL || hastaId) p.set('desde', desdeId);
    if (hastaId) p.set('hacia', hastaId);
    if (accesible) p.set('accesible', '1');
    if (vista3d) p.set('vista', '3d');
    if (modoGrafo) p.set('grafo', '1');
    const consulta = p.toString();
    window.history.replaceState(null, '', consulta ? `${window.location.pathname}?${consulta}` : window.location.pathname);
  }, [desdeId, hastaId, accesible, vista3d]);

  const georreferencia = useMemo(() => crearGeorreferencia(datos?.puntosGps ?? PUNTOS_GPS_LOCALES), [datos]);
  const ubicacionGps = useMemo(() => {
    if (!datos || gps.estado !== 'activo') return null;
    const enPlano = georreferencia.aPlano(gps.lat, gps.lng);
    return { ...ajustarACamino(datos, enPlano.x, enPlano.y), radio: gps.precision_m / georreferencia.metrosPorPixel };
  }, [datos, gps, georreferencia]);
  const origenGps = useMemo(
    () => (datos && ubicacionGps ? origenDesdeGps(datos, ubicacionGps.x, ubicacionGps.y, desdeId) : null),
    [datos, ubicacionGps, desdeId],
  );

  // Mientras el GPS está en uso, el origen de la ruta sigue a la persona.
  useEffect(() => {
    if (siguiendoGps && origenGps) setDesdeId(origenGps.lugar.id);
  }, [siguiendoGps, origenGps]);

  const resultado = useMemo(
    () => (datos && hastaId ? calcularRuta(datos, desdeId, hastaId, accesible) : null),
    [datos, desdeId, hastaId, accesible],
  );

  const irA = useCallback((lugarId: string) => {
    setHastaId(lugarId);
    setPestana('ruta');
    setTocadoId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const cambiarDesde = (id: string) => {
    setDesdeId(id);
    setDesdeQR(false);
    setSiguiendoGps(false);
  };

  const usarGps = () => {
    setSiguiendoGps(true);
    setDesdeQR(false);
    iniciarGps();
  };

  const dejarGps = () => {
    setSiguiendoGps(false);
    detenerGps();
  };

  const alAccionDelAsistente = (accion: AccionAsistente) => {
    switch (accion.tipo) {
      case 'ir':
        if (accion.desdeId) cambiarDesde(accion.desdeId);
        if (accion.accesible) setAccesible(true);
        irA(accion.lugarId);
        break;
      case 'eventos':
        setPestana('eventos');
        break;
      case 'directorio':
        setPestana('directorio');
        break;
      case 'vista3d':
        setVista3d(true);
        break;
      case 'gps':
        setPestana('ruta');
        usarGps();
        break;
      case 'accesible':
        setAccesible(true);
        setPestana('ruta');
        break;
      case 'aula':
        setInteriorAbierto({ lugarId: accion.lugarId, aula: accion.codigo, nivel: accion.nivel });
        break;
    }
  };

  const interiorDe = (lugarId: string | null | undefined) => interiores.find((i) => i.lugar_id === lugarId);
  const verInterior = (lugarId: string, aula: string | null = null) => {
    setTocadoId(null);
    setInteriorAbierto({ lugarId, aula });
  };
  const interior = interiorAbierto ? interiorDe(interiorAbierto.lugarId) : undefined;

  const ruta = resultado?.ok ? resultado.ruta : null;
  const tocado = datos && tocadoId ? datos.lugares.find((l) => l.id === tocadoId) : undefined;
  const depsTocado = datos && tocadoId ? datos.dependencias.filter((d) => d.lugar_id === tocadoId) : [];
  const fotosTocado = tocadoId ? fotosDe(tocadoId) : [];
  const lugarConFotos = datos && fotosAbiertasId ? datos.lugares.find((l) => l.id === fotosAbiertasId) : undefined;

  return (
    <div className="app">
      <header className="barra">
        <Marca />
        <nav className="pestanas" role="tablist" aria-label="Secciones">
          {PESTANAS.map((p) => (
            <button key={p.id} type="button" role="tab" aria-selected={pestana === p.id} onClick={() => setPestana(p.id)}>
              {p.texto}
            </button>
          ))}
        </nav>
      </header>

      {!datos ? (
        <div className="cargando">Cargando el mapa del campus…</div>
      ) : (
        <main className="contenido">
          <section className="panel">
            {pestana === 'eventos' && <ListaEventos datos={datos} onComoLlegar={irA} />}
            {pestana === 'ruta' && (
              <PanelRuta
                datos={datos}
                desdeId={desdeId}
                hastaId={hastaId}
                accesible={accesible}
                desdeQR={desdeQR}
                resultado={resultado}
                gps={gps}
                origenGps={origenGps}
                siguiendoGps={siguiendoGps}
                onDesde={cambiarDesde}
                onHasta={setHastaId}
                onAccesible={setAccesible}
                onUsarGps={usarGps}
                onDejarGps={dejarGps}
                onVerInterior={interiorDe(hastaId) ? () => verInterior(hastaId!) : undefined}
              />
            )}
            {pestana === 'directorio' && (
              <Directorio datos={datos} interiores={interiores} onIr={irA} onVerInterior={verInterior} />
            )}
          </section>

          <section className="zona-mapa">
            {vista3d ? (
              <Suspense fallback={<div className="cargando-3d">Cargando la vista 3D…</div>}>
                <Vista3D
                  datos={datos}
                  ruta={ruta}
                  desdeId={desdeId}
                  hastaId={hastaId}
                  ubicacionGps={ubicacionGps}
                  onElegirLugar={setTocadoId}
                />
              </Suspense>
            ) : (
              <MapaCampus
                datos={datos}
                ruta={ruta}
                desdeId={desdeId}
                hastaId={hastaId}
                ubicacionGps={ubicacionGps}
                modoGrafo={modoGrafo}
                onElegirLugar={setTocadoId}
              />
            )}
            <button type="button" className="boton-vista" aria-pressed={vista3d} onClick={() => setVista3d((v) => !v)}>
              {vista3d ? 'Ver en 2D' : 'Ver en 3D'}
            </button>
            {modoGrafo && !vista3d && <div className="aviso-grafo">Modo grafo: toca el mapa para ver coordenadas x, y</div>}
            {tocado && (
              <div className="tarjeta-lugar" role="dialog" aria-label={tocado.nombre}>
                <button type="button" className="cerrar" aria-label="Cerrar" onClick={() => setTocadoId(null)}>
                  ×
                </button>
                <div className="tarjeta-lugar-info">
                  {fotosTocado.length > 0 && (
                    <button
                      type="button"
                      className="miniatura"
                      aria-label={`Ver ${fotosTocado.length > 1 ? 'las fotos' : 'la foto'} de ${tocado.nombre}`}
                      onClick={() => setFotosAbiertasId(tocado.id)}
                    >
                      <img src={fotosTocado[0].mini} alt="" />
                      <span>{fotosTocado.length > 1 ? `${fotosTocado.length} fotos` : 'Ampliar'}</span>
                    </button>
                  )}
                  <div>
                    <strong>{tocado.nombre}</strong>
                    {tocado.descripcion && <p>{tocado.descripcion}</p>}
                    {depsTocado.length > 0 && (
                      <p className="suave">
                        {depsTocado.slice(0, 3).map((d) => d.nombre).join(' · ')}
                        {depsTocado.length > 3 && ` y ${depsTocado.length - 3} más`}
                      </p>
                    )}
                  </div>
                </div>
                <div className="acciones">
                  <button type="button" className="boton" onClick={() => irA(tocado.id)}>
                    Ir aquí
                  </button>
                  <button
                    type="button"
                    className="boton secundario"
                    onClick={() => {
                      cambiarDesde(tocado.id);
                      setTocadoId(null);
                      setPestana('ruta');
                    }}
                  >
                    Estoy aquí
                  </button>
                  {interiorDe(tocado.id) && (
                    <button type="button" className="boton secundario" onClick={() => verInterior(tocado.id)}>
                      Pisos y aulas
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>
        </main>
      )}
      {datos && (
        <Asistente
          datos={datos}
          interiores={interiores}
          desdeId={desdeId}
          accesible={accesible}
          onAccion={alAccionDelAsistente}
        />
      )}
      {interior && interiorAbierto && (
        <InteriorBloque
          interior={interior}
          aulaInicial={interiorAbierto.aula}
          nivelInicial={interiorAbierto.nivel}
          onCerrar={() => setInteriorAbierto(null)}
          onComoLlegar={() => {
            setInteriorAbierto(null);
            irA(interior.lugar_id);
          }}
        />
      )}
      {lugarConFotos && (
        <VisorFotos titulo={lugarConFotos.nombre} fotos={fotosDe(lugarConFotos.id)} onCerrar={() => setFotosAbiertasId(null)} />
      )}
    </div>
  );
}
