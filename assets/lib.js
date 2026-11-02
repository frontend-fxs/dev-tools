export class ToolError extends Error {
  constructor(message, { details = "", snippet = "", hex = "" } = {}) {
    super(message);
    this.name = "ToolError";
    this.details = details;
    this.snippet = snippet;
    this.hex = hex;
  }
}

const NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00A0",
};

export function encodeBase64(text, options) {
  return encodeBase64Bytes(new TextEncoder().encode(text), options);
}

export function encodeBase64Bytes(bytes, { urlSafe = false } = {}) {
  let binary = "";
  const size = 0x8000;
  for (let index = 0; index < bytes.length; index += size) {
    binary += String.fromCharCode(...bytes.subarray(index, index + size));
  }
  let encoded = btoa(binary);
  if (urlSafe) {
    encoded = encoded.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
  }
  return encoded;
}

export function decodeBase64(input) {
  let text = String(input).trim().replace(/^\uFEFF/u, "");
  text = text.replace(/^data:[^;]+;base64,/iu, "");
  text = text.replace(/\s/gu, "");
  if (!text) return { text: "", bytes: new Uint8Array() };

  let normalized = text.replaceAll("-", "+").replaceAll("_", "/");
  if (!/^[A-Za-z0-9+/]*={0,2}$/u.test(normalized)) {
    throw new ToolError("Base64 no válido");
  }
  const remainder = normalized.length % 4;
  if (remainder === 1) throw new ToolError("Base64 no válido");
  if (remainder) normalized += "=".repeat(4 - remainder);

  let binary;
  try {
    binary = atob(normalized);
  } catch {
    throw new ToolError("Base64 no válido");
  }

  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  try {
    return {
      text: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      bytes,
    };
  } catch {
    throw new ToolError("El contenido no es texto UTF-8", { hex: toHex(bytes) });
  }
}

export function formatJson(text, { indent = 2, sort = false, minify = false } = {}) {
  const value = parseJson(text);
  const normalized = sort ? sortKeys(value) : value;
  const space = minify ? undefined : indent === "tab" ? "\t" : Number(indent) || 2;
  return {
    text: JSON.stringify(normalized, null, space),
    summary: describeJson(normalized),
  };
}

export function encodeUrl(text, mode = "component") {
  return mode === "uri" ? encodeURI(text) : encodeURIComponent(text);
}

export function decodeUrl(text, mode = "component") {
  try {
    return mode === "uri" ? decodeURI(text) : decodeURIComponent(text);
  } catch {
    throw new ToolError("No se pudo decodificar. Revisa los signos %.");
  }
}

export function decodeJwt(token) {
  const parts = String(token).trim().split(".");
  if (parts.length < 2 || parts.length > 3 || !parts[0] || !parts[1]) {
    throw new ToolError("Un JWT tiene cabecera, payload y firma, separados por puntos.");
  }

  let header;
  let payloadText;
  try {
    header = JSON.parse(decodeBase64(parts[0]).text);
    payloadText = decodeBase64(parts[1]).text;
  } catch (error) {
    if (error instanceof ToolError && error.hex) {
      throw new ToolError("Una parte del token no es texto UTF-8.");
    }
    throw new ToolError("No se pudo leer el token. ¿Es Base64URL?");
  }

  if (!header || typeof header !== "object" || Array.isArray(header)) {
    throw new ToolError("La cabecera no es un objeto JSON.");
  }

  let payload = payloadText;
  try {
    payload = JSON.parse(payloadText);
  } catch {
    payload = payloadText;
  }

  return { header, payload, signature: parts[2] ?? "" };
}

export function parseInstant(input) {
  const text = String(input).trim();
  if (!text) return null;
  if (/^[+-]?\d+(?:\.\d+)?$/u.test(text)) {
    const value = Number(text);
    if (!Number.isFinite(value)) throw new ToolError("Fecha no válida");
    const digits = integerDigits(value);
    return new Date(digits >= 13 ? value : value * 1000);
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new ToolError("No reconozco esa fecha.");
  return date;
}

export function describeInstant(date) {
  return {
    seconds: Math.trunc(date.getTime() / 1000),
    millis: date.getTime(),
    iso: date.toISOString(),
    local: new Intl.DateTimeFormat("es", {
      dateStyle: "full",
      timeStyle: "long",
    }).format(date),
  };
}

export function createUuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = toHex(bytes, "");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function digest(algorithm, text) {
  const bytes = new TextEncoder().encode(text);
  const buffer = await crypto.subtle.digest(algorithm, bytes);
  const hash = new Uint8Array(buffer);
  return { hex: toHex(hash, ""), base64: encodeBase64Bytes(hash) };
}

export function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function unescapeHtml(text) {
  return text.replace(
    /&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]+);/gu,
    (entity, body) => {
      if (body[0] !== "#") {
        return Object.hasOwn(NAMED_ENTITIES, body) ? NAMED_ENTITIES[body] : entity;
      }
      const codePoint =
        body[1] === "x" || body[1] === "X"
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10);
      if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return entity;
      return String.fromCodePoint(codePoint);
    },
  );
}

export function queryToJson(text) {
  const raw = String(text).trim().replace(/^[?#]/u, "");
  if (!raw) return "{}";
  const params = new URLSearchParams(raw);
  const value = {};
  for (const key of params.keys()) {
    if (Object.hasOwn(value, key)) continue;
    const all = params.getAll(key);
    value[key] = all.length > 1 ? all : all[0];
  }
  return JSON.stringify(value, null, 2);
}

export function jsonToQuery(text) {
  const value = parseJson(text);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ToolError('Hace falta un objeto JSON, por ejemplo {"q":"dev"}.');
  }
  const params = new URLSearchParams();
  for (const [key, item] of Object.entries(value)) {
    if (Array.isArray(item)) {
      for (const entry of item) params.append(key, scalar(entry));
    } else if (item != null && typeof item === "object") {
      params.append(key, JSON.stringify(item));
    } else {
      params.append(key, scalar(item));
    }
  }
  return params.toString();
}

function parseJson(text) {
  const source = String(text).replace(/^\uFEFF/u, "");
  try {
    return JSON.parse(source);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const pos = jsonPosition(source, message);
    throw new ToolError("JSON no válido", {
      details: pos ? `Línea ${pos.line}, columna ${pos.col}. ${message}` : message,
      snippet: pos ? errorSnippet(source, pos.index) : "",
    });
  }
}

function jsonPosition(text, message) {
  const lineCol = /line (\d+) column (\d+)/iu.exec(message);
  if (lineCol) {
    const line = Number(lineCol[1]);
    const col = Number(lineCol[2]);
    return { line, col, index: indexFromLineCol(text, line, col) };
  }
  const at = /position (\d+)/iu.exec(message);
  if (!at) return null;
  const index = Number(at[1]);
  return {
    index,
    line: text.slice(0, index).split("\n").length,
    col: index - (text.lastIndexOf("\n", index - 1) + 1) + 1,
  };
}

function indexFromLineCol(text, line, col) {
  let index = 0;
  let current = 1;
  while (current < line && index < text.length) {
    if (text[index] === "\n") current += 1;
    index += 1;
  }
  return index + Math.max(0, col - 1);
}

function errorSnippet(text, index) {
  const from = Math.max(0, index - 24);
  const to = Math.min(text.length, index + 24);
  const excerpt = text.slice(from, to).replaceAll("\n", "↵");
  return `${excerpt}\n${" ".repeat(index - from)}^`;
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortKeys(value[key])]),
    );
  }
  return value;
}

function describeJson(value) {
  if (Array.isArray(value)) {
    return `Array · ${value.length} ${value.length === 1 ? "elemento" : "elementos"}`;
  }
  if (value === null) return "Nulo";
  if (typeof value === "object") {
    const count = Object.keys(value).length;
    return `Objeto · ${count} ${count === 1 ? "clave" : "claves"}`;
  }
  if (typeof value === "string") return `Texto · ${value.length} caracteres`;
  if (typeof value === "number") return "Número";
  if (typeof value === "boolean") return "Booleano";
  return typeof value;
}

function integerDigits(value) {
  const absolute = Math.trunc(Math.abs(value));
  if (absolute < 10) return 1;
  return Math.floor(Math.log10(absolute)) + 1;
}

function scalar(value) {
  return value == null ? "" : String(value);
}

function toHex(bytes, separator = " ") {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(separator);
}
