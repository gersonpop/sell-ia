# Especificacion: Integracion Sidebar con tabla modules via API dinamica

## Contexto
El sidebar actualmente requiere alinearse con el nuevo enfoque de simplificacion: consumir datos desde rutas dinamicas existentes y evitar endpoints dedicados por feature. Se necesita que el menu principal se alimente de la tabla `modules` con reglas claras de visibilidad y orden.

## Objetivo
Renderizar el sidebar principal de forma dinamica leyendo `modules` al iniciar la app, mostrando solo modulos raiz activos y ordenados, sin crear endpoints backend dedicados para esta integracion.

## Usuario principal
Usuario autenticado de la aplicacion web que navega mediante el sidebar.

## Historia de usuario
Como desarrollador de la plataforma, necesito integrar sidebar y modules para que el sidebar lea la tabla `modules`, seleccione los registros cuyo `parentId` sea `/`, cuyo `status` sea `active`, y los ordene por numero de orden para presentar una navegacion consistente.

## Alcance
- Consumo de `modules` desde API dinamica existente.
- Filtrado en frontend por `parentId` y `status`.
- Ordenamiento en frontend por `order` y desempate por `name`.
- Render del sidebar principal con los resultados.
- Manejo de estados de carga, vacio y error.

## Fuera de alcance
- Creacion de endpoint dedicado para sidebar/modules.
- Cambios de estructura en tabla `modules`.
- Filtrado por rol/microrol en esta historia.
- Gestion de submodulos (niveles hijos distintos de raiz) mas alla de no mostrarlos en menu principal.
- Edicion CRUD de modulos desde UI.

## Requerimientos no funcionales
- Tiempo de carga perceptible del sidebar tras iniciar app menor a 1s en condiciones normales.
- Consulta de datos reutilizando infraestructura API dinamica existente.
- Manejo robusto de errores con fallback visual no bloqueante.
- Logging de errores tecnicos en cliente/servidor para diagnostico.
- Comportamiento consistente entre sesiones para mismos datos de BD.

## Restriccion de persistencia
- Para flujos de negocio productivos, la persistencia debe definirse sobre base de datos real.
- No se permite cerrar una historia implementando persistencia principal en archivos locales JSON.
- Si existe almacenamiento local temporal para desarrollo, debe quedar explicitamente marcado como no productivo y fuera del alcance de cierre.

## Reglas funcionales
1. Al iniciar la app, el frontend debe obtener `modules` usando la ruta dinamica (`/api/v1/db/multi` con inclusion de `modules`).
2. El frontend debe trabajar con los campos tal como vienen de BD (sin contrato transformado por endpoint dedicado).
3. Solo se deben considerar para el sidebar principal los registros con `parentId === '/'`.
4. Solo se deben mostrar registros con `status === 'active'`.
5. Si `status` es `inactive` o `deprecated`, el modulo no se muestra.
6. Los modulos validos se ordenan por `order` ascendente.
7. Si dos modulos tienen el mismo `order`, se desempata por `name` ascendente.
8. Si no hay modulos validos, se muestra estado vacio controlado del sidebar.
9. Si falla la lectura de datos, se muestra estado de error amigable y no se rompe el resto de la app.
10. El sidebar no debe depender de endpoints especificos nuevos para este caso.
11. **Optimización de renderizado (initialModules)**: El componente del sidebar debe soportar la recepción opcional de `initialModules` desde el servidor (Server Component) para inicializar su estado de manera estática inmediata. Si se provee `initialModules`, se debe omitir el parpadeo de carga amigable (skeleton loader) y la llamada de red client-side redundante.

## Estados y casos borde
- **Loading:** mientras se consulta `modules`, mostrar skeleton/placeholder de sidebar.
- **Empty:** consulta exitosa pero sin modulos que cumplan filtros (`parentId='/'` y `status='active'`).
- **Error:** falla HTTP, formato inesperado o timeout; mostrar mensaje no tecnico al usuario.
- **Datos incompletos:** si faltan `name` o `route`, el item se omite y se registra warning.
- **Orden nulo/invalido:** enviar al final de la lista manteniendo desempate por `name`.
- **Duplicados de ruta:** mostrar ambos si existen, pero registrar warning para limpieza de datos.
- **No autenticado:** comportamiento actual de app (fuera de esta historia).

## Diseno funcional de UI
- Sidebar principal renderiza lista dinamica de items de menu.
- Cada item muestra etiqueta (`name`) e icono (si existe en dato).
- Click navega a `route`.
- Estados UX:
  - Cargando: placeholders visibles en posicion del menu.
  - Vacio: bloque "Sin modulos disponibles".
  - Error: bloque "No se pudo cargar el menu. Intenta de nuevo."
- No se agregan nuevas vistas; se adapta el componente/layout existente del sidebar.

## Backend y reglas de dominio
- Backend reutiliza la API dinamica existente sin agregar endpoint exclusivo.
- No hay nueva logica de dominio en servidor para filtrar/ordenar en este alcance.
- La responsabilidad de filtrado y orden recae en frontend segun reglas funcionales.
- Se mantiene seguridad actual de acceso a rutas API dinamicas (autenticacion vigente del proyecto).

## Contratos API
- **Endpoint consumido:** `GET /api/v1/db/multi`
- **Proposito:** recuperar datasets incluyendo `modules` al iniciar app.
- **Request (alto nivel):** parametros actuales de `multi` para incluir tabla `modules`.
- **Response esperada (alto nivel):**
  - Objeto con coleccion `modules` (array de registros crudos de BD).
  - Cada registro puede incluir: `id`, `name`, `route`, `icon`, `order`, `parentId`, `status`, otros campos existentes.
- **Status codes esperados:**
  - `200` exito
  - `401/403` no autorizado (segun politica actual)
  - `5xx` error servidor
- **Errores funcionales:**
  - Respuesta sin `modules` -> tratar como lista vacia + warning de integridad.

## Datos y persistencia
- Entidad origen: tabla `modules`.
- Campos clave usados por sidebar:
  - `parentId` (filtro raiz `"/"`)
  - `status` (filtro `active`)
  - `order` (orden ascendente)
  - `name` (label y desempate)
  - `route` (navegacion)
  - `icon` (presentacion opcional)
- No se requieren migraciones en esta historia.
- No se modifica persistencia ni constraints de BD.

## Seguridad y permisos
- Mantener mecanismo actual de autorizacion para consumo de API dinamica.
- No exponer secretos ni campos sensibles en rendering del sidebar.
- Registrar errores sin incluir datos sensibles de sesion/usuario en mensajes UI.
- Esta historia no introduce nuevas reglas RBAC; solo lectura base de modulos.

## Plan de testing
- **Unit (frontend):**
  - Filtrado correcto por `parentId === '/'`.
  - Filtrado correcto por `status === 'active'`.
  - Orden por `order` + desempate por `name`.
  - Manejo de `order` nulo/no numerico.
- **Integracion (frontend + API mock):**
  - Carga inicial usando `api/v1/db/multi` con payload de `modules`.
  - Estado vacio cuando no hay coincidencias.
  - Estado error cuando API falla.
- **E2E:**
  - Usuario autenticado ve sidebar con modulos esperados.
  - Modulo `inactive/deprecated` no aparece.
  - Orden visual coincide con `order` en BD.
  - Falla de API muestra mensaje de error y app sigue funcional.

## Plan de entrega por tareas
- **Frontend**
  1. Integrar llamada inicial a `api/v1/db/multi` para incluir `modules`.
  2. Implementar selector/mapper en cliente usando datos crudos de BD.
  3. Aplicar filtro `parentId='/'` y `status='active'`.
  4. Aplicar orden `order asc` + desempate `name asc`.
  5. Conectar resultado al componente de sidebar existente.
  6. Implementar estados loading/empty/error.
- **Backend/API**
  7. Verificar que `modules` este disponible desde `api/v1/db/multi` bajo reglas actuales.
  8. Validar permisos/autenticacion vigentes para ese consumo.
- **Calidad**
  9. Crear pruebas unitarias de filtro/orden.
  10. Crear pruebas de integracion de carga y estados UX.
  11. Ejecutar E2E minimo de visibilidad y orden en sidebar.

## Matriz de trazabilidad
- **AC1:** Sidebar lee modules desde ruta dinamica al iniciar app -> Tareas 1, 7, 8 -> Tests integracion/E2E carga inicial.
- **AC2:** Solo muestra `parentId='/'` y `status='active'` -> Tareas 3, 9 -> Tests unit + E2E visibilidad.
- **AC3:** Orden por `order` con desempate por `name` -> Tareas 4, 9 -> Tests unit + E2E orden.
- **AC4:** Manejo de loading/empty/error -> Tareas 6, 10 -> Tests integracion UX estados.
- **AC5:** Sin endpoint dedicado nuevo -> Tareas 1, 7 -> Revision tecnica + smoke API.

## Criterios de aceptacion
1. El sidebar consume `modules` desde `GET /api/v1/db/multi` al inicio de la app.
2. No existe endpoint nuevo dedicado para esta funcionalidad.
3. Solo se renderizan modulos con `parentId="/"` y `status="active"`.
4. Los modulos se muestran ordenados por `order` ascendente; empates por `name` ascendente.
5. Registros con `status="inactive"` o `status="deprecated"` no se muestran.
6. Existen estados visuales de carga, vacio y error correctamente manejados.
7. Las pruebas unitarias, de integracion y E2E definidas pasan.
8. El sidebar soporta la inyección estática de `initialModules` desde el servidor para evitar llamadas cliente innecesarias y eliminar parpadeos de carga del skeleton.

## Suposiciones confirmadas
1. Para visibilidad en sidebar principal, solo cuenta `status = 'active'`; `inactive` y `deprecated` no se muestran.
2. El consumo de `modules` se hara desde `api/v1/db/multi` al iniciar la app.
3. El frontend usara los campos crudos de BD tal como llegan (sin contrato dedicado transformado).
4. El filtrado en frontend sera `parentId === '/'` y `status === 'active'`.
5. El orden sera `order` ascendente con desempate por `name`.
