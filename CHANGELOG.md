# Registro de cambios

Lo más reciente arriba. Hasta la v39.53 estas notas estaban en el README; van de la más nueva a la más antigua (algunas rondas antiguas no tenían número de versión).

## v40.9: arreglos en el móvil (ficha del paper, tarjetas y enlaces en la app de Android)
- **Tarjetas**: tocar (o hacer clic en) el título abre la ficha para editar, como en la tabla. Mantenerlo pulsado en el móvil sigue sirviendo para arrastrar la tarjeta.
- **Enlaces a otras webs en la app de Android**: el DOI de una tarjeta (y cualquier enlace que se abría en una pestaña nueva) dejaba la pantalla en negro y, al volver atrás, se cerraba la app. Ahora, dentro de la app, se abre en la misma ventana con la barra de Chrome (con ✕), y «Atrás» vuelve a GPapers. Antes se guarda la copia de trabajo. En el navegador y en la PWA instalada se sigue abriendo en una pestaña nueva. No hace falta un APK nuevo.
- **Ficha de un paper en el móvil**: cabecera en una sola fila (✕, el título en dos líneas como mucho y «Guardar»), pestañas con nombre corto («Todo», «Clasificar») que caben sin desplazarlas (también en 320 px), «Ver todo» sin cajas dentro de cajas, imagen más pequeña junto al título, botones de Lectura y estrellas más grandes, «Rellenar / OpenAlex / Parecidos» repartidos a lo ancho.
- **Enlazar un PDF en el móvil**: la fila del PDF es una tarjeta: el nombre del archivo, debajo «Cambiar…», «Abrir» y «Página» al lado de su casilla, y después la copia en Drive a lo ancho con ✕. «Relacionar con» y «Buscar un paper…», uno debajo del otro.
- Pruebas: `python3 pruebas/prueba_v409.py .`

## v40.8: doce mejoras del visor de PDF
- **Añadir a GPapers desde una cita**: al tocar una referencia ([12] o «Autor, 2019»), la vista previa dice si ese paper ya está en la biblioteca («✓ Ya en tu biblioteca» y «📝 Abrir») o deja «➕ Añadir a GPapers»: busca el DOI (o el título) y abre Importar ya rellenado. El paper nuevo queda enlazado en Relaciones con el que estabas leyendo.
- **Columna a columna** (Lectura → «Columna a columna»): en papers a dos columnas, cada toque o → enseña el siguiente trozo de columna a todo el ancho; ← vuelve. Pensado para el móvil.
- **Zonas como imagen**: una zona dibujada se puede copiar como imagen, guardar como PNG o poner como imagen del paper.
- **Atrás y adelante**: «↩ Volver» guarda también el «adelante» (Alt+← / Alt+→ y los botones laterales del ratón). Cuentan los enlaces, el índice, las anotaciones y las búsquedas.
- **Marcas junto a la barra de desplazamiento**: subrayados, notas, marcadores y resultados de la búsqueda, con un clic para ir. Se quitan en ⚙.
- **Pestaña 🖼 Figuras**: lista las figuras y tablas del PDF (por su pie, «Figure 2.», «Tabla 1:»…) con miniatura; un toque lleva a ella.
- **Siglas**: al seleccionar una sigla («RNN», «fMRI») sale 🔤, que dice qué significa, dónde se define y cuántas veces sale.
- **Regla de lectura** (Lectura o tecla M): una franja clara que sigue al ratón (o se arrastra con el dedo) y oscurece lo demás; fina, media o ancha.
- **Texto adaptado** (Lectura o tecla T): el texto del PDF como en un libro, con tamaño y letra a elegir y sin desplazarse a lo ancho. Para leer en el móvil.
- **Reconocer el texto (OCR)** en ⋯: en PDF escaneados, reconoce el texto de la página o de todas en el propio navegador (Tesseract, español e inglés; la primera vez descarga unos 9 MB). Después se puede seleccionar, subrayar y buscar. Se guarda en el dispositivo.
- **Exportar a Anki**: en Anotaciones, «🃏 Anki» descarga un archivo para importar en Anki (anverso, reverso y etiquetas).
- **Diferencias PDF 1 / PDF 2**: con dos PDF abiertos, ≠ marca las frases que solo están en uno de ellos y permite ir de una a otra.
- **Móvil**: la barra de selección (con 🔤) cabe en 412 px y en 320 px se desliza; la regla se arrastra con el dedo por su asa; «🃏 Anki» va junto a «⬇ PDF anotado» para no quitar sitio a la lista.
- Pruebas: `python3 pruebas/prueba_visor_v408.py .` y, en el móvil en vertical (Pixel 7 y 320 px), `python3 pruebas/prueba_visor_v408_movil.py .`

## v40.7: arreglos tras una revisión completa (datos, citas y pantallas)
- **Fusionar secciones** ya no deja notas sueltas: las notas que estaban en la sección que desaparece pasan a la que queda aunque el paper no tuviera marcada esa sección, y también en los papers de la papelera. El aviso dice ««A» se ha juntado con «B»».
- **Año de la publicación original**: se lee al importar (`origdate` de BibTeX/biblatex, `original-date` de CSL JSON y `OP` de RIS) y se exporta también a RIS. Antes se exportaba pero se perdía al volver a importar.
- **Año original en la cita**: si el volumen, el número, las páginas o el DOI llevan el mismo número que el año («vol. 2018», «pp. 2018-2030»), los corchetes ya no van detrás del volumen (MLA, IEEE…), sino detrás del año.
- **Visor en el móvil**: la paleta de la barra de abajo se pliega en el color elegido (al tocarlo se abren los cinco) y «Deshacer» va solo con su icono; así caben los nombres de los botones. En móviles pequeños (360 px), solo iconos. Ningún texto se monta sobre otro.
- **Visor en una ventana estrecha del ordenador** (menos de 900 px): la barra del PDF va solo con iconos, con su título; antes «Anotaciones» quedaba fuera.
- **Visor y lector de EPUB**: sin la franja vacía de 16 px encima de la cabecera.
- **Ctrl+K → «Zonas para pasar»** (y los demás menús del visor abiertos desde Ctrl+K) sale debajo de ⋯, no en la esquina, y sin error.
- **Exportar en el móvil**: cada casilla, en la misma línea que su texto, con el ⓘ al final; la explicación se abre debajo.
- **Fecha de consulta** (Exportar y ficha → Cita): los formatos se enseñan con la fecha de hoy («Larga (21 de noviembre de 2026)», «Corta», «ISO»), y el resumen dice el formato. Antes salía siempre «20 de octubre de 2026», que parecía la fecha guardada.
- **Configuración en el móvil**: al buscar, las pestañas se esconden (salen todos los ajustes que coinciden).
- **Relaciones**: el dibujo mide lo que la ventana (en el móvil, a tamaño real; antes se encogía y no se leía); los títulos, cortos de verdad (28 letras), con fondo para que las líneas no los tachen, sin salirse por la derecha y sin pisarse.
- **Tabla**: las secciones y etiquetas que no caben acaban en «…» y las que no entran se esconden (están en el título de la celda); antes se cortaban a secas.
- **Datos**: la frase «Los campos que usa…» va seguida, con su ⓘ al final (en el móvil se partía en trozos).
- **Buscador**: «autor:», «año:», «#» o «-» a medio escribir ya no vacían la lista.
- **Móvil en horizontal**: la barra de abajo es más baja (icono y nombre en una línea) y el buscador se va al desplazar; la lista tiene casi el doble de sitio.
- **Service worker**: ya no guarda las consultas a CrossRef, OpenAlex, doi.org… en la caché (cada respuesta «opaca» ocupa unos 7 MB de la cuota de Chrome). De otras webs solo guarda las imágenes (portadas), en su propia caché y como mucho las 80 últimas.
- Pruebas nuevas: `python3 pruebas/prueba_v407.py .` y más casos en `node pruebas/pruebas_citas.js .`

## v40.6: más fácil sin perder nada (Exportar, Configuración, ficha, Secciones y Etiquetas)
- **Modo de la app: Sencillo o Completo** (Configuración → Apariencia, arriba). Sencillo esconde Vistas, Búsqueda avanzada, Relaciones, Columnas de la tabla, el Historial de la ficha, las clasificaciones de Secciones y Etiquetas y los demás estilos en «Cita». No borra nada; «Completo» lo enseña todo. Se guarda en el JSON (`settings.uiMode`: `full` por defecto o `simple`) y llega a los otros dispositivos.
- **Exportar**: arriba solo papers, formato y estilo; debajo la vista previa y Copiar, Copiar con formato y Guardar. Lo demás va en **«Más opciones»**, plegado, con un resumen («Automático · Español · consulta: 20 de octubre de 2026»). «Listar todos los autores» sale solo con Vancouver y «pp.» solo con APA; las explicaciones, en ⓘ. Resumen de anotaciones y Markdown para Obsidian, en una línea aparte.
- **Configuración**: un **buscador** arriba («pdf», «color», «Drive»…). En el ordenador las pestañas siguen a la vista: cada una dice cuántos ajustes coinciden y se ve la elegida; en el móvil salen todos los que coinciden, uno tras otro. Apariencia y Datos y Drive van en bloques plegables (Google Drive, PDF y anotaciones, PDF por citar, Espacio y herramientas), con textos cortos y las explicaciones en ⓘ. Lo que solo vale en este navegador lleva la marca «este dispositivo».
- **Ficha → Cita**: Cursiva y Negrita en una línea; idioma y fecha de consulta, en «Opciones» (plegado). Junto a la cita principal, `\cite{}` y `[@]`. «↺ Volver a la cita automática» sale solo si la cita está editada a mano.
- **Ficha → Relacionados**: una sola lista con el tipo de cada relación (Relacionado, Cita a, Citado por), sin los «Ninguno.».
- **Ficha → Notas por sección**: cada nota se pliega por su título, con el punto de color de su sección y el principio del texto. Su ⋯ la cambia de sección o la quita (con Deshacer). «+ Añadir nota» pregunta en qué sección va.
- **Gestionar secciones y etiquetas**: una fila por línea con color, nombre, descripción, **cuántos papers** tiene, ↑ ↓ y 🗑. Nuevo **⤵ Fusionar** dos etiquetas (o secciones, con sus notas) en una, con Deshacer. Las clasificaciones para ordenar van abajo, plegadas (abiertas si ya tienes alguna).
- **Barra lateral**: «Incluir notas…» e «Incluir el texto de los PDF…» salen al escribir en el buscador (o si están marcadas). Valoración y Años, en dos líneas con su nombre.
- **Relaciones**: la primera vez, la explicación sale debajo del gráfico en vez de encima.
- Pruebas actualizadas: las 40 de navegador y las 3 de node pasan.

## v40.5: pestaña «Datos» más clara, en bloques y con modo Sencillo o Avanzado
- **Bloques con título, plegables**: Identificación (imagen, título, título personalizado, autores, año, tipo, lectura y valoración), Publicación, Fechas, Enlaces y archivos (URL, PDF/EPUB, enlace en la cita) y Ajustes de la cita (clave de cita, clave de orden, tipo de autor). La app recuerda los que pliegas.
- **Modo Sencillo | Avanzado**, arriba: Sencillo (por defecto) muestra lo básico, lo que usa tu estilo principal y lo que tiene datos; Avanzado, todos los campos. Ya no hay «Otros campos»: en Sencillo, cada bloque nombra al pie lo que esconde («+ 4 campos más: Año original, Fecha completa…») y se abre con un clic, sin pasar a Avanzado.
- **DOI arriba, con «Rellenar»** (CrossRef), OpenAlex y Parecidos: lo primero que se rellena trae casi todo lo demás.
- **Etiquetas cortas**: el ejemplo va como texto de fondo («p. ej. 73-98») y la explicación, en un **ⓘ** que se abre al pulsarlo.
- **Vista previa de la cita** en el estilo principal al pie de Datos, que cambia mientras escribes.
- No se pierde ningún campo ni botón; en el móvil, todo en una columna.

## v40.4: año de la publicación original en las citas
- **Campo nuevo, opcional: «Año de la publicación original»** (en los datos del paper, en «Mostrar todos los campos»; si tiene datos, se ve siempre). Sirve para las reediciones y traducciones: se cita la edición que se ha leído y, entre corchetes, el año en que se publicó la obra por primera vez.
- Sale en **todos los estilos de serie**, justo después del año de la edición: APA «Freud, S. (2018) [1930].», Chicago, MLA, IEEE, Vancouver y UNE «…, 2018 [1930].», y en la cita en el texto «(Freud, 2018 [1930], p. 24)». Si el campo está vacío o coincide con el año, la cita no cambia.
- **Estilos propios**: campo nuevo `{origYear}`; con `[ {origYear:br}]` sale entre corchetes solo si tiene valor. Los estilos nuevos y los creados «a partir de» uno de serie ya lo llevan detrás del año.
- Se exporta como `original-date` (CSL JSON) y `origdate` (BibTeX/biblatex).
- Pruebas nuevas en `node pruebas/pruebas_citas.js .`

## v40.3: zonas para pasar de página, a elegir
- **👆 Zonas para pasar** (📖 Modo de lectura, en página a página, en el PDF y en el EPUB). Antes solo se pasaba tocando a la izquierda o a la derecha. Ahora la página se parte en 3 × 3 casillas y se elige qué hace cada una:
  - **Izquierda y derecha** (como antes, por defecto), **Arriba y abajo** (arriba vuelve, abajo pasa), **Al revés** (derecha, anterior) y **Casi todo adelante** (solo la columna izquierda vuelve).
  - **Hasta tres personalizadas**: cada casilla se toca para cambiarla entre ◀ Anterior, Siguiente ▶ o nada. Las casillas «—» siguen como siempre (subrayar, menús, pantalla completa). Se puede empezar copiando una de las formas hechas.
  - Al elegir o cambiar, las zonas se ven un momento sobre la página (azul: anterior; verde: siguiente). Se recuerda en el dispositivo.
- Deslizar, las flechas del teclado y el desplazamiento automático no cambian.
- Prueba nueva: `python3 pruebas/prueba_visor_zonas.py .`

## APK 1.2.2: pantalla de carga de GPapers al abrir la app
- Al abrir la app de Android, mientras Chrome arranca, ahora se ve el fondo de GPapers con su icono. Antes la primera ventana era transparente y, sobre todo en el primer arranque, se veía la pantalla de inicio del móvil durante 2 o 3 segundos. La 1.1 ya lo hacía.
- La prueba del emulador (`apk-prueba.yml`) compara el arranque de la versión de `main` con la nueva y dice qué colores se ven en pantalla cada medio segundo.

## v40.2: los PDF de Google Drive se abren sin espera a ciegas
- **Ventana de descarga al momento.** Al abrir un PDF que solo está en tu Google Drive (subido desde otro dispositivo) no se veía nada hasta tenerlo entero, a veces 10 s o más, salvo un aviso de 3 s. Ahora sale enseguida una ventana con el nombre, una barra con el porcentaje y lo que lleva («45 % · 1,2 de 2,7 MB») y **Cancelar** (o Escape). Se cierra sola al abrirse el visor.
- **Arreglo: los PDF ya guardados se volvían a descargar.** Android cierra a veces, sin avisar, la conexión de la app con el almacenamiento del navegador (por ejemplo, al dejarla en segundo plano). La primera lectura después fallaba, la app creía que no había copia del PDF y lo descargaba otra vez de Drive. Ahora abre otra conexión y repite la lectura.
- **Avisos en vez de silencio**: si no se puede guardar la copia de un PDF (sin espacio, o más de 100 MB), se avisa. Si la copia estaba guardada y el navegador la borró, al descargarlo de nuevo se dice por qué.
- **Más rápido**: PDF.js se carga mientras se descarga el archivo, y el PDF ya no se busca en Drive antes de cada descarga, porque la app recuerda dónde está desde la última sincronización (si ya no está ahí, lo busca). Como antes, después se queda una copia en el navegador y la próxima vez abre sin descargar.
- **APK 1.2.1**: vuelve el permiso de notificaciones. Sin él, en Android 13 o más nuevo, el primer arranque pasaba por el logo de Chrome y la pantalla de inicio antes de mostrar la app.
- Prueba nueva: `python3 pruebas/prueba_descarga.py .` (Drive simulado y lento: la ventana sale al momento, avanza, se cancela y el visor se abre; con la copia guardada no se descarga, aunque se haya cerrado la conexión con el almacenamiento).

## v40.1: los PDF vuelven a abrirse en todos los navegadores; repaso y estadísticas, opcionales
- **Arreglo importante: el visor vuelve a PDF.js 4.10.** PDF.js 5.7 (v40) usa funciones de JavaScript tan nuevas (`Map.getOrInsertComputed`, `Math.sumPrecise`, `Promise.try`…) que un Chrome, Edge o Chromium de hace unos meses no las tiene, y ahí los PDF no llegaban a abrirse. En el móvil abrían, pero más despacio. La política de seguridad vuelve a ser la de antes (sin `wasm-unsafe-eval`). Prueba nueva: `python3 pruebas/prueba_navegador_viejo.py .` quita esas funciones del navegador y comprueba que el PDF se abre.
- **🧠 Repaso de subrayados y 📊 Estadísticas de lectura** pasan a ser opciones de Configuración → Apariencia, **apagadas por defecto**. Apagadas no salen en la barra lateral ni en Ctrl+K, y con las estadísticas apagadas no se guarda nada mientras lees (tampoco se sincroniza cada 5 minutos). Lo ya guardado se conserva y vuelve a verse al encenderlas.
- **Visor**: el texto para buscar dentro de los PDF se saca 5 s después de abrir, página a página y solo con el navegador libre; si cierras antes, se deja para la próxima vez. Así no compite con pintar las primeras páginas y los subrayados.

## v40: añadir papers de cualquier sitio, OpenAlex, lectura y búsqueda en los PDF
**Añadir papers**
- **DOI de cualquier agencia**: si CrossRef no lo tiene (DataCite, Zenodo, mEDRA…), se pide a doi.org en formato CSL. **arXiv** por su número (`2401.12345`, `arXiv:…` o el enlace) y **PubMed** por PMID (`PMID: 31452104` o el enlace). La bandeja reconoce también el sello de arXiv del margen de los PDF.
- **Compartir a GPapers** un PDF o un EPUB desde Chrome, Archivos o la app de una revista: llega a la bandeja «PDF por citar» (web instalada y APK 1.2). Compartir un enlace de arXiv o PubMed lo busca.
- **Accesos del icono** (pulsación larga): Nuevo paper, Buscar por DOI y Seguir leyendo. En el ordenador, la app instalada abre .pdf, .epub, .bib, .ris y .json con doble clic.
- **Lista vacía que ayuda**: en un proyecto nuevo, botones para buscar por DOI, importar un archivo o elegir PDF; si la vacían los filtros, dice cuáles y ofrece «Limpiar filtros».

**OpenAlex**
- **Retractados**: aviso ⚠ en la tarjeta, la tabla y la ficha, filtro «⚠ Retractados» y «Comprobar si algún paper está retractado» (Configuración → Datos o Ctrl+K).
- **Relaciones automáticas** (Relaciones → «Buscar relaciones con OpenAlex»): qué papers tuyos citan a otros tuyos, con vista previa y un solo Deshacer; y **lo que te falta**: obras que citan dos o más de tus papers y aún no tienes.
- **Parecidos** (ficha, junto al DOI): los papers relacionados según OpenAlex, para importar los que elijas.

**Citas y exportar**
- **Clave de cita fija** (`Garcia2020a`): se fija al exportar a BibTeX, se puede cambiar en la ficha y copiar como `\cite{…}` o `[@…]`; el BibTeX importado conserva la suya.
- **Markdown para Obsidian, Logseq o Notion** (Exportar): un .md por paper con metadatos en YAML, clave de cita, notas y subrayados por página, en un ZIP.

**Leer**
- **Seguir leyendo**: una franja sobre la lista con el último PDF o EPUB, la página y el tiempo que falta.
- **Repaso de subrayados** (barra lateral): cada día unos pocos subrayados, primero los de los colores con significado; «Ya lo sé» lo aparta 30 días.
- **Estadísticas de lectura** (barra lateral o Ctrl+K): tiempo y páginas de hoy, 7 y 30 días, racha, minutos de cada día, papers de cada mes, lo más leído y avance por sección. Se guardan en el proyecto (`readLog`) y se suman los de todos tus dispositivos con Google Drive.
- **Buscar dentro del texto de los PDF y EPUB**: casilla «Incluir el texto de los PDF y EPUB» o `texto:palabra`. La tarjeta dice la página y la abre en el visor buscando lo mismo. El texto se saca al abrir cada documento o con «Preparar la búsqueda» (Configuración → Datos) y vive solo en este navegador.
- **Ctrl+K dentro del visor y del lector de EPUB**: busca cualquier orden de sus menús y submenús (también en ⋯ → «Buscar una orden…»).

**Interfaz y accesibilidad**
- **Icono adaptable** en Android (no queda encogido en un círculo blanco), en la web instalada y en la APK.
- **Espacio usado en este navegador** (Configuración → Datos): copias de PDF, texto para buscar, portadas, copias de seguridad e imágenes, con botones para liberar y para pedir que el navegador no borre los datos.
- **Accesibilidad** (revisada con axe en claro y oscuro, ordenador y móvil): letra oscura sobre los colores claros de etiquetas y botones, contraste suficiente en los filtros y en el modo oscuro, la barra lateral ya no se oculta a los lectores de pantalla en el ordenador, nombres para los botones de solo emoji, pestañas y zonas desplazables del visor accesibles con el teclado.

**Rendimiento y mantenimiento**
- **Escribir en el buscador** repinta solo la lista (antes, también la barra lateral entera) y la búsqueda ya no rehace el texto de cada paper en cada tecla.
- **La copia para deshacer** se hace cuando el navegador está libre, no justo después del clic; el JSON se guarda sin sangría (opción para quien lo lea a mano).
- **Tarjetas y filas** con `content-visibility`: el navegador no maqueta lo que no se ve.
- **Google Drive comprimido**: la copia completa se sube en gzip (5 a 10 veces menos datos). Se siguen leyendo las copias sin comprimir. Un dispositivo con una versión anterior no puede leer la copia comprimida hasta que se actualice (los cambios esperan; no se pierde nada).
- **PDF.js 5.7** (R7): se probó en la v40, pero se volvió a la 4.10 en la v40.1 (ver arriba).
- **Sincronizar e importar archivos grandes sin congelar la pantalla**: preparar y fusionar el proyecto con Google Drive, y leer un .bib o .ris de más de 300 000 letras, se hace en un hilo aparte (`js/trabajo.js`). Si el navegador no lo permite, se hace como antes.
- **Carga de los archivos al arrancar**: se midió dejar para después los del visor y el EPUB. Con la CPU a ¼ y sin caché, el arranque pasaba de 101 a 73 ms de scripts; con la caché del service worker (lo normal en una app instalada), unos 25 ms en los dos casos. Como la diferencia solo se nota la primera vez, se siguen cargando todos al arrancar (más sencillo y sin esperas al abrir el primer PDF).
- **Pruebas**: GitHub Actions pasa todas las pruebas (antes faltaban 10) en 5 grupos con Chromium en caché; pruebas nuevas en `pruebas/prueba_v40.py`.
- **Código**: el visor de PDF está repartido en cuatro archivos y el registro de cambios pasa a este CHANGELOG.md.
- **APK 1.2** (versionCode 3): compartir a la app, icono adaptable y sin el permiso de notificaciones, que no se usaba.

## Visor: leer en voz alta, lápiz a mano y los dos PDF a la vez (v39.53)
Tampoco aquí hay botones fijos nuevos: todo sale de ⋯ o de la barra de la selección.
- **🔊 Leer en voz alta** (⋯ → 📖 Modo de lectura, o ⋯ de la barra de la selección para empezar «desde aquí»), en el PDF y en el EPUB. Usa la voz del sistema (nada sale a internet), en español o en inglés según el texto. Marca la frase que lee, la sigue en la pantalla y pasa sola de página o de capítulo. Mientras lee, una barrita abajo: ⏮ ⏸ ⏭ (frase anterior, pausa, siguiente), la velocidad (de 0,8× a 2×, se recuerda en el dispositivo: `gp-vw-say`) y ✕. Esc o cerrar el visor la paran, y la pantalla no se apaga mientras lee.
- **✏ Lápiz** (⋯ del PDF): dibujar o escribir a mano sobre la página con el dedo, el lápiz o el ratón, con el color elegido. Los trazos seguidos (menos de 2 s entre uno y otro, en la misma página) forman una sola anotación, que se toca (con 𝙸 Seleccionar) para cambiarle el color, comentarla o borrarla. Mientras está puesto, una píldora «✏ Lápiz · ✕» arriba; ✕ o cualquier otra herramienta lo quita. En el **PDF anotado** salen como dibujos (Ink) que ven Acrobat, Foxit y los demás, y los dibujos que ya traía el PDF se pueden traer. Va en las anotaciones del paper (`k: 'ink'`, con los trazos en `g`), así que se sincroniza como el resto.
- **⧉ Ver el PDF 2 al lado** (⋯, si el paper tiene PDF 1 y PDF 2): el otro PDF a la derecha (debajo con la tablet en vertical; en el móvil, encima, y ✕ vuelve), solo para leer, con su propio zoom y su página. El divisor es el mismo de las notas; abrir las notas al lado lo cierra, y al revés.
- Pruebas: `python3 pruebas/prueba_visor_voz.py .`

## Visor: subrayar con línea o tachar, recorte a mano y girar páginas (v39.52)
- **U̲ Línea debajo y S̶ Tachado**: además del resaltado de siempre, un subrayado puede ser una línea bajo el texto o un tachado. Se cambia en la ventanita de cada subrayado (🖍 U̲ S̶) o se elige al crear, en ⋯ de la barra de la selección. En el **PDF anotado** salen como subrayado y tachado de verdad (los ven Acrobat, Foxit y los demás), y los que ya traía el PDF se importan con su estilo. También en el EPUB.
- **✂ Ajustar el recorte** (⋯ → 📖 Modo de lectura, con el recorte de márgenes puesto): cuatro barras (arriba, abajo, izquierda y derecha) para corregir el recorte automático cuando se come algo o deja demasiado margen. Se guarda para ese PDF en este dispositivo (`gp-vw-crop`); «↺ Volver al recorte automático» lo quita.
- **↻ Girar** (⋯ → 📖 Modo de lectura): esta página o todas, de 90 en 90 grados, para tablas apaisadas o escaneos de lado. Se guarda para ese PDF en este dispositivo (`gp-vw-rot`); los subrayados y la búsqueda siguen en su sitio.
- **Arreglo**: al volver a abrir un PDF con el recorte de márgenes puesto, el recorte no se aplicaba hasta tocar algo.
- Pruebas: `python3 pruebas/prueba_visor_giro.py .`

## Visor: colores con significado, más opciones con la selección, sepia y tiempo que falta (v39.51)
También en `js/lectura.js`, y otra vez sin botones fijos nuevos.
- **🏷 Significado de los colores** (⚙ Ajustes del visor → 🏷, PDF y EPUB): un nombre para cada color, por ejemplo amarillo para idea clave y rojo para crítica. Sale en los botones de color, en los filtros del panel (como etiquetas con su nombre) y en la ventanita de cada anotación. Al copiarlas o llevarlas a las notas, se **agrupan por significado** (en Markdown, con un título por grupo); sin nombres, todo sigue como antes. Va con los ajustes comunes (`settings.annLbl`, color → nombre de hasta 40 letras), así que llega a tus otros dispositivos.
- **⋯ en la barra de la selección** (PDF y EPUB): **❝ Copiar con la cita** («…» (Pérez y Gómez, 2024, p. 3); en el EPUB, «cap. N»), **📖 Definición** (RAE, o Cambridge en inglés; solo con una a tres palabras), **🌐 Traducir al español** (Google Traductor) y **🎓 Buscar en Google Académico**. Lo de fuera se abre en una pestaña nueva, solo al pulsarlo, y envía solo el texto elegido. Al pulsar en esa barra ya no se pierde la selección.
- **📜 Sepia en el PDF** (⚙ → 🌙 Modo noche y sepia: normal, sepia, noche o como el sistema). Como la noche, cambia el papel y el color del texto; las imágenes no se tocan.
- **⏱ Tiempo que falta**: «≈ 12 min» junto al número de páginas (en pantallas anchas), en el aviso de página de la pantalla completa y junto al capítulo del EPUB. Se calcula con **tu ritmo** en este dispositivo: el tiempo que pasas en cada página antes de pasar a la siguiente (`gp-vw-pace`, segundos por página) o las letras que avanzas por minuto en el EPUB (`gp-ep-pace`), contando solo mientras lees (has tocado algo hace menos de 2 min o va el automático). Se quita en ⚙ → ⏱ (`gp-vw-left`).
- Pruebas: `python3 pruebas/prueba_visor_colores.py .`

## Visor: enlaces que funcionan, vista previa de citas, pantalla encendida y lista de resultados (v39.50)
Nada de esto añade botones fijos: cada cosa sale solo cuando hace falta. Código en `js/lectura.js` (PDF y EPUB).
- **Enlaces del PDF**: tocar «[12]», «Fig. 3», «Sección 2» o cualquier enlace interno del PDF ya lleva a su sitio (antes no hacía nada: el visor no leía los enlaces). Por defecto sale antes una **vista previa** del destino (la referencia de la bibliografía, la figura…), pintada aparte y sin moverte de donde lees; en un PDF a dos columnas enseña solo la columna de la referencia, para que la letra se lea. «➜ Ir a la página N» salta y marca un momento dónde has caído. Con el ratón, la mano sale sobre los enlaces.
- **Enlaces a internet**: piden confirmación («↗ Abrir en una pestaña nueva» o «📋 Copiar»).
- **↩ Volver**: después de saltar (enlace, índice, miniaturas o lista de resultados) sale abajo a la izquierda «↩ Volver a la p. N» para regresar a donde estabas (también **Alt + ←**); se apilan varios saltos. ✕ lo quita.
- **EPUB**: lo mismo con sus enlaces internos (texto o imagen del destino, «➜ Ir allí» y «↩ Volver»); las llamadas a nota siguen con su ventanita.
- **⚙ Ajustes del visor → 🔗 Al tocar un enlace o una cita**: «👁 Ver antes una vista previa» (por defecto) o «➜ Ir directamente (con ↩ Volver)». En el dispositivo: `gp-vw-link`.
- **🔆 Pantalla encendida** (⚙ Ajustes del visor, si el navegador lo permite): con el PDF o el EPUB abierto la pantalla no se apaga sola mientras lees; se apaga tras **5 minutos sin tocar nada**. Con el desplazamiento automático en marcha, nunca. Opciones: mientras lees (por defecto), solo con el automático o como el sistema (`gp-vw-wake`).
- **Lista de resultados de la búsqueda**: junto a «3 de 27» sale **☰**, que abre en el panel la pestaña 🔍 con cada resultado, su página (o capítulo) y la frase donde aparece; tocar uno lleva a él (con un solo «↩ Volver» por búsqueda). Hasta 400 en la lista.
- Pruebas: `python3 pruebas/prueba_visor_enlaces.py .`

## Visor: los tiradores de un subrayado ya hecho funcionan también con zoom y candado (v39.49)
- **Arreglo**: con zoom, si el principio (o el final) de un subrayado quedaba fuera de la pantalla, su tirador no se podía arrastrar (el navegador solo localiza el texto que está a la vista). Pasaba sobre todo con el **🔒 candado**, que no deja mover la hoja para verlo entero, y en móviles con el modo ligero. Ahora el otro extremo se busca en la capa de texto aunque no se vea.
- Con el dedo, el tirador va por **palabras enteras** (como al subrayar).
- Se quita la opción de v39.48 («✋ Límites de un subrayado ya hecho»): los tiradores siempre se pueden mover.
- Pruebas: `python3 pruebas/prueba_visor_tiradores.py .`

## Visor: límites fijos para un subrayado ya hecho (v39.48)
- **⚙ Ajustes del visor → ✋ Límites de un subrayado ya hecho (tiradores)** (PDF): para no alargar ni acortar un subrayado sin querer al tocarlo.
  - **Fijos con el 🔒 candado o el ⚡ modo ligero** (por defecto): con cualquiera de los dos activo, al tocar un subrayado sale su ventanita (color, comentario, copiar, borrar) pero **no salen los tiradores**. Al poner o quitar el candado, o cambiar el modo ligero, se aplica al momento.
  - **Siempre fijos** o **Siempre se pueden mover** (como antes). Se recuerda en el dispositivo (`gp-vw-hdlk`).
- Subrayar texto nuevo sigue igual (con sus tiradores de selección).
- Pruebas: `python3 pruebas/prueba_visor_tiradores.py .`

## Visor: ⚙ Ajustes del visor y medios puntos de velocidad (v39.47)
- **⋯ → ⚙ Ajustes del visor** (PDF y EPUB) reúne lo que se elige una vez y se olvida, para que los submenús de lectura no estén saturados:
  🖍 al cambiar el color de un subrayado (solo ese / ese y los siguientes) · 👆 gestos de zoom (pellizcar, doble toque; solo PDF) · ⛶ dónde va la pestaña ▾ en pantalla completa (solo PDF) · 🌙 modo noche (solo PDF; el EPUB tiene sus colores en «Aa Texto y colores») · Aa tamaño del texto de la interfaz · 📂 al abrir (los PDF en pestaña nueva o dentro de la app, en el ordenador; panel de anotaciones abierto o no; este PDF también en el Drive normal) · ⚡ modo ligero (automático, siempre o nunca; `gp-vw-lite`) · ⌨ atajos de teclado (en el ordenador).
- **⋯** queda con 📖 Modo de lectura, 🔖 Marcadores, ⚙ Ajustes del visor y lo de descargar o abrir en otra app. **📖 Modo de lectura** queda con lo de leer: una o doble página, seguido o página a página, 🔒 candado, desplazamiento automático y recortar márgenes.
- **Desplazamiento automático con medios puntos**: la velocidad va de 1 a 20 de medio en medio (7, 7,5, 8…); 🐢/🐇, los toques a los lados, ↑ ↓ y la barra cambian medio punto. También en el EPUB.
- Pruebas: `python3 pruebas/prueba_visor_ajustes.py .`

## Visor: con el candado la hoja tampoco se mueve (v39.46)
- Con **🔒 candado** (página a página) la hoja queda **fija**: no cambia el tamaño y **tampoco se mueve** (ni arrastrando con el dedo, ni con dos dedos, ni con la rueda del ratón). Solo se pasa de página (toques a los lados, ← →, ↑ ↓, AvPág/RePág, espacio), y la página nueva sale en la misma zona. Para mover la hoja o cambiar el tamaño, se quita el candado.
- Pruebas: `python3 pruebas/prueba_visor_pasar.py .`

## Visor en táctil: sin el menú de Chrome, selección propia, color de un solo subrayado y más fluido en móviles de gama baja (v39.45)
- **Sin el menú largo de Chrome**: dentro del visor de PDF y del lector de EPUB, la pulsación larga (y el clic derecho) ya no abre el menú del navegador (Volver, Descargar, Imprimir, Compartir, código QR…). En los campos de texto sigue saliendo, para pegar. Fuera del visor no cambia nada.
- **Selección propia en táctil** (PDF y EPUB): el texto ya no lo selecciona el navegador (así no sale su barra Copiar/Compartir/Seleccionar todo). **Pulsación larga** sobre el texto: selecciona la palabra; **sin soltar, arrastra** para alargarla por palabras; **dos tiradores** la ajustan; sale la barra de GPapers (colores, 💬, 📋 Copiar). Tocar fuera la quita. Con ratón, como siempre. Código: `TS` en `js/visor.js` (la selección sigue siendo la del documento, solo que la pinta GPapers).
- **Al cambiar el color de un subrayado** (⋯ → 📖 Modo de lectura, en el PDF y en el EPUB): «🎯 Solo cambia ese subrayado» o «🖍 Ese y los siguientes» (por defecto, como antes: también pasa a ser el color para subrayar). Se recuerda en el dispositivo (`gp-ann-col`).
- **Más fluido**: crear, cambiar o borrar un subrayado repinta solo su página (antes, todas las cercanas); en táctil los subrayados usan transparencia en vez de «multiplicar» (más barato para la gráfica); las anotaciones de otros programas se leen cuando el visor está quieto. **Modo ligero** automático en táctil con poca memoria (≤ 4 GB) o pocos núcleos (≤ 4): lienzos de como mucho 3 Mpx y al doble de la pantalla, 4 páginas pintadas en memoria y la capa de texto solo cerca de la que lees.
- Pruebas: `python3 pruebas/prueba_visor_tactil.py .` (tablet Android, EPUB y un móvil con la CPU 6 veces más lenta).

## Visor: PDF con muchos subrayados al momento y barra que no mueve la hoja (v39.44)
- **PDF con muchos subrayados**: se abre al momento y los botones responden desde el principio. Antes, al abrir un PDF ya leído (con los tamaños de página guardados), cada página con subrayados se pedía a PDF.js y, al llegar, se volvían a pintar los subrayados de **todas** las páginas y la lista del panel, que volvían a pedir las que faltaban: con muchos subrayados la app se quedaba colgada. Ahora cada página pinta solo los suyos, **al acercarse a la vista** (o al pintarse), y cada página se pide una sola vez. El panel ordena con la altura calculada una vez por anotación; saltar a una de una página aún no leída va a su sitio.
- **Pantalla completa**: la barra que se saca con la pestaña ▾ (y las dos barras de 3 s) **flota encima de la página**, así la hoja no se mueve ni cambia de tamaño al sacarla u ocultarla (antes, con «ajustar», se reajustaba a la altura nueva). Al entrar en pantalla completa la barra sigue ocupando su sitio; desde que se oculta, flota hasta salir.
- Los subrayados siguen guardándose en el proyecto (no dentro del archivo): el PDF con ellos dentro sale con «⬇ PDF anotado», «abrir en otra app» o la copia en el Drive normal.
- Pruebas: `python3 pruebas/prueba_visor_rapido.py .`

## Visor: pestaña de la barra a un lado, candado del tamaño y doble página de una en una (v39.43)
Todo en **⋯ del visor → 📖 Modo de lectura** (se recuerda en este dispositivo, en `gp-vw-read`).
- **Pestaña ▾ de la barra oculta** (pantalla completa): **a la izquierda**, **en el centro** (como antes) o **a la derecha**. En el ordenador va arriba y en el móvil abajo, también a los lados.
- **🔒 Candado del tamaño**, con **página a página**: no deja cambiar el zoom (botones −/＋, «ajustar», Ctrl + rueda, pellizco, doble toque, teclas) y, **al pasar de página, se quedan el tamaño y la zona que veías** (por ejemplo, la columna de texto ampliada). Con dos dedos se puede seguir moviendo la página. AvPág al final de la página pasa a la siguiente desde arriba. Botón 🔓/🔒 en la barra del visor, en el submenú y tecla **K**; **en pantalla completa, un botón redondo casi transparente en una esquina de abajo** (la izquierda; la derecha si la pestaña está a la izquierda). Dura mientras el PDF está abierto; salir de página a página o cambiar a una o dos páginas lo quita.
- **Doble página: pasar de una en una o de dos en dos.** De una en una (con página a página), al pasar, **la de la derecha pasa a la izquierda y entra la siguiente** (1-2, 2-3, 3-4…; con «portada sola», la 1 sola y luego 2-3, 3-4…); al final se ven las dos últimas. De dos en dos, como antes. Elegir «de una en una» sin página a página la activa. En el **EPUB** también (⋯ → Modo de lectura, con doble página): avanza una columna.
- Pruebas: `python3 pruebas/prueba_visor_pasar.py .` (y `prueba_epub.py` para el EPUB).

## EPUB en el visor y mejor inserción de PDF (v39.42)
- **EPUB como los PDF**: se enlazan en los mismos huecos del paper (hasta dos, PDF o EPUB), entran en la bandeja «PDF por citar», se copian al navegador y a Google Drive igual, y su portada sale como imagen del paper. El formato lo dice la extensión del nombre (`isEpub`); los campos siguen siendo `pdf` y `pdf2`. El botón es 📘.
- **Lector de EPUB propio** (`js/epub.js`, sin librerías; funciona también desde `file://`): lee el ZIP con `DecompressionStream`, el OPF (metadatos y orden de lectura) y el índice (`nav.xhtml` o `toc.ncx`). Cada capítulo se copia limpio, con elementos nuevos: sin scripts, estilos del libro, formularios, iframes ni atributos `data-…`; del estilo solo quedan alineación, cursiva y negrita. Las imágenes salen del ZIP (blob:) y los enlaces internos saltan al capítulo; las llamadas a nota abren la nota en una ventanita.
- **Lo del visor de PDF, adaptado al texto que fluye**: subrayados en 5 colores con comentario (también entre capítulos), panel de anotaciones e índice, 📋 Copiar, 📝 A las notas (nota «Anotaciones del EPUB») y ⬇ .md, que dicen «cap. N» en vez de «p. N» (también el resumen de anotaciones); buscar sin tildes ni mayúsculas; **seguido**, **página a página** (toques a los lados, deslizar, ← →) y **doble página**; **desplazamiento automático** y **modo concentración** (los mismos ajustes que el PDF); **🔖 marcadores** (B, [ y ]); **dónde ibas** (el capítulo va con el EPUB y se sincroniza; el punto exacto, en el dispositivo: `gp-ep-pos`); pantalla completa; barra de posición en el libro; notas del paper.
- **Aa Texto**: tamaño, letra con o sin remate, interlineado, ancho de la línea, justificar y colores claro, sepia, noche o como el sistema (en el dispositivo: `gp-ep-set`). No hay zoom, recorte, zonas ni notas sueltas: no tienen sentido sin páginas fijas.
- Formato de las anotaciones del EPUB (campo `ann`, sin cambios en el modelo): `p` = capítulo y `q = [inicio, −inicio, fin, −inicio]` (posiciones en el texto del capítulo); los marcadores (`bm`) son capítulo × 100 + %.
- **Insertar PDF y EPUB**: suéltalos **sobre una tarjeta o una fila** para enlazarlos a ese paper (al primer hueco libre; si tiene dos, pregunta si sustituir el segundo), **sobre la ficha abierta** (en la fila del PDF 1 o 2, o en el primer hueco) o **pégalos con Ctrl+V** en la ficha; fuera de los papers siguen yendo a la bandeja. Mientras arrastras, un aviso arriba lo explica y el paper de destino se marca. La fila «Enlazar un PDF o EPUB…» de la ficha se ve siempre, también en la versión simplificada.
- **Completar con lo que trae el archivo**: al enlazarlo se lee el DOI y el título (PDF) o título, autores, año, editorial e ISBN (EPUB) y, si faltan en la ficha, se ofrece completarlos (solo los campos vacíos; con DOI, con los datos de CrossRef, solo al pulsar). Desde la bandeja, un EPUB sin DOI crea la cita como **libro** con sus metadatos.
- Pruebas: `python3 pruebas/prueba_epub.py .` (crea el EPUB de prueba al vuelo).

## Visor: papers largos, dónde ibas, modo concentración, atajos y tamaño del texto (v39.41)
Ya existía: el visor pinta solo las páginas que se ven y libera las lejanas, y recordaba la página al cerrarlo. Ahora, además:
- **Papers largos**: el tamaño de cada página se guarda por PDF en el dispositivo (`gp-vw-sz`, en tramos: ocupa poco), así que al volver a abrirlo no hay que medirlas todas ni se mueve lo que lees. El último PDF cerrado se queda leído 3 minutos (1 en el móvil): si lo vuelves a abrir, sale al instante y con la búsqueda preparada. Las páginas lejanas sueltan también lo que PDF.js tenía preparado de ellas.
- **Dónde ibas**: la página se guarda también al salir de la aplicación o cambiar de app con el visor abierto (antes, solo al cerrarlo), y se vuelve al mismo punto de la página (`gp-vw-pos`, en el dispositivo). Al abrir, «Sigues en la página N» con «⏮ Ir al principio».
- **🧘 Modo concentración**, en **⋯ → 📖 Modo de lectura → ⏬ Desplazamiento automático** (ahora un submenú: empezar o parar, velocidad y concentración), o con el botón 🧘 de su barra: mientras la página baja sola, se ocultan las barras, los menús y el puntero. Un toque en la página (o Esc, o la barra espaciadora) los saca y pausa; un toque en el centro sigue y los vuelve a ocultar. Se recuerda en el dispositivo (`gp-vw-conc`).
- **Más atajos en el visor** (**?** o ⋯ → ⌨ Atajos de teclado los muestra todos): S, H, R y N (herramientas), 1–5 (colores), + y − (zoom), W (ajustar), G (ir a página), I (índice), L (anotaciones), E (notas del paper), F (pantalla completa), D (doble página), P (página a página), A (automático), C (concentración) y ↑ ↓ (velocidad del automático). Esc cierra antes un menú abierto.
- **Tamaño del texto de la interfaz** (accesibilidad), en Configuración → Apariencia: 90 % a 160 %, en este dispositivo (`gp-ui-fz`). También con **Alt+Mayús+↑ / ↓** (se cambian en Atajos), incluso con el visor o una ventana abiertos. Todos los `font-size` de los CSS van multiplicados por `--fz`; las páginas del PDF no cambian. En el móvil los campos nunca bajan de 16 px.
- Pruebas: `python3 pruebas/prueba_visor_mejoras.py .`

## Visor: recorte de márgenes, marcadores y gestos de zoom (v39.40)
- **✂ Recortar los márgenes (automático)**, en **⋯ → 📖 Modo de lectura**: mide dónde hay texto o imágenes en unas cuantas páginas repartidas por el PDF y quita el blanco de alrededor, con el mismo recorte para todas (la página no baila al pasar; una página distinta, como una portada a sangre, no lo estropea). Al ajustar al ancho la letra se ve más grande. Funciona con una página, doble página, página a página y el desplazamiento automático; los subrayados, notas y la búsqueda siguen en su sitio. Se recuerda en el dispositivo.
- **🔖 Marcadores**, en **⋯ → 🔖 Marcadores**: marcar o quitar la página actual, ir al anterior o al siguiente y la lista para saltar a cada uno; «Quitar todos». Atajos: **B** marca o quita, **[** y **]** van al anterior y al siguiente. Las páginas marcadas llevan 🔖 arriba a la derecha. Se guardan con el PDF del paper (campo `bm`), así se sincronizan con Drive y se pueden deshacer.
- **Gestos de zoom**, en **⋯ → 📖 Modo de lectura → Gestos de zoom**: **🤏 pellizcar con dos dedos** y **👆 doble toque** (acerca unas dos veces donde tocas; otro doble toque vuelve a ajustar). Los dos vienen activados y se pueden quitar. En pantalla completa el doble toque sigue sacando los colores.
- Pruebas: `python3 pruebas/prueba_visor_extras.py .`

## Visor: modo de lectura (v39.39)
Todo está en un submenú: **⋯ del visor → 📖 Modo de lectura** (el menú muestra el modo actual; «‹ Volver» regresa a ⋯). Se recuerda en este dispositivo (`gp-vw-read` y `gp-vw-auto` en localStorage).
- **Doble página**: las páginas de dos en dos, como un libro abierto, ajustadas al ancho. «La primera página sola (portada)» deja la 1 sola y empareja 2-3, 4-5… → y ← pasan de par en par.
- **Página a página, con toques a los lados**: solo se ve la página actual (o el par, con doble página), entera en la pantalla. Un toque (o clic) en el 30 % izquierdo o derecho pasa a la anterior o la siguiente, también fuera de la página; el centro sigue como siempre (subrayar, abrir anotaciones, toques de pantalla completa). También ← →, y RePág/AvPág al llegar al borde. Buscar, el índice y las anotaciones saltan a su página.
- **⏬ Desplazamiento automático**: la página baja sola. Abajo sale una barra con **⏸ pausa**, 🐢 **barra de velocidad** (1 a 20) 🐇, el número de la velocidad y ✕ para parar. **Toques en la página**: centro, pausa o sigue; izquierda, más despacio; derecha, más deprisa. La barra espaciadora pausa. Espera mientras tienes el dedo en la pantalla y sigue desde donde lo dejes; al final del PDF se pausa. La velocidad va en puntos del PDF por segundo, así que no cambia al hacer zoom. Usa la vista seguida (si estaba en página a página, cambia a ella).
- Pruebas: `python3 pruebas/prueba_visor_lectura.py .`

## Revisión de seguridad, fallos y rendimiento (v39.35)
- **Seguridad**: los identificadores de un archivo JSON o de Google Drive (papers, etiquetas, secciones, notas, plantillas, clasificaciones, anotaciones) solo admiten letras, números, «_» y «-»; cualquier otro se cambia por su huella, con todas sus referencias. Los colores de etiquetas y secciones se validan. Además, los `data-on…` solo pueden llamar a funciones de la aplicación: ni `window`, ni `document`, ni el almacenamiento, ni funciones del navegador. Un archivo preparado ya no puede ejecutar nada al abrirlo.
- **Notas**: una línea con muchas marcas sin cerrar (`* * * …`) ya no bloquea la página (el analizador recuerda lo que ya probó).
- **Proyectos**: si la copia de trabajo de un proyecto no se puede leer, se aparta sin pisarla, se avisa y la sincronización deja de entender que se han borrado sus papers. Si la copia de trabajo no se puede guardar (sin espacio), ahora se avisa.
- **PDF**: una limpieza diaria borra de este navegador las copias, enlaces y portadas de PDF (y enlaces de imagen) que ya no usa ningún proyecto ni copia de seguridad; también al borrar un proyecto y en «Borrar datos de este navegador». Al fusionar duplicados y al citar desde la bandeja, el PDF conserva su archivo (también al deshacer).
- **Guardar**: un cambio hecho mientras se escribe el archivo ya no queda marcado como guardado.
- **Rendimiento**: la vista agrupada pinta las secciones largas por partes; las etiquetas de las tarjetas se colocan midiendo todas a la vez; «citado por» se calcula una vez por pintado; al escribir en un campo, la copia para deshacer se hace al parar; la sincronización con imágenes incrustadas trabaja con sus huellas; el grafo de relaciones hace menos pasadas con muchos nodos; subidas y borrados de Drive van varios a la vez; la limpieza de imágenes pasa a ser diaria.
- **Detalles**: BibTeX escapa `\`, `~`, `^` y las llaves sueltas, y las claves repetidas siguen tras la «z» (aa, ab…); Word ya no recibe caracteres de control; el orden manual se sincroniza sección a sección; la tarjeta se recoloca al cambiar una etiqueta si se filtra u ordena por etiquetas.

## Sincronización tras cambiar la paleta (v39.34)
- Al elegir la **paleta personalizada** (o cambiar uno de sus colores) la cabecera se quedaba en «Sin guardar…» aunque el cambio ya estaba en Google Drive. Pasaba cuando ese ajuste se añadía después de otro ajuste propio del dispositivo (p. ej. las columnas de la tabla): la copia era la misma, pero con los campos en otro orden, y la comparación final no la daba por guardada. Ahora se compara la copia normalizada y vuelve a decir «Guardado en Google Drive».

## Pie de la barra lateral adaptable (v39.33)
- El pie (Relaciones, Papelera, Configuración e Información) sigue fijo al fondo de la pantalla, pero **se ve como antes, cada uno en su línea y con su nombre, mientras todo cabe**. Solo cuando lo de arriba no cabe (grupos desplegados, muchas etiquetas, la Selección…) se junta en una fila de iconos, y vuelve a la lista al plegarlos. Se mide siempre con el pie normal, así que no parpadea en el límite.
- Con la barra plegada (☰) sigue la columna de iconos, y en el móvil el cajón va siempre con el pie normal.

## Barra lateral ordenada (v39.32)
- **Selección** sale arriba del todo (justo bajo Buscar) al marcar papers, en un panel compacto con el mismo diseño que el de ☑ Visibles: lectura en botones, estrellas, etiquetas y secciones como chips (a rayas si solo las tienen algunos) y Exportar, A otro proyecto, Papelera y Quitar selección.
- **Ordenar ⇅** sale de Buscar y tiene su propia línea, que muestra el orden actual («Título ▲ · por sección»); al pulsarla se despliega.
- **Filtros con el mismo diseño**: cabeceras iguales con iconos (📄 notas, ✎ gestionar) y la valoración mínima (⭐) y los años (📅) juntos en una sola línea compacta.
- **Vistas y posiciones en una lista**: «＋ Guardar» pregunta si guardar una ⭐ Vista (búsqueda, orden y filtros) o unas 📌 Posiciones (cómo están colocados los papers); las dos salen en la misma lista.
- **Pie fijo** (ordenador): Relaciones, Papelera, Configuración e Información son una fila de iconos que se queda siempre al fondo de la pantalla, aunque la lista sea muy larga; lo de arriba se desplaza por su cuenta. El texto legal va más pequeño debajo.

## Edición, etiquetas en la tabla, panel de ☑ y portada del PDF (v39.31)
- **Al editar** («Ver todo» y la pestaña de clasificación), el bloque **Secciones** va justo después de **Cita** y antes de **Etiquetas**.
- **Tabla en el ordenador**: un clic en la celda de etiquetas abre un menú con todas las etiquetas (y un buscador si hay más de 8). Cada clic pone o quita una y el menú sigue abierto. Arrastrar una etiqueta de la barra lateral a una fila sigue funcionando.
- **Panel de ☑ Visibles** (clic derecho, o mantener pulsado en el móvil) más compacto y visual, con todo lo del grupo «Selección» de la barra lateral (que se queda como estaba): la lectura en botones, la valoración con estrellas, las etiquetas y secciones como chips (llenos si las tienen todos los elegidos, a rayas si solo algunos; pulsar pone a todos o quita), y Exportar, A otro proyecto, Papelera y Quitar selección. Los cambios se aplican al momento y el panel no se cierra.
- **Portada del PDF**: un paper sin imagen y con PDF muestra en las tarjetas y la tabla la primera página de su primer PDF, como la bandeja. Se saca sin pedir nada (del archivo si ya hay permiso o de la copia del navegador) y se guarda en este navegador; si no se puede leer todavía, sale la primera vez que abres ese PDF. Si cambias el PDF, se saca la nueva. Una imagen propia siempre manda, y «Mostrar la imagen del paper» la oculta también.

## Varias secciones a la vez, arrastrar la selección y fila que no tapa (v39.30)
- **Filtro de secciones con varias a la vez**, como las etiquetas: cada sección que pulsas se añade o se quita, y se ven los papers que están en cualquiera de ellas. «Todas» quita el filtro. En el móvil, el menú de «Sección» se queda abierto para marcar varias. Las vistas guardadas recuerdan todas las secciones elegidas (las de versiones anteriores, con una sola, siguen funcionando).
- **Arrastrar varios papers a la vez**: si arrastras un paper que está seleccionado a otra sección (vista agrupada, en el ordenador o en el móvil), se mueven todos los seleccionados, con sus notas; un solo Ctrl+Z lo deshace. En el orden manual, los seleccionados se colocan juntos.
- **En el ordenador, las secciones y etiquetas de la fila de arriba ya no quedan tapadas**: si no caben en la fila, pasan debajo en varias líneas, como en el móvil; si caben, siguen en la misma fila.

## Fila de filtros aún más fina en el móvil (v39.29)
- Los botones de «Filtros: … ✕ · Limpiar todo» miden 20 px de alto (antes 26 px) con letra de 11,5 px, y la fila casi no tiene margen.
- Con filtros aplicados, la cuenta «4 de 6 · 0 sel.» pasa a la derecha de la fila de filtros, en vez de ocupar una línea propia debajo de los botones.

## Fila de filtros aplicados más compacta (v39.28)
- En el móvil, la fila «Filtros: … ✕ · Limpiar todo» es más baja (botones de 26 px en vez de 34 px, letra algo menor) y casi sin margen arriba y abajo.
- En el móvil, el aviso «Aún no hay etiquetas.» (o secciones) de la fila de arriba es una línea fina, más pequeña y sin hueco alrededor.
- Con filtros aplicados, la primera sección de la lista queda pegada a esa fila (sin el hueco de 20 px de encima del título), también en el ordenador.

## Posiciones guardadas, dentro de Vistas (v39.27)
- El botón **📌 Posiciones guardadas…** pasa de «Ordenar» a la sección **Vistas ⭐** de la barra lateral, debajo de la lista de vistas: las dos cosas sirven para volver a algo guardado.

## Tablet en horizontal: Sección y Etiquetas como en el móvil (v39.26)
- En **cualquier pantalla táctil** (también una tablet en horizontal, que no usa el modo móvil), tocar **Sección** o **Etiquetas** abre el mismo menú que en el móvil: mostrarlas debajo, agrupar (y plegar o desplegar todas), cómo combinar etiquetas, elegir con el número de papers de cada una, y gestionar.
- Las filas de secciones y de etiquetas van **debajo de la barra**, en varias líneas, en vez de una sola fila que se desplaza de lado.
- En el ordenador con ratón todo sigue igual (clic: mostrar u ocultar la fila; clic derecho: su menú).
- Arreglo: el botón «Guardar» de 📌 Posiciones guardadas no se veía.

## Orden manual, posiciones guardadas y secciones plegables (v39.25)
- **Colocar papers a mano**: arrastra un paper sobre otro (mitad de arriba: delante; de abajo: detrás). En el móvil, mantén pulsado medio segundo y mueve el dedo; una línea marca dónde caerá. Funciona en tarjetas y tabla, agrupado por sección (cada sección tiene su propio orden) o sin agrupar. Soltarlo sobre un paper de otra sección lo cambia de sección y lo deja en ese sitio.
- Al colocar uno, el orden pasa a **«Orden manual (arrastrando)»**, que parte del orden que se veía. Se puede elegir otro orden y volver a éste sin perderlo. Los papers nuevos van al final de su sección.
- **📌 Posiciones guardadas…** (un solo botón en «Vistas ⭐», en la barra lateral; hasta v39.26 estaba bajo «Ordenar»): guarda con un nombre cómo están colocados ahora los papers, para volver a ese orden después, o borrarlo con ✕. Se sincroniza con Drive.
- **Secciones plegables** (vista agrupada): clic o toque en el título de la sección la pliega o despliega (▾/▸, sigue mostrando cuántos papers tiene). «Plegar todas» y «Desplegar todas» en el menú de Secciones. Se recuerda en cada dispositivo.

## Más apretado y vista partida ajustable (v39.23)
- **Tabla del móvil en dos líneas**: título; y debajo autores · año · revista seguidos de lectura, estrellas, etiquetas y notas (las etiquetas se recortan primero).
- **Visor + notas: divisor arrastrable** entre el PDF y las notas para repartir el espacio (del 20 % al 80 %; se recuerda en el dispositivo). Doble clic: mitad y mitad. También con las flechas del teclado.
- **Tablet en vertical**: vista partida con el PDF arriba y las notas abajo, con el mismo divisor (arrastrar arriba o abajo). Desde v39.24 depende del tamaño de la pantalla (lado corto de unos 600 px o más, ≈ 7″): también en tablets que usan el modo móvil de la app. En un teléfono las notas siguen a pantalla completa.

## Móvil: arrastrar entre secciones y menú de ☑ (v39.21)
- **Arrastrar con el dedo** (vista agrupada por sección, tarjetas o tabla): mantén pulsado un paper medio segundo sin mover el dedo, sale su etiqueta y luego lo llevas a otra sección (o a «Sin sección»). Cerca del borde, la lista se desplaza sola. Si mueves el dedo enseguida, solo desplazas la lista.
- **☑ con menú**: clic derecho (en el móvil, mantener pulsado) en ☑ para elegir: los que se ven o todos los del proyecto. Con algo elegido, también lo del grupo «Selección»: lectura, valoración, etiqueta, sección, exportar citas, mover o copiar a otro proyecto, enviar a la papelera y quitar la selección (v39.22). Un toque normal sigue eligiendo los que se ven.
- **Tabla del móvil más compacta** (v39.22): menos aire y letra y botones algo más pequeños; cada ficha ocupa ~20 % menos.

## Notas del paper dentro del visor de PDF (v39.19)
- En la barra del visor, **📝 Notas** abre la ficha del paper en «Notas» (nota general y notas por sección), con todo el editor: formato, listas, plantillas, enlaces, añadir o quitar notas, cambiar su sección y «Traer anotaciones del PDF». También están las demás pestañas de la ficha.
- **En el ordenador y la tablet**, las notas ocupan la mitad derecha y el PDF sigue a la izquierda: se puede leer, desplazar y subrayar mientras escribes.
- **En el móvil** ocupan toda la pantalla, menos la barra del visor. **📄 Ver el PDF** (o 📝) va al PDF y vuelve a las notas sin perder lo escrito.
- Al cerrar el panel (otro toque en 📝, Esc o «Guardar paper»), o al salir del visor, se guarda. «Cancelar» descarta los cambios.

## Columnas de la tabla (v39.17)
- **Ordenar desde la cabecera**: un clic en cualquier cabecera ordena por esa columna (otro clic invierte el sentido), también **Secciones** y **Etiquetas**. Estas dos usan tus **clasificaciones** (Gestionar etiquetas/secciones): la de más arriba manda y las de debajo desempatan; «⬆ Subir» cambia cuál va primero. Después, el orden de la lista de Gestionar. Los papers sin ninguna, siempre al final. Ambas están también en «Ordenar» (v39.18).
- **Mover columnas**: en el ordenador, arrastra una cabecera y suéltala sobre otra (a su izquierda o derecha), o usa el clic derecho → «Mover a la izquierda/derecha». En la lista de columnas, ↑ y ↓ las mueven también.
- **Ocultar columnas**: clic derecho en una cabecera → «Ocultar esta columna», o desmárcala en la lista «Columnas que se ven». El título siempre se ve. «Restablecer las columnas» vuelve a lo de siempre.
- **En el móvil**: botón **⚙** pequeño en la barra de Tarjetas (solo en la vista de tabla), con toques normales: nada se abre por una pulsación larga ni por tocar la cabecera. Cada fila es una ficha de tres líneas: título; autores · año · revista; y el resto de columnas. Muestra solo las columnas visibles, en tu orden (v39.20).
- Las columnas se guardan en el JSON, pero son de cada dispositivo (no se sincronizan), como la vista de tarjetas o tabla.

## Clasificaciones para ordenar (v39.16)
En **Gestionar etiquetas** o **Gestionar secciones**, «＋ Nueva clasificación» crea un criterio de orden propio (p. ej. «Días»), con valores en **números** (1, 2, 3…), **letras** (A, B, C…; AA va tras Z), **números romanos** (I, II, III…; solo bien escritos) o **texto libre**. Puede haber varias a la vez, de etiquetas y de secciones.
- Con una clasificación elegida, cada etiqueta o sección tiene una casilla para su valor (en rojo si no se entiende, p. ej. «IIII»).
- **Ordenar**: cada clasificación sale como criterio (🏷️ o 📁 + su nombre). Cada paper usa el valor más bajo de sus etiquetas o secciones; los que no tienen ninguna con valor van al final, en ambos sentidos. «⇅ Ordenar los papers por…» lo aplica directamente y «Ordenar también esta lista» reordena las propias etiquetas o secciones.
- Se guardan en el JSON del proyecto (`orders`: `{id, name, of: 'tags'|'sections', fmt: 'num'|'alpha'|'roman'|'text'}`; cada etiqueta o sección, en `rk: {idClasificación: valor}`) y se sincronizan con Google Drive valor a valor. Las vistas ⭐ las recuerdan.

## Pestaña aparte, otras apps, comentarios y más (v39.1)
- **Visor en otra pestaña** (ordenador): 📄 abre el visor en una pestaña nueva para seguir usando la aplicación a la vez (Configuración → Datos: «en una pestaña nueva» o «dentro de la aplicación»; Ctrl + clic hace lo contrario; en móvil y tableta, siempre dentro). La pestaña del visor (`index.html?vw=…`) no guarda por su cuenta: manda cada cambio de las anotaciones a la principal por `BroadcastChannel('gpapers-vw')` y recibe lo que cambie allí (deshacer, Drive). Si la principal se cierra o cambia de proyecto, el visor pasa a guardar él mismo; al volver a abrir la aplicación, le devuelve el proyecto.
- **Abrir en otra app** (⋯ del visor): con el menú «Compartir» del sistema (Acrobat, Drive, Foxit…), el PDF tal cual o con las anotaciones; sin él, el visor del navegador.
- **Sacar los comentarios** (panel 💬): 📋 Copiar, 📝 A las notas y ⬇ .md, en formato texto, Markdown o con la cita en el texto («…» (Pérez, 2024, p. 3)); con todas, una sola nota «Anotaciones del PDF» por PDF que se actualiza; con un filtro o «Elegir», una nota nueva. Opción «Mantener al día» (Configuración) y botón «📄 Traer anotaciones del PDF» en la ficha.
- **Copiar o mover a otro proyecto** también desde el menú ▾ del proyecto; los PDF enlazados (y sus anotaciones) viajan con el paper.
- **Google Drive**: el botón dice si hay sesión (en el móvil se lee en ⋯) y Configuración → Datos tiene «Sincronizar ahora» y «Cerrar sesión». Cambiar de proyecto es más rápido: los cambios e imágenes se descargan a la vez y los PDF se suben después, sin hacer esperar; el menú 🔄 dice cuánto tardó la última vuelta.

## Móvil y bandeja (v39.2)
- **Zoom nítido**: con mucho zoom, la página entera no cabe en memoria a resolución completa (`vwMaxPx`); al parar, se repinta a resolución completa solo el trozo que se ve (`vwDetail`).
- **Panel de anotaciones en el móvil**: hoja desde abajo (antes salía fuera de la pantalla, porque es un `<aside>` y heredaba el estilo del menú lateral).
- **Tocar para leer**: las notas 🗒 se abren con el dedo y son más grandes; los subrayados con comentario llevan 💬; con el dedo hay más margen para acertar.
- **Botón «atrás» del móvil**: cierra la ventana o el menú abiertos (ficha, Configuración, Exportar, menú lateral…) en lugar de salir de la aplicación.
- **Bandeja «PDF por citar»**: por defecto debajo de la lista (Configuración: encima); opción de mostrarla solo con el botón 📄 N de la cabecera; «🖍 N anotaciones · ver» abre el PDF con la lista de anotaciones.

## Google Drive más rápido (v39.3)
- **Cambiar de proyecto sin esperar**: el proyecto que dejas se guarda aquí al momento y sus cambios se suben a Drive en segundo plano (`syStored`, fusionando con lo que haya llegado de otros dispositivos); el nuevo se abre enseguida. Al arrancar, se suben también los de otros proyectos que no llegaron a Drive.
- **Primero las citas**: cada vuelta lista solo los archivos del proyecto abierto (la limpieza de proyectos borrados, una vez al día); las imágenes que ya están en este dispositivo no se vuelven a descargar, y los PDF van después, en cola.

## Bandeja 🗃️ (v39.4)
- La bandeja «PDF por citar» lleva el icono 🗃️ (sección, botón de la cabecera y menús).
- **Crear todas las citas**: con varios PDF con DOI, las busca a la vez en CrossRef y crea los papers; las que fallan (o ya estaban, o sin DOI) se quedan en la bandeja y se dice cuáles. Un solo «Deshacer».
- **Duplicados**: si el DOI ya es un paper de la biblioteca, avisa («Ya tienes este paper: …») con «🔗 Enlazar a ese paper»; «Crear cita» pregunta antes de duplicarlo.

## Visor: índice, páginas, modo noche (v39.5)
- **Panel con pestañas**: 💬 Anotaciones, 📑 Índice (el marcador o «outline» del PDF, con niveles; en el móvil, hoja desde abajo que se cierra al saltar) y ▦ Páginas (miniaturas pequeñas, pintadas al verlas). Botón 📑 en la barra de herramientas.
- **Notas aparte**: la lista separa 🖍 Subrayados (y zonas) de 🗒 Notas, con filtro por tipo.
- **Borrar varias**: con «☐ Elegir», «☑ Todas las de la lista» y «🗑 Borrar (N)», con un solo «Deshacer».
- **🌙 Modo noche** (⋯): PDF.js pinta el texto y los trazos con colores oscuros (`pageColors`) y deja las imágenes como son. Se recuerda en este dispositivo; también «como el sistema».

## Anotaciones de otros programas (v39.6)
- Al abrir un PDF con anotaciones nuevas hechas en Acrobat, Foxit u otro lector, avisa: «Hay N anotaciones nuevas hechas en otro programa: ¿traerlas?». «Traer» las hace editables; «Ahora no» no vuelve a preguntar por esas (se recuerda en el dispositivo). No cuentan las que escribió GPapers (autor «GPapers») ni las ya traídas.
- Los avisos con botones («Deshacer», «Traer»…) se ven y se pueden pulsar también con el visor o una ficha abiertos.

## Resumen de anotaciones (v39.7)
- **Exportar → «🖍 Resumen de anotaciones…»**: para los papers seleccionados, los visibles con los filtros o todos, la cita completa en el estilo de Exportar y debajo sus subrayados (con comentario), zonas y notas, por página y de arriba abajo. Se descarga en Word (.docx), PDF (pdf-lib, letra Times) o Markdown. Código en `js/resumen.js`; el paquete .docx se comparte con Exportar (`docxPack`).

## Visor de PDF, bandeja «PDF por citar» y Drive normal (v39.0)
- **Visor propio** (botón 📄 de la tarjeta o de la ficha): PDF.js 4.10 en `lib/pdfjs/`, cargado solo la primera vez que abres un PDF (no pesa al arrancar). Pinta solo las páginas que se ven, libera las lejanas y limita el tamaño del lienzo en móviles. Zoom con Ctrl + rueda, botones o pellizco; ir a página; buscar (Ctrl + F); el botón «atrás» del móvil lo cierra. Recuerda la página donde lo dejaste (desde v39.41, también al salir de la app y el punto exacto).
- **Anotar**: selecciona texto y elige un color (amarillo, verde, azul, rojo, morado), o usa las herramientas Subrayar (arrastrar), Zona (rectángulo) y Nota (toque). Cada anotación admite un comentario, se puede recolorear, copiar, borrar (Ctrl + Z deshace) y mandar «A las notas» del paper con la página. El panel 💬 las lista por página, filtra por color o «con comentario» y exporta a Markdown.
- **Dónde se guardan**: dentro de la biblioteca, en `pdf.ann` de cada paper (coordenadas en el espacio del PDF, independientes del zoom). Viajan con la sincronización y se fusionan anotación por anotación entre dispositivos. El PDF de la carpeta oculta sigue siendo el original.
- **Acrobat y Foxit**: «⬇ PDF anotado» escribe con pdf-lib (`lib/pdf-lib.min.js`) anotaciones estándar (Highlight con QuadPoints y apariencia, Text para las notas, comentario en Contents con ventana Popup). Reescribirlo solo cambia las de GPapers (`NM gpapers-…`) y respeta las que ya traía el PDF. Las anotaciones que el PDF ya traía se ven en el visor y se pueden «hacer editables».
- **Bandeja «PDF por citar»** (sección de la portada, uno a uno; también desde Importar, el menú ⋯ o soltando PDF): lee el DOI y adivina el título; «Crear cita» la busca en CrossRef y crea el paper con el PDF ya enlazado, o «Asignar a un paper» existente. Se puede ocultar en Configuración.
- **Drive normal (opcional)**: en Configuración → Datos, «Guardar también los PDF en mi Drive normal» (y, por PDF, en la ficha) sube una copia anotada a la carpeta visible «GPapers», con nombre «Apellido Año - Título.pdf». Pide una vez el permiso `drive.file` (no sensible: no necesita verificación de Google, pero hay que añadirlo a la pantalla de consentimiento OAuth). Solo se vuelve a subir si cambian las anotaciones.
- Desde `file://` el visor propio no puede cargar sus módulos: el PDF se abre en el visor del navegador.
- Archivos nuevos: `js/visor.js`, `js/bandeja.js`, `visor.css`, `lib/`. Pruebas: `pruebas/prueba_visor.py` (con `pruebas/prueba.pdf`).

## Barras de una línea en escritorio (v38.3)
- En ventanas estrechas del navegador (no en móvil), la cabecera y la fila de «Nuevo paper» ya no saltan de línea: `fitBars` (js/lista.js) añade la clase `cmp` si no caben, y algunos botones quedan solo con su icono (el texto completo sigue en su título). Si aún falta sitio, el nombre del proyecto se corta con «…», la búsqueda se estrecha y las etiquetas de la fila se desplazan en horizontal (también con la rueda).

## Motor, avisos, teclado y más (v38.2, fase C)
- **Copias por papers** (`snapDb` en js/persistencia.js): cada copia para deshacer es `{head, parts}` con el JSON de cada paper aparte (sin historial y con las imágenes como huella); lo que no cambió reutiliza la misma cadena. Con 2000 papers, las 50 copias de deshacer pasan de ~183 MB a ~4 MB, y un cambio en un móvil medio, de ~285 a ~140 ms (la copia de trabajo reutiliza la copia recién hecha, `SNAP_SES`; al ocultar o cerrar la app se escribe siempre entera). Deshacer conserva el historial del día.
- **Avisos y confirmaciones propios** (`say`, `askOk` en js/modelo.js) en lugar de `alert` y `confirm`; eliminar un paper ya no pregunta: va a la papelera con «Deshacer» en el aviso. Las pruebas contestan solas con `window.ASK_AUTO`.
- **Teclado**: ↑/↓ (o j/k), Intro, Espacio y Supr en la lista; **paleta de órdenes** con Ctrl+K (configurable) para acciones y papers.
- **Duplicados aproximados**: títulos casi iguales (Dice de bigramas ≥ 0,9, mismos números, años a ±1) al importar («Parecido», desmarcado) y en «Buscar duplicados» («título parecido»).
- **Completar con OpenAlex** (botón junto al DOI en Datos): resumen y número de citas a las notas generales y PDF en abierto como URL.
- **Tema claro u oscuro a mano** (Configuración → Apariencia → Paleta): Automático, Claro u Oscuro, de cada dispositivo (`gp-theme`).

## Añadir papers más rápido (v38.1, fase B)
- **Buscar por DOI, ISBN o título** (📥 Importar → 🔎): un DOI va a CrossRef; un ISBN, a Open Library (`fetchIsbn`); unas palabras del título muestran hasta 6 resultados de CrossRef para elegir (`searchTitle`). La CSP permite `openlibrary.org` (y `api.openalex.org`, para la fase C) y la política de privacidad lo explica.
- **Compartir con la app** (Android): `share_target` en `manifest.json`; lo compartido llega como `index.html?title=…&text=…&url=…` y `shareIn` busca un DOI, un ISBN o el título y abre Importar.
- **Soltar archivos** en la ventana: .bib, .ris, .txt o CSL-JSON abren Importar; un .json de la aplicación se abre como proyecto (con su enlace al archivo en Chrome/Edge).
- **CSL-JSON**: se importa (`parseCsl`) y se exporta (formato «CSL-JSON» en Exportar, `cslJSON`).

## Motor, búsqueda y selección (v38.0, fase A)
- **Búsqueda por palabras**: cada palabra por separado y en cualquier orden («garcía 2020»), en título, alias, año, autores, revista, DOI, etiquetas y secciones (y notas y citas con la casilla). Admite `"frase exacta"`, `-palabra`, `autor:`, `año:2020` / `año:2010-2020`, `revista:`, `doi:`, `#etiqueta` (o `etiqueta:`) y `seccion:` (`qParse`/`qTest` en js/lista.js). Las palabras encontradas se **resaltan** en título y autores de tarjetas y tabla (`hl`).
- **Acciones en lote** (grupo Selección): estado de lectura, valoración, añadir o quitar etiqueta y sección, y enviar a la papelera; cada una se deshace con un solo Ctrl+Z (también desde el aviso).
- **Varias pestañas**: si el mismo proyecto ya está abierto en otra pestaña, la nueva queda en pausa (no guarda ni sincroniza) con «Usar en esta pestaña»; la otra guarda lo pendiente y pasa a pausa (`TAB`, BroadcastChannel «gpapers», en js/extras.js).
- **Sincronización sin trabajo repetido**: normalizar la biblioteca (`syNormS`) recuerda sus últimos resultados por la huella del JSON, así cada vuelta con Drive ya no lo hace 4 veces (con 2000 papers, ~1,2 s menos de pantalla congelada en un móvil medio).
- **Copias de seguridad ligeras**: `bk:<id>` es solo el índice y cada copia va en `bkd:<id>:<k>`, compacta y con las imágenes aparte (`imgd:`); al abrir ya no se leen todas las copias. Las de versiones anteriores se convierten solas.

## Rendimiento (v37.6–v37.7)
- Al abrir, la lista se pinta **una sola vez**, cuando ya se han leído la copia de trabajo y el estado de la interfaz (`RENDER_HOLD` en js/lista.js), y la copia recuperada no se vuelve a escribir.
- En el móvil la lista se pinta **de 40 en 40** (150 en el escritorio); el resto se añade al bajar.
- La sincronización con Google Drive al abrir espera a que la lista ya se vea (`afterPaint` en app.js).
- (v37.7) La **copia de trabajo** en IndexedDB es JSON compacto y guarda cada imagen incrustada **aparte**, una sola vez («imgd:<huella>»; el JSON lleva `{kind: 'data', ref}` y `img: 1`); guardar tras un cambio ya no reescribe todas las imágenes. Las que ya no usa ningún proyecto se borran al abrir (`imgGc`). El archivo JSON que guardas o exportas sigue llevando las imágenes dentro, como siempre.
- (v37.7) Las miniaturas incrustadas se muestran con URLs `blob:` en vez de copiar el base64 en el HTML de cada tarjeta, y la app usa una sola conexión a IndexedDB (`idbOpen`).

- (v37.8) Los avisos de reconectar con Google (`toast(…, 'sy')`) se quitan solos en cuanto vuelve el acceso, y pulsar un botón de un aviso lo cierra.

## Cambios de la ronda F7–F9
- **Tabla:** columna *Secciones* (se puede seguir agrupando por sección). La pestaña **Cita** va justo después de **Datos**. La **valoración mínima** está en *Filtros*.
- **Imagen del paper** (Datos → recuadro junto a los títulos; también se puede pegar con Ctrl+V una imagen copiada, p. ej. de Google Imágenes): una URL, un **archivo local enlazado** (Chrome/Edge: se guarda solo el nombre en el JSON y el enlace en este navegador, que puede pedir permiso al abrir) o una **copia reducida incrustada** (máx. 480 px, viaja con el JSON). Se ve en tarjetas y tabla; Configuración permite ocultarla.
- **Estilos de cita personalizados** (Configuración): se crean desde cero con una plantilla por tipo de documento y se guardan en `settings.customStyles` del JSON. Sintaxis: `{campo}` inserta un dato, `{campo:i:q}` aplica formato (cursiva, negrita, comillas, paréntesis, mayúsculas, `pp` para páginas…), `{year|s.f.}` da una alternativa si está vacío y `[ … ]` es un grupo opcional que solo sale si todos sus campos tienen valor. También se configuran los autores (formato, conjunción, «et al.»), las fechas, el orden y la numeración, y la cita en el texto. Aparecen en Exportar y en la pestaña Cita.
- **Estilos personalizados, más control:** «+ Nuevo a partir de…» crea un estilo propio con las plantillas de APA 7, Vancouver, MLA, IEEE, Chicago (2 variantes) o UNE-ISO 690 (2 variantes) para los tipos más comunes (artículo, libro, capítulo, congreso, tesis, web y prensa; los demás usan la plantilla por defecto), listas para modificar. Con el **botón derecho sobre un campo** de la plantilla (o sobre su botón en la lista de campos) se abren las opciones de ese campo y se escriben solas como `{campo:opción=valor}`: en autores y editores el formato, separadores, conjunción, límite con «et al.», mayúsculas y un **formato personalizado de cada autor** (`{L}, {g}`, `{g} {l}`, `{i} {l}`…); en fechas el formato o un patrón propio (`D de MMMM de YYYY`); en páginas «p./pp.», raya o solo la primera; además cursiva, negrita, mayúsculas, comillas, texto antes/después y valor alternativo. Cada estilo puede fijar su idioma (español/inglés).
- **Tipos de documento propios** (Configuración): para lo que los predefinidos no contemplan. Eliges qué campos muestra el formulario y cómo se llaman, y con qué tipo predefinido se cita en los estilos de serie. Aparecen en el desplegable «Tipo» de cada paper (grupo «Tipos propios»), que además permite «➕ Crear un tipo propio…» sobre la marcha. Los estilos propios ven todos los campos y pueden tener una plantilla específica para el tipo. Se guardan en `settings.customTypes`.
- **Ayuda** (botón ❓ de la barra lateral, bajo Configuración y una línea, o F1): explica todas las funciones, la configuración, los tipos propios y la creación de estilos de cita personalizados, con buscador.

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

## Interfaz simplificada (v33)
- **Cabecera**: solo Google Drive 🔄, Guardar 💾, 📥 Importar y Exportar citas; Abrir, Guardar como, Importar referencias y Autoguardado están en **Archivo ▾**. «Reabrir último» pasó al menú ▾ del proyecto («↻ Volver a leer…», solo si el proyecto tiene archivo) y «Buscar duplicados» también.
- **Estado de guardado único** junto al nombre del proyecto («Guardado», «Sin guardar», «Guardado en Google Drive», «Sincronizando…»…), con un punto de color.
- **Barra lateral**: Secciones, Etiquetas y Lectura en un solo grupo **Filtros**; **Selección** solo aparece con papers marcados («☑ Seleccionar visibles» está sobre la lista).
- **Configuración por pestañas**: Apariencia, Notas y citas, Atajos, Datos y Drive. El progreso de lectura es opcional (desactivado por defecto).
- **Ayuda**: «Empezar aquí» y, bajo «Ver toda la ayuda», el resto (la búsqueda abre todo).
