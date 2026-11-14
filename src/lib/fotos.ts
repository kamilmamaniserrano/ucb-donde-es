/** Foto de un lugar: `src` se ve en grande y `mini` es la miniatura de la tarjeta del mapa. */
export interface FotoLugar {
  src: string;
  mini: string;
  pie: string;
}

// Cada foto está en public/lugares/ en dos tamaños: <nombre>.jpg (1280 px de ancho) y <nombre>-mini.jpg (360 px).
const foto = (archivo: string, pie: string): FotoLugar => ({
  src: `/lugares/${archivo}.jpg`,
  mini: `/lugares/${archivo}-mini.jpg`,
  pie,
});

/** Fotos de la entrada de cada lugar, por id de lugar. La primera es la portada. */
const FOTOS: Record<string, FotoLugar[]> = {
  coliseo: [foto('coliseo', 'Bloque A · entrada del Coliseo U.C.B. (la puerta amarilla)')],
  bloque_b: [
    foto('bloque-b', 'Bloque B · Departamento de Cultura y Arte'),
    foto('bloque-b-2', 'El Bloque B, al lado de la entrada del Coliseo (Bloque A)'),
  ],
  bloque_c: [
    foto('bloque-c', 'Entrada del Bloque C (Edificio de Ingeniería), junto al Bloque B'),
    foto('bloque-c-2', 'Fachada de vidrio del Bloque C'),
  ],
  agora: [foto('agora', 'Entrada del Ágora U.C.B.')],
  bloque_d: [foto('bloque-d', 'Bloque D · a la derecha, la torre de vidrio del ascensor panorámico')],
  paraninfo: [
    foto('bloque-d', 'El Paraninfo está en el piso 5 del Bloque D: sube por el ascensor panorámico (la torre de vidrio, a la derecha)'),
  ],
  bloque_f: [foto('bloque-f', 'Bloque F, visto desde el pasillo con barandas')],
  biblioteca: [foto('biblioteca', 'Entrada de la Biblioteca Central: gradas rojas y, a la izquierda, una rampa')],
  bloque_g1: [foto('bloque-g-postgrado', 'Ingreso de Postgrado del Bloque G, junto al Bloque D')],
  bloque_g2: [
    foto('bloque-g2', 'Entrada G2 del Bloque G: ePC y Caja – Tesorería'),
    foto('bloque-g2-epc', 'Fachada de la ePC (Escuela de la Producción y la Competitividad) en el Bloque G'),
  ],
  cafeteria: [foto('cafeteria', 'Bloque H · Cafetería U.C.B.; a la izquierda, el Bloque G2 (Caja – Tesorería)')],
  bloque_k: [
    foto('bloque-k', 'Bloque K · Marketing, Admisiones e Informaciones'),
    foto('bloque-k-2', 'Entrada de Informaciones y Admisiones (Bloque K)'),
  ],
  bloque_l: [foto('bloque-l', 'Bloque L · Rectorado Sede La Paz')],
};

export const fotosDe = (lugarId: string): FotoLugar[] => FOTOS[lugarId] ?? [];
