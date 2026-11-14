import { useEffect, useRef, useState } from 'react';
import type { FotoLugar } from '../lib/fotos';

interface Props {
  titulo: string;
  fotos: FotoLugar[];
  onCerrar: () => void;
}

/** Fotos de un lugar a pantalla completa. Se cierra con la ×, con Escape o tocando fuera de la foto. */
export default function VisorFotos({ titulo, fotos, onCerrar }: Props) {
  const [indice, setIndice] = useState(0);
  const cerrar = useRef<HTMLButtonElement>(null);
  const varias = fotos.length > 1;
  const mover = (paso: number) => setIndice((i) => (i + paso + fotos.length) % fotos.length);
  const actual = fotos[indice];

  useEffect(() => {
    cerrar.current?.focus();
  }, []);

  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
      else if (e.key === 'ArrowRight') setIndice((i) => (i + 1) % fotos.length);
      else if (e.key === 'ArrowLeft') setIndice((i) => (i - 1 + fotos.length) % fotos.length);
    };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [fotos.length, onCerrar]);

  return (
    <div className="visor-fondo" onClick={onCerrar}>
      <figure className="visor" role="dialog" aria-modal="true" aria-label={`Fotos de ${titulo}`} onClick={(e) => e.stopPropagation()}>
        <header className="visor-cabecera">
          <strong>{titulo}</strong>
          {varias && (
            <small>
              {indice + 1} de {fotos.length}
            </small>
          )}
          <button ref={cerrar} type="button" className="cerrar" aria-label="Cerrar las fotos" onClick={onCerrar}>
            ×
          </button>
        </header>
        <div className="visor-foto">
          <img src={actual.src} alt={actual.pie} />
          {varias && (
            <>
              <button type="button" className="visor-flecha anterior" aria-label="Foto anterior" onClick={() => mover(-1)}>
                ‹
              </button>
              <button type="button" className="visor-flecha siguiente" aria-label="Foto siguiente" onClick={() => mover(1)}>
                ›
              </button>
            </>
          )}
        </div>
        <figcaption>{actual.pie}</figcaption>
      </figure>
    </div>
  );
}
