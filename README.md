# Extractor de Foros MIEL (UNLaM)

Herramienta diseñada para autenticarse en la plataforma **MIEL** de la Universidad Nacional de La Matanza (`https://miel.unlam.edu.ar/principal/interno/`) y descargar todos los contenidos de los foros de debate organizados por materia y tema.

Los contenidos se exportan en formatos especialmente optimizados para que **otra Inteligencia Artificial (o agente LLM)** pueda leerlos, analizarlos y responder consultas académicas sin necesidad de acceder a un navegador web ni lidiar con ruido HTML/CSS.

---

## Características Principales

- **Multi-formato para IA y humanos**:
  - **Markdown (`.md`) [Recomendado para LLMs]**: Estructura limpia y semántica con cabeceras, fecha, autor, rol (Docente/Tutor o Alumno) y jerarquía de respuestas citadas con `>`. Reduce en más de un 90% el consumo de tokens respecto al HTML original.
  - **JSON (`.json`) [Para Agentes y RAG]**: Objetos estructurados con IDs, metadatos, árbol padre-hijo y enlaces a archivos adjuntos.
  - **HTML (`.html`) [Respaldo]**: Archivo HTML offline idéntico al del navegador.
- **Descarga de Adjuntos**: Descarga automáticamente imágenes, ejercicios y documentos PDF adjuntados por profesores y alumnos en una carpeta local `adjuntos/`, vinculándolos en el Markdown generado.
- **Modo Interactivo y Modo CLI**: Menú guiado por teclado o comandos directos para automatización.
- **100% Nativo en Node.js**: Sin librerías pesadas ni necesidad de navegadores headless (como Chromium/Puppeteer), lo que lo hace ultrarrápido y compatible con Linux y Windows.

---

## Requisitos del Sistema

Para ejecutar esta herramienta se necesita:

- **Node.js**: Versión **18.0.0 o superior** recomendada (compatible con Node.js 16+, 18+, 20+, 22+ y 24+).
  - Para verificar si ya lo tienes instalado en tu terminal:
    ```bash
    node -v
    ```
  - Si aún no lo tienes instalado, descárgalo e instálalo desde [nodejs.org](https://nodejs.org/) o a través de tu gestor de paquetes favorito (`nvm`, `fnm`, `apt`, `brew`, `winget`, `choco`).
- **npm**: Incluido automáticamente al instalar Node.js (usado para ejecutar scripts como `npm start` y `npm run all`).
- **Cuenta activa en MIEL**: DNI/usuario y contraseña válidos en [MIEL UNLaM](https://miel.unlam.edu.ar/).
- **Conexión a Internet**: Acceso HTTPS a `https://miel.unlam.edu.ar/`.

> [!NOTE]
> **Cero dependencias externas:** Este proyecto está desarrollado usando **exclusivamente módulos nativos de Node.js** (`https`, `http`, `fs`, `path`, `readline`).  
> **No es necesario ejecutar `npm install`** para descargar paquetes de terceros ni se necesitan navegadores pesados tipo Puppeteer/Chromium.

---

## Instalación y Preparación Rápida

1. **Clonar o descargar el repositorio:**
   ```bash
   git clone <URL_DEL_REPOSITORIO>
   cd ExtraerForosMiel
   ```

2. **Configurar credenciales (`.env`):**
   Copia el archivo de ejemplo:
   ```bash
   cp .env.example .env
   ```
   Abre `.env` y coloca tu usuario y contraseña de MIEL:
   ```env
   MIEL_USUARIO=tu_dni_o_usuario
   MIEL_PASSWORD=tu_contraseña
   OUTPUT_DIR=resultados
   ```

3. **Ejecutar la herramienta:**
   ```bash
   npm start
   ```
   *(Listo, no se requiere ningún paso adicional de compilación o instalación).*

---

## Configuración de Credenciales

Puedes configurar tus credenciales en un archivo `.env` en la raíz del proyecto (este archivo está ignorado en `.gitignore` por seguridad):

```env
MIEL_USUARIO=tu_dni_o_usuario
MIEL_PASSWORD=tu_contraseña
OUTPUT_DIR=resultados
```

También puedes suministrar las credenciales por argumentos de línea de comandos (`-u` y `-p`).

---

## Uso con npm

### 1. Modo Interactivo
Ejecuta el comando estándar:
```bash
npm start
```
El script te permitirá:
1. Ver tus materias inscriptas y elegir si descargar todas o una en particular.
2. Elegir qué formatos exportar (Markdown, JSON, HTML o todos).
*(Los archivos e imágenes adjuntas se descargan siempre de forma automática).*

### 2. Atajos rápidos con npm

- **Descargar todo de todas las materias**:
  ```bash
  npm run all
  ```

- **Pasar argumentos a `npm start`**:
  Puedes pasarle cualquier flag agregando `--` antes de los argumentos:
  ```bash
  # Descargar solo Estadística Aplicada
  npm start -- -m "Estadistica"

  # Descargar solo en Markdown para la IA
  npm start -- -m "Estadistica" -f md

  # Ver ayuda de opciones
  npm start -- --help
  ```

---

## Opciones CLI Disponibles

| Opción | Descripción |
| :--- | :--- |
| `--all`, `-a` | Descarga todos los foros de todas las materias automáticamente |
| `--materia`, `-m <nombre>` | Filtra por nombre de materia o por idComisión |
| `--tema`, `-t <nombre>` | Filtra por nombre o id de tema |
| `--format`, `-f <md,json,html,all>` | Formatos de salida a generar (por defecto: `md,json,html`) |
| `--output`, `-o <dir>` | Directorio de salida (por defecto: `resultados`) |
| `--no-attachments` | Desactiva temporalmente la descarga de adjuntos si no se desean |
| `--help`, `-h` | Muestra la ayuda en consola |

---

## Estructura de Salida

La carpeta de salida (por defecto `resultados/`) replica la organización por temas observada en el archivo histórico:

```
resultados/
└── ESTADISTICA APLICADA_01-2900/
    ├── Inferencia Bayesiana y Clásica/
    │   ├── Inferencia Bayesiana y Clásica.md    <-- Formato limpio para la IA
    │   ├── Inferencia Bayesiana y Clásica.json  <-- Formato estructurado RAG
    │   ├── Inferencia Bayesiana y Clásica.html  <-- Copia offline
    │   └── adjuntos/
    │       ├── Pasos-a-seguir-inferencia-bayesiana.png
    │       └── Proceso-de-Inferencia-Bayesiana.pdf
    ├── Bondad de Ajuste/
    │   ├── Bondad de Ajuste.md
    │   └── ...
    └── ANOVA/
        └── ...
```

---

## ¿Cómo alimentar estos datos a otra IA?

1. **Lectura directa de archivos Markdown**: Puedes adjuntar directamente los archivos `.md` de cada tema a chats como ChatGPT, Claude o Gemini. La estructura de hilos y respuestas con citas (`>`) permite al modelo entender inmediatamente quién preguntó y qué respondió el profesor.
2. **Embeddings y Búsqueda Vectorial (RAG)**: Si utilizas LangChain, LlamaIndex o una base de datos vectorial (como ChromaDB o Pinecone), puedes indexar directamente los archivos `.json` usando los campos `autor`, `fecha`, y `contenido` como documentos con metadatos.

---

## 🤖 Documentación Técnica para IAs y Desarrolladores

Si eres una Inteligencia Artificial, agente LLM o desarrollador buscando comprender la arquitectura interna del extractor, el flujo de autenticación, los esquemas de datos JSON y las pautas para integrar estos foros en sistemas RAG, consulta el archivo:

👉 **[DOCUMENTACION_IA.md](DOCUMENTACION_IA.md)** — *Documentación técnica estructurada para modelos de lenguaje y sistemas autónomos.*
