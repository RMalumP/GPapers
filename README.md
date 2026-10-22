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
y en «Copiar con formato» y en Word se convierte. En la pestaña Cita puedes escribir `*texto*` para cursiva (un asterisco literal, `\*`).
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
