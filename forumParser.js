// --- Utilidades de decodificación y formato ---

const HTML_ENTITIES = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&aacute;": "á",
  "&eacute;": "é",
  "&iacute;": "í",
  "&oacute;": "ó",
  "&uacute;": "ú",
  "&Aacute;": "Á",
  "&Eacute;": "É",
  "&Iacute;": "Í",
  "&Oacute;": "Ó",
  "&Uacute;": "Ú",
  "&ntilde;": "ñ",
  "&Ntilde;": "Ñ",
  "&middot;": "·",
  "&bull;": "•",
  "&hellip;": "…",
  "&ndash;": "-",
  "&mdash;": "—",
  "&mu;": "μ",
  "&le;": "≤",
  "&ge;": "≥",
  "&ne;": "≠",
  "&times;": "×",
  "&divide;": "÷",
  "&plusmn;": "±",
  "&deg;": "°",
  "&alpha;": "α",
  "&beta;": "β",
  "&gamma;": "γ",
  "&delta;": "δ",
  "&epsilon;": "ε",
  "&theta;": "θ",
  "&lambda;": "λ",
  "&pi;": "π",
  "&sigma;": "σ",
  "&omega;": "ω",
  "&Delta;": "Δ",
  "&Sigma;": "Σ",
  "&infin;": "∞",
  "&approx;": "≈",
  "&radic;": "√",
  "&int;": "∫",
  "&sum;": "∑",
};

function decodificarEntidades(html) {
  if (!html) return "";
  let res = html;
  for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
    res = res.split(entity).join(char);
  }
  // Entidades numéricas decimales y hexadecimales
  res = res.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
  res = res.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  return res;
}

function sanitizarNombre(str) {
  if (!str) return "sin_nombre";
  return str
    .trim()
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Convierte un fragmento de HTML del cuerpo de un mensaje de MIEL en Markdown limpio.
 */
function htmlToMarkdown(html) {
  if (!html) return "";

  let md = html;

  // Reemplazar saltos de línea y párrafos
  md = md.replace(/<br\s*\/?>/gi, "\n");
  md = md.replace(/<\/p>/gi, "\n\n");
  md = md.replace(/<p[^>]*>/gi, "");

  // Formato de texto
  md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**");
  md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**");
  md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "*$1*");
  md = md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, "*$1*");
  md = md.replace(/<sub[^>]*>([\s\S]*?)<\/sub>/gi, "_($1)");
  md = md.replace(/<sup[^>]*>([\s\S]*?)<\/sup>/gi, "^($1)");
  md = md.replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, "$1");

  // Listas
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1");
  md = md.replace(/<\/?(?:ul|ol)[^>]*>/gi, "\n");

  // Enlaces
  md = md.replace(/<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (match, href, text) => {
    const cleanText = text.replace(/<[^>]+>/g, "").trim();
    return cleanText ? `[${cleanText}](${href})` : href;
  });

  // Limpiar etiquetas restantes como span, div, font
  md = md.replace(/<[^>]+>/g, "");

  // Decodificar entidades
  md = decodificarEntidades(md);

  // Normalizar saltos de línea repetidos
  md = md.replace(/\n{3,}/g, "\n\n").trim();

  return md;
}

// --- Métodos de extracción de estructuras ---

/**
 * Extrae la lista de materias/comisiones desde el HTML de /principal/interno/
 */
function parsearMaterias(html) {
  const materias = [];
  const bloques = html.split(/(?=<div[^>]+\bmateria-bloque\b)/);

  for (let i = 1; i < bloques.length; i++) {
    const b = bloques[i];
    const id = b.match(/data-id="(\d+)"/)?.[1];
    const tituloMatch = b.match(/class="[^"]*materia-titulo[^"]*">\s*([^<]+)/);
    const titulo = tituloMatch ? decodificarEntidades(tituloMatch[1]).trim() : "Materia";
    const comMatch = b.match(/Com:\s*([^\s<]+)/);
    const codigo = comMatch ? comMatch[1].trim() : "";

    if (id && titulo) {
      materias.push({
        idComision: id,
        nombre: titulo,
        codigo,
        carpeta: sanitizarNombre(`${titulo}_${codigo || id}`),
      });
    }
  }

  return materias;
}

/**
 * Extrae el nombre del usuario logueado
 */
function parsearNombreUsuario(html) {
  const match = html.match(/class="[^"]*nombreUsuario[^"]*">\s*([^<]+)/);
  return match ? decodificarEntidades(match[1]).trim() : "Usuario";
}

/**
 * Extrae la lista de temas desde el HTML de /forov2/temas/comision/{idComision}
 */
function parsearTemas(html, idComision) {
  const temas = [];
  const vistos = new Set();

  // 1. Buscar en los bloques principales de temas: <div class="foro-tema ...">
  const bloquesTema = html.split(/(?=<div[^>]+class="[^"]*\bforo-tema\b)/);
  for (let i = 1; i < bloquesTema.length; i++) {
    const bloque = bloquesTema[i];
    const linkMatch = bloque.match(/href="([^"]*forov2\/mensajes\/comision\/\d+\/tema\/(\d+))"/);
    if (!linkMatch) continue;

    const url = linkMatch[1];
    const idTema = linkMatch[2];
    if (vistos.has(idTema)) continue;
    vistos.add(idTema);

    const tituloMatch = bloque.match(/<div class="w3-medium">\s*<strong>([^<]+)<\/strong>/);
    const titulo = tituloMatch ? decodificarEntidades(tituloMatch[1]).trim() : `Tema_${idTema}`;

    const descMatch = bloque.match(/<div class="w3-padding-4">([\s\S]*?)<\/div>/);
    const descripcion = descMatch ? decodificarEntidades(descMatch[1]).replace(/<[^>]+>/g, "").trim() : "";

    const infoMatch = bloque.match(/(\d+)\s+mensajes[\s\S]*?&Uacute;ltimo mensaje\s+([0-9\/: ]+)/i);
    const cantidadMensajes = infoMatch ? parseInt(infoMatch[1], 10) : 0;
    const ultimoMensajeFecha = infoMatch ? infoMatch[2].trim() : "";

    temas.push({
      idTema,
      idComision,
      titulo,
      descripcion,
      cantidadMensajes,
      ultimoMensajeFecha,
      url,
      carpeta: sanitizarNombre(titulo),
    });
  }

  // 2. Si no encontró temas en los bloques (ej. vista alternativa), buscar enlaces en el menú lateral
  if (temas.length === 0) {
    const menuRegex = /<a[^>]+href="([^"]*forov2\/mensajes\/comision\/\d+\/tema\/(\d+))"[^>]*title="([^"]+)"[^>]*>/gi;
    let match;
    while ((match = menuRegex.exec(html)) !== null) {
      const idTema = match[2];
      if (vistos.has(idTema)) continue;
      vistos.add(idTema);

      const titulo = decodificarEntidades(match[3]).trim();
      temas.push({
        idTema,
        idComision,
        titulo,
        descripcion: "",
        cantidadMensajes: 0,
        ultimoMensajeFecha: "",
        url: match[1],
        carpeta: sanitizarNombre(titulo),
      });
    }
  }

  return temas;
}

/**
 * Extrae los mensajes de un tema a partir del HTML de /forov2/mensajes/comision/{idComision}/tema/{idTema}
 */
function parsearMensajesTema(html, idComision, idTema) {
  // Extraer título del tema desde el h1 si está disponible
  const titleMatch = html.match(/<h1[^>]*>\s*Tema:\s*([^<]+)<\/h1>/i);
  const tituloTema = titleMatch ? decodificarEntidades(titleMatch[1]).trim() : "Tema";

  const mensajes = [];
  const liRegex = /<li\s+class="([^"]*(?:foro-mensaje|foro-respuesta)[^"]*)"\s+data-id[Mm]ensaje[Pp]adre="(\d+)"\s+id="idMensaje-(\d+)">([\s\S]*?)(?=(?:<li\s+class="[^"]*(?:foro-mensaje|foro-respuesta)[^"]*"|<\/ul>\s*<\/div>|$))/gi;

  let match;
  while ((match = liRegex.exec(html)) !== null) {
    const classes = match[1];
    const parentId = match[2];
    const id = match[3];
    const bloque = match[4];
    const esRespuesta = classes.includes("foro-respuesta");

    // Autor
    const autorMatch = bloque.match(/<div><strong\s*>([^<]+)<\/strong><\/div>/i);
    const autor = autorMatch ? decodificarEntidades(autorMatch[1]).trim() : "Desconocido";

    // Rol (Alumno, Tutor, Docente)
    const rolMatch = bloque.match(/<div class="w3-text-gray">\s*(?:<i[^>]*>[^<]*<\/i>\s*)?([^<]+)<\/div>/i);
    const rol = rolMatch ? decodificarEntidades(rolMatch[1]).trim().replace(/\s+/g, " ") : "";

    // Fecha
    const fechaMatch = bloque.match(/Enviado el\s+([0-9\/: ]+)/i);
    const fecha = fechaMatch ? fechaMatch[1].trim() : "";

    // Cuerpo del mensaje
    const cuerpoMatch = bloque.match(/<div class="foro-contenido-mensaje[^"]*">([\s\S]*?)<\/div>/i);
    let cuerpoHtml = cuerpoMatch ? cuerpoMatch[1].trim() : "";
    
    // Limpiar restos si hubieran
    cuerpoHtml = cuerpoHtml.replace(/\*\*\s*Archivo adjunto:\s*<a[\s\S]*?<\/a>/gi, "");
    
    const cuerpoMd = htmlToMarkdown(cuerpoHtml);

    // Adjuntos (imágenes y archivos PDF/docs)
    const adjuntos = [];
    const urlsVistas = new Set();

    // Imágenes adjuntas
    const imgRegex = /<img[^>]+class="[^"]*foroImgAdjuntos[^"]*"[^>]+src="?([^" >]+)"?\s+alt="?([^" >]+)"?/gi;
    let imgMatch;
    while ((imgMatch = imgRegex.exec(bloque)) !== null) {
      const url = imgMatch[1];
      if (!urlsVistas.has(url)) {
        urlsVistas.add(url);
        adjuntos.push({
          tipo: "imagen",
          url,
          nombreArchivo: sanitizarNombre(imgMatch[2] || path.basename(url)),
        });
      }
    }

    // Archivos adjuntos (enlaces de descarga)
    const fileRegex = /<a\s+href="([^"]*forov2\/event\/descargar\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let fileMatch;
    while ((fileMatch = fileRegex.exec(bloque)) !== null) {
      const url = fileMatch[1];
      if (!urlsVistas.has(url)) {
        urlsVistas.add(url);
        const nombreLimpio = decodificarEntidades(fileMatch[2]).replace(/<[^>]+>/g, "").trim();
        adjuntos.push({
          tipo: "archivo",
          url,
          nombreArchivo: sanitizarNombre(nombreLimpio || path.basename(url)),
        });
      }
    }

    mensajes.push({
      id,
      parentId,
      esRespuesta,
      autor,
      rol,
      fecha,
      cuerpoHtml,
      cuerpoMd,
      adjuntos,
    });
  }

  return {
    tituloTema,
    idTema,
    idComision,
    totalMensajes: mensajes.length,
    mensajes,
  };
}

module.exports = {
  parsearMaterias,
  parsearNombreUsuario,
  parsearTemas,
  parsearMensajesTema,
  htmlToMarkdown,
  decodificarEntidades,
  sanitizarNombre,
};
