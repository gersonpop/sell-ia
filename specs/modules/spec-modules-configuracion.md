# Especificacion: Modulos con Sidebar, Embedded y Nueva Pagina

## Contexto
La plataforma requiere un comportamiento consistente para modulos configurables: navegacion jerarquica por parent, render por tipo de contenido, prioridades por orden y visibilidad en sidebar con internacionalizacion.

## Objetivo
Implementar gestion y consumo de modulos en BD real usando API dinamica, garantizando que:
- el sidebar siempre este presente en rutas protegidas,
- `content=embedded` renderice panel izquierdo/derecho,
- `content=newPage` genere navegacion desde el parent,
- el orden se aplique dentro del parent,
- los modulos raiz aparezcan en sidebar con icono e i18n.

## Historia de usuario
Como desarrollador, al crear un modulo debo definir su parent, contenido y orden para que la aplicacion renderice correctamente sidebar, vistas embebidas y accesos a nuevas paginas.

## Alcance
- Tabla `modules` persistida en PostgreSQL.
- CRUD de modulos por `/api/v1/db/modules`.
- `parent` obligatorio con `"/"` para raiz.
- `content` catalogado (`embedded`, `newPage`).
- UI de Settings para crear/editar/desactivar/reactivar modulos.
- Sidebar dinamico para modulos raiz activos.
- i18n de etiquetas visibles.

## Fuera de alcance
- Endpoints especificos adicionales para modulos.
- Borrado fisico de modulos.
- Persistencia funcional en JSON local.

## Requerimientos no funcionales
- Seguridad: mutaciones solo `SU`.
- Rendimiento: consultas de navegacion de modulos con respuesta estable en entorno objetivo.
- Observabilidad: errores y denegaciones auditables.
- Confiabilidad: validaciones de dominio en backend.

## Restriccion de persistencia
- Para flujos productivos, persistencia principal en base de datos real.
- No cerrar historias con persistencia funcional en archivos locales JSON.

## Reglas funcionales
1. Sidebar siempre presente en rutas protegidas.
2. Solo modulos activos con `parent="/"` aparecen en sidebar principal.
3. Si `content=embedded`, se debe utilizar el patron de diseno `EmbeddedPattern` (ubicado en `web/src/components/module-patterns/EmbeddedPattern.tsx`), el cual renderiza:
   - panel izquierdo (`menuPanel`) con hijos ordenados por `sort_order`.
   - panel derecho (`contentPanel`) con el contenido del hijo seleccionado.
4. Si `content=newPage`, se debe utilizar el patron de diseno `NewPagePattern` (ubicado en `web/src/components/module-patterns/NewPagePattern.tsx`) para la estructura de la pagina. Su renderizado depende de su posicion jerarquica:
   - **Parent raiz (`parent="/"`)**: Si es un modulo raiz, la pagina se renderiza directamente en el contenedor principal (`sidebarContent`).
   - **Hijo de un modulo embebido**: Si es hijo de un modulo embebido, se debe renderizar dentro del `contentPanel` del modulo padre embebido.
5. `sort_order` ordena por contexto:
   - raiz contra raiz cuando `parent="/"`,
   - hijos contra hijos del mismo parent cuando `parent=<id>`.
6. `parent` es obligatorio:
   - `"/"` para raiz,
   - o `id` valido de modulo existente.
7. `code` se autogenera en backend e inmutable en actualizaciones.
8. `DELETE` es logico: cambia estado a inactivo.
9. Si `parent="/"`, el modulo debe mostrar acceso en sidebar con icono e i18n.

## Estados y casos borde
- `loading`: carga de listado/arbol.
- `empty`: parent embebido sin hijos o tabla sin resultados.
- `error`: fallo de API/BD.
- `forbidden`: rol no autorizado.
- `invalid_parent`: parent vacio o id inexistente.
- `invalid_content`: contenido fuera del catalogo.

## Diseno funcional UI
- Settings > Configuracion de modulos.
- Tabla con busqueda, filtros, acciones por fila.
- Formulario con labels i18n (sin placeholders como opcion de select en status/scope/content).
- `Parent ID` obligatorio con opcion `/ (raiz)` y rutas existentes para hijos.
- Campo de icono permite carga de imagen y vista previa.

## Backend y reglas de dominio
- Endpoint dinamico: `/api/v1/db/modules`.
- Validaciones obligatorias en backend:
  - `name`, `scope_id`, `sort_order`, `status`, `content`, `parent`.
  - `parent` obligatorio; `"/"` valido como raiz.
  - `scope_id` en catalogo `roleScope`.
  - `status` en catalogo `moduleStatus`.
  - `content` en catalogo `pageContent`.
- `SU` requerido para `POST/PATCH/DELETE`.
- Soft-delete en `DELETE`.

## Contratos API
- `GET /api/v1/db/modules`: listar/filtrar modulos.
- `POST /api/v1/db/modules`: crear modulo (SU).
- `PATCH /api/v1/db/modules`: editar modulo (SU).
- `DELETE /api/v1/db/modules`: desactivar modulo (SU).

Headers de seguridad segun `docs/API_V1_DB_MANUAL.md`.

## Datos y persistencia
Campos esperados en `modules`:
- `id`, `code`, `name`, `description`, `route`, `icon`, `sort_order`, `status`, `parent`, `scope_id`, `content`, `page_content`, `created_at`, `updated_at`.

Reglas de schema:
- `code` unico.
- `parent` NOT NULL con `default '/'`.
- indices en `code`, `status`, `sort_order`.

## Seguridad y permisos
- Solo `SU` muta configuracion de modulos.
- Usuarios sin permisos reciben `403`.
- Auditoria de cambios y denegaciones.

## Plan de testing
- Unit: validaciones de parent/content/order/code.
- Integracion: authz SU, soft-delete, catalogos, errores.
- E2E: sidebar persistente, embedded con hijos, newPage con CTA, i18n visible.

## Plan de entrega por tareas
1. Ajustar schema/migraciones de `parent` obligatorio y contenido.
2. Consolidar reglas de dominio en API dinamica de modulos.
3. Asegurar sidebar persistente + raiz activa con icono/i18n.
4. Implementar comportamiento `embedded` (panel izquierdo/derecho).
5. Implementar comportamiento `newPage` (CTA desde parent).
6. Ejecutar y evidenciar pruebas unit/integracion/E2E.

## Matriz de trazabilidad
- Sidebar persistente -> T3 -> E2E shell.
- Embedded panel -> T4 -> E2E embedded.
- NewPage CTA -> T5 -> E2E navegacion.
- Orden por parent -> T2 -> unit/integracion.
- Root en sidebar + i18n -> T3 -> E2E i18n.

## Criterios de aceptacion
1. Sidebar visible en rutas protegidas.
2. `embedded` renderiza panel izquierdo/derecho con hijos.
3. `newPage` muestra acceso desde parent a pagina creada.
4. `sort_order` se aplica por parent.
5. `parent="/"` aparece en sidebar con icono e i18n.
6. Sin persistencia funcional en JSON local.

## Asignacion de agentes especializados
- `backend-auth-integrator`: reglas de dominio y API dinamica.
- `cybersecurity-guardian`: authz/auditoria/hardening.
- `ui-system-architect`: experiencia de configuracion y layout embedded.
- `frontend-navigation-specialist`: sidebar y navegacion parent-hijos.
- `qa-e2e-analyst`: cobertura de pruebas y evidencia.
