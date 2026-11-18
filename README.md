# Gestor de papers

Aplicación web sin dependencias ni compilación (HTML + CSS + JS). Sirve igual desde GitHub Pages que en local.
Las novedades de cada versión están en [CHANGELOG.md](CHANGELOG.md).

## Qué hace
- **Biblioteca de papers por proyectos**, con secciones, etiquetas, estados de lectura, valoración, notas con formato, relaciones («cita a», relacionados) y papelera.
- **Añadir papers** por DOI (CrossRef, DataCite, Zenodo y cualquier agencia vía doi.org), arXiv, PubMed, ISBN o título; importar BibTeX, RIS, ScienceDirect o citas de Google Scholar; compartir un PDF o un EPUB a la app.
- **Citas** en APA 7, Vancouver, MLA, IEEE, Chicago, UNE-ISO 690, Derecho y estilos propios; clave de cita fija para LaTeX y Pandoc; exportar a Word, BibTeX, RIS y Markdown para Obsidian.
- **Visor de PDF y lector de EPUB** con subrayados, notas, lápiz, marcadores, modo de lectura, leer en voz alta y búsqueda de órdenes (Ctrl+K); búsqueda dentro del texto de todos los documentos desde la lista.
- **OpenAlex**: resumen y citas, papers retractados, relaciones entre tus papers, lo que te falta y papers parecidos.
- **Lectura**: «Seguir leyendo», repaso diario de subrayados y estadísticas (tiempo, páginas, racha).
- **Google Drive** (opcional, en la carpeta privada de la app) para usarla en varios dispositivos; funciona sin conexión como app instalada o como APK de Android.

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

## App Android (APK)
La carpeta `android/` es una app Android (Trusted Web Activity) que abre `https://rmalump.github.io/GPapers/` con Chrome a pantalla completa, con su icono y sin barra de dirección. No lleva copia de la web: cada versión nueva de la web llega sola a la app, así que el APK solo hay que volver a compilarlo si cambia el nombre, el icono o la dirección (subir `versionCode` y `versionName` en `android/app/build.gradle`).
- **Verificación**: `https://rmalump.github.io/.well-known/assetlinks.json` (en el repositorio `rmalump.github.io`) lleva la huella SHA-256 de la clave de firma. Sin él, la app funciona igual pero muestra una barra con la dirección arriba.
- **Firma**: la clave (`gpapers.jks`) no está en el repositorio. Hay que usar siempre la misma, porque con otra el móvil no deja actualizar la app instalada.
- **Compilar**: `cd android && GPAPERS_KEYSTORE=ruta/gpapers.jks GPAPERS_KEYSTORE_PASSWORD=… gradle assembleRelease` (Android SDK 36). El flujo `.github/workflows/apk.yml` hace lo mismo en GitHub y publica el APK en «Releases» si existen los secrets `GPAPERS_KEYSTORE_BASE64` y `GPAPERS_KEYSTORE_PASSWORD`; sin ellos no hace nada.
- **Instalar**: abrir el `.apk` en el móvil y permitir «instalar apps de origen desconocido».

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

## Datos de la aplicación (PWA) y actualizaciones (F13)
- Además del JSON, la app guarda en IndexedDB una **copia de la sesión** (tus datos tal como están, aunque no hayas guardado) y el **estado de la interfaz** (filtros, orden, barra lateral, bloques plegados). Al reabrirla sigues donde lo dejaste y, si había cambios sin guardar, te lo avisa. El JSON sigue siendo el archivo original: guarda para escribir en él (si recuerda el archivo, pide permiso).
- Estos datos viven **fuera de la caché del service worker**, así que las actualizaciones no los tocan: **no hace falta borrar los datos de la aplicación** para recibir una versión nueva. El service worker sirve la app **desde la caché de su versión** (v37.6: abre al instante aunque la red sea lenta o no haya), busca versiones nuevas al abrir, al volver a la app y cada 30 min, las descarga enteras por detrás y avisa con «Recargar ahora» (guarda la copia de sesión antes de recargar).
- La versión está en `APP_V` (app.js) y en `papers-vNN` (sw.js): **súbelas juntas** en cada publicación (si no cambian, los dispositivos instalados no ven la versión nueva). En Ayuda → «Aplicación instalada» hay botones para buscar actualizaciones y olvidar la copia de sesión.

## Código
Sin compilación: `index.html` carga scripts clásicos en este orden (comparten el ámbito global, así que la app sigue funcionando desde `file://`), y `sw.js` los guarda en el mismo orden:
`js/modelo.js` (modelo de datos y utilidades), `js/citas.js` (estilos de cita, tipos y estilos propios), `js/persistencia.js` (abrir, guardar, deshacer), `js/importar.js`, `js/config.js` (atajos, configuración, ayuda), `js/lista.js` (lista y exportar), `js/edicion.js` (edición, notas, relaciones, papelera, historial), `js/drive.js` (Google Drive), `js/extras.js` (PWA, duplicados, PDF, proyectos, copias), `js/visor.js`, `js/visor-anotar.js`, `js/visor-mas.js` y `js/visor-modos.js` (el visor de PDF repartido en cuatro: abrir, páginas y zoom · anotaciones, selección, panel y búsqueda · menú ⋯, notas al lado, PDF anotado, pestaña aparte y pantalla completa · modo de lectura, ajustes, recorte, marcadores y gestos), `js/bandeja.js` (bandeja «PDF por citar» y copia en el Drive normal), `js/epub.js` (lector de EPUB), `js/lectura.js` (más del visor: enlaces y vista previa, pantalla encendida, resultados de la búsqueda, colores con significado, estilos, recorte y giro, leer en voz alta, lápiz, los dos PDF a la vez, estadísticas de lectura y Ctrl+K dentro del visor), `js/resumen.js` (resumen de anotaciones, repaso de subrayados, Markdown para Obsidian y la ventana de estadísticas), `js/textos.js` (buscar dentro del texto de los PDF y EPUB, y el espacio usado en el navegador) y `app.js` (datos de la aplicación y arranque).
Un archivo nuevo se añade en los tres sitios; `pruebas/prueba_version.js` lo comprueba.
El HTML no lleva `onclick` ni otros manejadores en línea: `index.html` tiene una CSP que los bloquea (y no permite `eval`). Cada elemento dice qué hacer en `data-on<evento>`, p. ej. `data-onclick="openPaper('p1')"`; ese texto lo lee un minilenguaje (llamadas, lecturas, textos, números, listas, `this`, `event`, `!` y `+`), sin evaluarlo como JavaScript (ver «Eventos de la interfaz» en `js/modelo.js`). Para asignar se usan funciones pequeñas (`put(F,'mode',this.value,render)`, `setHas(…)`, etc., en `app.js`); las variables `const`/`let` que haga falta leer van en `ON_VARS`. `pruebas/prueba_eventos.js` comprueba que no queda ningún manejador en línea y que todos los `data-on` se pueden leer.

## Pruebas
`node pruebas/prueba_version.js .`, `node pruebas/prueba_eventos.js .` y `node pruebas/pruebas_citas.js .`; las de navegador son `python3 pruebas/prueba_<nombre>.py .` (todas las `pruebas/prueba_*.py`; necesitan Playwright con Chromium; la de sincronización simula Google y Drive, y las de OpenAlex, DOI y PubMed simulan esas API). GitHub Actions (`.github/workflows/pruebas.yml`) las pasa todas en cada cambio, repartidas en 5 grupos: una prueba nueva entra sola.

## Licencia
[Creative Commons Reconocimiento-CompartirIgual 4.0 Internacional (CC BY-SA 4.0)](https://creativecommons.org/licenses/by-sa/4.0/deed.es): texto completo en `LICENSE`. Dirección: R.M.P. · Desarrollo: Vibe Coding con Claude.
