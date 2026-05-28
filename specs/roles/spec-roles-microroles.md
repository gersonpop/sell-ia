# Especificación: Sistema de Roles y Permisos Granulares por Módulo

## Contexto
La plataforma requiere de un modelo de autorización robusto y granular que permita restringir y habilitar el acceso a los diferentes módulos y submódulos de la aplicación, tanto en la interfaz web como en la aplicación móvil. Para garantizar una administración limpia, se requiere un módulo visual donde se puedan mapear todos los módulos activos de la base de datos y definir de forma precisa permisos de lectura, creación, actualización y borrado por cada rol asignado a las distintas organizaciones (empresas).

---

## Objetivo
Diseñar e implementar el módulo de administración y el motor de validación de **Roles y Permisos Granulares**. El sistema permitirá:
1. Mapear de forma jerárquica los módulos y submódulos registrados en la tabla `modules`.
2. Crear, editar y eliminar roles por empresa (`companyId`), donde cada rol encapsula el conjunto total y exclusivo de accesos de un usuario.
3. Configurar de manera precisa cuatro acciones básicas (**Leer, Crear, Actualizar y Borrar**) por cada módulo y submódulo.
4. Asegurar la consistencia de estos permisos en la navegación (web y móvil) y blindar el acceso a nivel de API (backend).

---

## Usuario Principal
*   **Súper Usuario (SU)**: Administrador global de la plataforma con privilegios para crear y editar roles de cualquier empresa.
*   **Administrador de Empresa (Admin)**: Gestiona la creación de roles específicos y la asignación de usuarios dentro del alcance de su organización (`companyId`).
*   **Usuario Final**: Empleado de la empresa que accede a los módulos según los permisos definidos en su rol asignado.

---

## Historia de Usuario
Como desarrollador de la plataforma, requiero que el módulo de roles me permita mapear los módulos de la aplicación contenidos en la tabla `modules`, generar diferentes roles desglosando el acceso a **Lectura, Creación, Actualización y Borrado** de cada módulo y submódulo, y definir de forma exclusiva los accesos de cada usuario mediante la asignación de un único rol activo por empresa.

---

## Alcance
*   **Interfaz de Administración de Roles**: Panel interactivo para seleccionar un cargo, ver su descripción, alcance (scope) y una cuadrícula jerárquica con checkboxes para configurar los permisos por módulo.
*   **Mapeo Dinámico de Módulos**: Agrupación visual de los módulos de la base de datos en tres categorías: *Aplicación Móvil*, *Menú Principal*, y *General*.
*   **Permisos de Cuatro Acciones**: Configuración granular de **Leer, Crear, Actualizar y Borrar** por cada módulo.
*   **Asignación de Rol Único**: Cada usuario final tendrá asociado exactamente un solo rol activo por organización.
*   **Seguridad y Aislamiento por Tenant (`companyId`)**: Los roles creados por una organización son privados y no pueden ser consultados ni modificados por otras empresas.
*   **Control de Acceso en Backend (API)**: Validación en tiempo de ejecución en la API dinámica para rechazar operaciones de escritura si el rol del usuario no tiene los permisos necesarios.

---

## Fuera de Alcance
*   Asignación de múltiples roles simultáneos a un mismo usuario (herencia aditiva).
*   Políticas de acceso para servicios IAM externos o proveedores de la nube (AWS/Azure/GCP).
*   Auditoría de lectura (solo se auditan las mutaciones de datos: creación, edición y borrado).

---

## Requerimientos No Funcionales
*   **Rendimiento**: El cálculo de permisos del usuario logueado debe realizarse en el servidor durante la sesión y ser cached para evitar parpadeos visuales (flickering) al navegar en el cliente.
*   **Seguridad y Cifrado**: El JSON de permisos asignado al rol debe poder almacenarse de forma íntegra en la base de datos (con firma digital HMAC o hash de integridad) para prevenir manipulaciones manuales en caliente.
*   **Integridad Referencial**: Impedir la eliminación de un módulo en la base de datos si existen permisos activos de roles asociados a él.

---

## Restricción de Persistencia
*   Todos los roles, módulos y permisos deben ser almacenados en la base de datos relacional PostgreSQL activa en caliente.
*   No se permite simular la persistencia de permisos en archivos locales JSON o memoria temporal para el cierre de esta funcionalidad en producción.

---

## Reglas Funcionales
1.  **Unicidad de Asignación**: Un usuario está vinculado a exactamente **un único Rol activo** a la vez por cada empresa (`companyId`). Este rol representa el contenedor completo y absoluto de sus accesos.
2.  **Mapeo de Módulos Activos**: La cuadrícula de configuración de roles solo debe listar los módulos de la base de datos que se encuentren en estado `'active'`.
3.  **Heredabilidad de Hijos**: Si un módulo padre tiene permisos desactivados por completo, sus submódulos hijos heredan la restricción por defecto y no pueden ser accedidos.
4.  **Granularidad de Permisos**:
    *   **Leer**: Habilita la visibilidad en el menú de navegación (Sidebar) y permite peticiones `GET` a la API correspondiente.
    *   **Crear**: Habilita los botones de "Agregar" y autoriza peticiones `POST`.
    *   **Actualizar**: Habilita los botones de "Editar/Guardar" y autoriza peticiones `PATCH`.
    *   **Borrar**: Habilita los botones de "Eliminar" y autoriza peticiones `DELETE`.
5.  **Aislamiento Multitenant**: Un cliente corporativo solo puede ver y editar los roles que tengan su mismo `companyId`. El súper usuario (`SU`) puede administrar los roles de todas las empresas.
6.  **Protección de Roles Activos**: No se permite eliminar un Rol si existen usuarios activos asignados a él; el sistema debe exigir la reasignación de los usuarios a otro Rol antes de proceder.

---

## Estados y Casos Borde
*   **Rol Activo**: Disponible para ser asignado a usuarios. Sus permisos se evalúan en tiempo real en cada petición.
*   **Rol Inactivo**: Oculto para nuevas asignaciones, pero se mantiene en la base de datos para auditoría histórica.
*   **Intento de Acceso Cruzado**: Si un usuario intenta enviar un `companyId` alterado en las cabeceras HTTP, la API bloqueará la petición registrando un evento de seguridad de denegación de acceso.
*   **Módulos sin Permisos**: Si a un usuario se le retiran todos los permisos de un módulo, este módulo desaparecerá instantáneamente de su Sidebar.

---

## Diseño Funcional de UI

El módulo de Roles presentará un diseño homogéneo y de alta fidelidad como se describe a continuación:

### 1. Panel de Control Superior
*   **Dropdown "Cargo"**: Selector para elegir el rol a configurar (ej. `Superadmin`, `Vendedor`, `Administrador`).
*   **Botones de Acción**:
    *   `Editar Rol`: Abre el panel/drawer deslizable para modificar el nombre, clave o descripción.
    *   `Eliminar`: Elimina el rol (siempre que no tenga usuarios asignados).
    *   `Agregar` (Botón premium verde): Abre el panel lateral para crear un nuevo rol desde cero.
*   **Campos de Metadatos del Rol**:
    *   *Id clave* (Ej. `SU`, `VEN`): Código abreviado e inmutable del rol.
    *   *Descripción* (Ej. `Administrador de la plataforma`): Resumen de la responsabilidad del cargo.
    *   *Alcance / Scope* (Dropdown): Define el nivel de acceso general (`Super Admin`, `admin`, `user`).

### 2. Cuadrícula de Permisos Jerárquica
Organizada en acordeones o secciones por categorías de módulos:
*   **Sección A: Aplicación Móvil** (Módulos como *Postcosecha*, *Boncheo*, *Cuarto Frío*, *Registrar Enfermedades*).
*   **Sección B: Menú Principal** (Módulos como *Inicio*, *Dashboard*, *Cultivo*, *Talento Humano*).
*   **Sección C: General** (Módulos como *Administración*, *Configuraciones*).

Cada fila de módulo presentará:
*   El nombre del módulo y su ruta técnica entre paréntesis (ej. `Postcosecha ( /ScanPost )`).
*   Checkboxes/Switches agrupados bajo las columnas: **Leer**, **Crear**, **Actualizar**, y **Borrar**.
*   Sangría visual clara para diferenciar submódulos hijos (ej. bajo *Cultivo*: *Asignaciones*, *Etiquetas*, *Variedades*, *Fincas*).

---

## Backend y Reglas de Dominio
Al realizar cualquier operación de base de datos a través de la API dinámica (`/api/v1/db/roles` y `/api/v1/db/role_assignments`), el backend ejecutará:
1.  **Resolución de Sesión**: Carga del `x-actor-role` y `x-company-id`.
2.  **Validación de Escritura**: Comprobación en `public.RolePermission` de que el usuario logueado tenga el permiso `can_write = true` en el módulo de administración de roles (`/admin/roles`).
3.  **Invalidación de Caché**: Al editar los permisos de un Rol, el backend emitirá una invalidación de las sesiones activas asociadas a ese rol para obligar a Next-Auth a recargar las capacidades en la próxima navegación del usuario.

---

## Contratos API

### 1. Obtener Permisos del Rol Seleccionado
*   **Endpoint**: `GET /api/v1/db/role_permissions`
*   **Query Params**: `roleId=uuid`
*   **Cabeceras**: Autenticación estándar de desarrollo/producción.
*   **Respuesta Exitosa (200 OK)**:
    ```json
    {
      "roleId": "uuid-rol",
      "permissions": [
        {
          "moduleId": "uuid-modulo",
          "moduleName": "Postcosecha",
          "route": "/ScanPost",
          "canRead": true,
          "canCreate": true,
          "canUpdate": true,
          "canDelete": true
        }
      ]
    }
    ```

### 2. Guardar/Actualizar Permisos de un Rol
*   **Endpoint**: `PATCH /api/v1/db/role_permissions`
*   **Body**:
    ```json
    {
      "roleId": "uuid-rol",
      "permissions": [
        {
          "moduleId": "uuid-modulo",
          "canRead": true,
          "canCreate": true,
          "canUpdate": true,
          "canDelete": true
        }
      ]
    }
    ```
*   **Respuesta Exitosa (200 OK)**: `{ "ok": true, "message": "Permisos actualizados correctamente" }`
*   **Error (403 Forbidden)**: `{ "message": "No tienes privilegios para modificar roles" }`

---

## Datos y Persistencia

### Modelo de Datos (Tablas PostgreSQL)

```sql
-- Tabla Principal de Roles
CREATE TABLE public."Role" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_id VARCHAR(50) UNIQUE NOT NULL,      -- Ej: 'SU', 'VEN'
    name VARCHAR(100) NOT NULL,              -- Ej: 'Superadmin', 'Vendedor'
    description TEXT,                        -- Ej: 'Administrador de la plataforma'
    scope VARCHAR(50) NOT NULL,              -- 'Super Admin', 'admin', 'user'
    company_id VARCHAR(50),                  -- Aislamiento de tenant
    status VARCHAR(20) DEFAULT 'active',     -- 'active', 'inactive'
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- Tabla de Permisos por Módulo
CREATE TABLE public."RolePermission" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID REFERENCES public."Role"(id) ON DELETE CASCADE,
    module_id UUID REFERENCES public.modules(id) ON DELETE CASCADE,
    can_read BOOLEAN DEFAULT false,
    can_create BOOLEAN DEFAULT false,
    can_update BOOLEAN DEFAULT false,
    can_delete BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    CONSTRAINT unique_role_module UNIQUE (role_id, module_id)
);
```

---

## Seguridad y Permisos
*   **RLS (Row-Level Security)**: Se habilitará en la tabla `"Role"` y `"RolePermission"` de forma que un usuario con `company_id` específico jamás pueda visualizar ni editar roles de otro tenant.
*   **Protección de Clave Primaria**: Todas las modificaciones se basan en el ID único (UUID), validado contra la sesión del usuario.
*   **Control de SU**: Las configuraciones de scope `Super Admin` solo pueden ser manipuladas por actores con `x-actor-role = 'SU'`.

---

## Plan de Testing
1.  **Pruebas Unitarias**:
    *   Verificar que al consultar los permisos de un usuario, se retorne correctamente la matriz de lectura/escritura de su rol asignado.
    *   Verificar que un usuario sin rol asignado reciba permisos denegados por defecto en todos los módulos.
2.  **Pruebas de Integración (API)**:
    *   Realizar peticiones `POST`/`PATCH` con un rol que tenga `can_create = false` o `can_update = false` y validar que retorne exactamente `403 Forbidden`.
    *   Intentar eliminar un rol asignado a usuarios activos y validar que la API retorne un error de negocio controlado.
3.  **Pruebas Manuales (UI)**:
    *   Asignar el rol de "Vendedor" a un usuario de pruebas, entrar con su cuenta y validar que los módulos no autorizados no se rendericen en el Sidebar y que los botones de "Agregar/Eliminar" estén ocultos.

---

## Plan de Entrega por Tareas

### Fase 1: Datos y Backend
*   **Tarea 1**: Crear las tablas `"Role"` y `"RolePermission"` en la base de datos PostgreSQL (Neon).
    *   *Criterio de Aceptación*: Tablas creadas con claves primarias, foráneas y restricciones de unicidad.
*   **Tarea 2**: Configurar los accesos CRUD en `pgDynamicDbStore.ts` y la ruta dinámica de API `/api/v1/db/roles`.
    *   *Criterio de Aceptación*: La API responde a GET, POST, PATCH y DELETE de roles aislando por `companyId`.

### Fase 2: Interfaz de Usuario y Controles
*   **Tarea 3**: Desarrollar el componente visual de cuadrícula jerárquica con checkboxes para Leer, Crear, Actualizar y Borrar.
    *   *Criterio de Aceptación*: Lista correctamente los módulos en sus tres secciones, respeta la sangría de los submódulos y actualiza el estado de selección en el cliente.
*   **Tarea 4**: Implementar el panel lateral (Drawer) de adición/edición de Roles.
    *   *Criterio de Aceptación*: Transición deslizable suave, validación de inputs y envío correcto de payloads a la base de datos.

### Fase 3: Integración de Seguridad y Menú
*   **Tarea 5**: Integrar el filtro de menús en el Sidebar basado en la tabla `"RolePermission"`.
    *   *Criterio de Aceptación*: Los módulos ocultos en el rol desaparecen instantáneamente del Sidebar al iniciar sesión.

---

## Matriz de Trazabilidad
| Requerimiento (Spec) | Tarea de Entrega | Caso de Prueba |
| :--- | :--- | :--- |
| **Rol Único por Usuario** | Tarea 1 y 2 | Intentar asociar múltiples roles en la tabla de asignación. |
| **Cuadrícula Jerárquica** | Tarea 3 | Verificar el renderizado de módulos e hijos con sangría. |
| **Granularidad de Permisos** | Tarea 3 y 4 | Marcar y guardar combinaciones específicas de Leer/Crear/Actualizar/Borrar. |
| **Validación de API** | Tarea 2 | Petición de escritura no autorizada retorna `403 Forbidden`. |
| **Aislamiento Multitenant** | Tarea 2 y 5 | Usuario de Empresa A no puede leer ni ver roles de Empresa B. |

---

## Criterios de Aceptación
1.  **Criterio 1**: El administrador de la empresa solo visualiza y edita los roles asociados a su propio `companyId`.
2.  **Criterio 2**: Un usuario de la plataforma tiene estrictamente **un solo rol asignado** que agrupa y limita todos sus accesos.
3.  **Criterio 3**: La cuadrícula de permisos desglosa las cuatro acciones esenciales (**Leer, Crear, Actualizar, Borrar**) mapeadas directamente de la tabla `modules`.
4.  **Criterio 4**: Al desmarcar el permiso de "Leer" para un módulo, dicho módulo queda oculto en el Sidebar del usuario y su acceso por URL directa queda bloqueado.
5.  **Criterio 5**: El sistema impide la eliminación de cualquier Rol que tenga al menos un usuario activo asignado.

---

## Suposiciones Confirmadas
*   El usuario posee **un único rol activo** que representa su conjunto total y exclusivo de accesos en su organización.
*   La cuadrícula se estructura de forma jerárquica distinguiendo entre Aplicación Móvil, Menú Principal y General.
*   La asignación de permisos se basa en cuatro acciones básicas configurables (Leer, Crear, Actualizar, Borrar).
*   El backend valida estas capacidades dinámicamente antes de mutar registros de cualquier entidad.
