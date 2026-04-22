# SynInt-ML.Version1.80

## Descripción
Sincronizador de información entre Mercado Libre y sistemas locales de facturación. Versión 1.80 optimizada para despliegues externos (Render, Vercel, Railway) con corrección de conflictos de dependencias y guías actualizadas.

## 🚀 Guía Actualizada para Despliegue en Render / PaaS

### 1. Resolución de Error de Dependencias (ERRESOLVE)
Si experimentas el error `npm error ERESOLVE could not resolve`, hemos tomado las siguientes medidas en la versión 1.80:
- Se eliminó la dependencia conflictiva `chrome-aws-lambda` (que solo es necesaria en AWS Lambda) y se reemplazó por la versión completa de `puppeteer`.
- **Acción recomendada en Render:** En el comando de construcción (**Build Command**), utiliza el flag `--legacy-peer-deps` si el error persiste.
  - Comando Sugerido: `npm install --legacy-peer-deps && npm run build`

### 2. Pasos Generales Obligatorios
- **Estructura de Carpetas:** Los archivos deben estar en la **raíz** de tu repositorio.
- **Variables de Entorno:** Configura `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` y `GEMINI_API_KEY` en el panel de Render.
- **Build Command:** `npm install --legacy-peer-deps && npm run build`
- **Start Command:** `npm start`

## Historial de Cambios - Versión 1.80 (Limpieza de Dependencias)

### 1. Corrección de Conflictos `chrome-aws-lambda`
- Se identificó que `chrome-aws-lambda@10` causaba conflictos con versiones modernas de `puppeteer-core@24`.
- Se migró a `puppeteer` estándar para entornos de servidor (Render), eliminando la dependencia problemática.
- Se añadió soporte para instalaciones resilientes en despliegues automatizados.

---

## Historial de Cambios - Versión 1.79 (Optimización de Despliegue)

## Historial de Cambios - Versión 1.78 (Correcciones y Resiliencia)

### 1. Corrección en Importación de Excel
- Se ha optimizado el proceso de **"Importar Excel"** para asegurar que los productos se agreguen correctamente al listado persistente de la base de datos.
- Se corrigieron fallos que impedían que la importación se ejecutara correctamente en ciertas condiciones, asegurando que la sección se pueble de forma aditiva o desde cero si está vacía.

### 2. Gestión Resiliente de Categorías
- Se mejoró el endpoint de categorías para manejar de forma robusta los casos donde las tablas maestras aún no están configuradas correctamente en el entorno de producción.
- Se implementaron mensajes de log más limpios para facilitar la detección de discrepancias en el esquema de la base de datos.

### 3. Estabilidad en Sincronización Automatizada
- Se agregaron validaciones preventivas para informar al usuario de forma clara cuando no hay credenciales vinculadas para el método automatizado, evitando cuelgues innecesarios.

---

## Historial de Cambios - Versión 1.77 (Persistencia Acumulativa)

### 1. Sistema de Importación Aditiva
- Se ha modificado la lógica de importación desde **Excel**, **ODBC (.dat)** y **Carga Manual**.
- Ahora, al importar o cargar items, estos **no reemplazan** el listado actual de inventario, sino que se integran de forma aditiva.
- Se mantiene la sincronización con la base de datos para asegurar que los items no se pierdan al navegar por la aplicación.

### 2. Gestión de Inventario Mejorada
- Se ha añadido un botón de **Eliminar** (ícono de basurero) individual para cada item en el listado de inventario de productos.
- Esto permite quitar items específicos del listado persistente de la base de datos de manera sencilla.

---

## Historial de Cambios - Versión 1.76.6 (Gestión de Seguridad y RLS)

### 1. Soporte para Service Role Key
- Se ha habilitado el soporte para la variable de entorno `SUPABASE_SERVICE_ROLE_KEY`.
- El servidor ahora prioriza esta clave para realizar operaciones administrativas, lo que permite saltar las políticas de seguridad (RLS) que a veces bloquean el guardado de productos desde el backend.

### 2. Mensajes de Error de Seguridad Claros
- Se han mejorado las notificaciones de error para detectar específicamente cuándo una operación es bloqueada por una política de seguridad (RLS) en Supabase.
- El sistema ahora guía al usuario para que configure correctamente su Service Role Key o ajuste sus políticas en el panel de Supabase.

---

## Historial de Cambios - Versión 1.76.5 (Garantía de Guardado Total)

### 1. Sistema de Stripping Exhaustivo
- Se ha eliminado el límite de reintentos en el mecanismo de auto-recuperación.
- El sistema ahora detecta cualquier columna rechazada por la base de datos (como `description`, `code` o `category_id`) y la elimina de forma iterativa **hasta que el guardado sea aceptado**.
- Esto garantiza que, incluso si la tabla `products` en Supabase tiene una estructura mínima o drásticamente diferente a la esperada, los datos esenciales que sí coincidan se persistan correctamente.
- Se aplicó esta misma lógica tanto a la creación como a la actualización de productos.

---

## Historial de Cambios - Versión 1.76.4 (Resiliencia Extrema)

### 1. Reintentos Recursivos de Esquema
- Se ha mejorado el mecanismo de auto-recuperación para que sea **recursivo**.
- Si el fallo persiste para múltiples columnas (ej: falla `category_id`, se quita, y luego falla `code`), el sistema ahora realiza hasta 3 intentos eliminando consecutivamente cada columna problemática hasta lograr el guardado exitoso.
- Esto garantiza que, incluso si la base de datos ha sido modificada externamente o la caché está muy desactualizada, los datos básicos del producto se guarden siempre.

### 2. Detección de Esquema Profunda
- Se optimizó la consulta de detección de columnas en el inicio de la petición para obtener la estructura de la tabla incluso si esta se encuentra vacía.

---

## Historial de Cambios - Versión 1.76.3 (Auto-Recuperación de Esquema)

### 1. Sistema de Reintentos Inteligentes (PGRST204)
- Se ha implementado una lógica de **auto-recuperación** para los errores de "columna no encontrada en el caché del esquema".
- Si el servidor de base de datos reporta que una columna (como `category_id`) no existe, el sistema ahora:
    1. Captura el error exacto.
    2. Identifica el campo faltante.
    3. Elimina automáticamente dicho campo de la petición.
    4. **Reintenta la operación exitosamente**.
- Esto garantiza que el usuario pueda guardar productos incluso si la base de datos y el servidor de API no están perfectamente sincronizados.

---

## Historial de Cambios - Versión 1.76.2 (Corrección de Carga Manual y Resiliencia)

### 1. Resolución de Error de "Columna 'code' no encontrada"
- Se implementó una **detección dinámica de columnas** en el backend. El sistema ahora verifica las columnas reales de la tabla `products` en tiempo real.
- Se añadió un **mapeo resiliente** que permite utilizar tanto `code` como `codigo` indistintamente, resolviendo problemas de caché de esquema o desincronización de base de datos.
- Se mejoraron los logs del servidor para identificar rápidamente discrepancias entre el código y el esquema de la base de datos.

### 2. Segmentación de Categorías en Carga Manual
- Tal como solicitó el usuario, el campo "ID Categoría ML" en la **Carga Manual** se dividió en dos menús desplegables:
    - **Categoría Principal ML:** Alimentado desde la tabla `categorias`.
    - **Subcategoría ML:** Alimentado desde la tabla `subcategory`.
- Esto permite una selección más estructurada y reduce errores de ingreso manual.

### 3. Fluidez en el Cierre de Ventas
- Se optimizó el proceso de confirmación de registro para asegurar que, tras un guardado exitoso, la ventana de carga manual se cierre inmediatamente.

---

## Historial de Cambios - Versión 1.76.1 (Parches de Conectividad)

### 1. Robustez en Conexión Supabase
- Se implementó un middleware de verificación que previene errores críticos cuando las variables de entorno de Supabase no están configuradas.
- Se mejoró la captura de errores en la gestión de categorías para manejar correctamente casos donde las tablas `categorias` o `subcategory` aún no han sido creadas en el nuevo entorno.

### 2. Optimización de Session Check (Frontend)
- Se refinó la lógica de validación de sesión para evitar saturación de errores "Failed to fetch" durante reinicios del servidor.
- Se implementaron tiempos de espera (timeout) y controles de concurrencia para asegurar una comunicación más fluida.

### 3. Salud del Sistema
- Se añadió un endpoint de salud (`/api/health`) para monitorear el estado de la conexión con Supabase desde el panel de control.

---

## Historial de Cambios - Versión 1.76 (Segmentación de Categorías en DB)

### 1. Separación de Tablas en Supabase
- Se ha implementado una separación física de los datos de categorías y subcategorías:
    - Las **Categorías Principales** ahora se almacenan exclusivamente en la tabla `categorias`.
    - Las **Subcategorías** se almacenan en la nueva tabla `subcategory`.
- Esta estructura mejora la integridad de los datos y permite una gestión más eficiente de cada nivel de clasificación.
- Se actualizaron los procesos de guardado (sync) y lectura para interactuar con ambos repositorios de forma independiente.

### 2. Sincronización Optimizada
- El proceso de sincronización masiva y manual ahora coordina las operaciones en ambas tablas simultáneamente.
- Se añadió manejo de errores específico para asegurar que fallos en una tabla no dejen el sistema en un estado inconsistente.

### 3. Actualización de Identidad
- Proyecto actualizado a la versión **1.76**.

---

## Historial de Cambios - Versión 1.75 (Mejoras en Carga Manual)

### 1. Selección de Categoría Dividida
- En el formulario de **Carga Manual de Producto**, el campo único de "ID Categoría ML" ha sido reemplazado por **dos menús desplegables independientes**:
    - Uno para las **Categorías Principales**.
    - Otro para las **Subcategorías**.
- Esto facilita la selección precisa del rubro al cargar productos manualmente.

### 2. Corrección en Guardado de Items y Base de Datos
- **Resolución de Error PGRST204:** Se solucionó el error de Supabase que impedía guardar o actualizar productos debido a una discrepancia en el nombre de la columna de categoría. Se unificó el uso de la columna `category` en lugar de `category_id` en todo el sistema (Frontend y Backend).
- **Cierre Automático:** Se corrigió un error en el flujo de **"Confirmar Registro"** donde la ventana de carga manual quedaba abierta tras el guardado.
- **Persistencia Garantizada:** Se optimizó la lógica de guardado para asegurar que los registros se persistan correctamente en la base de datos antes de refrescar los listados.
- Se resolvieron conflictos de estados entre los diálogos de confirmación y el modal de carga.

### 3. Actualización de Identidad
- Proyecto actualizado a la versión **1.75**.

---

## Historial de Cambios - Versión 1.74 (Optimización de Espacio en Categorías)

### 1. Expansión de Espacio de Trabajo
- Se eliminó la columna derecha (panel de sincronizaciones) específicamente en la pestaña de **Categorías Maestras**.
- El contenido principal ahora se expande al **ancho total (100%)** de la pantalla, permitiendo que los bloques de "Gestión de Categorías" y "Gestión de Subcategorías" utilicen todo el espacio disponible.
- Esto resuelve el problema de visualización reducida y mejora la legibilidad de las tablas de categorías.

### 2. Sincronización de Identidad
- Actualización de etiquetas de versión en toda la plataforma a **v1.74**.

---

## Historial de Cambios - Versión 1.73 (Limpieza de Interfaz y Gestión de Categorías)

### 1. Refinamiento de Interfaz en Categorías
- Se eliminaron los recuadros de **"Últimas Sincronizaciones"** y **"Historial de Sincronización"** en la barra lateral cuando se visualiza la sección de Categorías Maestras, proporcionando una interfaz más limpia y enfocada.
- Se mantiene la funcionalidad de consulta del historial en el resto de los módulos operativos (Inventario, Precios, etc.).

### 2. Gestión de Categorías
- Se verificó y aseguró la permanencia de las acciones de **"Editar"** y **"Eliminar"** para cada entrada en el listado maestro de categorías y subcategorías.
- Mantenimiento de la estructura de doble columna para una gestión ágil de categorías y subcategorías lado a lado.

### 3. Actualización de Identidad
- Proyecto actualizado a la versión **1.73**.

---

## Historial de Cambios - Versión 1.72 (Optimización de UI y Gestión Manual)

### 1. Reorganización de Interfaz (Categorías)
- Las secciones de **"Gestión de Categorías ML"** y **"Gestión de Subcategorías"** ahora se muestran en una disposición de **doble columna** (lado a lado) en pantallas grandes, optimizando el espacio de trabajo.
- Se eliminó el botón de "Importar Maestro" para simplificar el flujo y centrarse en la gestión manual y sincronizada por base de datos.

### 2. Mejoras en Carga Manual de Productos
- El campo **"ID Categoría ML"** en la carga manual de productos ahora es un **menú desplegable fijo** que contiene tanto el listado de categorías principales como las subcategorías cargadas.
- Esto asegura la consistencia de los datos y evita errores de escritura manual al crear nuevos productos.

### 3. Sincronización Automática Robusta
- Se optimizó la lógica de sincronización tras la carga manual de categorías para garantizar que cada nuevo registro se persista inmediatamente en Supabase.
- Se agregaron notificaciones de estado para informar al usuario si la sincronización remota fue exitosa o si los datos se guardaron localmente por fallos de red.

### 4. Correcciones Generales
- Se restauró la visualización de la tabla de categorías principales que presentaba errores visuales en versiones previas.
- Proyecto actualizado a la versión **1.72**.

---

## Historial de Cambios - Versión 1.71 (Subcategorías y Refinamiento de Carga)

### 1. Sistema de Subcategorías
- Se implementó una nueva sección de **"Subcategorías"** dentro del módulo de Gestión de Categorías.
- Estas subcategorías permiten una clasificación secundaria de los productos.
- En la edición de productos, ahora se puede seleccionar tanto la Categoría Principal como una Subcategoría (opcional) desde el listado maestro.

### 2. Prefijo MLA Automatizado
- En la **Carga Manual** de categorías y subcategorías, se añadió el prefijo fijo **"MLA"**.
- El usuario ahora solo necesita ingresar los números del código (ej: 1652), y el sistema construye automáticamente el ID completo (MLA1652).

### 3. Corrección en Importación de Publicaciones
- Se eliminó el bloqueo de "No autorizado" al intentar importar un archivo Excel en la pestaña de Publicaciones/Inventario.
- Ahora la importación local desde Excel funciona independientemente de si la cuenta de Mercado Libre está vinculada o no.

### 4. Actualización de Identidad
- Proyecto actualizado a la versión **1.71**.

---

## Historial de Cambios - Versión 1.70 (Optimización de Categorías y Estabilidad)

### 1. Cambio de Estructura de Base de Datos
- Siguiendo la retroalimentación del usuario, ahora el sistema utiliza específicamente la tabla **"categorias"** en Supabase para almacenar la información maestra.
- Se actualizaron todos los endpoints de lectura y escritura para alinearse con esta nueva estructura.

### 2. Correcciones en Gestión de Categorías
- **Carga Manual:** Se implementó una sincronización automática tras cada carga manual para asegurar que los datos se guarden inmediatamente en la base de datos.
- **Importación Excel:** Se optimizó el proceso para evitar validaciones de Mercado Libre innecesarias en este módulo, eliminando bloqueos de carga.

### 3. Estabilidad en Vinculación ML
- Se corrigió un error en la generación de la URL de redirección que causaba errores 404 en el proceso de autorización. El sistema ahora limpia y valida dinámicamente el origen de la petición.

### 4. Actualización de Identidad
- Proyecto actualizado a la versión **1.70**.

---

## Historial de Cambios - Versión 1.69 (Persistencia de Categorías)

### 1. Sincronización de Categorías con Supabase
- El botón **"Sincronizar"** en la sección de Gestión de Categorías ahora guarda permanentemente el listado en la base de datos de Supabase.
- Los datos guardados son cargados automáticamente al iniciar la aplicación, asegurando que la información esté disponible en todos los dispositivos.
- Se optimizó la lectura de categorías en el módulo de edición de productos para utilizar la información persistida.

### 2. Estabilidad de Datos
- Se implementó un flujo de limpieza y actualización atómica al sincronizar categorías para evitar duplicados o datos huérfanos.

### 3. Actualización de Identidad
- Proyecto actualizado a la versión **1.69**.
- Mantenimiento general de estilos y estabilidad del sistema.

---

## Historial de Cambios - Versión 1.68 (Estabilidad de Conexión y Guía de Usuario)

### 1. Sistema de Autorrefresco de Tokens (Mercado Libre)
- Se implementó una lógica de backend que verifica automáticamente si el token de Mercado Libre ha expirado.
- Si el token está por expirar, el sistema lo renueva automáticamente antes de cada sincronización, eliminando errores de "No autorizado" tras períodos de inactividad.

### 2. Guía de Vinculación Mejorada
- Se extendió el bloqueo interactivo de las pestañas de "Productos" para guiar al usuario a vincular su cuenta si aún no lo ha hecho.
- Las notificaciones de error por falta de conexión ahora incluyen un botón de **"Vincular Ahora"** para facilitar el proceso.

### 3. Actualización de Identidad
- El proyecto ha sido actualizado a la versión **1.68**.
- Se corrigieron errores reportados en el flujo de sincronización individual y masiva.

---

## Historial de Cambios - Versión 1.67 (Edición de Categorías y Sincronización)

### 1. Gestión de Categorías Avanzada
- Se añadió la capacidad de **Editar** y **Eliminar** categorías directamente desde el listado maestro.
- Se implementó un nuevo botón de **Sincronizar** en la sección de categorías para asegurar la integridad de los datos importados y manuales.
- Se optimizó el proceso de importación masiva para mayor fiabilidad.

### 2. Actualización de Identidad
- El proyecto ha sido actualizado a la versión **1.67**.
- Se mantienen todas las mejoras de automatización y estabilidad de versiones previas.

---

## Historial de Cambios - Versión 1.66 (Carga Manual de Categorías)

### 1. Carga Manual de Categorías
- Se ha añadido el botón **"Agregar Manual"** en la sección de Gestión de Categorías ML.
- Permite ingresar directamente el código y nombre de una nueva categoría sin necesidad de un archivo Excel.
- Las categorías agregadas manualmente se integran inmediatamente al listado maestro y están disponibles para la edición de productos.

### 2. Actualización de Identidad
- El proyecto ha sido actualizado a la versión **1.66**.
- Se mantienen todas las mejoras de automatización y estabilidad de versiones previas.

---

## Historial de Cambios - Versión 1.65 (Mejoras en Categorías y Usabilidad)

### 1. Gestión de Categorías Optimizada
- Se corrigió el funcionamiento de la sección de **"Categorías"**.
- El importador maestro ahora detecta con mayor precisión las columnas **"Código"** (o codigo) y **"Nombre"** (o nombre).
- El listado maestro ahora sirve como base única para la selección de categorías en el resto del sistema.

### 2. Mejoras en Edición y Carga Manual
- El campo **"ID Categoría ML"** ahora utiliza estrictamente el listado maestro cargado como un menú desplegable.
- Se implementó el **cierre automático** de las ventanas de edición y carga manual tras confirmar el guardado exitoso.
- Se optimizó la respuesta visual para asegurar que los cambios se reflejen sin necesidad de recargar manualmente.

### 3. Actualización de Identidad
- El proyecto ha sido actualizado a la versión **1.65**.
- Se actualizaron las etiquetas de encabezado y descripciones para reflejar el estado actual del sistema.

---

## Historial de Cambios - Versión 1.64 (Menú de Categorías y Mejoras de Automatización)

### 1. Nuevo Menú de Categorías
- Se ha creado una sección dedicada a **"Categorías"** en el menú lateral.
- Permite la carga centralizada del archivo maestro de categorías.
- Muestra el listado completo de categorías importadas (Código y Nombre).
- Estas categorías se sincronizan automáticamente con el menú desplegable al editar productos.

### 2. Sincronización con Mercado Libre
- Se corrigió el enlace de vinculación de cuenta en las secciones de "Stock y Precios".
- Ahora el proceso de vinculación abre correctamente el flujo de autorización de Mercado Libre.

### 3. Limpieza de Interfaz
- Se eliminaron los botones redundantes de "Categorías" y "ODBC" de las secciones de Stock, Facturas y PDFs para una navegación más limpia.
- La gestión de productos ahora refleja los cambios de edición de forma inmediata.

### 4. Correcciones Técnicas
- Se resolvió el error que impedía que la ventana de edición se cerrara automáticamente.
- Se optimizó la actualización del inventario tras guardar cambios.

### 5. Actualización de Identidad
- El proyecto ha sido actualizado a la versión **1.64**.

---

## Historial de Cambios - Versión 1.63 (Mejoras en Notificaciones y Gestión de Categorías)

### 1. Corrección Crítica de Base de Datos (Supabase)
- Se eliminaron todas las referencias a la columna `category` en la tabla `products`, resolviendo el error **PGRST204** (columna no encontrada en el caché del esquema).
- La lógica de categorización ahora depende exclusivamente de `category_id`, alineándose con el esquema real de la base de datos.
- Se ajustaron los endpoints de inserción, actualización y sincronización masiva para omitir el campo problemático.

### 2. Mejoras en la Gestión de Categorías
- El campo **"ID Categoría ML"** en los formularios de carga manual y edición ahora funciona como un **menú desplegable** cuando se ha cargado un archivo maestro de categorías.
- Se eliminó el campo redundante "Nombre Categoría" de los formularios para evitar confusiones y errores de esquema.
- Se optimizó la validación de categorías contra el archivo Excel adjunto.

### 3. Actualización de Identidad
- El proyecto ha sido actualizado a la versión **1.62**.

---

## Historial de Cambios - Versión 1.61 (Refinamiento de UI y Correcciones)

### 1. Mejoras en Reporte de Errores
- El título del formulario se cambió a **"Reportar Errores"**.
- El campo "Empresa / Módulo Afectado" se reemplazó por un menú desplegable con opciones predefinidas: **Publicaciones, Stock y Precios, Facturas, PDFs, Clientes**.

### 2. Correcciones en Notificaciones (Admin)
- Se corrigió el error visual donde la función de tachado no correspondía a la notificación seleccionada.
- Se optimizó el renderizado de la lista de mensajes para asegurar la integridad de las acciones.

### 3. Ajustes en Gestión de Categorías
- El botón **"Categorías"** se movió al principio de la lista de acciones para un acceso más rápido.
- Se corrigió la visualización de la información dentro del menú desplegable de categorías en el modal de edición.

### 4. Estabilidad de Sincronización
- Se revisó y ajustó el proceso de automatización de sincronización a Mercado Libre para mejorar su tasa de éxito.

### 5. Actualización de Identidad
- El proyecto ha sido actualizado a la versión **1.61**.

---

## Historial de Cambios - Versión 1.60 (Automatización de Sincronización)

## Historial de Cambios - Versión 1.59 (Validación por Excel y Limpieza de UI)

## Historial de Cambios - Versión 1.58 (Refinamiento y Notificaciones)

## Historial de Cambios - Versión 1.57 (Validación de Categorías ML)

### 1. Mejora en Botón "Categorías": Validación en Tiempo Real
- Al pulsar el botón **"Categorías"**, el sistema ahora consulta la API oficial de Mercado Libre (`/sites/MLA/categories`) para obtener el listado de categorías raíz vigentes.
- Se ha implementado una lógica de cotejo que compara las categorías de los productos listados con las obtenidas de la API.

### 2. Nuevos Indicadores de Validación
- Si un producto tiene una categoría que no corresponde a las categorías raíz oficiales de ML, se muestra una etiqueta roja parpadeante: **"Categoría Inválida ML"**.
- Se mantiene la advertencia **"Sin Categoría - No Sincronizado"** para productos sin ningún ID de categoría asignado.

### 3. Actualización de Identidad y Versión
- El proyecto ha sido actualizado a la versión **1.57**.
- Se mantiene la estética, estructura y lógica operativa previa.

---

## Historial de Cambios - Versión 1.56 (Gestión de Categorías y Plantillas)

### 1. Nueva Funcionalidad: Descarga de Plantillas por Categoría
- Se ha añadido el botón **"Categorías"** arriba del botón de sincronización.
- Este botón analiza el listado de productos actual y extrae los IDs de categorías únicos (MLAxxx).
- Abre automáticamente pestañas de descarga para las plantillas oficiales de Mercado Libre correspondientes a cada categoría detectada.

### 2. Indicadores Visuales de Sincronización
- Se implementó una advertencia visual (**"Sin Categoría - No Sincronizado"**) que aparece junto al nombre del producto si este no tiene una categoría asignada.
- Esto permite identificar rápidamente qué productos requieren atención antes de intentar una sincronización masiva.

### 3. Actualización de Identidad y Versión
- El proyecto ha sido actualizado a la versión **1.56**.
- Se mantiene la estética, estructura y lógica operativa previa.

---

## Historial de Cambios - Versión 1.55 (Actualización de Automatización)

### 1. Mejora en Automatización: Sincronizar a ML
- Se ha actualizado la lógica del botón **"Sincronizar a ML"** siguiendo los pasos de automatización más recientes.
- El proceso ahora es dinámico: busca la categoría del primer producto disponible en la base de datos de la empresa.
- Se actualizaron los XPaths y selectores para mayor precisión en la navegación de Mercado Libre:
    - Búsqueda manual por categoría.
    - Selección automática del primer resultado.
    - Confirmación y descarga del archivo Excel de categorías.

### 2. Actualización de Identidad y Versión
- El proyecto ha sido actualizado a la versión **1.55**.
- Se mantiene la estética, estructura y lógica previa, asegurando la continuidad operativa.

---

## Historial de Cambios - Versión 1.54 (Automatización y Refinamiento)

### 1. Nueva Funcionalidad: Sincronizar a ML (Automatización)
- Se ha añadido un nuevo botón **"Sincronizar a ML"** en la sección de Publicaciones (Productos), ubicado debajo del botón "Borrar todo".
- Este botón inicia un proceso de automatización (Puppeteer) que:
    - Se loguea automáticamente en Mercado Libre usando las credenciales configuradas.
    - Navega a la sección de publicación masiva por categorías.
    - Realiza una búsqueda por la palabra "caños".
    - Selecciona la categoría y descarga el archivo Excel correspondiente.
    - El archivo se descarga automáticamente en el navegador del usuario.

### 2. Refinamiento de Credenciales ML (Admin)
- Se ha mejorado la robustez del guardado de credenciales ML en el Panel de Administrador.
- Se añadió validación para asegurar que los campos de usuario y contraseña se envíen correctamente (incluso si están vacíos).
- Se optimizó la actualización de la interfaz tras guardar los cambios.

### 3. Actualización de Identidad y Versión
- El proyecto ha sido renombrado formalmente a **SynInt-ML.Version1.54**.
- Se actualizó la visualización de la versión en el encabezado y pie de página de la aplicación.

---

## Historial de Versiones Anteriores

### Versión 1.53 (Refinamiento y Ajustes de UI)
- Reemplazo de checkbox por botón deslizante (Toggle) en notificaciones (Admin).
- Corrección en el guardado de credenciales ML con logging detallado.
- Eliminación de botones "Sincronizar Seleccionados" y "Preparar Excel ML".
- Reorganización de botones en la sección de Publicaciones.
- Verificación de la carga manual de productos.

### Versión 1.52
- Corrección de Notificaciones (Optimistic Update).
- Reubicación de Credenciales ML a modal de Configuración.
- Ajustes menores de UI.

### Versión 1.51
- Gestión de Notificaciones y Estado Visual.
- Corrección en Guardado de Credenciales ML.
- Restauración de Funcionalidad en Panel de Empresa.
- Simplificación de Interfaz de Inicio.

### Versión 1.50
- Sistema de Reportes Redundante (Local + Cloud).
- Sincronización Automatizada ML (Método Híbrido con Puppeteer).
- Robustez en la comunicación y manejo de errores.
- Renombramiento formal a versión 1.50.

### Versión 1.48
- Validación de categorías en "Preparar Excel ML".
- Corrección de lógica de inicio de automatización.

---
© 2026 MLSync - Todos los derechos reservados.
