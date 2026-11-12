import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import CalibracionGps from '../components/CalibracionGps';
import Marca from '../components/Marca';
import { supabase } from '../lib/supabase';
import { cargarDatos } from '../lib/datos';
import { entradaAIso, isoAEntrada, rangoEvento } from '../lib/tiempo';
import { esVisible, ordenarPorNombre, type DatosCampus, type Evento } from '../lib/tipos';

interface Formulario {
  id: string | null;
  titulo: string;
  descripcion: string;
  inicio: string;
  fin: string;
  lugar_id: string;
  ambiente: string;
  organizador: string;
  por_confirmar: boolean;
}

const VACIO: Formulario = {
  id: null,
  titulo: '',
  descripcion: '',
  inicio: '',
  fin: '',
  lugar_id: 'coliseo',
  ambiente: '',
  organizador: '',
  por_confirmar: false,
};

const aFormulario = (e: Evento): Formulario => ({
  id: e.id,
  titulo: e.titulo,
  descripcion: e.descripcion ?? '',
  inicio: isoAEntrada(e.inicio),
  fin: isoAEntrada(e.fin),
  lugar_id: e.lugar_id,
  ambiente: e.ambiente ?? '',
  organizador: e.organizador ?? '',
  por_confirmar: e.por_confirmar,
});

export default function Admin() {
  const [sesion, setSesion] = useState<Session | null>(null);
  const [esAdmin, setEsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSesion(data.session));
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSesion(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !sesion) {
      setEsAdmin(null);
      return;
    }
    supabase.rpc('es_admin').then(({ data, error }) => setEsAdmin(!error && data === true));
  }, [sesion]);

  let contenido;
  if (!supabase) {
    contenido = (
      <div className="tarjeta">
        <h2>Falta conectar Supabase</h2>
        <p>
          Crea el archivo <code>.env.local</code> (copia <code>.env.example</code>) con <code>VITE_SUPABASE_URL</code> y{' '}
          <code>VITE_SUPABASE_ANON_KEY</code>, y reinicia <code>npm run dev</code>. En Vercel, agrega las mismas variables en
          Settings → Environment Variables.
        </p>
      </div>
    );
  } else if (!sesion) {
    contenido = <Ingreso />;
  } else if (esAdmin === null) {
    contenido = <p className="suave">Verificando permisos…</p>;
  } else if (!esAdmin) {
    contenido = (
      <div className="tarjeta">
        <h2>Sin permisos de administración</h2>
        <p>
          La cuenta <strong>{sesion.user.email}</strong> no está en la tabla <code>admins</code>. Pide a un administrador que
          la agregue desde el SQL Editor de Supabase.
        </p>
        <button type="button" className="boton secundario" onClick={() => supabase?.auth.signOut()}>
          Cerrar sesión
        </button>
      </div>
    );
  } else {
    contenido = <PanelAdmin email={sesion.user.email ?? ''} />;
  }

  return (
    <div className="pagina">
      <header className="barra">
        <Marca subtitulo="Administración" />
        <nav className="enlaces-barra">
          <a href="/">Ver la app</a>
          <a href="/qr">Códigos QR</a>
        </nav>
      </header>
      <main className="pagina-cuerpo">{contenido}</main>
    </div>
  );
}

function Ingreso() {
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setEnviando(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password: clave });
    if (error) setError('Correo o contraseña incorrectos.');
    setEnviando(false);
  };

  return (
    <form className="tarjeta formulario estrecho" onSubmit={enviar}>
      <h2>Ingresar</h2>
      <label className="campo">
        <span>Correo</span>
        <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="campo">
        <span>Contraseña</span>
        <input type="password" required autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} />
      </label>
      {error && <p className="aviso aviso-error">{error}</p>}
      <button className="boton" disabled={enviando}>
        {enviando ? 'Ingresando…' : 'Ingresar'}
      </button>
    </form>
  );
}

function PanelAdmin({ email }: { email: string }) {
  const [datos, setDatos] = useState<DatosCampus | null>(null);
  const recargar = useCallback(() => {
    cargarDatos().then(setDatos);
  }, []);
  useEffect(recargar, [recargar]);

  if (!datos) return <p className="suave">Cargando datos…</p>;

  return (
    <div className="pila">
      <div className="fila-entre">
        <p className="suave">
          Sesión: <strong>{email}</strong>
        </p>
        <button type="button" className="boton secundario pequeno" onClick={() => supabase?.auth.signOut()}>
          Cerrar sesión
        </button>
      </div>
      {datos.origen === 'local' && (
        <p className="aviso aviso-error">
          No se pudieron leer los datos de Supabase y se están mostrando los datos locales. Revisa que hayas ejecutado{' '}
          <code>supabase/schema.sql</code> y <code>supabase/seed.sql</code>.
        </p>
      )}
      <EditorEventos datos={datos} alGuardar={recargar} />
      <Calibracion datos={datos} alGuardar={recargar} />
      <CalibracionGps datos={datos} alGuardar={recargar} />
      <section className="tarjeta">
        <h2>Editar el mapa</h2>
        <p>
          Los lugares y caminos están en las tablas <code>lugares</code> y <code>caminos</code> de Supabase (Table Editor).
          Abre <a href="/?grafo=1">la app en modo grafo</a> para ver todos los nodos y caminos, y toca el mapa para obtener
          las coordenadas x, y de un punto nuevo.
        </p>
      </section>
    </div>
  );
}

function EditorEventos({ datos, alGuardar }: { datos: DatosCampus; alGuardar: () => void }) {
  const [form, setForm] = useState<Formulario>(VACIO);
  const [mensaje, setMensaje] = useState<{ texto: string; error: boolean } | null>(null);
  const lugares = useMemo(() => ordenarPorNombre(datos.lugares.filter(esVisible)), [datos]);
  const nombreLugar = (id: string) => datos.lugares.find((l) => l.id === id)?.nombre ?? id;
  const eventos = [...datos.eventos].sort((a, b) => Date.parse(b.inicio) - Date.parse(a.inicio));
  const cambiar = <K extends keyof Formulario>(campo: K, valor: Formulario[K]) => setForm((f) => ({ ...f, [campo]: valor }));

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    if (form.fin < form.inicio) {
      setMensaje({ texto: 'La fecha de fin debe ser posterior al inicio.', error: true });
      return;
    }
    const fila = {
      titulo: form.titulo.trim(),
      descripcion: form.descripcion.trim() || null,
      inicio: entradaAIso(form.inicio),
      fin: entradaAIso(form.fin),
      lugar_id: form.lugar_id,
      ambiente: form.ambiente.trim() || null,
      organizador: form.organizador.trim() || null,
      por_confirmar: form.por_confirmar,
    };
    const { error } = form.id
      ? await supabase.from('eventos').update(fila).eq('id', form.id)
      : await supabase.from('eventos').insert(fila);
    if (error) {
      setMensaje({ texto: `No se pudo guardar: ${error.message}`, error: true });
      return;
    }
    setMensaje({ texto: form.id ? 'Evento actualizado.' : 'Evento creado.', error: false });
    setForm(VACIO);
    alGuardar();
  };

  const eliminar = async (ev: Evento) => {
    if (!supabase || !window.confirm(`¿Eliminar «${ev.titulo}»? No se puede deshacer.`)) return;
    const { error } = await supabase.from('eventos').delete().eq('id', ev.id);
    setMensaje(error ? { texto: `No se pudo eliminar: ${error.message}`, error: true } : { texto: 'Evento eliminado.', error: false });
    if (!error) {
      if (form.id === ev.id) setForm(VACIO);
      alGuardar();
    }
  };

  return (
    <section className="tarjeta">
      <h2>Eventos</h2>
      <div className="admin-columnas">
        <form className="formulario" onSubmit={guardar}>
          <h3>{form.id ? 'Editar evento' : 'Nuevo evento'}</h3>
          <label className="campo">
            <span>Título *</span>
            <input required value={form.titulo} onChange={(e) => cambiar('titulo', e.target.value)} />
          </label>
          <div className="dos-campos">
            <label className="campo">
              <span>Inicio * (hora de La Paz)</span>
              <input type="datetime-local" required value={form.inicio} onChange={(e) => cambiar('inicio', e.target.value)} />
            </label>
            <label className="campo">
              <span>Fin *</span>
              <input type="datetime-local" required value={form.fin} onChange={(e) => cambiar('fin', e.target.value)} />
            </label>
          </div>
          <label className="campo">
            <span>Lugar * (destino de «Cómo llegar»)</span>
            <select value={form.lugar_id} onChange={(e) => cambiar('lugar_id', e.target.value)}>
              {lugares.map((l) => (
                <option key={l.id} value={l.id}>{l.nombre}</option>
              ))}
            </select>
          </label>
          <label className="campo">
            <span>Ambiente (opcional)</span>
            <input placeholder="Ej.: Auditorio 3, piso 2" value={form.ambiente} onChange={(e) => cambiar('ambiente', e.target.value)} />
          </label>
          <label className="campo">
            <span>Organizador (opcional)</span>
            <input value={form.organizador} onChange={(e) => cambiar('organizador', e.target.value)} />
          </label>
          <label className="campo">
            <span>Descripción (opcional)</span>
            <textarea rows={3} value={form.descripcion} onChange={(e) => cambiar('descripcion', e.target.value)} />
          </label>
          <label className="interruptor">
            <input type="checkbox" checked={form.por_confirmar} onChange={(e) => cambiar('por_confirmar', e.target.checked)} />
            <span>Datos por confirmar</span>
          </label>
          {mensaje && <p className={`aviso ${mensaje.error ? 'aviso-error' : 'aviso-ok'}`}>{mensaje.texto}</p>}
          <div className="acciones">
            <button className="boton">{form.id ? 'Guardar cambios' : 'Crear evento'}</button>
            {form.id && (
              <button type="button" className="boton secundario" onClick={() => setForm(VACIO)}>
                Cancelar
              </button>
            )}
          </div>
        </form>

        <ul className="lista-fichas">
          {eventos.map((ev) => (
            <li key={ev.id} className="ficha">
              <div className="ficha-cabecera">
                <div>
                  <strong>{ev.titulo}</strong>
                  <small className="suave">{rangoEvento(ev)}</small>
                  <small className="suave">{ev.ambiente ?? nombreLugar(ev.lugar_id)}</small>
                </div>
                <div className="acciones">
                  <button type="button" className="boton secundario pequeno" onClick={() => setForm(aFormulario(ev))}>
                    Editar
                  </button>
                  <button type="button" className="boton peligro pequeno" onClick={() => eliminar(ev)}>
                    Eliminar
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Calibracion({ datos, alGuardar }: { datos: DatosCampus; alGuardar: () => void }) {
  const visibles = useMemo(() => ordenarPorNombre(datos.lugares.filter(esVisible)), [datos]);
  const [idA, setIdA] = useState('ingreso_principal');
  const [idB, setIdB] = useState('coliseo');
  const [metros, setMetros] = useState('');
  const [mensaje, setMensaje] = useState<{ texto: string; error: boolean } | null>(null);

  const a = visibles.find((l) => l.id === idA);
  const b = visibles.find((l) => l.id === idB);
  const pixeles = a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  const medidos = Number(metros.replace(',', '.'));
  const nuevaEscala = pixeles > 0 && medidos > 0 ? medidos / pixeles : null;

  const guardar = async () => {
    if (!supabase || !nuevaEscala) return;
    const { error } = await supabase.from('config').upsert([
      { clave: 'metros_por_pixel', valor: nuevaEscala },
      { clave: 'escala_calibrada', valor: 1 },
    ]);
    setMensaje(error ? { texto: `No se pudo guardar: ${error.message}`, error: true } : { texto: 'Escala guardada.', error: false });
    if (!error) alGuardar();
  };

  return (
    <section className="tarjeta">
      <h2>Escala del mapa</h2>
      <p>
        Escala actual: <strong>{datos.config.metros_por_pixel.toFixed(3)} m por píxel</strong>{' '}
        {datos.config.escala_calibrada ? '(calibrada)' : '(estimada)'}. Para calibrarla, mide la distancia{' '}
        <strong>en línea recta</strong> entre dos puntos del campus (con cinta, contando pasos de ~0,75 m o con «Medir
        distancia» de Google Maps) y escríbela aquí. Todas las distancias se recalculan solas.
      </p>
      <div className="dos-campos">
        <label className="campo">
          <span>Punto A</span>
          <select value={idA} onChange={(e) => setIdA(e.target.value)}>
            {visibles.map((l) => (
              <option key={l.id} value={l.id}>{l.nombre}</option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>Punto B</span>
          <select value={idB} onChange={(e) => setIdB(e.target.value)}>
            {visibles.map((l) => (
              <option key={l.id} value={l.id}>{l.nombre}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="campo">
        <span>Distancia medida (metros)</span>
        <input inputMode="decimal" placeholder="Ej.: 120" value={metros} onChange={(e) => setMetros(e.target.value)} />
      </label>
      {pixeles > 0 && (
        <p className="suave">
          En el plano hay {Math.round(pixeles)} px entre ambos puntos (≈ {Math.round(pixeles * datos.config.metros_por_pixel)} m
          con la escala actual).
          {nuevaEscala && ` Nueva escala: ${nuevaEscala.toFixed(3)} m por píxel.`}
        </p>
      )}
      {mensaje && <p className={`aviso ${mensaje.error ? 'aviso-error' : 'aviso-ok'}`}>{mensaje.texto}</p>}
      <button type="button" className="boton" disabled={!nuevaEscala} onClick={guardar}>
        Guardar escala
      </button>
    </section>
  );
}
