const fs = require("fs");
const path = require("path");

/**
 * Convierte un bloque de texto en texto citado con prefijo "> " para cada línea.
 */
function citarTexto(texto) {
  if (!texto) return "";
  return texto
    .split("\n")
    .map((l) => (l.trim() ? `> ${l}` : ">"))
    .join("\n");
}

/**
 * Genera el contenido en formato Markdown optimizado para LLMs e IAs
 */
function generarMarkdown(temaData, materiaInfo, tieneAdjuntosLocales = true) {
  const lineas = [];

  lineas.push(`# Tema: ${temaData.tituloTema}`);
  lineas.push("");
  lineas.push(`- **Materia:** ${materiaInfo.nombre} (${materiaInfo.codigo || "Comisión " + materiaInfo.idComision})`);
  lineas.push(`- **Comisión ID:** ${materiaInfo.idComision}`);
  lineas.push(`- **Tema ID:** ${temaData.idTema}`);
  lineas.push(`- **Total de Mensajes:** ${temaData.totalMensajes}`);
  lineas.push(`- **Fecha de Extracción:** ${new Date().toLocaleString("es-AR")}`);
  lineas.push("");
  lineas.push("---");
  lineas.push("");

  for (const m of temaData.mensajes) {
    const rolTexto = m.rol ? ` (${m.rol})` : "";
    const fechaTexto = m.fecha ? `*Fecha: ${m.fecha}*` : "";

    let adjuntosMd = "";
    if (m.adjuntos && m.adjuntos.length > 0) {
      const links = m.adjuntos.map((a) => {
        const ref = tieneAdjuntosLocales ? `adjuntos/${a.nombreArchivo}` : a.url;
        return `- [${a.nombreArchivo}](${ref})`;
      });
      adjuntosMd = `\n\n**Adjuntos:**\n${links.join("\n")}`;
    }

    if (m.esRespuesta) {
      // Formato para respuestas secundarias (identadas con cita)
      const encabezado = `> #### [Respuesta #${m.id} a #${m.parentId}] ${m.autor}${rolTexto}\n> ${fechaTexto}\n>`;
      const cuerpoCitado = citarTexto(m.cuerpoMd + adjuntosMd);
      lineas.push(encabezado);
      lineas.push(cuerpoCitado);
      lineas.push("");
    } else {
      // Formato para mensajes principales / inicio de hilos
      lineas.push(`### [Mensaje #${m.id}] ${m.autor}${rolTexto}`);
      if (fechaTexto) lineas.push(fechaTexto);
      lineas.push("");
      lineas.push(m.cuerpoMd + adjuntosMd);
      lineas.push("");
      lineas.push("---");
      lineas.push("");
    }
  }

  return lineas.join("\n").trim() + "\n";
}

/**
 * Genera el objeto JSON estructurado
 */
function generarJSON(temaData, materiaInfo) {
  return {
    materia: materiaInfo.nombre,
    codigoComision: materiaInfo.codigo,
    idComision: materiaInfo.idComision,
    idTema: temaData.idTema,
    tituloTema: temaData.tituloTema,
    extraidoEn: new Date().toISOString(),
    totalMensajes: temaData.totalMensajes,
    mensajes: temaData.mensajes.map((m) => ({
      id: m.id,
      parentId: m.parentId,
      esRespuesta: m.esRespuesta,
      autor: m.autor,
      rol: m.rol,
      fecha: m.fecha,
      contenido: m.cuerpoMd,
      adjuntos: (m.adjuntos || []).map((a) => ({
        tipo: a.tipo,
        nombreArchivo: a.nombreArchivo,
        urlOriginal: a.url,
        rutaLocal: `adjuntos/${a.nombreArchivo}`,
      })),
    })),
  };
}

/**
 * Guarda el tema en disco en los formatos solicitados (md, json, html)
 */
function guardarTema(temaData, rawHtml, materiaInfo, dirBase, opciones = {}) {
  const { formatos = ["md", "json", "html"], descargarAdjuntos = true } = opciones;

  // Estructura: {dirBase}/{materiaCarpeta}/{temaCarpeta}/
  const dirTema = path.join(dirBase, materiaInfo.carpeta, temaData.carpeta);
  if (!fs.existsSync(dirTema)) {
    fs.mkdirSync(dirTema, { recursive: true });
  }

  const baseFileName = temaData.carpeta;
  const resultados = {};

  // 1. Guardar Markdown
  if (formatos.includes("md") || formatos.includes("all")) {
    const mdContent = generarMarkdown(temaData, materiaInfo, descargarAdjuntos);
    const mdPath = path.join(dirTema, `${baseFileName}.md`);
    fs.writeFileSync(mdPath, mdContent, "utf8");
    resultados.md = mdPath;
  }

  // 2. Guardar JSON
  if (formatos.includes("json") || formatos.includes("all")) {
    const jsonContent = JSON.stringify(generarJSON(temaData, materiaInfo), null, 2);
    const jsonPath = path.join(dirTema, `${baseFileName}.json`);
    fs.writeFileSync(jsonPath, jsonContent, "utf8");
    resultados.json = jsonPath;
  }

  // 3. Guardar HTML original de respaldo
  if (formatos.includes("html") || formatos.includes("all")) {
    const htmlPath = path.join(dirTema, `${baseFileName}.html`);
    fs.writeFileSync(htmlPath, rawHtml, "utf8");
    resultados.html = htmlPath;
  }

  return { dirTema, resultados };
}

module.exports = {
  generarMarkdown,
  generarJSON,
  guardarTema,
};
