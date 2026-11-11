const readline = require("readline");
const path = require("path");
const fs = require("fs");
const { MielClient } = require("./mielClient");
const {
  parsearMaterias,
  parsearNombreUsuario,
  parsearTemas,
  parsearMensajesTema,
} = require("./forumParser");
const { guardarTema } = require("./exporters");

// --- Argumentos CLI ---

function parsearArgs() {
  const args = process.argv.slice(2);
  const opciones = {
    all: false,
    materia: null,
    tema: null,
    formatos: ["md", "json", "html"],
    descargarAdjuntos: true,
    output: process.env.OUTPUT_DIR || "resultados",
    usuario: null,
    clave: null,
    ayuda: false,
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--all" || a === "-a") {
      opciones.all = true;
    } else if (a === "--materia" || a === "-m") {
      opciones.materia = args[++i];
    } else if (a === "--tema" || a === "-t") {
      opciones.tema = args[++i];
    } else if (a === "--format" || a === "-f") {
      const fmtRaw = args[++i];
      opciones.formatos = fmtRaw.split(",").map((s) => s.trim().toLowerCase());
    } else if (a === "--attachments") {
      opciones.descargarAdjuntos = true;
    } else if (a === "--no-attachments") {
      opciones.descargarAdjuntos = false;
    } else if (a === "--output" || a === "-o") {
      opciones.output = args[++i];
    } else if (a === "--user" || a === "-u") {
      opciones.usuario = args[++i];
    } else if (a === "--pass" || a === "-p") {
      opciones.clave = args[++i];
    } else if (a === "--help" || a === "-h") {
      opciones.ayuda = true;
    }
  }

  return opciones;
}

function mostrarAyuda() {
  console.log(`
=== EXTRACTOR DE FOROS MIEL (UNLaM) ===
Uso: node index.js [opciones]

Opciones:
  --all, -a                 Descarga todos los foros de todas las materias sin preguntar
  --materia, -m <nombre|id> Filtra por nombre de materia o idComisión
  --tema, -t <nombre|id>    Filtra por nombre o id de tema específico
  --format, -f <formatos>   Formatos separados por coma: md, json, html, all (por defecto: md,json,html)
  --attachments             Descarga archivos e imágenes adjuntas (por defecto: activado)
  --no-attachments          Omite la descarga de adjuntos
  --output, -o <directorio> Directorio de salida (por defecto: resultados)
  --user, -u <usuario>      DNI o usuario de MIEL (o configurar en .env)
  --pass, -p <contraseña>   Contraseña de MIEL (o configurar en .env)
  --help, -h                Muestra este mensaje de ayuda

Ejemplos:
  node index.js                                 # Modo interactivo
  node index.js --all                           # Descarga todo
  node index.js -m "Estadistica" --format md    # Solo Estadística Aplicada en Markdown
  node index.js -m 117919 --attachments         # Por id de comisión con adjuntos
`);
}

// --- Utilidad para prompts en terminal ---

function preguntar(pregunta, valorPorDefecto = "") {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    const texto = valorPorDefecto ? `${pregunta} [${valorPorDefecto}]: ` : `${pregunta}: `;
    rl.question(texto, (respuesta) => {
      rl.close();
      const final = respuesta.trim() || valorPorDefecto;
      resolve(final);
    });
  });
}

// --- Procesamiento de descargas ---

async function procesarTema(client, materia, tema, dirSalida, opciones) {
  const { formatos, descargarAdjuntos } = opciones;

  // 1. Obtener HTML completo del tema
  const rawHtml = await client.getMensajesTema(materia.idComision, tema.idTema);

  // 2. Parsear mensajes
  const temaData = parsearMensajesTema(rawHtml, materia.idComision, tema.idTema);
  temaData.carpeta = tema.carpeta || temaData.tituloTema;

  // 3. Exportar archivos estructurados
  const { dirTema, resultados } = guardarTema(temaData, rawHtml, materia, dirSalida, {
    formatos,
    descargarAdjuntos,
  });

  // 4. Descargar adjuntos si está habilitado
  let adjuntosDescargados = 0;
  if (descargarAdjuntos) {
    const dirAdjuntos = path.join(dirTema, "adjuntos");
    for (const m of temaData.mensajes) {
      for (const a of m.adjuntos || []) {
        if (!a.url) continue;
        const destPath = path.join(dirAdjuntos, a.nombreArchivo);
        if (!fs.existsSync(destPath)) {
          try {
            await client.descargarArchivo(a.url, destPath);
            adjuntosDescargados++;
          } catch (err) {
            console.error(`      [!] Error descargando adjunto ${a.nombreArchivo}: ${err.message}`);
          }
        } else {
          adjuntosDescargados++;
        }
      }
    }
  }

  return {
    temaData,
    resultados,
    adjuntosDescargados,
  };
}

// --- Flujo Principal ---

async function main() {
  const opciones = parsearArgs();

  if (opciones.ayuda) {
    mostrarAyuda();
    return;
  }

  console.log("\n==============================================");
  console.log("       EXTRACTOR DE FOROS MIEL (UNLaM)        ");
  console.log("    Optimizado para lectura por IA y archivo  ");
  console.log("==============================================\n");

  const client = new MielClient();

  // 1. Iniciar sesión
  console.log("Iniciando sesión en MIEL...");
  try {
    await client.login(opciones.usuario, opciones.clave);
    console.log("  [✓] Sesión iniciada correctamente.\n");
  } catch (err) {
    console.error(`\n[ERROR] No se pudo iniciar sesión: ${err.message}\n`);
    process.exit(1);
  }

  // 2. Obtener materias
  console.log("Consultando materias inscriptas...");
  const internoHtml = await client.getInterno();
  const nombreUsuario = parsearNombreUsuario(internoHtml);
  const materias = parsearMaterias(internoHtml);

  console.log(`  [✓] Alumno: ${nombreUsuario}`);
  console.log(`  [✓] Materias encontradas: ${materias.length}\n`);

  if (materias.length === 0) {
    console.log("No se encontraron materias activas para este usuario.");
    return;
  }

  let materiasAProcesar = materias;

  // 3. Selección de materias (modo CLI o interactivo)
  if (opciones.materia) {
    const filtro = opciones.materia.toLowerCase();
    materiasAProcesar = materias.filter(
      (m) =>
        m.nombre.toLowerCase().includes(filtro) ||
        m.idComision === filtro ||
        (m.codigo && m.codigo.toLowerCase().includes(filtro))
    );
    if (materiasAProcesar.length === 0) {
      console.error(`No se encontró ninguna materia coincidente con "${opciones.materia}".`);
      return;
    }
  } else if (!opciones.all) {
    // Menú interactivo de materias
    console.log("Seleccione la materia a descargar:");
    console.log("  [0] Todas las materias");
    materias.forEach((m, idx) => {
      console.log(`  [${idx + 1}] ${m.nombre} (Comisión: ${m.codigo || m.idComision})`);
    });
    console.log();

    const seleccion = await preguntar("Ingrese número de opción", "0");
    const num = parseInt(seleccion, 10);
    if (!isNaN(num) && num > 0 && num <= materias.length) {
      materiasAProcesar = [materias[num - 1]];
    } else {
      materiasAProcesar = materias;
    }
    console.log();
  }

  // 4. Selección de formatos y adjuntos si es interactivo
  if (!opciones.all && !process.argv.slice(2).some((a) => a.startsWith("-f") || a.startsWith("--format"))) {
    console.log("Formatos de exportación:");
    console.log("  [1] Markdown (.md) - Óptimo para IAs/LLMs");
    console.log("  [2] JSON (.json)     - Óptimo para RAG / Agentes");
    console.log("  [3] HTML (.html)     - Respaldo visual original");
    console.log("  [4] Todos los formatos (md + json + html)");
    console.log();

    const fmtOpt = await preguntar("Elija formatos a generar", "4");
    if (fmtOpt === "1") opciones.formatos = ["md"];
    else if (fmtOpt === "2") opciones.formatos = ["json"];
    else if (fmtOpt === "3") opciones.formatos = ["html"];
    else opciones.formatos = ["md", "json", "html"];
    console.log();
  }

  // 5. Ejecutar descargas
  const dirSalida = path.resolve(opciones.output);
  console.log(`Directorio de destino: ${dirSalida}\n`);

  let totalTemasDescargados = 0;
  let totalMensajesDescargados = 0;
  let totalAdjuntosDescargados = 0;

  for (const materia of materiasAProcesar) {
    console.log(`\n======================================================`);
    console.log(`Materia: ${materia.nombre} (${materia.codigo || materia.idComision})`);
    console.log(`======================================================`);

    const forosHtml = await client.getTemasForo(materia.idComision);
    let temas = parsearTemas(forosHtml, materia.idComision);

    console.log(`Temas de debate encontrados: ${temas.length}`);

    if (opciones.tema) {
      const filtroTema = opciones.tema.toLowerCase();
      temas = temas.filter((t) => t.titulo.toLowerCase().includes(filtroTema) || t.idTema === filtroTema);
      console.log(`Temas filtrados: ${temas.length}`);
    }

    if (temas.length === 0) {
      console.log("  (No hay temas disponibles en este foro)");
      continue;
    }

    for (let i = 0; i < temas.length; i++) {
      const tema = temas[i];
      process.stdout.write(`  [${i + 1}/${temas.length}] Descargando: "${tema.titulo}"... `);

      try {
        const { temaData, adjuntosDescargados } = await procesarTema(
          client,
          materia,
          tema,
          dirSalida,
          opciones
        );
        totalTemasDescargados++;
        totalMensajesDescargados += temaData.totalMensajes;
        totalAdjuntosDescargados += adjuntosDescargados;

        const infoAdj = opciones.descargarAdjuntos && adjuntosDescargados > 0 ? `, ${adjuntosDescargados} adjuntos` : "";
        console.log(`OK (${temaData.totalMensajes} mensajes${infoAdj})`);
      } catch (err) {
        console.log(`ERROR (${err.message})`);
      }
    }
  }

  // 6. Resumen final
  console.log("\n==============================================");
  console.log("           DESCARGA COMPLETADA                ");
  console.log("==============================================");
  console.log(`- Materias procesadas:   ${materiasAProcesar.length}`);
  console.log(`- Temas descargados:     ${totalTemasDescargados}`);
  console.log(`- Mensajes extraídos:    ${totalMensajesDescargados}`);
  console.log(`- Adjuntos guardados:    ${totalAdjuntosDescargados}`);
  console.log(`- Carpeta de resultados: ${dirSalida}\n`);
}

main().catch((err) => {
  console.error("\nERROR FATAL:", err.message);
  process.exit(1);
});
