import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import edificiosJson from '../data/edificios.json';
import type { Ruta } from '../lib/rutas';
import type { DatosCampus } from '../lib/tipos';

/** Edificio levantado a partir de su contorno en el plano (coordenadas 664×489). */
interface Edificio {
  id: string;
  nombre: string;
  etiqueta: string;
  lugar_id: string;
  bloque: string | null;
  /** "techo": losa elevada sin paredes, como el Ágora. */
  tipo: 'edificio' | 'techo';
  pisos: number;
  alto_piso_m: number;
  subsuelos: number;
  color: string;
  vidrio: boolean;
  poligono: [number, number][];
}

const EDIFICIOS = edificiosJson as unknown as Edificio[];

// Mismo recorte del plano que usa el mapa 2D.
const RECORTE = { x0: 188, y0: 58, x1: 664, y1: 489 };
const CENTRO = new THREE.Vector3(420, 0, 275);
// Posición inicial de la cámara respecto del punto que mira: desde la avenida, en diagonal hacia arriba.
const DESDE_CAMARA = new THREE.Vector3(-40, 270, 350);
const ALTO_PISO_M = 3.5;
const COLORES = {
  ruta: 0xe8590c,
  escaleras: 0xffb066,
  desde: 0x16a34a,
  hasta: 0xf7941d,
  gps: 0x2563eb,
};

interface Props {
  datos: DatosCampus;
  ruta: Ruta | null;
  desdeId: string;
  hastaId: string | null;
  ubicacionGps: { x: number; y: number; radio: number } | null;
  onElegirLugar: (id: string) => void;
}

interface Escena3D {
  escena: THREE.Scene;
  camara: THREE.PerspectiveCamera;
  controles: OrbitControls;
  grupoRuta: THREE.Group;
  grupoGps: THREE.Group;
  /** Mallas de cada piso por edificio (índice = número de piso). */
  pisos: Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[]>;
  pxPorMetro: number;
}

function extruir(forma: THREE.Shape, alto: number): THREE.BufferGeometry {
  const geo = new THREE.ExtrudeGeometry(forma, { depth: alto, bevelEnabled: false });
  // La forma se dibuja en (x, -y) y se acuesta: queda sobre el plano XZ con la altura en +Y.
  geo.rotateX(-Math.PI / 2);
  return geo;
}

function etiqueta(texto: string, clase: string): CSS2DObject {
  const div = document.createElement('div');
  div.className = clase;
  div.textContent = texto;
  return new CSS2DObject(div);
}

function vaciar(grupo: THREE.Group) {
  grupo.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
      o.geometry.dispose();
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    }
  });
  grupo.clear();
}

export default function Vista3D({ datos, ruta, desdeId, hastaId, ubicacionGps, onElegirLugar }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const ref = useRef<Escena3D | null>(null);
  const alElegir = useRef(onElegirLugar);
  const [sinWebGL, setSinWebGL] = useState(false);

  useEffect(() => {
    alElegir.current = onElegirLugar;
  }, [onElegirLugar]);

  useEffect(() => {
    const div = contenedor.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setSinWebGL(true);
      return;
    }
    const pxPorMetro = 1 / datos.config.metros_por_pixel;
    const altoPiso = (e: Edificio) => e.alto_piso_m * pxPorMetro;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(div.clientWidth, div.clientHeight);
    div.appendChild(renderer.domElement);
    const etiquetas = new CSS2DRenderer();
    etiquetas.setSize(div.clientWidth, div.clientHeight);
    etiquetas.domElement.className = 'etiquetas-3d';
    div.appendChild(etiquetas.domElement);

    const escena = new THREE.Scene();
    escena.background = new THREE.Color(0xeef0f6);
    escena.add(new THREE.HemisphereLight(0xffffff, 0x8f98ab, 2.2));
    const sol = new THREE.DirectionalLight(0xffffff, 1.8);
    sol.position.set(650, 600, 700);
    escena.add(sol);

    const aspecto = div.clientWidth / div.clientHeight;
    const camara = new THREE.PerspectiveCamera(45, aspecto, 1, 5000);
    // En pantallas angostas (celular) se aleja la cámara para que entre todo el ancho del campus.
    camara.position.copy(CENTRO).addScaledVector(DESDE_CAMARA, Math.min(1.6, Math.max(1, 1.1 / aspecto)));
    const controles = new OrbitControls(camara, renderer.domElement);
    controles.target.copy(CENTRO);
    controles.enableDamping = true;
    controles.maxPolarAngle = 1.35; // no dejar que la cámara baje del suelo
    controles.minDistance = 60;
    controles.maxDistance = 1300;
    controles.update();

    // Suelo: el plano del campus. Es apenas translúcido para que se vean los subsuelos.
    const textura = new THREE.TextureLoader().load('/mapa-campus.png');
    textura.colorSpace = THREE.SRGBColorSpace;
    textura.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const ancho = RECORTE.x1 - RECORTE.x0;
    const largo = RECORTE.y1 - RECORTE.y0;
    const suelo = new THREE.Mesh(
      new THREE.PlaneGeometry(ancho, largo),
      new THREE.MeshBasicMaterial({ map: textura, transparent: true, opacity: 0.94 }),
    );
    suelo.rotation.x = -Math.PI / 2;
    suelo.position.set(RECORTE.x0 + ancho / 2, 0, RECORTE.y0 + largo / 2);
    escena.add(suelo);

    const pisos: Escena3D['pisos'] = new Map();
    const clicables: THREE.Object3D[] = [];
    const materialBordes = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 });
    for (const e of EDIFICIOS) {
      const forma = new THREE.Shape(e.poligono.map(([x, y]) => new THREE.Vector2(x, -y)));
      const alto = altoPiso(e);
      const lista: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[] = [];
      const agregar = (geo: THREE.BufferGeometry, y: number, material: THREE.MeshStandardMaterial) => {
        const malla = new THREE.Mesh(geo, material);
        malla.position.y = y;
        malla.userData = { lugarId: e.lugar_id, color: material.color.clone() };
        malla.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), materialBordes));
        escena.add(malla);
        clicables.push(malla);
        return malla;
      };
      const material = () =>
        new THREE.MeshStandardMaterial({
          color: e.color,
          roughness: 0.8,
          metalness: 0.05,
          transparent: e.vidrio,
          opacity: e.vidrio ? 0.55 : 1,
        });

      if (e.tipo === 'techo') {
        lista.push(agregar(extruir(forma, 0.8 * pxPorMetro), alto, material()));
      } else {
        for (let i = 0; i < e.pisos; i++) lista.push(agregar(extruir(forma, alto), i * alto, material()));
        for (let i = 1; i <= e.subsuelos; i++) {
          const sub = new THREE.MeshStandardMaterial({ color: e.color, transparent: true, opacity: 0.35, depthWrite: false });
          agregar(extruir(forma, alto), -i * alto, sub);
        }
      }
      pisos.set(e.id, lista);

      const cx = e.poligono.reduce((s, p) => s + p[0], 0) / e.poligono.length;
      const cy = e.poligono.reduce((s, p) => s + p[1], 0) / e.poligono.length;
      const rotulo = etiqueta(e.etiqueta, 'etiqueta-edificio');
      rotulo.position.set(cx, (e.tipo === 'techo' ? alto : e.pisos * alto) + 4 * pxPorMetro, cy);
      escena.add(rotulo);
    }

    const grupoRuta = new THREE.Group();
    const grupoGps = new THREE.Group();
    escena.add(grupoRuta, grupoGps);
    ref.current = { escena, camara, controles, grupoRuta, grupoGps, pisos, pxPorMetro };

    // Tocar un edificio lo selecciona (solo si fue un toque, no un arrastre para girar).
    const raycaster = new THREE.Raycaster();
    let inicio: { x: number; y: number } | null = null;
    const alBajar = (ev: PointerEvent) => {
      inicio = { x: ev.clientX, y: ev.clientY };
    };
    const alSoltar = (ev: PointerEvent) => {
      if (!inicio || Math.hypot(ev.clientX - inicio.x, ev.clientY - inicio.y) > 6) return;
      const r = renderer.domElement.getBoundingClientRect();
      const puntero = new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(puntero, camara);
      const [impacto] = raycaster.intersectObjects(clicables, false);
      if (impacto) alElegir.current(impacto.object.userData.lugarId);
    };
    renderer.domElement.addEventListener('pointerdown', alBajar);
    renderer.domElement.addEventListener('pointerup', alSoltar);

    const observador = new ResizeObserver(() => {
      const w = div.clientWidth;
      const h = div.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      etiquetas.setSize(w, h);
      camara.aspect = w / h;
      camara.updateProjectionMatrix();
    });
    observador.observe(div);

    renderer.setAnimationLoop(() => {
      controles.update();
      renderer.render(escena, camara);
      etiquetas.render(escena, camara);
    });

    return () => {
      renderer.setAnimationLoop(null);
      observador.disconnect();
      renderer.domElement.removeEventListener('pointerdown', alBajar);
      renderer.domElement.removeEventListener('pointerup', alSoltar);
      controles.dispose();
      escena.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
        }
      });
      textura.dispose();
      renderer.dispose();
      div.replaceChildren();
      ref.current = null;
    };
    // La escena se arma una sola vez; la escala no cambia mientras la vista está abierta.
  }, []);

  // Ruta y marcadores de origen y destino.
  useEffect(() => {
    const e = ref.current;
    if (!e) return;
    vaciar(e.grupoRuta);
    const altura = (piso: number) => (piso * ALTO_PISO_M + 1.2) * e.pxPorMetro;
    const porId = new Map(datos.lugares.map((l) => [l.id, l]));

    const marcador = (id: string | null, color: number, texto: string, clase: string) => {
      const l = id ? porId.get(id) : undefined;
      if (!l || l.x == null || l.y == null) return null;
      const punto = new THREE.Vector3(l.x, altura(l.piso), l.y);
      const esfera = new THREE.Mesh(
        new THREE.SphereGeometry(4, 20, 14),
        new THREE.MeshBasicMaterial({ color, depthTest: false }),
      );
      esfera.position.copy(punto);
      esfera.renderOrder = 11;
      const rotulo = etiqueta(texto, `etiqueta-ruta ${clase}`);
      rotulo.position.set(punto.x, punto.y + 8, punto.z);
      e.grupoRuta.add(esfera, rotulo);
      return punto;
    };

    const origen = marcador(desdeId, COLORES.desde, 'Estás aquí', 'origen');
    const destino = hastaId ? marcador(hastaId, COLORES.hasta, `Destino · ${porId.get(hastaId)?.nombre ?? ''}`, 'destino') : null;

    if (ruta) {
      for (const s of ruta.segmentos) {
        const a = new THREE.Vector3(s.de[0], altura(s.pisoDe), s.de[1]);
        const b = new THREE.Vector3(s.a[0], altura(s.pisoA), s.a[1]);
        // En un cambio de piso se sube (o baja) en vertical y luego se avanza.
        const puntos = s.pisoDe === s.pisoA ? [a, b] : [a, new THREE.Vector3(a.x, b.y, a.z), b];
        const material = new THREE.MeshBasicMaterial({
          color: s.tipo === 'escaleras' ? COLORES.escaleras : COLORES.ruta,
          depthTest: false,
          transparent: true,
          opacity: 0.95,
        });
        for (let i = 0; i < puntos.length - 1; i++) {
          const tubo = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(puntos[i], puntos[i + 1]), 1, 1.8, 8), material);
          tubo.renderOrder = 10;
          e.grupoRuta.add(tubo);
        }
      }
    }

    // Con una ruta, la vista se centra entre el origen y el destino; sin ruta, en el campus.
    // Solo se desplaza: el ángulo y la distancia de la cámara no cambian.
    const foco = origen && destino ? origen.clone().add(destino).multiplyScalar(0.5) : CENTRO;
    const delta = new THREE.Vector3(foco.x, 0, foco.z).sub(e.controles.target);
    e.controles.target.add(delta);
    e.camara.position.add(delta);
  }, [datos, ruta, desdeId, hastaId]);

  // Resalta el edificio de destino (y el piso exacto, si no es la planta baja).
  useEffect(() => {
    const e = ref.current;
    if (!e) return;
    for (const lista of e.pisos.values()) {
      for (const m of lista) {
        m.material.color.copy(m.userData.color);
        m.material.emissive.setHex(0x000000);
      }
    }
    const hasta = hastaId ? datos.lugares.find((l) => l.id === hastaId) : undefined;
    if (!hasta) return;
    const edificio = EDIFICIOS.find((ed) => ed.lugar_id === hasta.id || (hasta.bloque != null && ed.bloque === hasta.bloque));
    const lista = edificio ? e.pisos.get(edificio.id) : undefined;
    if (!lista) return;
    const naranja = new THREE.Color(COLORES.hasta);
    if (hasta.piso > 0 && lista[hasta.piso]) {
      // Destino en un piso alto: solo ese piso se ilumina, para que se vea a qué altura ir.
      lista[hasta.piso].material.color.copy(naranja);
      lista[hasta.piso].material.emissive.setHex(0x8a4a00);
    } else {
      for (const m of lista) m.material.color.copy(m.userData.color).lerp(naranja, 0.5);
    }
  }, [datos, hastaId]);

  // Posición GPS: punto azul con un disco que indica la precisión.
  useEffect(() => {
    const e = ref.current;
    if (!e) return;
    vaciar(e.grupoGps);
    if (!ubicacionGps) return;
    const punto = new THREE.Mesh(new THREE.SphereGeometry(4.5, 20, 14), new THREE.MeshBasicMaterial({ color: COLORES.gps, depthTest: false }));
    punto.position.set(ubicacionGps.x, 1.5 * e.pxPorMetro, ubicacionGps.y);
    punto.renderOrder = 12;
    const disco = new THREE.Mesh(
      new THREE.CircleGeometry(ubicacionGps.radio, 40),
      new THREE.MeshBasicMaterial({ color: COLORES.gps, transparent: true, opacity: 0.18, depthWrite: false }),
    );
    disco.rotation.x = -Math.PI / 2;
    disco.position.set(ubicacionGps.x, 0.3, ubicacionGps.y);
    e.grupoGps.add(disco, punto);
  }, [ubicacionGps]);

  if (sinWebGL) {
    return <div className="vista-3d sin-3d">Este dispositivo no permite mostrar la vista 3D.</div>;
  }
  return (
    <>
      <div ref={contenedor} className="vista-3d" aria-label="Vista 3D del campus" />
      <div className="ayuda-3d">Arrastra para girar · pellizca o usa la rueda para acercar</div>
    </>
  );
}
