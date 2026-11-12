// Genera supabase/seed.sql a partir de los JSON de src/data (la misma fuente que usa la app sin conexión).
// Uso: npm run seed
import { readFileSync, writeFileSync } from 'node:fs';

const leer = (archivo) => JSON.parse(readFileSync(new URL(`../src/data/${archivo}`, import.meta.url), 'utf8'));

const valor = (v) => {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return `'${String(v).replace(/'/g, "''")}'`;
};

const insertar = (tabla, columnas, filas, final = '') =>
  `insert into public.${tabla} (${columnas.join(', ')}) values\n` +
  filas.map((f) => `  (${columnas.map((c) => valor(f[c])).join(', ')})`).join(',\n') +
  (final ? `\n${final}` : '') +
  ';\n';

const lugares = leer('lugares.json');
const caminos = leer('caminos.json');
const dependencias = leer('dependencias.json');
const eventos = leer('eventos.json');
const config = Object.entries(leer('config.json')).map(([clave, v]) => ({ clave, valor: v }));
const georreferencia = leer('georreferencia.json');

const columnasLugar = ['id', 'nombre', 'tipo', 'bloque', 'x', 'y', 'piso', 'descripcion', 'direccion'];
const actualizarLugar = columnasLugar.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`).join(', ');

const sql = `-- Generado por scripts/generar-seed.mjs a partir de src/data. No editar a mano.
-- Ejecutar en Supabase → SQL Editor DESPUÉS de schema.sql.
-- Ojo: vuelve a cargar caminos y dependencias desde cero (borra los cambios hechos en Supabase a esas tablas).

begin;

${insertar('lugares', columnasLugar, lugares, `on conflict (id) do update set ${actualizarLugar}`)}
delete from public.caminos;
${insertar('caminos', ['desde', 'hasta', 'tipo', 'distancia_m', 'indicacion', 'indicacion_vuelta'], caminos)}
delete from public.dependencias;
${insertar('dependencias', ['lugar_id', 'nombre'], dependencias)}
${insertar(
  'eventos',
  ['id', 'titulo', 'descripcion', 'inicio', 'fin', 'lugar_id', 'ambiente', 'organizador', 'por_confirmar'],
  eventos,
  'on conflict (id) do nothing',
)}
${insertar('config', ['clave', 'valor'], config, 'on conflict (clave) do nothing')}
-- Puntos de control del GPS: solo si la tabla está vacía, para no borrar la calibración hecha en /admin.
insert into public.georreferencia (nombre, x, y, lat, lng)
select * from (values
${georreferencia.map((p) => `  (${[p.nombre, p.x, p.y, p.lat, p.lng].map(valor).join(', ')})`).join(',\n')}
) as v (nombre, x, y, lat, lng)
where not exists (select 1 from public.georreferencia);

commit;

-- Para dar permisos de administración, crea el usuario en Authentication → Users
-- y luego ejecuta (con su correo):
-- insert into public.admins (email) values ('tu-correo@ucb.edu.bo');
`;

writeFileSync(new URL('../supabase/seed.sql', import.meta.url), sql);
console.log(
  `seed.sql generado: ${lugares.length} lugares, ${caminos.length} caminos, ${dependencias.length} dependencias, ${eventos.length} eventos.`,
);
