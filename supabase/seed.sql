-- Generado por scripts/generar-seed.mjs a partir de src/data. No editar a mano.
-- Ejecutar en Supabase → SQL Editor DESPUÉS de schema.sql.
-- Ojo: vuelve a cargar caminos y dependencias desde cero (borra los cambios hechos en Supabase a esas tablas).

begin;

insert into public.lugares (id, nombre, tipo, bloque, x, y, piso, descripcion, direccion) values
  ('ingreso_principal', 'Ingreso principal', 'ingreso', null, 343, 460, 0, 'Puerta peatonal sobre la Av. 14 de Septiembre', 'Av. 14 de Septiembre No 4807, esquina Calle 2, Obrajes'),
  ('ingreso_vehicular_oeste', 'Ingreso vehicular oeste', 'ingreso', null, 220, 388, 0, 'Ingreso y salida de vehículos, junto al Bloque D', null),
  ('ingreso_vehicular_este', 'Ingreso vehicular este', 'ingreso', null, 632, 228, 0, 'Ingreso y salida de vehículos, junto a la Biblioteca', null),
  ('ingreso_vehicular_l', 'Ingreso vehicular (Bloque L)', 'ingreso', null, 632, 398, 0, 'Ingreso y salida de vehículos, junto al Bloque L', null),
  ('atrio', 'Atrio', 'punto', null, 343, 428, 0, 'Plaza de ingreso al campus', null),
  ('agora', 'Ágora', 'punto', null, 383, 212, 0, 'Plaza cubierta con coworks', null),
  ('capilla', 'Capilla «El Arca»', 'punto', null, 490, 372, 0, 'Capilla del campus', null),
  ('paraninfo', 'Paraninfo U.C.B.', 'punto', 'D', 276, 290, 5, 'Bloque D, piso 5', null),
  ('coliseo', 'Coliseo U.C.B. (Bloque A)', 'bloque', 'A', 365, 190, 0, 'Coliseo, Departamento de Deportes y Sala de Danza', null),
  ('bloque_b', 'Bloque B · Cultura y arte', 'bloque', 'B', 440, 136, 0, 'Cultura y Arte, Extensión Cultural', null),
  ('bloque_c', 'Bloque C · Edificio de Ingeniería', 'bloque', 'C', 505, 146, 0, 'Laboratorios de Ingeniería y de Computación', null),
  ('bloque_d', 'Bloque D', 'bloque', 'D', 288, 305, 0, 'Aulas D1 a D30, Auditorios 2-3-4 y Paraninfo (piso 5)', null),
  ('bloque_f', 'Bloque F', 'bloque', 'F', 490, 195, 0, 'Registro Académico (Kardex), Derecho y aulas F1 a F13', null),
  ('bloque_g1', 'Bloque G (entrada G1)', 'bloque', 'G', 335, 350, 0, 'Aulas G, Auditorio Principal, Caja y Facultad de Ingeniería', null),
  ('bloque_g2', 'Bloque G (entrada G2)', 'bloque', 'G', 420, 300, 0, 'Entrada lateral del Bloque G, hacia la Cafetería', null),
  ('cafeteria', 'Cafetería (Bloque H)', 'bloque', 'H', 468, 292, 0, 'Cafetería del campus', null),
  ('biblioteca', 'Biblioteca (Bloque I)', 'bloque', 'I', 550, 300, 0, 'Biblioteca central', null),
  ('bloque_j', 'Bloque J', 'bloque', 'J', 290, 362, 0, 'Internacionalización y Vicerrectorado Académico Nacional', null),
  ('bloque_k', 'Bloque K', 'bloque', 'K', 345, 378, 0, 'Oficina de Informaciones, Admisión y Centro Médico', null),
  ('bloque_l', 'Bloque L · Rectorado de Sede', 'bloque', 'L', 578, 428, 0, 'Rectorado de Sede y Dirección Académica', null),
  ('x_atrio_o', 'el lado oeste del Atrio', 'cruce', null, 298, 405, 0, null, null),
  ('x_atrio_e', 'el lado este del Atrio', 'cruce', null, 392, 402, 0, null, null),
  ('x_d_sur', 'el pasillo entre el Bloque J y el Bloque D', 'cruce', null, 272, 340, 0, null, null),
  ('x_d_g1', 'el pasillo entre el Bloque D y el Bloque G', 'cruce', null, 322, 278, 0, null, null),
  ('x_agora_o', 'el extremo oeste del Ágora', 'cruce', null, 316, 245, 0, null, null),
  ('x_agora_ne', 'el extremo noreste del Ágora', 'cruce', null, 455, 182, 0, null, null),
  ('x_norte', 'la explanada frente a los Bloques B y C', 'cruce', null, 468, 148, 0, null, null),
  ('x_k_ne', 'el camino junto al Bloque G', 'cruce', null, 376, 343, 0, null, null),
  ('x_h', 'el lado oeste de la Cafetería', 'cruce', null, 452, 262, 0, null, null),
  ('x_f_o', 'el paso entre la Cafetería y el Bloque F', 'cruce', null, 482, 225, 0, null, null),
  ('x_jardin', 'el sendero del jardín central', 'cruce', null, 440, 345, 0, null, null),
  ('x_este', 'el sendero entre la Capilla y la Biblioteca', 'cruce', null, 560, 350, 0, null, null),
  ('x_l', 'la esquina del jardín junto al Bloque L', 'cruce', null, 565, 400, 0, null, null),
  ('x_i_n', 'el jardín entre el Bloque F y la Biblioteca', 'cruce', null, 538, 238, 0, null, null)
on conflict (id) do update set nombre = excluded.nombre, tipo = excluded.tipo, bloque = excluded.bloque, x = excluded.x, y = excluded.y, piso = excluded.piso, descripcion = excluded.descripcion, direccion = excluded.direccion;

delete from public.caminos;
insert into public.caminos (desde, hasta, tipo, distancia_m, indicacion, indicacion_vuelta) values
  ('ingreso_principal', 'atrio', 'camino', null, 'Entra por el ingreso principal hasta el Atrio', 'Camina hacia el ingreso principal'),
  ('atrio', 'bloque_k', 'escaleras', null, 'Sube por las gradas centrales del Atrio hasta el Bloque K', 'Baja por las gradas centrales hasta el Atrio'),
  ('atrio', 'x_atrio_o', 'camino', null, 'Camina hacia el lado izquierdo (oeste) del Atrio', 'Camina hacia el centro del Atrio'),
  ('x_atrio_o', 'bloque_j', 'camino', null, 'Sigue de frente hasta el Bloque J', 'Baja hacia el lado oeste del Atrio'),
  ('bloque_j', 'bloque_k', 'camino', null, 'Cruza la plaza hasta el Bloque K', 'Cruza la plaza hasta el Bloque J'),
  ('atrio', 'x_atrio_e', 'camino', null, 'Camina hacia el lado derecho (este) del Atrio', 'Camina hacia el centro del Atrio'),
  ('x_atrio_e', 'bloque_k', 'escaleras', null, 'Sube las gradas hacia el Bloque K', 'Baja las gradas hacia el lado este del Atrio'),
  ('ingreso_vehicular_oeste', 'x_atrio_o', 'camino', null, 'Desde el ingreso vehicular, camina hacia el Atrio', 'Camina hacia el ingreso vehicular oeste'),
  ('bloque_j', 'x_d_sur', 'camino', null, 'Pasa junto al Bloque J hacia el Bloque D', 'Camina hacia el Bloque J'),
  ('x_d_sur', 'bloque_d', 'camino', null, 'Sigue el pasillo hasta la entrada del Bloque D', 'Baja por el pasillo hacia el Bloque J'),
  ('bloque_d', 'paraninfo', 'escaleras', null, 'Sube por las escaleras del Bloque D hasta el piso 5', 'Baja por las escaleras hasta la planta baja del Bloque D'),
  ('bloque_d', 'x_d_g1', 'camino', null, 'Sigue por el pasillo entre el Bloque D y el Bloque G', 'Sigue por el pasillo hasta la entrada del Bloque D'),
  ('x_d_g1', 'x_agora_o', 'camino', null, 'Continúa hasta el extremo oeste del Ágora', 'Baja por el pasillo entre el Bloque D y el Bloque G'),
  ('x_agora_o', 'agora', 'camino', null, 'Entra al Ágora', 'Camina hacia el extremo oeste del Ágora'),
  ('x_agora_o', 'coliseo', 'camino', null, 'Bordea el Ágora por el lado del Coliseo hasta su entrada', 'Bordea el Ágora hacia su extremo oeste'),
  ('agora', 'coliseo', 'camino', null, 'Cruza hacia la entrada del Coliseo', 'Cruza hacia el Ágora'),
  ('agora', 'x_agora_ne', 'camino', null, 'Atraviesa el Ágora hacia su extremo noreste', 'Atraviesa el Ágora'),
  ('coliseo', 'x_agora_ne', 'camino', null, 'Sigue junto al Coliseo hacia el extremo noreste del Ágora', 'Sigue junto al Coliseo hasta su entrada'),
  ('x_agora_ne', 'x_norte', 'escaleras', null, 'Sube las gradas hacia los Bloques B y C', 'Baja las gradas hacia el Ágora'),
  ('x_norte', 'bloque_b', 'camino', null, 'Llega al Bloque B', 'Camina hacia la explanada frente al Bloque C'),
  ('x_norte', 'bloque_c', 'camino', null, 'Llega al Bloque C', 'Camina hacia la explanada frente al Bloque B'),
  ('x_norte', 'bloque_f', 'camino', null, 'Baja por el lado oeste del Bloque F hasta su entrada', 'Sube por el lado oeste del Bloque F hacia los Bloques B y C'),
  ('x_f_o', 'bloque_f', 'camino', null, 'Llega a la entrada del Bloque F', 'Baja hacia el paso entre el Bloque F y la Cafetería'),
  ('x_agora_ne', 'x_f_o', 'camino', null, 'Camina hacia el Bloque F', 'Camina hacia el extremo noreste del Ágora'),
  ('x_f_o', 'x_h', 'camino', null, 'Baja hacia la Cafetería', 'Sube hacia el Bloque F'),
  ('x_h', 'cafeteria', 'camino', null, 'Llega a la Cafetería', 'Camina hacia el lado oeste de la Cafetería'),
  ('bloque_k', 'bloque_g1', 'camino', null, 'Camina hacia la entrada G1 del Bloque G', 'Camina hacia el Bloque K'),
  ('bloque_k', 'x_k_ne', 'camino', null, 'Toma el camino de la derecha, junto al Bloque G', 'Baja hacia el Bloque K'),
  ('x_k_ne', 'bloque_g2', 'camino', null, 'Sigue el camino hasta la entrada G2 del Bloque G', 'Baja por el camino junto al Bloque G'),
  ('bloque_g2', 'x_h', 'camino', null, 'Continúa junto al Bloque G hacia la Cafetería', 'Camina junto al Bloque G hasta la entrada G2'),
  ('x_atrio_e', 'x_jardin', 'camino', null, 'Toma el sendero que cruza el jardín', 'Baja por el sendero del jardín hacia el Atrio'),
  ('x_jardin', 'cafeteria', 'camino', null, 'Sube por el jardín hasta la Cafetería', 'Baja hacia el sendero del jardín'),
  ('x_jardin', 'capilla', 'camino', null, 'Camina hacia la Capilla «El Arca»', 'Camina hacia el sendero del jardín'),
  ('x_atrio_e', 'x_l', 'camino', null, 'Camina hacia el este por el sendero junto al jardín', 'Camina hacia el Atrio por el sendero junto al jardín'),
  ('x_l', 'bloque_l', 'camino', null, 'Llega al Bloque L', 'Camina hacia la esquina del jardín'),
  ('x_l', 'ingreso_vehicular_l', 'camino', null, 'Sal hacia el ingreso vehicular', 'Desde el ingreso vehicular, camina hacia el jardín'),
  ('x_l', 'x_este', 'escaleras', null, 'Sube las gradas junto al jardín', 'Baja las gradas hacia el Bloque L'),
  ('capilla', 'x_este', 'camino', null, 'Camina hacia la Biblioteca', 'Camina hacia la Capilla «El Arca»'),
  ('x_este', 'biblioteca', 'camino', null, 'Llega a la entrada de la Biblioteca', 'Baja por el sendero junto a la Biblioteca'),
  ('bloque_f', 'x_i_n', 'camino', null, 'Rodea el Bloque F hacia la Biblioteca', 'Camina hacia el Bloque F'),
  ('x_i_n', 'biblioteca', 'camino', null, 'Baja hasta la entrada de la Biblioteca', 'Sube hacia el jardín entre la Biblioteca y el Bloque F'),
  ('x_i_n', 'ingreso_vehicular_este', 'camino', null, 'Cruza el parqueo hacia el ingreso vehicular', 'Desde el ingreso vehicular, cruza el parqueo hacia el Bloque F');

delete from public.dependencias;
insert into public.dependencias (lugar_id, nombre) values
  ('coliseo', 'Coliseo U.C.B.'),
  ('coliseo', 'Departamento de Deportes'),
  ('coliseo', 'Club "U" Católica'),
  ('coliseo', 'Sala de Danza'),
  ('bloque_b', 'Departamento de Cultura y Arte'),
  ('bloque_b', 'Sala de Literatura'),
  ('bloque_b', 'Extensión Cultural'),
  ('bloque_b', 'Unidad de Auditoría Interna'),
  ('bloque_c', 'Laboratorios de Ingeniería'),
  ('bloque_c', 'Sala de Docentes'),
  ('bloque_c', 'Laboratorios de Computación'),
  ('bloque_c', 'Laboratorio de Computación Aplicada'),
  ('bloque_c', 'Redes y Soporte'),
  ('bloque_d', 'Aulas D1 a D30'),
  ('bloque_d', 'Auditorios 2, 3 y 4'),
  ('bloque_d', 'Laboratorio de Computación 4'),
  ('bloque_d', 'Laboratorio de Redes 5'),
  ('bloque_d', 'Laboratorio de Psicofisiología'),
  ('paraninfo', 'Paraninfo U.C.B.'),
  ('bloque_d', 'Capilla "San Pablo"'),
  ('bloque_d', 'Sala de Docentes (Facultad de Ingeniería)'),
  ('bloque_d', 'Sala de Docentes (Ciencias Básicas)'),
  ('bloque_d', 'Servicio y Mantenimiento'),
  ('bloque_d', 'Archivo Nacional'),
  ('bloque_d', 'Central Telefónica'),
  ('bloque_d', 'Laboratorio CINAES'),
  ('bloque_d', 'Centro de Cómputo'),
  ('bloque_f', 'Registro Académico (Kardex y Registros)'),
  ('bloque_f', 'Decanatura de la Facultad de Derecho y Ciencias Políticas'),
  ('bloque_f', 'Carrera de Ciencias Políticas'),
  ('bloque_f', 'Carrera de Derecho'),
  ('bloque_f', 'Oficinas de Postgrado de Derecho y Ciencias Políticas'),
  ('bloque_f', 'Instituto para la Democracia (IpD)'),
  ('bloque_f', 'Aulas F1 a F13'),
  ('bloque_f', 'Laboratorios 1 y 7'),
  ('bloque_f', 'Mediador Universitario'),
  ('bloque_g1', 'Aulas G1, G2 y G3'),
  ('bloque_g1', 'Auditorio Principal'),
  ('bloque_g1', 'Caja – Tesorería'),
  ('bloque_g1', 'Escuela de la Producción y la Competitividad (ePC)'),
  ('bloque_g1', 'Centro de Sistemas'),
  ('bloque_g1', 'Decanatura de la Facultad de Ingeniería'),
  ('bloque_g1', 'Carreras de la Facultad de Ingeniería'),
  ('bloque_g1', 'Oficinas de Postgrado de Ingeniería'),
  ('bloque_g1', 'Laboratorios de Postgrado'),
  ('bloque_g1', 'Unidad de Gestión de Calidad Académica'),
  ('bloque_g1', 'Unidad de Desarrollo Docente y Curricular'),
  ('bloque_g1', 'Gestión Académica de Postgrado'),
  ('bloque_g1', 'Servicios de atención psicológica y salud mental'),
  ('bloque_j', 'Internacionalización Académica y Cooperación Global'),
  ('bloque_j', 'Vicerrectorado Académico Nacional'),
  ('bloque_k', 'Oficina de Informaciones'),
  ('bloque_k', 'Departamento de Marketing y Comunicación'),
  ('bloque_k', 'Departamento de Admisión y Orientación'),
  ('bloque_k', 'Marketing Postgrado'),
  ('bloque_k', 'Departamento de Pastoral Universitaria'),
  ('bloque_k', 'Universidad para la Tercera Edad'),
  ('bloque_k', 'Proyecto Vencer el Miedo (VEM)'),
  ('bloque_k', 'Cato Voluntarios'),
  ('bloque_k', 'Departamento de Personal'),
  ('bloque_k', 'Centro Médico U.C.B.'),
  ('bloque_k', 'Carrera de Administración de Empresas'),
  ('bloque_k', 'Carrera de Administración Turística'),
  ('bloque_k', 'Carrera de Ingeniería en Innovación Empresarial'),
  ('bloque_k', 'Centro de Investigación de Turismo'),
  ('bloque_l', 'Rectorado de Sede'),
  ('bloque_l', 'Dirección Académica de Sede'),
  ('bloque_l', 'Dirección Administrativa Financiera de Sede');

insert into public.eventos (id, titulo, descripcion, inicio, fin, lugar_id, ambiente, organizador, por_confirmar) values
  ('00000000-0000-4000-8000-000000000001', 'Sínodo · Encuentro y Asamblea de la Iglesia Católica', 'Encuentro y asamblea de la Iglesia Católica en la UCB.', '2026-11-03T08:30:00-04:00', '2026-11-06T18:00:00-04:00', 'bloque_g1', 'Auditorio Principal (Bloque G)', null, true),
  ('00000000-0000-4000-8000-000000000002', 'Feria de Marketing', 'Feria de proyectos y emprendimientos de Marketing.', '2026-11-09T09:00:00-04:00', '2026-11-11T18:00:00-04:00', 'agora', 'Ágora', null, true),
  ('00000000-0000-4000-8000-000000000003', 'Mecatón 2026 · TECH MECH', 'Hackathon de MECAFEST, organizada por Mecacentro UCB (Ingeniería Mecatrónica).', '2026-11-12T08:00:00-04:00', '2026-11-13T18:00:00-04:00', 'coliseo', 'Coliseo U.C.B.', 'Mecacentro UCB', false),
  ('00000000-0000-4000-8000-000000000004', 'Meca Gala', 'Gala de MECAFEST.', '2026-11-13T19:00:00-04:00', '2026-11-13T22:00:00-04:00', 'paraninfo', 'Paraninfo U.C.B. · Bloque D, piso 5', 'Mecacentro UCB', true),
  ('00000000-0000-4000-8000-000000000005', '3ra Colación de Grado', 'Ceremonia de colación de grado.', '2026-11-26T09:00:00-04:00', '2026-11-28T13:00:00-04:00', 'coliseo', 'Coliseo U.C.B.', null, true)
on conflict (id) do nothing;

insert into public.config (clave, valor) values
  ('metros_por_pixel', 0.31),
  ('escala_calibrada', 1),
  ('velocidad_m_s', 1.2),
  ('velocidad_accesible_m_s', 0.8),
  ('velocidad_escaleras_m_s', 0.5),
  ('metros_por_piso', 12)
on conflict (clave) do nothing;

-- Puntos de control del GPS: solo si la tabla está vacía, para no borrar la calibración hecha en /admin.
insert into public.georreferencia (nombre, x, y, lat, lng)
select * from (values
  ('Capilla «El Arca» (centro del techo)', 490, 362, -16.52292283950898, -68.1118449372547),
  ('Coliseo (centro del techo)', 335, 152, -16.522314796533973, -68.11186280294254),
  ('Ingreso principal (puerta)', 343, 460, -16.522916416529352, -68.1122201167202)
) as v (nombre, x, y, lat, lng)
where not exists (select 1 from public.georreferencia);

commit;

-- Para dar permisos de administración, crea el usuario en Authentication → Users
-- y luego ejecuta (con su correo):
-- insert into public.admins (email) values ('tu-correo@ucb.edu.bo');
