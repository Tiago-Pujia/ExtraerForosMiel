const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

// Cargar variables de entorno desde .env manualmente si existe (evita depender de paquete dotenv)
function cargarEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      // Eliminar comillas envolventes si las tiene
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

cargarEnv();

class MielClient {
  constructor() {
    this.cookies = new Map();
  }

  getCookieString() {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  actualizarCookies(setCookieHeader) {
    if (!setCookieHeader) return;
    const headers = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    for (const h of headers) {
      const [pair] = h.split(";");
      const eqIdx = pair.indexOf("=");
      if (eqIdx !== -1) {
        const key = pair.slice(0, eqIdx).trim();
        const val = pair.slice(eqIdx + 1).trim();
        this.cookies.set(key, val);
      }
    }
  }

  request(urlStr, options = {}) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(urlStr);
      const isHttps = urlObj.protocol === "https:";
      const lib = isHttps ? https : http;

      const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        ...(options.headers || {}),
      };

      const cookieStr = this.getCookieString();
      if (cookieStr) {
        headers["Cookie"] = cookieStr;
      }

      const req = lib.request(
        urlStr,
        {
          method: options.method || "GET",
          headers,
        },
        (res) => {
          this.actualizarCookies(res.headers["set-cookie"]);

          // Manejo de redirecciones
          if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
            const redirectUrl = new URL(res.headers.location, urlStr).toString();
            return resolve(this.request(redirectUrl, { ...options, method: "GET" }));
          }

          if (options.isBinary) {
            const chunks = [];
            res.on("data", (chunk) => chunks.push(chunk));
            res.on("end", () => {
              resolve({
                statusCode: res.statusCode,
                headers: res.headers,
                buffer: Buffer.concat(chunks),
              });
            });
          } else {
            let data = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
              resolve({
                statusCode: res.statusCode,
                headers: res.headers,
                body: data,
              });
            });
          }
        }
      );

      req.on("error", reject);

      if (options.body) {
        req.write(options.body);
      }
      req.end();
    });
  }

  async login(usuario, clave) {
    const user = usuario || process.env.MIEL_USUARIO;
    const pass = clave || process.env.MIEL_PASSWORD;

    if (!user || !pass) {
      throw new Error("No se indicaron credenciales (MIEL_USUARIO o MIEL_PASSWORD). Configúralas en .env o por argumentos.");
    }

    const body = `usuario=${encodeURIComponent(user)}&clave=${encodeURIComponent(pass)}`;
    const res = await this.request("https://miel.unlam.edu.ar/principal/event/login/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
      },
      body,
    });

    let json;
    try {
      json = JSON.parse(res.body);
    } catch (err) {
      throw new Error(`Respuesta inválida del login de MIEL: ${res.body.slice(0, 150)}`);
    }

    if (json.estado !== 0) {
      throw new Error(`Login fallido en MIEL para el usuario ${user}. Verifique credenciales.`);
    }

    return true;
  }

  async getInterno() {
    const res = await this.request("https://miel.unlam.edu.ar/principal/interno/");
    return res.body;
  }

  async getTemasForo(idComision) {
    const url = `https://miel.unlam.edu.ar/forov2/temas/comision/${idComision}`;
    const res = await this.request(url);
    return res.body;
  }

  async getMensajesTema(idComision, idTema) {
    const url = `https://miel.unlam.edu.ar/forov2/mensajes/comision/${idComision}/tema/${idTema}`;
    const res = await this.request(url);
    return res.body;
  }

  async descargarArchivo(url, destPath) {
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const res = await this.request(url, { isBinary: true });
    if (res.statusCode >= 200 && res.statusCode < 300) {
      fs.writeFileSync(destPath, res.buffer);
      return destPath;
    } else {
      throw new Error(`Error ${res.statusCode} al descargar ${url}`);
    }
  }
}

module.exports = { MielClient, cargarEnv };
