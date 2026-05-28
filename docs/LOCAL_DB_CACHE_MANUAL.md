# Manual de Diseño y Arquitectura: Caché de Doble Capa y Patrones de Indexación

Este documento detalla el patrón de diseño e implementación del sistema de caché de doble capa (Cliente + Servidor) para las tablas de catálogos y configuración altamente estáticas del proyecto (`st_City`, `st_Country`, `st_Multidata`, `st_State` y `modules`). 

El objetivo es establecer esta arquitectura como estándar obligatorio para futuras extensiones del sistema, reduciendo la latencia visual a cero en el cliente y minimizando el impacto de red y base de datos en el servidor.

---

## 1. Arquitectura de Caché de Doble Capa

```mermaid
graph TD
    subgraph Cliente (Navegador)
        UI[Componente UI / Cliente React]
        LC[(localStorage de Cliente)]
    end

    subgraph Servidor (Next.js Node)
        API[API Endpoints / Servidores Next]
        SC[(Caché en Memoria Servidor)]
    end

    subgraph Base de Datos
        DB[(PostgreSQL)]
    end

    UI -->|1. Consulta caché local| LC
    UI -->|2. Fallo de caché / Fetch de Fondo| API
    API -->|3. Consulta caché en memoria| SC
    API -->|4. Fallo de caché en servidor| DB
    DB -.->|5. Retorna y guarda en memoria| SC
    API -.->|6. Retorna y guarda localmente| LC
```

### Principios Fundamentales
1. **Renderizado Instantáneo (Caché de Cliente - LocalStorage)**: 
   - El cliente lee de `localStorage` de manera síncrona durante el montaje del componente. Esto elimina parpadeos visuales y spinners de carga, proporcionando transiciones instantáneas de página.
2. **Consistencia Eventual / Fetch de Fondo (Stale-While-Revalidate)**:
   - Después del renderizado inicial desde la caché, el cliente realiza una petición en segundo plano para verificar si existen actualizaciones. Si los datos fetched difieren del caché, el estado se actualiza suave y automáticamente y se guarda la versión más reciente en `localStorage`.
3. **Optimización de Red (Caché de Servidor - In-Memory)**:
   - El servidor mantiene en memoria (`staticStoreCache` y `catalogCache`) copias de las respuestas de base de datos para tablas estáticas con un TTL (Time-To-Live) de **5 minutos**. Las peticiones consecutivas desde cualquier usuario se sirven instantáneamente sin sobrecargar PostgreSQL.
4. **Invalidación Inteligente**:
   - Cuando se ejecutan escrituras (`create`, `update`, `delete`) sobre tablas estáticas en el servidor, este invalida inmediatamente las memorias caché correspondientes.

---

## 2. Acceso y Uso de Tablas Locales (Cliente React)

A partir de ahora, todo componente cliente que acceda a tablas de catálogo estáticas debe apegarse a las siguientes convenciones utilizando `localStorage`:

### Patrón A: Catálogos del Formulario (Ej: Onboarding de Países, Estados y Ciudades)
Implementar `localStorage` con validación de SSR (`typeof window !== "undefined"`).

```typescript
// Claves estandarizadas para caché de catálogos
const cacheKey = "onboarding_bootstrap"; 
const depCacheKey = `onboarding_deps_${countryCode}`;
const cityCacheKey = `onboarding_cities_${countryCode}_${departmentCode}`;
```

#### Código Ejemplo de Lectura y Guardado:
```typescript
useEffect(() => {
  async function loadBaseCatalogs() {
    const cacheKey = "onboarding_bootstrap";
    
    // 1. Validar SSR y comprobar caché
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const data = JSON.parse(cached);
          setCompanies(data.companies ?? []);
          setGenders(data.genders ?? []);
          setCountries(data.countries ?? []);
          return; // Retorno inmediato si hay caché
        } catch {
          // Ignorar error de parsing y continuar
        }
      }
    }

    // 2. Fallback de Red (Servidor)
    const response = await fetch("/api/v1/auth/social/onboarding/bootstrap");
    const data = await response.json();
    
    // Procesar datos y setear estados
    setCompanies(data.companies ?? []);
    setGenders(data.genders ?? []);
    setCountries(data.countries ?? []);

    // 3. Guardar en caché para la próxima visita
    if (typeof window !== "undefined") {
      localStorage.setItem(cacheKey, JSON.stringify(data));
    }
  }
  void loadBaseCatalogs();
}, []);
```

### Patrón B: Módulos de Barra Lateral (Stale-While-Revalidate)
Este patrón permite que el menú renderice al instante sin parpadeo del spinner de carga al cambiar de ruta, pero garantiza que si el administrador desactiva o agrega un módulo, el cambio se refleje en segundo plano.

```typescript
const cacheKey = `sidebar_modules_${actorId}_${companyId ?? ""}`;
```

#### Implementación Completa:
```typescript
useEffect(() => {
  let hasLoadedFromCache = false;

  // 1. Cargar desde localStorage de inmediato
  if (typeof window !== "undefined") {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const rows = JSON.parse(cached);
        if (Array.isArray(rows)) {
          setDynamicModules(selectSidebarModulesFromDbRows(rows));
          setModulesLoading(false); // Detener animación de carga de inmediato
          hasLoadedFromCache = true;
        }
      } catch {
        // Continuar si hay error de formato
      }
    }
  }

  let cancelled = false;
  const loadModules = async () => {
    if (!hasLoadedFromCache) {
      setModulesLoading(true);
    }
    try {
      const response = await fetch(`/api/v1/db/multi?table=modules`, { headers });
      const body = await response.json();
      
      if (cancelled) return;
      const rows = Array.isArray(body.modules) ? body.modules : [];
      const normalizedFetched = selectSidebarModulesFromDbRows(rows);

      // Actualizar estado solo si los datos de red difieren de la caché para evitar re-renderizados innecesarios
      setDynamicModules((prev) => {
        const isSame = JSON.stringify(prev) === JSON.stringify(normalizedFetched);
        return isSame ? prev : normalizedFetched;
      });

      // Guardar el nuevo set de datos de red en caché
      if (typeof window !== "undefined") {
        localStorage.setItem(cacheKey, JSON.stringify(rows));
      }
    } catch (error) {
      if (!cancelled && !hasLoadedFromCache) {
        setModulesError(error.message);
      }
    } finally {
      if (!cancelled) {
        setModulesLoading(false);
      }
    }
  };
  
  void loadModules();
  return () => { cancelled = true; };
}, [actorId, companyId]);
```

### Seguridad y Control de Sesión
Para asegurar que los datos en caché de un usuario no queden remanentes ni se muestren a otro usuario en la misma computadora, **es obligatorio limpiar el LocalStorage al cerrar sesión (Logout)**.

En el handler `onClick` de tu botón de Sign Out:
```typescript
onClick={() => {
  if (typeof window !== "undefined") {
    localStorage.clear(); // Limpieza absoluta de caché
  }
  void signOut({ callbackUrl: `/${locale}` });
}}
```

---

## 3. Acceso y Uso de Caché Local (Servidor Node)

En el backend, usamos almacenamiento en caché estático global para evitar consultas repetitivas de base de datos a PostgreSQL.

### Métodos del Servidor Disponibles

#### `listRecords(actor, tableParam, id)`
Implementado en `web/src/server/pgDynamicDbStore.ts`.
- Cachea automáticamente listados completos (`id === null`) de tablas registradas en la allowlist estática: `modules`, `st_multidata`, `st_country`, `st_state` y `st_city`.
- Cuenta con un TTL de 5 minutos (`STATIC_CACHE_TTL_MS`).

#### `invalidateStoreCache(tableParam?)`
- Limpia la memoria caché del servidor.
- **Si se le pasa un parámetro**: limpia únicamente la caché de esa tabla específica (ej. `invalidateStoreCache("modules")`).
- **Si se llama vacío**: limpia la caché de todas las tablas y también gatilla la invalidación del catálogo de onboarding.

#### `invalidateCatalogCache()`
Implementado en `web/src/server/auth/onboarding.ts`.
- Limpia de forma directa la caché de los catálogos agregados (`catalogCache`) usada en el formulario de onboarding social.

---

## 4. Guía de Indexado en PostgreSQL para Alta Escalabilidad

Para que la primera consulta a la base de datos (la cual llena la caché de servidor por primera vez o refresca tras una invalidación) se realice en milisegundos, es crítico que las tablas estáticas y de relaciones cuenten con los índices apropiados en PostgreSQL. 

A continuación se detallan las recomendaciones de indexación física para las tablas involucradas:

### 1. Tabla `"st_City"` (Ciudades)
Contiene miles de filas y se consulta filtrando por Estado y País.
- **Índice Recomendado**: Índice compuesto para la consulta jerárquica de ubicaciones.
  ```sql
  CREATE INDEX IF NOT EXISTS idx_st_city_lookup 
  ON public."st_City" ("state_id", "iso_country");
  ```
- **Razón**: `getCatalogCities` filtra por `state_id` y valida con `iso_country`. Un índice compuesto acelera exponencialmente esta terna.

### 2. Tabla `"st_State"` (Estados/Provincias)
Se consulta filtrando por País.
- **Índice Recomendado**:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_st_state_country 
  ON public."st_State" ("iso_country");
  ```
- **Razón**: Permite recuperar de forma directa y ordenada todas las provincias de un país para los selectores dependientes en el onboarding.

### 3. Tabla `"st_Multidata"` (Glicerina, Estados de Usuario, Catálogos Varios)
Se utiliza para catálogos llave-valor y agrupadores dinámicos.
- **Índice Recomendado**:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_st_multidata_lookup 
  ON public."st_Multidata" ("type", "value");
  ```
- **Razón**: Las consultas suelen filtrar por `type` (ej. `gender`, `userStatus`, `countryCode`). Este índice compuesto elimina los table scans completos.

### 4. Tabla `"modules"` (Configuración de Navegación y Rutas)
Consultada en cada carga de diseño y en rutado del sidebar.
- **Índice Recomendado**:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_modules_hierarchy 
  ON public.modules ("status", "sort_order", "parent");
  ```
- **Razón**: Los layouts y barras laterales filtran por estado `'active'` y ordenan jerárquicamente por `sort_order` bajo un módulo `parent`. Este índice cubre la ordenación nativa.

### 5. Tabla `"Company"` (Empresas Registradas)
Consultada para poblar el bootstrap de Onboarding.
- **Índice Recomendado**:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_company_name 
  ON public."Company" ("commercialName" ASC);
  ```
- **Razón**: Los listados de compañías son presentados ordenados alfabéticamente en los formularios. Este índice cubre tanto el ordenamiento como la visualización óptima.
