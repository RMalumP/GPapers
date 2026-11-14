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
Tus datos viven en archivos JSON locales que eliges tú (uno por proyecto); nada se envía a ningún servidor.
El autoguardado usa la API de acceso a archivos (solo Chrome/Edge de escritorio); en otros navegadores el guardado es una descarga.
Chrome pide confirmar el acceso al archivo al volver a leerlo en una sesión nueva (▾ del proyecto → «Volver a leer…»).

## Proyectos
Cada proyecto es una biblioteca aparte (papers, notas, secciones, etiquetas, relaciones y papelera) con **su propio archivo JSON, que se llama como el proyecto** (`Tesis` → `Tesis.json`).
Los ajustes son comunes a todos: nombre de la aplicación, colores, atajos, tipos y estilos propios, plantillas y opciones de exportación (cada JSON lleva una copia para que sirva solo).
- **Nombre**: se escribe en la cabecera, junto al nombre de la aplicación. En Chrome/Edge se intenta renombrar también el archivo; si no se puede, el siguiente «Guardar» crea el del nombre nuevo.
- **Cambiar de proyecto**: botón ▾ de la cabecera. El navegador guarda la copia de trabajo de cada proyecto (IndexedDB: `projects`, `proj:<id>`, `h:<id>`), así que el cambio es inmediato y no se pierde lo que no estaba guardado.
- **Guardar** guarda solo el proyecto abierto en su archivo; **Guardar como** propone `<proyecto>.json`; el autoguardado escribe en el archivo de cada proyecto.
- **Abrir 📂** abre un JSON como proyecto: el suyo si ya lo es (mismo archivo), o uno nuevo con el nombre del archivo. Un JSON de versiones anteriores se abre igual.
- La biblioteca de versiones anteriores pasa sola a ser el primer proyecto (con el nombre de su archivo).
- **Google Drive** guarda todos los proyectos: un índice común (`gpapers-projects.json`, lista de proyectos y ajustes comunes) y los archivos de cada uno (el primero conserva los nombres de siempre, `gpapers-snap.json`…; los demás, `gpapers-p-<id>-…`). Cada vuelta sincroniza el índice y el proyecto abierto; los proyectos de otros dispositivos salen en ▾ con ☁ y se descargan al abrirlos. Renombrar o borrar un proyecto llega a todos los dispositivos.

- **Relaciones**: la primera vez que se abre (con relaciones) se muestra la explicación de la función; después se abre el gráfico y el botón «❓ ¿Para qué sirve?» la vuelve a mostrar. Sin relaciones, la explicación atenuada sigue saliendo siempre.

## Interfaz simplificada (v33)
- **Cabecera**: solo Google Drive 🔄, Guardar 💾, 📥 Importar y Exportar citas; Abrir, Guardar como, Importar referencias y Autoguardado están en **Archivo ▾**. «Reabrir último» pasó al menú ▾ del proyecto («↻ Volver a leer…», solo si el proyecto tiene archivo) y «Buscar duplicados» también.
- **Estado de guardado único** junto al nombre del proyecto («Guardado», «Sin guardar», «Guardado en Google Drive», «Sincronizando…»…), con un punto de color.
- **Barra lateral**: Secciones, Etiquetas y Lectura en un solo grupo **Filtros**; **Selección** solo aparece con papers marcados («☑ Seleccionar visibles» está sobre la lista).
- **Configuración por pestañas**: Apariencia, Notas y citas, Atajos, Datos y Drive. El progreso de lectura es opcional (desactivado por defecto).
- **Ayuda**: «Empezar aquí» y, bajo «Ver toda la ayuda», el resto (la búsqueda abre todo).

## Copias, duplicados, PDF y filtros
- **Copias de seguridad** por proyecto (IndexedDB: índice `bk:<id>` y cada copia en `bkd:<id>:<k>`): una al abrir cada día y antes de restaurar o de sustituirlo todo por Drive, las últimas 10; crear, descargar, restaurar (deshacible) y borrar desde ▾ → «Copias de seguridad…». Solo en el navegador.
- **Buscar duplicados** (grupo Selección): mismo DOI o título; «Quedarme con este» fusiona campos vacíos, etiquetas, secciones, notas y relaciones, y manda los demás a la papelera.
- **Mover o copiar a otro proyecto** (grupo Selección): notas, etiquetas y secciones (por nombre; se crean si faltan) y relaciones entre los elegidos.
- **PDF enlazados** (Datos): hasta dos por paper (`pdf` y `pdf2`); solo el nombre y la página van al JSON; el enlace al archivo vive en el navegador. Opcional (Configuración → «Subir a mi Google Drive los PDF enlazados»): cada PDF se copia a la carpeta oculta de Drive (`gpapers-pdf-<id>` y `gpapers-pdf-<id>~2`, subida reanudable, máx. 100 MB) y se abre desde otros dispositivos; se borra al quitar el enlace.
- **Copiar cita 📋** en tarjetas y tabla; **vistas ⭐** (filtros guardados) por proyecto (IndexedDB `fav:<id>`; los recientes, en `rec:<id>`); **barra de progreso** de lectura junto al nombre del proyecto.

## Interfaz para móviles
En pantallas táctiles estrechas (móvil en vertical, o en horizontal con poca altura) la aplicación cambia sola a una interfaz adaptada; en el ordenador no cambia nada, aunque la ventana sea pequeña.
- **Cabecera de una fila**: ☰ (menú), nombre del proyecto con su estado y ⋯ (Google Drive, Guardar, Importar, Exportar y todo lo de Archivo).
- **Buscador fijo** encima de la lista, con acceso directo a los filtros. La fila de Tabla/Tarjetas, Sección ▾, Etiquetas ▾ y ☑ cabe en el ancho; las secciones y etiquetas salen debajo, en líneas (sin desplazar). Sección ▾ abre un menú con «Mostrarlas debajo», «Agrupar por sección» y la lista de secciones (con cuántos papers tiene cada una); Etiquetas ▾, con «Mostrarlas debajo», cómo combinarlas y la lista de etiquetas (se pueden marcar varias).
- **Gestionar secciones**: dos líneas por sección (color, nombre, ↑ ↓ · descripción, Eliminar); las etiquetas, una línea.
- **Barra lateral como panel** que entra desde la izquierda, con «Ver resultados» para volver a la lista.
- **Barra inferior**: Papers, Configuración, ＋ Nuevo (siempre en el centro), Exportar, Importar y Más. Con PDF por citar aparece 🗃️ entre Papers y Configuración (muestra o despliega la bandeja). Los filtros se abren desde 🎚️ junto al buscador o desde el menú ☰.
- **Ventanas a pantalla completa**, con pestañas deslizables y ✕ arriba; la vista Tabla se muestra como fichas.
- **Pulsación larga** = clic derecho (también en iPhone). Los campos usan texto de 16 px para que el iPhone no amplíe la página.
Todo vive en `movil.css` y `js/movil.js`, detrás de la clase `mv` de `<html>`, y reutiliza las funciones de siempre. Pruebas: `python3 pruebas/prueba_movil.py`.

## Añadir app
En la barra lateral, dentro de «Información» (plegada, bajo Configuración), el botón **Añadir app** (mismo estilo que Ayuda) instala la aplicación en el dispositivo. Solo se ve si se abre desde la web y aún no está instalada
(se oculta al abrirla como app y al instalarse). En Chrome y Edge la instalación la ofrece el navegador; en los demás se explica cómo hacerlo.

## Citas (APA 7, Vancouver, MLA, IEEE y Chicago)
La plantilla depende del tipo de fuente (artículo, libro, capítulo, congreso, tesis, web, artículo de prensa y entrada de blog). Las citas llevan *cursiva* real: en texto plano se quita,
y en «Copiar con formato» y en Word se convierte. En la pestaña «Cita» puedes escribir `*texto*` para cursiva (un asterisco literal, `\*`).
En «Exportar citas» eliges idioma de los conectores (español/inglés), formato de la fecha de consulta y si Vancouver lista todos los autores.

## Derecho y jurisprudencia
Los estilos de cita salen agrupados en tres secciones: **Estilos generales**, **Derecho y jurisprudencia** y **Estilos propios** (en Exportar, en la pestaña Cita y en «Nuevo a partir de…»).

**Estilo de cita principal** (Configuración → Notas y citas; APA 7 por defecto): sale primero en la pestaña Cita, o solo él si se marca «mostrar solo el estilo principal» (con un botón para ver todos); al elegirlo pasa a ser también el estilo de Exportar. La pestaña **Datos** abre en una **versión simplificada** con lo básico y los campos que ese estilo usa para el tipo del paper (se detectan probando la cita, así que vale también para los estilos propios); los campos con datos nunca se ocultan y «Mostrar todos los campos» despliega el resto bajo «Otros campos». En la pestaña Cita las citas se editan **con su formato** (la cursiva se ve como cursiva, sin asteriscos; por dentro se guarda igual, `*cursiva*`), con una barra de **formato** arriba: Cursiva, Negrita, Idioma y Fecha de consulta (cómo se escribe «[consultado el …]»; los mismos ajustes que Exportar).
El estilo **Derecho y jurisprudencia** une las guías de la UAM (Facultad de Derecho), la UMA, la UC3M y la UCM:
- **Exportación en bloques**: lista de abreviaturas utilizadas (opcional), bibliografía de la doctrina en APA 7, **Anexo de legislación** y **Anexo de jurisprudencia**, estos dos de lo más antiguo a lo más reciente. La legislación y la jurisprudencia no van en la bibliografía.
- **Legislación** (UMA): `España. Ley 40/2015, de 2 de octubre, de Régimen Jurídico del Sector Público. Boletín Oficial del Estado, 2 de octubre de 2015, núm. 236, pp. 89411 a 89530.` En el texto, la abreviatura (`art. 22.1 CE`) o, si no hay, rango, número y fecha sacados del título (`RDL 18/2020, de 12 de mayo`; en la UE, `Dir. 2015/2376 del Consejo, de 8 de diciembre de 2015`). Campos nuevos: rango y abreviatura.
- **Jurisprudencia** (tipo nuevo): `España. Tribunal Supremo (Sala de lo Penal, Sección 1.ª). Sentencia núm. 1229/2017, de 29 de marzo de 2017.`; con caso, asunto y ECLI en los tribunales europeos (`Caso Schempp (C-403/03). Sentencia de 12 de julio de 2005, EU:C:2005:446.`), base de datos o internet. En el texto, el tribunal abreviado (STS, STC, ATC, DTC, SAN, STSJ Madrid, SAP Sevilla, STEDH, STJUE…) con número y fecha, y FJ, FD o apartado. Los demás estilos citan la jurisprudencia con la misma plantilla (las guías la recomiendan sea cual sea el estilo).
- **Importar** tiene botón propio en la cabecera (📥, a la izquierda de «Exportar citas») y lee también el **texto de ScienceDirect** (`.txt`, con resumen y palabras clave a las notas generales) y **citas copiadas de Google Scholar**, una por línea, en APA, MLA, Chicago, Harvard o Vancouver (autores, año, título, revista o editorial, volumen, número y páginas). Ejemplo en `pruebas/ejemplo_sciencedirect.txt`.
- BibTeX (`@jurisdiction`, `shorthand`, `ecli`) y RIS (`CASE`, `J2`, `C3`, `DB`) importan y exportan los campos nuevos.

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
- **Filtros** con contadores en cada chip, «Sin sección» y «Sin etiquetas», etiquetas excluidas (clic derecho en una etiqueta), valoración mínima, rango de años, buscador de etiquetas (con 6 o más) y barra de progreso de lectura. Los filtros aplicados se resumen sobre la lista, cada uno con su ✕, y con «Limpiar todo».
- **Filtros compactos:** Secciones, Etiquetas y Lectura se pliegan (se recuerda); «📄 Notas», cómo combinar etiquetas, la valoración y los años van en la fila de su título. «＋ Guardar vista» pide el nombre en la propia barra.
- **Barra lateral en tres bloques:** buscar (con una **búsqueda avanzada** por condiciones, plegada al empezar, y Ordenar debajo, desplegado al abrir Buscar; plegado, Buscar deja solo la caja a todo el ancho), filtrar; luego **Vistas** (búsquedas y filtros guardados, un clic para aplicarlas, la activa marcada), **Recientes** (los 5 últimos papers abiertos), Selección y Relaciones; abajo Papelera, Configuración e Información. Clic derecho en «Menú» pliega o despliega todos los grupos.
- **Barra lateral, interacción:** arrastra un paper (o varios seleccionados) a una sección o etiqueta de Filtros para añadírsela; arrastra el borde derecho de la barra para cambiar su ancho (200–480 px; doble clic lo restablece); <kbd>Alt+M</kbd> (configurable) pliega o despliega la barra.
- **Barra lateral plegada:** la búsqueda sigue a la vista en la fila de «Nuevo paper»; lo demás se pliega. Etiquetas tiene la opción «Todas», como Secciones, y «☑ Visibles» selecciona los papers que se ven.
- **Configuración** y **editar paper** con cabecera fija que se estrecha al hacer scroll; apartados plegables.
- **Editar paper:** pestaña «Secciones, etiquetas y relacionados» con el mismo diseño plegable que «Ver todo», y la cita en su propia pestaña; «Ver todo» con bloques plegables y una sola variante de cita (selector).
- **Notas** (generales y por sección) con un editor que muestra el formato al escribir, como WhatsApp: `*cursiva*`, `**negrita**`, `~~tachado~~`, `__subrayado__`, listas con «- » o «1. ». Se guardan y copian con esos símbolos; al exportar solo se ve el formato.

## Código
Sin compilación: `index.html` carga scripts clásicos en este orden (comparten el ámbito global, así que la app sigue funcionando desde `file://`), y `sw.js` los guarda en el mismo orden:
`js/modelo.js` (modelo de datos y utilidades), `js/citas.js` (estilos de cita, tipos y estilos propios), `js/persistencia.js` (abrir, guardar, deshacer), `js/importar.js`, `js/config.js` (atajos, configuración, ayuda), `js/lista.js` (lista y exportar), `js/edicion.js` (edición, notas, relaciones, papelera, historial), `js/drive.js` (Google Drive), `js/extras.js` (PWA, duplicados, PDF, proyectos, copias), `js/visor.js` (visor y anotaciones de PDF), `js/bandeja.js` (bandeja «PDF por citar» y copia en el Drive normal) y `app.js` (datos de la aplicación y arranque).
Un archivo nuevo se añade en los tres sitios; `pruebas/prueba_version.js` lo comprueba.
El HTML no lleva `onclick` ni otros manejadores en línea: `index.html` tiene una CSP que los bloquea (y no permite `eval`). Cada elemento dice qué hacer en `data-on<evento>`, p. ej. `data-onclick="openPaper('p1')"`; ese texto lo lee un minilenguaje (llamadas, lecturas, textos, números, listas, `this`, `event`, `!` y `+`), sin evaluarlo como JavaScript (ver «Eventos de la interfaz» en `js/modelo.js`). Para asignar se usan funciones pequeñas (`put(F,'mode',this.value,render)`, `setHas(…)`, etc., en `app.js`); las variables `const`/`let` que haga falta leer van en `ON_VARS`. `pruebas/prueba_eventos.js` comprueba que no queda ningún manejador en línea y que todos los `data-on` se pueden leer.

## Pruebas
`node pruebas/prueba_version.js .`, `node pruebas/prueba_eventos.js .`, `node pruebas/pruebas_citas.js .`, `python3 pruebas/prueba_f4.py .`, `python3 pruebas/prueba_ui.py .`, `python3 pruebas/prueba_sync.py .`, `python3 pruebas/prueba_proyectos.py .`, `python3 pruebas/prueba_mejoras.py .` y `python3 pruebas/prueba_interfaz.py .`, `python3 pruebas/prueba_derecho.py .`, `python3 pruebas/prueba_principal.py .`, `python3 pruebas/prueba_importar.py .`, `python3 pruebas/prueba_rendimiento.py .`, `python3 pruebas/prueba_movil.py .`, `python3 pruebas/prueba_motor.py .`, `python3 pruebas/prueba_visor.py .` (necesitan Playwright con Chromium; la de sincronización simula Google y Drive).

## Cambios de la ronda F7–F9
- **Tabla:** columna *Secciones* (se puede seguir agrupando por sección). La pestaña **Cita** va justo después de **Datos**. La **valoración mínima** está en *Filtros*.
- **Imagen del paper** (Datos → recuadro junto a los títulos; también se puede pegar con Ctrl+V una imagen copiada, p. ej. de Google Imágenes): una URL, un **archivo local enlazado** (Chrome/Edge: se guarda solo el nombre en el JSON y el enlace en este navegador, que puede pedir permiso al abrir) o una **copia reducida incrustada** (máx. 480 px, viaja con el JSON). Se ve en tarjetas y tabla; Configuración permite ocultarla.
- **Estilos de cita personalizados** (Configuración): se crean desde cero con una plantilla por tipo de documento y se guardan en `settings.customStyles` del JSON. Sintaxis: `{campo}` inserta un dato, `{campo:i:q}` aplica formato (cursiva, negrita, comillas, paréntesis, mayúsculas, `pp` para páginas…), `{year|s.f.}` da una alternativa si está vacío y `[ … ]` es un grupo opcional que solo sale si todos sus campos tienen valor. También se configuran los autores (formato, conjunción, «et al.»), las fechas, el orden y la numeración, y la cita en el texto. Aparecen en Exportar y en la pestaña Cita.
- **Estilos personalizados, más control:** «+ Nuevo a partir de…» crea un estilo propio con las plantillas de APA 7, Vancouver, MLA, IEEE, Chicago (2 variantes) o UNE-ISO 690 (2 variantes) para los tipos más comunes (artículo, libro, capítulo, congreso, tesis, web y prensa; los demás usan la plantilla por defecto), listas para modificar. Con el **botón derecho sobre un campo** de la plantilla (o sobre su botón en la lista de campos) se abren las opciones de ese campo y se escriben solas como `{campo:opción=valor}`: en autores y editores el formato, separadores, conjunción, límite con «et al.», mayúsculas y un **formato personalizado de cada autor** (`{L}, {g}`, `{g} {l}`, `{i} {l}`…); en fechas el formato o un patrón propio (`D de MMMM de YYYY`); en páginas «p./pp.», raya o solo la primera; además cursiva, negrita, mayúsculas, comillas, texto antes/después y valor alternativo. Cada estilo puede fijar su idioma (español/inglés).
- **Tipos de documento propios** (Configuración): para lo que los predefinidos no contemplan. Eliges qué campos muestra el formulario y cómo se llaman, y con qué tipo predefinido se cita en los estilos de serie. Aparecen en el desplegable «Tipo» de cada paper (grupo «Tipos propios»), que además permite «➕ Crear un tipo propio…» sobre la marcha. Los estilos propios ven todos los campos y pueden tener una plantilla específica para el tipo. Se guardan en `settings.customTypes`.
- **Ayuda** (botón ❓ de la barra lateral, bajo Configuración y una línea, o F1): explica todas las funciones, la configuración, los tipos propios y la creación de estilos de cita personalizados, con buscador.

## Datos de la aplicación (PWA) y actualizaciones (F13)
- Además del JSON, la app guarda en IndexedDB una **copia de la sesión** (tus datos tal como están, aunque no hayas guardado) y el **estado de la interfaz** (filtros, orden, barra lateral, bloques plegados). Al reabrirla sigues donde lo dejaste y, si había cambios sin guardar, te lo avisa. El JSON sigue siendo el archivo original: guarda para escribir en él (si recuerda el archivo, pide permiso).
- Estos datos viven **fuera de la caché del service worker**, así que las actualizaciones no los tocan: **no hace falta borrar los datos de la aplicación** para recibir una versión nueva. El service worker sirve la app **desde la caché de su versión** (v37.6: abre al instante aunque la red sea lenta o no haya), busca versiones nuevas al abrir, al volver a la app y cada 30 min, las descarga enteras por detrás y avisa con «Recargar ahora» (guarda la copia de sesión antes de recargar).
- La versión está en `APP_V` (app.js) y en `papers-vNN` (sw.js): **súbelas juntas** en cada publicación (si no cambian, los dispositivos instalados no ven la versión nueva). En Ayuda → «Aplicación instalada» hay botones para buscar actualizaciones y olvidar la copia de sesión.

## Rendimiento (v37.6–v37.7)
- Al abrir, la lista se pinta **una sola vez**, cuando ya se han leído la copia de trabajo y el estado de la interfaz (`RENDER_HOLD` en js/lista.js), y la copia recuperada no se vuelve a escribir.
- En el móvil la lista se pinta **de 40 en 40** (150 en el escritorio); el resto se añade al bajar.
- La sincronización con Google Drive al abrir espera a que la lista ya se vea (`afterPaint` en app.js).
- (v37.7) La **copia de trabajo** en IndexedDB es JSON compacto y guarda cada imagen incrustada **aparte**, una sola vez («imgd:<huella>»; el JSON lleva `{kind: 'data', ref}` y `img: 1`); guardar tras un cambio ya no reescribe todas las imágenes. Las que ya no usa ningún proyecto se borran al abrir (`imgGc`). El archivo JSON que guardas o exportas sigue llevando las imágenes dentro, como siempre.
- (v37.7) Las miniaturas incrustadas se muestran con URLs `blob:` en vez de copiar el base64 en el HTML de cada tarjeta, y la app usa una sola conexión a IndexedDB (`idbOpen`).

- (v37.8) Los avisos de reconectar con Google (`toast(…, 'sy')`) se quitan solos en cuanto vuelve el acceso, y pulsar un botón de un aviso lo cierra.

## Motor, búsqueda y selección (v38.0, fase A)
- **Búsqueda por palabras**: cada palabra por separado y en cualquier orden («garcía 2020»), en título, alias, año, autores, revista, DOI, etiquetas y secciones (y notas y citas con la casilla). Admite `"frase exacta"`, `-palabra`, `autor:`, `año:2020` / `año:2010-2020`, `revista:`, `doi:`, `#etiqueta` (o `etiqueta:`) y `seccion:` (`qParse`/`qTest` en js/lista.js). Las palabras encontradas se **resaltan** en título y autores de tarjetas y tabla (`hl`).
- **Acciones en lote** (grupo Selección): estado de lectura, valoración, añadir o quitar etiqueta y sección, y enviar a la papelera; cada una se deshace con un solo Ctrl+Z (también desde el aviso).
- **Varias pestañas**: si el mismo proyecto ya está abierto en otra pestaña, la nueva queda en pausa (no guarda ni sincroniza) con «Usar en esta pestaña»; la otra guarda lo pendiente y pasa a pausa (`TAB`, BroadcastChannel «gpapers», en js/extras.js).
- **Sincronización sin trabajo repetido**: normalizar la biblioteca (`syNormS`) recuerda sus últimos resultados por la huella del JSON, así cada vuelta con Drive ya no lo hace 4 veces (con 2000 papers, ~1,2 s menos de pantalla congelada en un móvil medio).
- **Copias de seguridad ligeras**: `bk:<id>` es solo el índice y cada copia va en `bkd:<id>:<k>`, compacta y con las imágenes aparte (`imgd:`); al abrir ya no se leen todas las copias. Las de versiones anteriores se convierten solas.

## Añadir papers más rápido (v38.1, fase B)
- **Buscar por DOI, ISBN o título** (📥 Importar → 🔎): un DOI va a CrossRef; un ISBN, a Open Library (`fetchIsbn`); unas palabras del título muestran hasta 6 resultados de CrossRef para elegir (`searchTitle`). La CSP permite `openlibrary.org` (y `api.openalex.org`, para la fase C) y la política de privacidad lo explica.
- **Compartir con la app** (Android): `share_target` en `manifest.json`; lo compartido llega como `index.html?title=…&text=…&url=…` y `shareIn` busca un DOI, un ISBN o el título y abre Importar.
- **Soltar archivos** en la ventana: .bib, .ris, .txt o CSL-JSON abren Importar; un .json de la aplicación se abre como proyecto (con su enlace al archivo en Chrome/Edge).
- **CSL-JSON**: se importa (`parseCsl`) y se exporta (formato «CSL-JSON» en Exportar, `cslJSON`).

## Motor, avisos, teclado y más (v38.2, fase C)
- **Copias por papers** (`snapDb` en js/persistencia.js): cada copia para deshacer es `{head, parts}` con el JSON de cada paper aparte (sin historial y con las imágenes como huella); lo que no cambió reutiliza la misma cadena. Con 2000 papers, las 50 copias de deshacer pasan de ~183 MB a ~4 MB, y un cambio en un móvil medio, de ~285 a ~140 ms (la copia de trabajo reutiliza la copia recién hecha, `SNAP_SES`; al ocultar o cerrar la app se escribe siempre entera). Deshacer conserva el historial del día.
- **Avisos y confirmaciones propios** (`say`, `askOk` en js/modelo.js) en lugar de `alert` y `confirm`; eliminar un paper ya no pregunta: va a la papelera con «Deshacer» en el aviso. Las pruebas contestan solas con `window.ASK_AUTO`.
- **Teclado**: ↑/↓ (o j/k), Intro, Espacio y Supr en la lista; **paleta de órdenes** con Ctrl+K (configurable) para acciones y papers.
- **Duplicados aproximados**: títulos casi iguales (Dice de bigramas ≥ 0,9, mismos números, años a ±1) al importar («Parecido», desmarcado) y en «Buscar duplicados» («título parecido»).
- **Completar con OpenAlex** (botón junto al DOI en Datos): resumen y número de citas a las notas generales y PDF en abierto como URL.
- **Tema claro u oscuro a mano** (Configuración → Apariencia → Paleta): Automático, Claro u Oscuro, de cada dispositivo (`gp-theme`).

## Barras de una línea en escritorio (v38.3)
- En ventanas estrechas del navegador (no en móvil), la cabecera y la fila de «Nuevo paper» ya no saltan de línea: `fitBars` (js/lista.js) añade la clase `cmp` si no caben, y algunos botones quedan solo con su icono (el texto completo sigue en su título). Si aún falta sitio, el nombre del proyecto se corta con «…», la búsqueda se estrecha y las etiquetas de la fila se desplazan en horizontal (también con la rueda).

## Visor de PDF, bandeja «PDF por citar» y Drive normal (v39.0)
- **Visor propio** (botón 📄 de la tarjeta o de la ficha): PDF.js 4.10 en `lib/pdfjs/`, cargado solo la primera vez que abres un PDF (no pesa al arrancar). Pinta solo las páginas que se ven, libera las lejanas y limita el tamaño del lienzo en móviles. Zoom con Ctrl + rueda, botones o pellizco; ir a página; buscar (Ctrl + F); el botón «atrás» del móvil lo cierra. Recuerda la página donde lo dejaste.
- **Anotar**: selecciona texto y elige un color (amarillo, verde, azul, rojo, morado), o usa las herramientas Subrayar (arrastrar), Zona (rectángulo) y Nota (toque). Cada anotación admite un comentario, se puede recolorear, copiar, borrar (Ctrl + Z deshace) y mandar «A las notas» del paper con la página. El panel 💬 las lista por página, filtra por color o «con comentario» y exporta a Markdown.
- **Dónde se guardan**: dentro de la biblioteca, en `pdf.ann` de cada paper (coordenadas en el espacio del PDF, independientes del zoom). Viajan con la sincronización y se fusionan anotación por anotación entre dispositivos. El PDF de la carpeta oculta sigue siendo el original.
- **Acrobat y Foxit**: «⬇ PDF anotado» escribe con pdf-lib (`lib/pdf-lib.min.js`) anotaciones estándar (Highlight con QuadPoints y apariencia, Text para las notas, comentario en Contents con ventana Popup). Reescribirlo solo cambia las de GPapers (`NM gpapers-…`) y respeta las que ya traía el PDF. Las anotaciones que el PDF ya traía se ven en el visor y se pueden «hacer editables».
- **Bandeja «PDF por citar»** (sección de la portada, uno a uno; también desde Importar, el menú ⋯ o soltando PDF): lee el DOI y adivina el título; «Crear cita» la busca en CrossRef y crea el paper con el PDF ya enlazado, o «Asignar a un paper» existente. Se puede ocultar en Configuración.
- **Drive normal (opcional)**: en Configuración → Datos, «Guardar también los PDF en mi Drive normal» (y, por PDF, en la ficha) sube una copia anotada a la carpeta visible «GPapers», con nombre «Apellido Año - Título.pdf». Pide una vez el permiso `drive.file` (no sensible: no necesita verificación de Google, pero hay que añadirlo a la pantalla de consentimiento OAuth). Solo se vuelve a subir si cambian las anotaciones.
- Desde `file://` el visor propio no puede cargar sus módulos: el PDF se abre en el visor del navegador.
- Archivos nuevos: `js/visor.js`, `js/bandeja.js`, `visor.css`, `lib/`. Pruebas: `pruebas/prueba_visor.py` (con `pruebas/prueba.pdf`).

## Resumen de anotaciones (v39.7)
- **Exportar → «🖍 Resumen de anotaciones…»**: para los papers seleccionados, los visibles con los filtros o todos, la cita completa en el estilo de Exportar y debajo sus subrayados (con comentario), zonas y notas, por página y de arriba abajo. Se descarga en Word (.docx), PDF (pdf-lib, letra Times) o Markdown. Código en `js/resumen.js`; el paquete .docx se comparte con Exportar (`docxPack`).

## Anotaciones de otros programas (v39.6)
- Al abrir un PDF con anotaciones nuevas hechas en Acrobat, Foxit u otro lector, avisa: «Hay N anotaciones nuevas hechas en otro programa: ¿traerlas?». «Traer» las hace editables; «Ahora no» no vuelve a preguntar por esas (se recuerda en el dispositivo). No cuentan las que escribió GPapers (autor «GPapers») ni las ya traídas.
- Los avisos con botones («Deshacer», «Traer»…) se ven y se pueden pulsar también con el visor o una ficha abiertos.

## Visor: índice, páginas, modo noche (v39.5)
- **Panel con pestañas**: 💬 Anotaciones, 📑 Índice (el marcador o «outline» del PDF, con niveles; en el móvil, hoja desde abajo que se cierra al saltar) y ▦ Páginas (miniaturas pequeñas, pintadas al verlas). Botón 📑 en la barra de herramientas.
- **Notas aparte**: la lista separa 🖍 Subrayados (y zonas) de 🗒 Notas, con filtro por tipo.
- **Borrar varias**: con «☐ Elegir», «☑ Todas las de la lista» y «🗑 Borrar (N)», con un solo «Deshacer».
- **🌙 Modo noche** (⋯): PDF.js pinta el texto y los trazos con colores oscuros (`pageColors`) y deja las imágenes como son. Se recuerda en este dispositivo; también «como el sistema».

## Bandeja 🗃️ (v39.4)
- La bandeja «PDF por citar» lleva el icono 🗃️ (sección, botón de la cabecera y menús).
- **Crear todas las citas**: con varios PDF con DOI, las busca a la vez en CrossRef y crea los papers; las que fallan (o ya estaban, o sin DOI) se quedan en la bandeja y se dice cuáles. Un solo «Deshacer».
- **Duplicados**: si el DOI ya es un paper de la biblioteca, avisa («Ya tienes este paper: …») con «🔗 Enlazar a ese paper»; «Crear cita» pregunta antes de duplicarlo.

## Google Drive más rápido (v39.3)
- **Cambiar de proyecto sin esperar**: el proyecto que dejas se guarda aquí al momento y sus cambios se suben a Drive en segundo plano (`syStored`, fusionando con lo que haya llegado de otros dispositivos); el nuevo se abre enseguida. Al arrancar, se suben también los de otros proyectos que no llegaron a Drive.
- **Primero las citas**: cada vuelta lista solo los archivos del proyecto abierto (la limpieza de proyectos borrados, una vez al día); las imágenes que ya están en este dispositivo no se vuelven a descargar, y los PDF van después, en cola.

## Móvil y bandeja (v39.2)
- **Zoom nítido**: con mucho zoom, la página entera no cabe en memoria a resolución completa (`vwMaxPx`); al parar, se repinta a resolución completa solo el trozo que se ve (`vwDetail`).
- **Panel de anotaciones en el móvil**: hoja desde abajo (antes salía fuera de la pantalla, porque es un `<aside>` y heredaba el estilo del menú lateral).
- **Tocar para leer**: las notas 🗒 se abren con el dedo y son más grandes; los subrayados con comentario llevan 💬; con el dedo hay más margen para acertar.
- **Botón «atrás» del móvil**: cierra la ventana o el menú abiertos (ficha, Configuración, Exportar, menú lateral…) en lugar de salir de la aplicación.
- **Bandeja «PDF por citar»**: por defecto debajo de la lista (Configuración: encima); opción de mostrarla solo con el botón 📄 N de la cabecera; «🖍 N anotaciones · ver» abre el PDF con la lista de anotaciones.

## Pestaña aparte, otras apps, comentarios y más (v39.1)
- **Visor en otra pestaña** (ordenador): 📄 abre el visor en una pestaña nueva para seguir usando la aplicación a la vez (Configuración → Datos: «en una pestaña nueva» o «dentro de la aplicación»; Ctrl + clic hace lo contrario; en móvil y tableta, siempre dentro). La pestaña del visor (`index.html?vw=…`) no guarda por su cuenta: manda cada cambio de las anotaciones a la principal por `BroadcastChannel('gpapers-vw')` y recibe lo que cambie allí (deshacer, Drive). Si la principal se cierra o cambia de proyecto, el visor pasa a guardar él mismo; al volver a abrir la aplicación, le devuelve el proyecto.
- **Abrir en otra app** (⋯ del visor): con el menú «Compartir» del sistema (Acrobat, Drive, Foxit…), el PDF tal cual o con las anotaciones; sin él, el visor del navegador.
- **Sacar los comentarios** (panel 💬): 📋 Copiar, 📝 A las notas y ⬇ .md, en formato texto, Markdown o con la cita en el texto («…» (Pérez, 2024, p. 3)); con todas, una sola nota «Anotaciones del PDF» por PDF que se actualiza; con un filtro o «Elegir», una nota nueva. Opción «Mantener al día» (Configuración) y botón «📄 Traer anotaciones del PDF» en la ficha.
- **Copiar o mover a otro proyecto** también desde el menú ▾ del proyecto; los PDF enlazados (y sus anotaciones) viajan con el paper.
- **Google Drive**: el botón dice si hay sesión (en el móvil se lee en ⋯) y Configuración → Datos tiene «Sincronizar ahora» y «Cerrar sesión». Cambiar de proyecto es más rápido: los cambios e imágenes se descargan a la vez y los PDF se suben después, sin hacer esperar; el menú 🔄 dice cuánto tardó la última vuelta.

## Sincronización con Google Drive, Privacidad y Créditos (F14)
- **Final de la barra lateral**: Papelera, Configuración, una línea, «ℹ️ Información» (Ayuda y Créditos, discretos y plegada por defecto; se recuerda si la abres) y, siempre visible y con la misma letra, una línea que explica qué es la app con el enlace **Política de privacidad** (v31.1: sustituye al botón Privacidad; Google lo pide en la página principal para verificar la marca).
- **©️ Créditos** (barra lateral, en «Información»): dirección, desarrollo, derechos (licencia CC BY-SA) y la versión de la aplicación.
- **Icono 🔄 a la izquierda de 💾** (sin conectar muestra «Conectar con Google Drive»): guarda la biblioteca entera (papers, notas, secciones, etiquetas, papelera y ajustes) en la carpeta oculta `appDataFolder` del **propio Google Drive** de cada persona, como en Supuestos C1 (permiso `drive.appdata`: la app no ve el resto del Drive; sin servidor intermedio). Archivos (todos `gpapers-…`): ver «Solo cambios» abajo.
- **Autoguardado activado al conectar**: cada cambio se sube a los 3 s; al abrir la app, al volver a ella y cada 5 min se traen los cambios de los otros dispositivos. La casilla «Autoguardado» lo activa o desactiva (con Drive funciona en cualquier navegador, también en el móvil). El punto del icono indica el estado (verde, azul girando, amarillo, rojo).
- **Con la sesión iniciada, clic en 🔄**: sincronizar ahora, autoguardado en Drive, ¿cómo funciona?, **cerrar sesión** y **borrar mis datos de Google Drive** (Privacidad está en la barra lateral) (solo en ese dispositivo; los demás siguen sincronizando).
- **Fusión a tres bandas** con la última versión sincronizada (guardada en IndexedDB): altas, ediciones y borrados de cada dispositivo se combinan paper a paper y campo a campo (notas una a una); si los dos cambian el mismo campo gana el paper modificado más tarde; una edición gana a un borrado. La vista (tarjetas/tabla) es de cada dispositivo. Lo que llega de Drive se puede deshacer. Con una ventana de edición abierta se espera a que se cierre.
- **Primera vez con datos en los dos lados** (o al abrir otro archivo con la sesión iniciada): pregunta si combinar, usar la de Drive o la de este dispositivo. Si aquí solo está el ejemplo, manda Drive sin preguntar.
- **Solo cambios (F15)**: en Drive hay una copia completa (`gpapers-snap.json`), un archivo pequeño por cada autoguardado con solo lo que cambió, campo a campo (`gpapers-d-<hora>-<dispositivo>.json`), y cada imagen incrustada aparte, una sola vez (`gpapers-img-<huella>`; en la biblioteca solo queda la huella). Con 25 cambios sueltos se rehace la copia completa y se borran; las imágenes sin usar se borran pasado un día. Lo descargado se guarda en IndexedDB (`syncCache`): cada vuelta pide solo la lista de archivos y los nuevos. Lo que pasa de 4 MB se sube con la **subida reanudable** de Drive (sin el límite de 5 MB y sin configurar nada). La copia de un solo archivo de la versión anterior (`gpapers-sync.json`) se lee y se convierte sola.
- **El acceso de Google dura 1 hora** (mismo arreglo que Supuestos C1): sin servidor propio solo se renueva abriendo la ventana de Google, que el navegador bloquea si no la provoca un clic. El acceso se guarda en localStorage (compartido entre pestañas y válido al reabrir mientras no caduque); al caducar se intenta renovar una sola vez sin ventana (y no desde cada pestaña: `gp-sync-try`) y, si no se puede, el punto se pone amarillo y se reconecta con el **siguiente clic o tecla** en cualquier parte. Los cambios esperan en el dispositivo y se suben al reconectar.
- **Política de privacidad** (enlace al final de la barra lateral; abre la ventana de Privacidad): qué datos se tratan, cuándo sale algo a internet, el permiso de Drive, cómo cerrar sesión, **borrar la copia de Drive** y retirar el permiso. Versión enlazable en `privacidad.html` (para la pantalla de consentimiento de Google).
- **Configuración (v31)**: el ID de cliente OAuth está en `SY_CFG` (js/drive.js) y es el del proyecto propio de Google Cloud «Gestor de papers» (origen autorizado `https://rmalump.github.io`, permiso `drive.appdata`). El acceso guardado va ligado a ese ID: al cambiarlo, los dispositivos que estaban conectados con el anterior ven un aviso «Conectar» y dan permiso una vez (la carpeta oculta es otra; sus datos siguen en el dispositivo y se suben). La página principal muestra qué es la app y enlaza la política de privacidad, como pide Google para verificarla. `google415a4e3d6145dca0.html` es el archivo de verificación de Google Search Console (el mismo de Supuestos C1) para verificar `https://rmalump.github.io/GPapers/`.

## Licencia
[Creative Commons Reconocimiento-CompartirIgual 4.0 Internacional (CC BY-SA 4.0)](https://creativecommons.org/licenses/by-sa/4.0/deed.es): texto completo en `LICENSE`. Dirección: R.M.P. · Desarrollo: Vibe Coding con Claude.

## Clasificaciones para ordenar (v39.16)
En **Gestionar etiquetas** o **Gestionar secciones**, «＋ Nueva clasificación» crea un criterio de orden propio (p. ej. «Días»), con valores en **números** (1, 2, 3…), **letras** (A, B, C…; AA va tras Z), **números romanos** (I, II, III…; solo bien escritos) o **texto libre**. Puede haber varias a la vez, de etiquetas y de secciones.
- Con una clasificación elegida, cada etiqueta o sección tiene una casilla para su valor (en rojo si no se entiende, p. ej. «IIII»).
- **Ordenar**: cada clasificación sale como criterio (🏷️ o 📁 + su nombre). Cada paper usa el valor más bajo de sus etiquetas o secciones; los que no tienen ninguna con valor van al final, en ambos sentidos. «⇅ Ordenar los papers por…» lo aplica directamente y «Ordenar también esta lista» reordena las propias etiquetas o secciones.
- Se guardan en el JSON del proyecto (`orders`: `{id, name, of: 'tags'|'sections', fmt: 'num'|'alpha'|'roman'|'text'}`; cada etiqueta o sección, en `rk: {idClasificación: valor}`) y se sincronizan con Google Drive valor a valor. Las vistas ⭐ las recuerdan.

## Columnas de la tabla (v39.17)
- **Ordenar desde la cabecera**: un clic en cualquier cabecera ordena por esa columna (otro clic invierte el sentido), también **Secciones** y **Etiquetas**. Estas dos usan tus **clasificaciones** (Gestionar etiquetas/secciones): la de más arriba manda y las de debajo desempatan; «⬆ Subir» cambia cuál va primero. Después, el orden de la lista de Gestionar. Los papers sin ninguna, siempre al final. Ambas están también en «Ordenar» (v39.18).
- **Mover columnas**: en el ordenador, arrastra una cabecera y suéltala sobre otra (a su izquierda o derecha), o usa el clic derecho → «Mover a la izquierda/derecha». En la lista de columnas, ↑ y ↓ las mueven también.
- **Ocultar columnas**: clic derecho en una cabecera → «Ocultar esta columna», o desmárcala en la lista «Columnas que se ven». El título siempre se ve. «Restablecer las columnas» vuelve a lo de siempre.
- **En el móvil**: botón **⚙** pequeño en la barra de Tarjetas (solo en la vista de tabla), con toques normales: nada se abre por una pulsación larga ni por tocar la cabecera. Cada fila es una ficha de tres líneas: título; autores · año · revista; y el resto de columnas. Muestra solo las columnas visibles, en tu orden (v39.20).
- Las columnas se guardan en el JSON, pero son de cada dispositivo (no se sincronizan), como la vista de tarjetas o tabla.

## Notas del paper dentro del visor de PDF (v39.19)
- En la barra del visor, **📝 Notas** abre la ficha del paper en «Notas» (nota general y notas por sección), con todo el editor: formato, listas, plantillas, enlaces, añadir o quitar notas, cambiar su sección y «Traer anotaciones del PDF». También están las demás pestañas de la ficha.
- **En el ordenador y la tablet**, las notas ocupan la mitad derecha y el PDF sigue a la izquierda: se puede leer, desplazar y subrayar mientras escribes.
- **En el móvil** ocupan toda la pantalla, menos la barra del visor. **📄 Ver el PDF** (o 📝) va al PDF y vuelve a las notas sin perder lo escrito.
- Al cerrar el panel (otro toque en 📝, Esc o «Guardar paper»), o al salir del visor, se guarda. «Cancelar» descarta los cambios.

## Móvil: arrastrar entre secciones y menú de ☑ (v39.21)
- **Arrastrar con el dedo** (vista agrupada por sección, tarjetas o tabla): mantén pulsado un paper medio segundo sin mover el dedo, sale su etiqueta y luego lo llevas a otra sección (o a «Sin sección»). Cerca del borde, la lista se desplaza sola. Si mueves el dedo enseguida, solo desplazas la lista.
- **☑ con menú**: clic derecho (en el móvil, mantener pulsado) en ☑ para elegir: los que se ven o todos los del proyecto. Con algo elegido, también lo del grupo «Selección»: lectura, valoración, etiqueta, sección, exportar citas, mover o copiar a otro proyecto, enviar a la papelera y quitar la selección (v39.22). Un toque normal sigue eligiendo los que se ven.
- **Tabla del móvil más compacta** (v39.22): menos aire y letra y botones algo más pequeños; cada ficha ocupa ~20 % menos.

## Más apretado y vista partida ajustable (v39.23)
- **Tabla del móvil en dos líneas**: título; y debajo autores · año · revista seguidos de lectura, estrellas, etiquetas y notas (las etiquetas se recortan primero).
- **Visor + notas: divisor arrastrable** entre el PDF y las notas para repartir el espacio (del 20 % al 80 %; se recuerda en el dispositivo). Doble clic: mitad y mitad. También con las flechas del teclado.
- **Tablet en vertical**: vista partida con el PDF arriba y las notas abajo, con el mismo divisor (arrastrar arriba o abajo). Desde v39.24 depende del tamaño de la pantalla (lado corto de unos 600 px o más, ≈ 7″): también en tablets que usan el modo móvil de la app. En un teléfono las notas siguen a pantalla completa.

## Orden manual, posiciones guardadas y secciones plegables (v39.25)
- **Colocar papers a mano**: arrastra un paper sobre otro (mitad de arriba: delante; de abajo: detrás). En el móvil, mantén pulsado medio segundo y mueve el dedo; una línea marca dónde caerá. Funciona en tarjetas y tabla, agrupado por sección (cada sección tiene su propio orden) o sin agrupar. Soltarlo sobre un paper de otra sección lo cambia de sección y lo deja en ese sitio.
- Al colocar uno, el orden pasa a **«Orden manual (arrastrando)»**, que parte del orden que se veía. Se puede elegir otro orden y volver a éste sin perderlo. Los papers nuevos van al final de su sección.
- **📌 Posiciones guardadas…** (un solo botón en «Vistas ⭐», en la barra lateral; hasta v39.26 estaba bajo «Ordenar»): guarda con un nombre cómo están colocados ahora los papers, para volver a ese orden después, o borrarlo con ✕. Se sincroniza con Drive.
- **Secciones plegables** (vista agrupada): clic o toque en el título de la sección la pliega o despliega (▾/▸, sigue mostrando cuántos papers tiene). «Plegar todas» y «Desplegar todas» en el menú de Secciones. Se recuerda en cada dispositivo.

## Tablet en horizontal: Sección y Etiquetas como en el móvil (v39.26)
- En **cualquier pantalla táctil** (también una tablet en horizontal, que no usa el modo móvil), tocar **Sección** o **Etiquetas** abre el mismo menú que en el móvil: mostrarlas debajo, agrupar (y plegar o desplegar todas), cómo combinar etiquetas, elegir con el número de papers de cada una, y gestionar.
- Las filas de secciones y de etiquetas van **debajo de la barra**, en varias líneas, en vez de una sola fila que se desplaza de lado.
- En el ordenador con ratón todo sigue igual (clic: mostrar u ocultar la fila; clic derecho: su menú).
- Arreglo: el botón «Guardar» de 📌 Posiciones guardadas no se veía.

## Posiciones guardadas, dentro de Vistas (v39.27)
- El botón **📌 Posiciones guardadas…** pasa de «Ordenar» a la sección **Vistas ⭐** de la barra lateral, debajo de la lista de vistas: las dos cosas sirven para volver a algo guardado.

## Fila de filtros aplicados más compacta (v39.28)
- En el móvil, la fila «Filtros: … ✕ · Limpiar todo» es más baja (botones de 26 px en vez de 34 px, letra algo menor) y casi sin margen arriba y abajo.
- En el móvil, el aviso «Aún no hay etiquetas.» (o secciones) de la fila de arriba es una línea fina, más pequeña y sin hueco alrededor.
- Con filtros aplicados, la primera sección de la lista queda pegada a esa fila (sin el hueco de 20 px de encima del título), también en el ordenador.

## Fila de filtros aún más fina en el móvil (v39.29)
- Los botones de «Filtros: … ✕ · Limpiar todo» miden 20 px de alto (antes 26 px) con letra de 11,5 px, y la fila casi no tiene margen.
- Con filtros aplicados, la cuenta «4 de 6 · 0 sel.» pasa a la derecha de la fila de filtros, en vez de ocupar una línea propia debajo de los botones.

## Varias secciones a la vez, arrastrar la selección y fila que no tapa (v39.30)
- **Filtro de secciones con varias a la vez**, como las etiquetas: cada sección que pulsas se añade o se quita, y se ven los papers que están en cualquiera de ellas. «Todas» quita el filtro. En el móvil, el menú de «Sección» se queda abierto para marcar varias. Las vistas guardadas recuerdan todas las secciones elegidas (las de versiones anteriores, con una sola, siguen funcionando).
- **Arrastrar varios papers a la vez**: si arrastras un paper que está seleccionado a otra sección (vista agrupada, en el ordenador o en el móvil), se mueven todos los seleccionados, con sus notas; un solo Ctrl+Z lo deshace. En el orden manual, los seleccionados se colocan juntos.
- **En el ordenador, las secciones y etiquetas de la fila de arriba ya no quedan tapadas**: si no caben en la fila, pasan debajo en varias líneas, como en el móvil; si caben, siguen en la misma fila.

## Edición, etiquetas en la tabla, panel de ☑ y portada del PDF (v39.31)
- **Al editar** («Ver todo» y la pestaña de clasificación), el bloque **Secciones** va justo después de **Cita** y antes de **Etiquetas**.
- **Tabla en el ordenador**: un clic en la celda de etiquetas abre un menú con todas las etiquetas (y un buscador si hay más de 8). Cada clic pone o quita una y el menú sigue abierto. Arrastrar una etiqueta de la barra lateral a una fila sigue funcionando.
- **Panel de ☑ Visibles** (clic derecho, o mantener pulsado en el móvil) más compacto y visual, con todo lo del grupo «Selección» de la barra lateral (que se queda como estaba): la lectura en botones, la valoración con estrellas, las etiquetas y secciones como chips (llenos si las tienen todos los elegidos, a rayas si solo algunos; pulsar pone a todos o quita), y Exportar, A otro proyecto, Papelera y Quitar selección. Los cambios se aplican al momento y el panel no se cierra.
- **Portada del PDF**: un paper sin imagen y con PDF muestra en las tarjetas y la tabla la primera página de su primer PDF, como la bandeja. Se saca sin pedir nada (del archivo si ya hay permiso o de la copia del navegador) y se guarda en este navegador; si no se puede leer todavía, sale la primera vez que abres ese PDF. Si cambias el PDF, se saca la nueva. Una imagen propia siempre manda, y «Mostrar la imagen del paper» la oculta también.

## Barra lateral ordenada (v39.32)
- **Selección** sale arriba del todo (justo bajo Buscar) al marcar papers, en un panel compacto con el mismo diseño que el de ☑ Visibles: lectura en botones, estrellas, etiquetas y secciones como chips (a rayas si solo las tienen algunos) y Exportar, A otro proyecto, Papelera y Quitar selección.
- **Ordenar ⇅** sale de Buscar y tiene su propia línea, que muestra el orden actual («Título ▲ · por sección»); al pulsarla se despliega.
- **Filtros con el mismo diseño**: cabeceras iguales con iconos (📄 notas, ✎ gestionar) y la valoración mínima (⭐) y los años (📅) juntos en una sola línea compacta.
- **Vistas y posiciones en una lista**: «＋ Guardar» pregunta si guardar una ⭐ Vista (búsqueda, orden y filtros) o unas 📌 Posiciones (cómo están colocados los papers); las dos salen en la misma lista.
- **Pie fijo** (ordenador): Relaciones, Papelera, Configuración e Información son una fila de iconos que se queda siempre al fondo de la pantalla, aunque la lista sea muy larga; lo de arriba se desplaza por su cuenta. El texto legal va más pequeño debajo.

## Pie de la barra lateral adaptable (v39.33)
- El pie (Relaciones, Papelera, Configuración e Información) sigue fijo al fondo de la pantalla, pero **se ve como antes, cada uno en su línea y con su nombre, mientras todo cabe**. Solo cuando lo de arriba no cabe (grupos desplegados, muchas etiquetas, la Selección…) se junta en una fila de iconos, y vuelve a la lista al plegarlos. Se mide siempre con el pie normal, así que no parpadea en el límite.
- Con la barra plegada (☰) sigue la columna de iconos, y en el móvil el cajón va siempre con el pie normal.

## Sincronización tras cambiar la paleta (v39.34)
- Al elegir la **paleta personalizada** (o cambiar uno de sus colores) la cabecera se quedaba en «Sin guardar…» aunque el cambio ya estaba en Google Drive. Pasaba cuando ese ajuste se añadía después de otro ajuste propio del dispositivo (p. ej. las columnas de la tabla): la copia era la misma, pero con los campos en otro orden, y la comparación final no la daba por guardada. Ahora se compara la copia normalizada y vuelve a decir «Guardado en Google Drive».

## Revisión de seguridad, fallos y rendimiento (v39.35)
- **Seguridad**: los identificadores de un archivo JSON o de Google Drive (papers, etiquetas, secciones, notas, plantillas, clasificaciones, anotaciones) solo admiten letras, números, «_» y «-»; cualquier otro se cambia por su huella, con todas sus referencias. Los colores de etiquetas y secciones se validan. Además, los `data-on…` solo pueden llamar a funciones de la aplicación: ni `window`, ni `document`, ni el almacenamiento, ni funciones del navegador. Un archivo preparado ya no puede ejecutar nada al abrirlo.
- **Notas**: una línea con muchas marcas sin cerrar (`* * * …`) ya no bloquea la página (el analizador recuerda lo que ya probó).
- **Proyectos**: si la copia de trabajo de un proyecto no se puede leer, se aparta sin pisarla, se avisa y la sincronización deja de entender que se han borrado sus papers. Si la copia de trabajo no se puede guardar (sin espacio), ahora se avisa.
- **PDF**: una limpieza diaria borra de este navegador las copias, enlaces y portadas de PDF (y enlaces de imagen) que ya no usa ningún proyecto ni copia de seguridad; también al borrar un proyecto y en «Borrar datos de este navegador». Al fusionar duplicados y al citar desde la bandeja, el PDF conserva su archivo (también al deshacer).
- **Guardar**: un cambio hecho mientras se escribe el archivo ya no queda marcado como guardado.
- **Rendimiento**: la vista agrupada pinta las secciones largas por partes; las etiquetas de las tarjetas se colocan midiendo todas a la vez; «citado por» se calcula una vez por pintado; al escribir en un campo, la copia para deshacer se hace al parar; la sincronización con imágenes incrustadas trabaja con sus huellas; el grafo de relaciones hace menos pasadas con muchos nodos; subidas y borrados de Drive van varios a la vez; la limpieza de imágenes pasa a ser diaria.
- **Detalles**: BibTeX escapa `\`, `~`, `^` y las llaves sueltas, y las claves repetidas siguen tras la «z» (aa, ab…); Word ya no recibe caracteres de control; el orden manual se sincroniza sección a sección; la tarjeta se recoloca al cambiar una etiqueta si se filtra u ordena por etiquetas.

## Visor: modo de lectura (v39.39)
Todo está en un submenú: **⋯ del visor → 📖 Modo de lectura** (el menú muestra el modo actual; «‹ Volver» regresa a ⋯). Se recuerda en este dispositivo (`gp-vw-read` y `gp-vw-auto` en localStorage).
- **Doble página**: las páginas de dos en dos, como un libro abierto, ajustadas al ancho. «La primera página sola (portada)» deja la 1 sola y empareja 2-3, 4-5… → y ← pasan de par en par.
- **Página a página, con toques a los lados**: solo se ve la página actual (o el par, con doble página), entera en la pantalla. Un toque (o clic) en el 30 % izquierdo o derecho pasa a la anterior o la siguiente, también fuera de la página; el centro sigue como siempre (subrayar, abrir anotaciones, toques de pantalla completa). También ← →, y RePág/AvPág al llegar al borde. Buscar, el índice y las anotaciones saltan a su página.
- **⏬ Desplazamiento automático**: la página baja sola. Abajo sale una barra con **⏸ pausa**, 🐢 **barra de velocidad** (1 a 20) 🐇, el número de la velocidad y ✕ para parar. **Toques en la página**: centro, pausa o sigue; izquierda, más despacio; derecha, más deprisa. La barra espaciadora pausa. Espera mientras tienes el dedo en la pantalla y sigue desde donde lo dejes; al final del PDF se pausa. La velocidad va en puntos del PDF por segundo, así que no cambia al hacer zoom. Usa la vista seguida (si estaba en página a página, cambia a ella).
- Pruebas: `python3 pruebas/prueba_visor_lectura.py .`

## Visor: recorte de márgenes, marcadores y gestos de zoom (v39.40)
- **✂ Recortar los márgenes (automático)**, en **⋯ → 📖 Modo de lectura**: mide dónde hay texto o imágenes en unas cuantas páginas repartidas por el PDF y quita el blanco de alrededor, con el mismo recorte para todas (la página no baila al pasar; una página distinta, como una portada a sangre, no lo estropea). Al ajustar al ancho la letra se ve más grande. Funciona con una página, doble página, página a página y el desplazamiento automático; los subrayados, notas y la búsqueda siguen en su sitio. Se recuerda en el dispositivo.
- **🔖 Marcadores**, en **⋯ → 🔖 Marcadores**: marcar o quitar la página actual, ir al anterior o al siguiente y la lista para saltar a cada uno; «Quitar todos». Atajos: **B** marca o quita, **[** y **]** van al anterior y al siguiente. Las páginas marcadas llevan 🔖 arriba a la derecha. Se guardan con el PDF del paper (campo `bm`), así se sincronizan con Drive y se pueden deshacer.
- **Gestos de zoom**, en **⋯ → 📖 Modo de lectura → Gestos de zoom**: **🤏 pellizcar con dos dedos** y **👆 doble toque** (acerca unas dos veces donde tocas; otro doble toque vuelve a ajustar). Los dos vienen activados y se pueden quitar. En pantalla completa el doble toque sigue sacando los colores.
- Pruebas: `python3 pruebas/prueba_visor_extras.py .`
