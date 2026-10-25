# Gestor de papers

Aplicación web sin dependencias ni compilación (HTML + CSS + JS). Sirve igual desde GitHub Pages que en local.

## Usar en local
Abre `index.html` en Chrome o Edge. Desde `file://` no se puede instalar como app (limitación de Chrome): para instalarla, publícala en GitHub Pages
o usa ⋮ → Guardar y compartir → Crear acceso directo → «Abrir como ventana».

## Publicar en GitHub Pages
1. Sube todos los archivos de esta carpeta a la raíz de un repositorio (no subas tu `papers.json`).
2. Ajustes → Pages → Source: *Deploy from a branch* → rama `main`, carpeta `/ (root)`.
3. Abre la URL que te da GitHub y, en Chrome/Edge, pulsa «Instalar aplicación» en la barra de direcciones.

## Datos y autoguardado
Tus datos viven en un archivo JSON local que eliges tú; nada se envía a ningún servidor.
El autoguardado usa la API de acceso a archivos (solo Chrome/Edge de escritorio); en otros navegadores el guardado es una descarga.
Chrome pide confirmar el acceso al archivo al reabrirlo en una sesión nueva («Reabrir último»).

## Citas (APA 7, Vancouver, MLA, IEEE y Chicago)
La plantilla depende del tipo de fuente (artículo, libro, capítulo, congreso, tesis, web, artículo de prensa y entrada de blog). Las citas llevan *cursiva* real: en texto plano se quita,
y en «Copiar con formato» y en Word se convierte. En la pestaña «Cita» puedes escribir `*texto*` para cursiva (un asterisco literal, `\*`).
En «Exportar citas» eliges idioma de los conectores (español/inglés), formato de la fecha de consulta y si Vancouver lista todos los autores.

## Novedades (F0.5 y F1a)
- Por paper puedes elegir el enlace de la cita (DOI, URL o ninguno) y omitir «[consultado …]» aunque la fecha esté rellena.
- Campos nuevos en el formulario según el tipo: volumen, número, páginas, edición, editorial, lugar, editores, fecha de publicación, tipo de trabajo y tipo de autor (persona, entidad, sin autor).
- Las citas APA y Vancouver ya usan volumen, número, páginas, edición, editorial, lugar, editores, fecha de publicación y tipo de trabajo. Nueva opción en Exportar: «pp.» antes de las páginas de un capítulo (APA).
- Estilos de cita: APA 7 (variante 1 y variante 2 con nombre completo entre corchetes) y Vancouver (variante 1 con iniciales y variante 2 con nombre completo).
- Al importar BibTeX, RIS o CrossRef (y con «Buscar» en el DOI) se leen también volumen, número, páginas, editorial, lugar, edición, editores y fecha de publicación; BibTeX y RIS los escriben al exportar.
- Exportar: formato de la numeración (1. / [1] / (1)) y letras para obras del mismo autor y año en APA (2020a, 2020b), con casilla para desactivarlas.
- Nuevo estilo **Chicago · Autor-fecha** (17.ª ed.): `Autor. 2016. *Título*. Lugar: Editorial.`, con letras 2016a/2016b, «n.d.» y fecha de acceso solo si no hay año. Los artículos admiten ahora «Fecha de publicación»: se usa solo el mes (Chicago e IEEE).
- Nuevo estilo **Chicago · Notas y bibliografía** (17.ª ed.): solo la bibliografía, con el año tras la editorial (`Autor. *Título*. Lugar: Editorial, 2016.`); las notas a pie llegarán en la fase F4. Corrección en MLA y Chicago: con dos autores en orden directo la conjunción «e/y» depende del nombre de pila (`Levitt, Steven D. y Stephen J. Dubner`; `… e Irene Pérez`).
- Nuevos estilos **UNE-ISO 690 · Nombre-fecha** (`APELLIDO, Nombre, 2016. Título…`, con letras 2016a/2016b y `[s.f.]`) y **UNE-ISO 690 · Numérico** (año al final, lista numerada). Apellidos en mayúsculas, entidades enteras en mayúsculas, `En línea.`, `Disponible en:` y `[Consulta: dd-mm-aaaa]` (o ISO). Todo el estilo está marcado «verificar» en Exportar: el orden de los elementos se dedujo de los ejemplos de la guía.
- Nuevo estilo **IEEE** (siempre en inglés, numerado `[1]` según el orden de la lista, sin fecha de consulta; enlaces como `[Online]. Available: …`).
- Nuevo estilo **MLA** (8.ª/9.ª) para los seis tipos de fuente. En Exportar aparece bajo el selector un aviso con las particularidades del estilo y la lista «Basado en…». Los estilos que exijan numeración propia (IEEE, UNE numérico) ocultarán la casilla «Numerar» y los de idioma fijo bloquearán el selector de idioma.
- Nuevos tipos **Artículo de prensa** y **Entrada de blog** (con fecha de publicación completa; la prensa admite también páginas). APA: prensa digital si la cita lleva enlace, impresa si no (con «Enlace en la cita: Ninguno» sale la forma impresa aunque haya URL). Si rellenas la fecha y «Año» está vacío, el año se completa solo; si no coinciden, un aviso lo indica y las citas usan solo el año. Donde la guía no trae plantilla (prensa en Vancouver, MLA, IEEE y UNE; blog en Vancouver, IEEE y UNE) se usa una adaptada y se avisa en Exportar y en la pestaña Cita («Verificar»). BibTeX: prensa = `@article` con `entrysubtype = {newspaper}`; blog = `@online` con `entrysubtype = {blog}`. RIS: `NEWS` y `BLOG`.
- Quince tipos más: informe, norma técnica, patente, mapa, conjunto de datos, software o videojuego, base de datos, audiovisual, audio, publicación en red social, IA generativa, entrada de diccionario, presentación, comunicación personal y legislación, con plantilla en los 10 estilos (genérica y con aviso «Verificar» donde la guía no trae una). BibTeX con `entrysubtype` y RIS con `GEN` + marca para los que no tienen entrada propia. Las comunicaciones personales (APA, Chicago), las redes sociales (Chicago notas y bibliografía) y la IA sin enlace (Chicago) no entran en la lista de referencias.
- **Cita en el texto y notas de Chicago** (Configuración → casilla opcional): aparecen en la pestaña «Cita» de cada paper, con campo de página y botones de copiar. Los estilos numéricos muestran `[n]` o `(n)`.
- **Exportar a Word (.docx)** real, con sangría francesa y cursivas, además del `.doc` anterior.
- **Relaciones**: botón del menú que dibuja el gráfico de papers relacionados («relacionado» y «cita a»); clic en un paper para abrirlo.

## Cambios de la ronda F5
- **Papelera:** los papers eliminados se conservan 5 días.
- **Historial:** solo muestra los cambios del día y no se guarda en el JSON (allí queda solo la fecha de creación).
- **Lista principal:** el estado de lectura y las estrellas van junto a la ✕; clic derecho en las estrellas para cambiar la valoración.
- **Barra lateral** con fondo y borde propios; «Gestionar» junto al título de Secciones y Etiquetas.
- **Configuración** y **editar paper** con cabecera fija que se estrecha al hacer scroll; apartados plegables.
- **Editar paper:** pestaña «Secciones, etiquetas y relacionados» con el mismo diseño plegable que «Ver todo», y la cita en su propia pestaña; «Ver todo» con bloques plegables y una sola variante de cita (selector).
- **Notas** (generales y por sección) con un editor que muestra el formato al escribir, como WhatsApp: `*cursiva*`, `**negrita**`, `~~tachado~~`, `__subrayado__`, listas con «- » o «1. ». Se guardan y copian con esos símbolos; al exportar solo se ve el formato.

## Pruebas
`node pruebas/pruebas_citas.js app.js`, `python3 pruebas/prueba_f4.py .`, `python3 pruebas/prueba_ui.py .` y `python3 pruebas/prueba_sync.py .` (necesitan Playwright con Chromium; la de sincronización simula Google y Drive).

## Cambios de la ronda F7–F9
- **Tabla:** columna *Secciones* (se puede seguir agrupando por sección). La pestaña **Cita** va justo después de **Datos**. La **valoración mínima** está en el grupo *Ordenar*.
- **Imagen del paper** (Datos → recuadro junto a los títulos; también se puede pegar con Ctrl+V una imagen copiada, p. ej. de Google Imágenes): una URL, un **archivo local enlazado** (Chrome/Edge: se guarda solo el nombre en el JSON y el enlace en este navegador, que puede pedir permiso al abrir) o una **copia reducida incrustada** (máx. 480 px, viaja con el JSON). Se ve en tarjetas y tabla; Configuración permite ocultarla.
- **Estilos de cita personalizados** (Configuración): se crean desde cero con una plantilla por tipo de documento y se guardan en `settings.customStyles` del JSON. Sintaxis: `{campo}` inserta un dato, `{campo:i:q}` aplica formato (cursiva, negrita, comillas, paréntesis, mayúsculas, `pp` para páginas…), `{year|s.f.}` da una alternativa si está vacío y `[ … ]` es un grupo opcional que solo sale si todos sus campos tienen valor. También se configuran los autores (formato, conjunción, «et al.»), las fechas, el orden y la numeración, y la cita en el texto. Aparecen en Exportar y en la pestaña Cita.
- **Estilos personalizados, más control:** «+ Nuevo a partir de…» crea un estilo propio con las plantillas de APA 7, Vancouver, MLA, IEEE, Chicago (2 variantes) o UNE-ISO 690 (2 variantes) para los tipos más comunes (artículo, libro, capítulo, congreso, tesis, web y prensa; los demás usan la plantilla por defecto), listas para modificar. Con el **botón derecho sobre un campo** de la plantilla (o sobre su botón en la lista de campos) se abren las opciones de ese campo y se escriben solas como `{campo:opción=valor}`: en autores y editores el formato, separadores, conjunción, límite con «et al.», mayúsculas y un **formato personalizado de cada autor** (`{L}, {g}`, `{g} {l}`, `{i} {l}`…); en fechas el formato o un patrón propio (`D de MMMM de YYYY`); en páginas «p./pp.», raya o solo la primera; además cursiva, negrita, mayúsculas, comillas, texto antes/después y valor alternativo. Cada estilo puede fijar su idioma (español/inglés).
- **Tipos de documento propios** (Configuración): para lo que los predefinidos no contemplan. Eliges qué campos muestra el formulario y cómo se llaman, y con qué tipo predefinido se cita en los estilos de serie. Aparecen en el desplegable «Tipo» de cada paper (grupo «Tipos propios»), que además permite «➕ Crear un tipo propio…» sobre la marcha. Los estilos propios ven todos los campos y pueden tener una plantilla específica para el tipo. Se guardan en `settings.customTypes`.
- **Ayuda** (botón ❓ de la barra lateral, entre Papelera y Configuración, o F1): explica todas las funciones, la configuración, los tipos propios y la creación de estilos de cita personalizados, con buscador.

## Datos de la aplicación (PWA) y actualizaciones (F13)
- Además del JSON, la app guarda en IndexedDB una **copia de la sesión** (tus datos tal como están, aunque no hayas guardado) y el **estado de la interfaz** (filtros, orden, barra lateral, bloques plegados). Al reabrirla sigues donde lo dejaste y, si había cambios sin guardar, te lo avisa. El JSON sigue siendo el archivo original: guarda para escribir en él (si recuerda el archivo, pide permiso).
- Estos datos viven **fuera de la caché del service worker**, así que las actualizaciones no los tocan: **no hace falta borrar los datos de la aplicación** para recibir una versión nueva. El service worker revalida siempre (`cache: 'no-cache'`), busca versiones nuevas al abrir, al volver a la app y cada 30 min, y avisa con «Recargar ahora» (guarda la copia de sesión antes de recargar).
- La versión está en `APP_V` (app.js) y en `papers-vNN` (sw.js): **súbelas juntas** en cada publicación. En Ayuda → «Aplicación instalada» hay botones para buscar actualizaciones y olvidar la copia de sesión.

## Sincronización con Google Drive y Privacidad (F14)
- **Icono 🔄 a la izquierda de 💾**: guarda la biblioteca entera (papers, notas, secciones, etiquetas, papelera y ajustes) en la carpeta oculta `appDataFolder` del **propio Google Drive** de cada persona, como en Supuestos C1 (permiso `drive.appdata`: la app no ve el resto del Drive; sin servidor intermedio). Archivos (todos `gpapers-…`): ver «Solo cambios» abajo.
- **Autoguardado activado al conectar**: cada cambio se sube a los 3 s; al abrir la app, al volver a ella y cada 5 min se traen los cambios de los otros dispositivos. La casilla «Autoguardado» lo activa o desactiva (con Drive funciona en cualquier navegador, también en el móvil). El punto del icono indica el estado (verde, azul girando, amarillo, rojo).
- **Con la sesión iniciada, clic en 🔄**: sincronizar ahora, autoguardado en Drive, ¿cómo funciona?, privacidad y **cerrar sesión** (solo en ese dispositivo; los demás siguen sincronizando).
- **Fusión a tres bandas** con la última versión sincronizada (guardada en IndexedDB): altas, ediciones y borrados de cada dispositivo se combinan paper a paper y campo a campo (notas una a una); si los dos cambian el mismo campo gana el paper modificado más tarde; una edición gana a un borrado. La vista (tarjetas/tabla) es de cada dispositivo. Lo que llega de Drive se puede deshacer. Con una ventana de edición abierta se espera a que se cierre.
- **Primera vez con datos en los dos lados** (o al abrir otro archivo con la sesión iniciada): pregunta si combinar, usar la de Drive o la de este dispositivo. Si aquí solo está el ejemplo, manda Drive sin preguntar.
- **Solo cambios (F15)**: en Drive hay una copia completa (`gpapers-snap.json`), un archivo pequeño por cada autoguardado con solo lo que cambió, campo a campo (`gpapers-d-<hora>-<dispositivo>.json`), y cada imagen incrustada aparte, una sola vez (`gpapers-img-<huella>`; en la biblioteca solo queda la huella). Con 25 cambios sueltos se rehace la copia completa y se borran; las imágenes sin usar se borran pasado un día. Lo descargado se guarda en IndexedDB (`syncCache`): cada vuelta pide solo la lista de archivos y los nuevos. Lo que pasa de 4 MB se sube con la **subida reanudable** de Drive (sin el límite de 5 MB y sin configurar nada). La copia de un solo archivo de la versión anterior (`gpapers-sync.json`) se lee y se convierte sola.
- El acceso de Google dura una hora y vive solo en la pestaña (sessionStorage); si caduca, el icono se pone amarillo y basta con «Volver a conectar».
- **🔒 Privacidad** (barra lateral, bajo la Papelera): qué datos se tratan, cuándo sale algo a internet, el permiso de Drive, cómo cerrar sesión, **borrar la copia de Drive** y retirar el permiso. Versión enlazable en `privacidad.html` (para la pantalla de consentimiento de Google).
- **Configuración**: el ID de cliente OAuth está en `SY_CFG` (app.js). Es el del proyecto de Google de Supuestos C1, que ya autoriza el origen `https://rmalump.github.io`; para que la ventana de Google muestre «Gestor de papers», crea un proyecto propio (Google Drive API + pantalla de consentimiento con solo `drive.appdata` + ID de cliente «Aplicación web» con ese origen) y cambia el ID. Vacío = sin sincronización.
