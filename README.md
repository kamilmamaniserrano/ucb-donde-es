# ¿Dónde es? · Campus UCB La Paz

Plataforma web que muestra los eventos de la UCB y guía a cualquier persona por la **ruta más corta** dentro del
campus (Av. 14 de Septiembre, Obrajes). Prototipo para el Reto FDI de TECH MECH 2026.

- **Eventos**: lista con fecha, lugar y estado (en curso / próximo / finalizado), botón «Cómo llegar» y
  «Agregar a mi calendario» (Google Calendar).
- **Cómo llegar**: el algoritmo de Dijkstra calcula la ruta más corta sobre el grafo del campus. Muestra los
  pasos, los metros que se caminan, el tiempo aproximado y los pisos que se suben. Tiene un modo **sin escaleras**.
- **Directorio**: buscador de oficinas, carreras y aulas (por ejemplo «Kardex», «Caja», «D12»), con las
  dependencias de los bloques del mapa. Solo incluye lugares dibujados en el mapa del campus principal.
- **GPS**: el botón «Usar mi ubicación» muestra a la persona en el mapa (punto azul con su precisión) y usa el
  lugar más cercano como origen de la ruta, actualizándolo mientras camina.
- **Vista 3D**: con el botón «Ver en 3D», los bloques se levantan según sus pisos. La ruta se ve en 3D (por ejemplo,
  sube por el Bloque D hasta el Paraninfo, en el piso 5) y el piso de destino se ilumina.
- **Códigos QR** (`/qr`): una hoja imprimible con un QR por lugar. Al escanearlo, la app sabe dónde está la
  persona y usa ese lugar como origen.
- **Administración** (`/admin`): CRUD de eventos y calibración de la escala del mapa.

## Tecnología

| Parte | Herramienta |
|---|---|
| Interfaz | React 19 + Vite + TypeScript |
| Mapa | Leaflet sobre el plano oficial del campus (`public/mapa-campus.png`) |
| Ruta más corta | Dijkstra propio (`src/lib/rutas.ts`) |
| Base de datos y login | Supabase (Postgres + Auth + RLS) |
| Hosting | Vercel |

Si Supabase no está configurado o no responde, la app usa los datos de `src/data/*.json`. Así funciona igual
en una demo sin conexión a la base.

## Correr en tu computadora

```bash
npm install
npm run dev        # http://localhost:5173
```

Para conectar Supabase, copia `.env.example` como `.env.local` y completa:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=...   # la clave pública "anon" / "publishable"
```

`.env.local` está en `.gitignore` y no se sube al repositorio. **Nunca uses la `service_role` / secret key en
esta app**: queda expuesta en el navegador. Tampoco hace falta, porque los permisos se controlan con RLS.

## Configurar Supabase (una sola vez)

1. Crea el proyecto en [supabase.com](https://supabase.com).
2. En **SQL Editor**, ejecuta `supabase/schema.sql`. Crea las tablas, las políticas RLS (lectura pública,
   escritura solo para administradores) y la función `es_admin()`.
3. En **SQL Editor**, ejecuta `supabase/seed.sql` para cargar lugares, caminos, dependencias, eventos y config.
4. En **Authentication → Users → Add user**, crea la cuenta del administrador con correo y contraseña
   (marca *Auto Confirm User*).
5. Dale permisos de administrador:
   ```sql
   insert into public.admins (email) values ('correo-del-admin@ucb.edu.bo');
   ```
6. Entra a `/admin` con esa cuenta.

Si cambias los JSON de `src/data`, ejecuta `npm run seed` para regenerar `supabase/seed.sql`.

## Publicar en Vercel

1. Sube la carpeta a un repositorio de GitHub. El `.gitignore` ya excluye `node_modules` y `.env.local`.
2. En Vercel: **Add New → Project →** importa el repositorio. Detecta Vite solo: el comando de build es
   `npm run build` y la carpeta de salida es `dist`.
3. En **Settings → Environment Variables**, agrega `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` y vuelve a
   desplegar.
4. `vercel.json` redirige todas las rutas a `index.html`, así que `/admin` y `/qr` funcionan.
5. Abre `/qr`, escribe la dirección de Vercel y descarga los QR desde esa página, para que apunten a la app
   publicada.

## Cómo está modelado el mapa

- **lugares**: nodos del grafo. `x`, `y` son píxeles del plano (664×489). `tipo` puede ser `ingreso`, `bloque` o
  `punto` (se ven en el mapa) o `cruce` (intersección invisible). `piso` sirve para la navegación entre pisos; por ejemplo, el Paraninfo está en el piso 5 del
  Bloque D.
- **caminos**: aristas, que se pueden recorrer en ambos sentidos. `tipo` puede ser `camino`, `escaleras`, `rampa`
  o `ascensor`; el modo sin escaleras descarta las `escaleras`. `distancia_m` puede quedar vacío, y entonces se
  calcula con la escala del plano. `indicacion` / `indicacion_vuelta` son los textos de cada sentido.
- **config**: `metros_por_pixel` (escala), velocidades al caminar (1,2 m/s normal, 0,8 m/s accesible,
  0,5 m/s en escaleras) y `metros_por_piso`.

### Editar o corregir el mapa

1. Abre la app con `?grafo=1` (por ejemplo `http://localhost:5173/?grafo=1`). Se ven todos los nodos con su id y
   todos los caminos; las escaleras aparecen en rojo punteado.
2. Toca el mapa para obtener las coordenadas `x, y` de un punto.
3. Edita las tablas `lugares` y `caminos` en el **Table Editor** de Supabase. Para que los cambios queden en el
   repositorio, edita también `src/data/*.json` y ejecuta `npm run seed`.

### Calibrar la escala

La escala actual es **0,31 m por píxel**. Se calibró con dos medidas tomadas con «Medir distancia» de Google Maps:

| Medida | Real | En el plano | Escala |
|---|---|---|---|
| Frente del campus sobre la Av. 14 de Septiembre, de esquina a esquina | 136,9 m | 440 px (x=195 a x=635) | 0,311 m/px |
| Coliseo, lado largo | 44,41 m | ~148 px | 0,300 m/px |

El plano es un dibujo y no está perfectamente a escala. En la zona central, los puntos GPS de la Capilla, el Coliseo
y el Ingreso indican unos 0,25 m/px, así que las distancias son una buena aproximación, no una medida exacta.

Si se hace una medición mejor:

1. Mide en el campus la distancia **en línea recta** entre dos puntos del mapa. Por ejemplo, del ingreso principal
   a la puerta del Coliseo, con cinta, contando pasos o con «Medir distancia» de Google Maps.
2. En `/admin → Escala del mapa`, elige esos dos puntos y escribe los metros.

Todas las distancias y los tiempos se recalculan solos.

## Vista 3D

`src/components/Vista3D.tsx` usa three.js y se descarga solo cuando alguien la abre, así que no hace más lenta la
app. Los edificios están en `src/data/edificios.json`:

| Campo | Qué es |
|---|---|
| `poligono` | Contorno del edificio en píxeles del plano. Se obtuvo detectando los colores de cada bloque en el plano; J y K se dibujaron a mano siguiendo su borde amarillo |
| `pisos`, `alto_piso_m` | Cantidad de pisos y altura de cada uno (3,5 m por defecto). El Coliseo es un solo volumen de 12 m (cancha polideportiva con graderías) |
| `subsuelos` | Pisos bajo el nivel de la entrada: se ven translúcidos debajo del suelo (el Bloque C tiene 2) |
| `tipo` | `edificio`, o `techo` para una losa elevada sin paredes (el Ágora) |
| `lugar_id` | Lugar que se selecciona al tocar el edificio |
| `vidrio` | Lo dibuja translúcido (J y K) |

Los pisos de A, C y D están confirmados. Los de B, F, G, H, I, J, K y L son estimaciones hechas a partir del plano
maestro; corrígelos en ese archivo.

## GPS (georreferencia del plano)

El navegador entrega la posición en latitud y longitud. Para dibujarla en el plano, `src/lib/gps.ts` ajusta una
transformación (escala, rotación y traslación) a partir de los puntos de control de
`src/data/georreferencia.json`. Cada punto tiene su posición en el plano (`x`, `y`) y en Google Maps (`lat`,
`lng`).

- Hoy se usan 3 puntos: el centro del techo de la Capilla «El Arca», el centro del techo del Coliseo y el ingreso
  principal. Con ellos, el error es de unos 2 m.
- Para agregar un punto, ubícalo en Google Maps en vista satélite (clic derecho → copiar coordenadas) y toma su
  `x, y` en la app con `?grafo=1`. Usa puntos fáciles de reconocer en ambos lados y repartidos por el campus.
- Fuera del rectángulo del campus, la app guía desde el ingreso principal.
- Como el GPS no distingue pisos, solo se eligen lugares de planta baja.
- Necesita HTTPS (Vercel ya lo tiene) y que la persona acepte el permiso de ubicación. Al aire libre la precisión
  típica es de 5 a 15 m; dentro de los bloques conviene usar los códigos QR.

## Datos que hay que verificar en el campus

El grafo se armó a partir del plano oficial, así que hay supuestos que conviene confirmar recorriendo el campus:

- [ ] La ubicación exacta de las puertas de cada bloque, sobre todo la del Coliseo, el Bloque D y el Bloque G.
- [ ] Dónde hay escaleras. Hoy están marcadas: las gradas centrales del Atrio, las gradas Atrio → Bloque K, las
      gradas Ágora → Bloques B/C, las gradas junto al Bloque L y las escaleras internas del Bloque D.
- [ ] Si el Bloque D tiene ascensor hasta el piso 5. Si lo tiene, agrega un camino `bloque_d → paraninfo` con
      `tipo = 'ascensor'` y el Paraninfo quedará accesible sin escaleras.
- [ ] El lugar y los horarios de los eventos marcados como «Por confirmar».
