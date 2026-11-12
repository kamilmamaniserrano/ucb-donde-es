import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import Marca from '../components/Marca';
import { cargarDatos } from '../lib/datos';
import { esVisible, ordenarPorNombre, type DatosCampus } from '../lib/tipos';

/** Hoja imprimible con un QR por lugar: al escanearlo, la app abre con ese lugar como origen. */
export default function CodigosQR() {
  const [datos, setDatos] = useState<DatosCampus | null>(null);
  const [base, setBase] = useState(window.location.origin);
  const [imagenes, setImagenes] = useState<Record<string, string>>({});

  useEffect(() => {
    cargarDatos().then(setDatos);
  }, []);

  const lugares = useMemo(() => (datos ? ordenarPorNombre(datos.lugares.filter(esVisible)) : []), [datos]);
  const urlDe = (id: string) => `${base.replace(/\/+$/, '')}/?desde=${encodeURIComponent(id)}`;

  useEffect(() => {
    let cancelado = false;
    const raiz = base.replace(/\/+$/, '');
    Promise.all(
      lugares.map(async (l) => {
        const url = `${raiz}/?desde=${encodeURIComponent(l.id)}`;
        const imagen = await QRCode.toDataURL(url, { margin: 1, width: 320, color: { dark: '#1c1f5e', light: '#ffffff' } });
        return [l.id, imagen] as const;
      }),
    ).then((pares) => {
      if (!cancelado) setImagenes(Object.fromEntries(pares));
    });
    return () => {
      cancelado = true;
    };
  }, [lugares, base]);

  return (
    <div className="pagina">
      <header className="barra no-imprimir">
        <Marca subtitulo="Códigos QR" />
        <nav className="enlaces-barra">
          <a href="/">Ver la app</a>
          <a href="/admin">Administración</a>
        </nav>
      </header>
      <main className="pagina-cuerpo">
        <section className="tarjeta no-imprimir">
          <h2>Códigos QR para el campus</h2>
          <p>
            Imprime y coloca cada código en su lugar. Al escanearlo, la app sabe dónde está la persona y le muestra los
            eventos y la ruta más corta desde ahí.
          </p>
          <label className="campo">
            <span>Dirección pública de la app (la de Vercel)</span>
            <input value={base} onChange={(e) => setBase(e.target.value)} />
          </label>
          <button type="button" className="boton" onClick={() => window.print()}>
            Imprimir
          </button>
        </section>

        <div className="rejilla-qr">
          {lugares.map((l) => (
            <article key={l.id} className="tarjeta-qr">
              <p className="qr-encabezado">Estás en</p>
              <h3>{l.nombre}</h3>
              {imagenes[l.id] && <img src={imagenes[l.id]} alt={`Código QR para ${l.nombre}`} />}
              <p className="qr-pie">Escanea para ver los eventos de la UCB y cómo llegar</p>
              <small className="qr-url">{urlDe(l.id)}</small>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
