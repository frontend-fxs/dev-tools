import * as lib from "./lib.js";

const tools = [base64Tool(), jsonTool(), urlTool(), queryTool(), jwtTool(), epochTool(), uuidTool(), hashTool(), htmlTool()];

const workspace = document.querySelector("#workspace");
const nav = document.querySelector("#tool-nav");
const search = document.querySelector("#search");
let currentId = "base64";

search.addEventListener("input", () => paintNav());
search.addEventListener("search", () => paintNav());
window.addEventListener("hashchange", () => open(location.hash.slice(1)));
open(location.hash.slice(1) || "base64");

function open(id) {
  const tool = tools.find((item) => item.id === id) || tools[0];
  currentId = tool.id;
  if (location.hash !== `#${tool.id}`) history.replaceState(null, "", `#${tool.id}`);
  paintNav();
  workspace.replaceChildren(
    h("header", { class: "tool-head" }, [h("h1", { text: tool.name }), h("p", { text: tool.hint })]),
    tool.mount(),
  );
  workspace.scrollTop = 0;
}

function paintNav() {
  const query = search.value.trim().toLowerCase();
  const visible = tools.filter((tool) => `${tool.name} ${tool.nav} ${tool.hint}`.toLowerCase().includes(query));
  nav.replaceChildren();
  if (!visible.length) {
    nav.append(h("p", { class: "empty", text: "Ninguna herramienta coincide." }));
    return;
  }
  for (const tool of visible) {
    nav.append(
      h(
        "button",
        {
          type: "button",
          class: tool.id === currentId ? "nav-item active" : "nav-item",
          title: tool.hint,
          onClick: () => open(tool.id),
        },
        [h("span", { class: "nav-name", text: tool.name }), h("span", { class: "nav-hint", text: tool.nav })],
      ),
    );
  }
}

function base64Tool() {
  return {
    id: "base64",
    name: "Base64",
    nav: "Codificar texto",
    hint: "Codifica y decodifica texto UTF-8. Acepta la variante URL-safe y archivos.",
    mount() {
      let mode = "encode";
      let urlSafe = false;
      const input = labeledArea("Entrada", "Pega texto o Base64");
      const output = labeledArea("Salida", "", { readOnly: true });
      const status = statusBox();
      const encodeBtn = segmentButton("Codificar", true);
      const decodeBtn = segmentButton("Decodificar", false);
      const urlBox = h("input", { type: "checkbox" });

      function setMode(next) {
        mode = next;
        encodeBtn.setAttribute("aria-pressed", String(next === "encode"));
        decodeBtn.setAttribute("aria-pressed", String(next === "decode"));
        run();
      }

      function run() {
        const value = input.area.value;
        if (!value.trim()) {
          output.area.value = "";
          status.set("idle", "Listo");
          return;
        }
        try {
          if (mode === "encode") {
            output.area.value = lib.encodeBase64(value, { urlSafe });
            status.set("ok", `${value.length} caracteres`);
          } else {
            const decoded = lib.decodeBase64(value);
            output.area.value = decoded.text;
            status.set("ok", `${decoded.bytes.length} bytes`);
          }
        } catch (error) {
          fail(output.area, status, error);
        }
      }

      encodeBtn.addEventListener("click", () => setMode("encode"));
      decodeBtn.addEventListener("click", () => setMode("decode"));
      urlBox.addEventListener("change", () => {
        urlSafe = urlBox.checked;
        run();
      });
      input.area.addEventListener("input", run);

      return layout({
        toolbar: [
          h("div", { class: "segment", role: "group", "aria-label": "Modo" }, [encodeBtn, decodeBtn]),
          h("label", { class: "check" }, [urlBox, "URL-safe"]),
          fileButton("Abrir archivo", async (file) => {
            if (mode === "encode") {
              const bytes = new Uint8Array(await file.arrayBuffer());
              output.area.value = lib.encodeBase64Bytes(bytes, { urlSafe });
              status.set("ok", `${file.name} · ${bytes.length} bytes`);
              return;
            }
            input.area.value = await file.text();
            run();
          }),
        ],
        body: h("div", { class: "panes" }, [input.el, output.el]),
        status,
      });
    },
  };
}

function jsonTool() {
  return {
    id: "json",
    name: "JSON",
    nav: "Formatear y validar",
    hint: "Valida, formatea o minifica JSON. Puede ordenar las claves.",
    mount() {
      let minify = false;
      let sort = false;
      let indent = "2";
      const input = labeledArea("Entrada", '{ "ejemplo": true }');
      const output = labeledArea("Salida", "", { readOnly: true });
      const status = statusBox();
      const prettyBtn = segmentButton("Formatear", true);
      const miniBtn = segmentButton("Minificar", false);
      const sortBox = h("input", { type: "checkbox" });
      const indentSelect = selectControl(
        [
          ["2", "2 espacios"],
          ["4", "4 espacios"],
          ["tab", "Tabulación"],
        ],
        (value) => {
          indent = value;
          run();
        },
      );

      function run() {
        const value = input.area.value;
        if (!value.trim()) {
          output.area.value = "";
          status.set("idle", "Listo");
          return;
        }
        try {
          const result = lib.formatJson(value, { indent, sort, minify });
          output.area.value = result.text;
          status.set("ok", `JSON válido · ${result.summary}`);
        } catch (error) {
          fail(output.area, status, error);
        }
      }

      function setMinify(next) {
        minify = next;
        prettyBtn.setAttribute("aria-pressed", String(!next));
        miniBtn.setAttribute("aria-pressed", String(next));
        indentSelect.disabled = next;
        run();
      }

      prettyBtn.addEventListener("click", () => setMinify(false));
      miniBtn.addEventListener("click", () => setMinify(true));
      sortBox.addEventListener("change", () => {
        sort = sortBox.checked;
        run();
      });
      input.area.addEventListener("input", run);

      return layout({
        toolbar: [
          h("div", { class: "segment", role: "group", "aria-label": "Modo" }, [prettyBtn, miniBtn]),
          indentSelect,
          h("label", { class: "check" }, [sortBox, "Ordenar claves"]),
          fileButton("Abrir archivo", async (file) => {
            input.area.value = await file.text();
            run();
          }),
        ],
        body: h("div", { class: "panes" }, [input.el, output.el]),
        status,
      });
    },
  };
}

function urlTool() {
  return {
    id: "url",
    name: "URL",
    nav: "Escapar una dirección",
    hint: "Codifica y decodifica componentes (espacios, acentos) o una URI completa.",
    mount() {
      return transformTool({
        modes: [
          ["component", "Componente"],
          ["uri", "URI completa"],
        ],
        placeholder: "https://ejemplo.com/a b?q=cañón",
        bidirectional: true,
        run(value, { mode, direction }) {
          return direction === "decode" ? lib.decodeUrl(value, mode) : lib.encodeUrl(value, mode);
        },
      });
    },
  };
}

function queryTool() {
  return {
    id: "query",
    name: "Query",
    nav: "Query string y JSON",
    hint: "Pasa una query string a JSON y un objeto JSON a query string. Las claves repetidas se vuelven arrays.",
    mount() {
      return transformTool({
        modes: [
          ["json", "A JSON"],
          ["query", "A query string"],
        ],
        placeholder: "q=dev&tag=json&tag=web",
        run(value, mode) {
          return mode === "query" || mode === "decode:query" ? lib.jsonToQuery(value) : lib.queryToJson(value);
        },
      });
    },
  };
}

function jwtTool() {
  return {
    id: "jwt",
    name: "JWT",
    nav: "Leer un token",
    hint: "Muestra cabecera y payload. No verifica la firma ni contacta con ningún servidor.",
    mount() {
      const input = labeledArea("Token", "eyJhbGciOiJub25lIn0.eyJzdWIiOiJkZW1vIn0.");
      const status = statusBox();
      const header = h("pre", { class: "json" });
      const payload = h("pre", { class: "json" });
      const meta = h("div", { class: "metrics" });
      const result = h("div", { class: "stack" }, [
        h("section", {}, [h("h2", { text: "Cabecera" }), header]),
        h("section", {}, [h("h2", { text: "Payload" }), payload]),
        meta,
      ]);
      result.hidden = true;

      function run() {
        const value = input.area.value.trim();
        if (!value) {
          result.hidden = true;
          status.set("idle", "Listo");
          return;
        }
        try {
          const decoded = lib.decodeJwt(value);
          header.textContent = JSON.stringify(decoded.header, null, 2);
          payload.textContent =
            typeof decoded.payload === "string" ? decoded.payload : JSON.stringify(decoded.payload, null, 2);
          meta.replaceChildren(...jwtMeta(decoded));
          result.hidden = false;
          status.set("ok", "Firma sin verificar");
        } catch (error) {
          result.hidden = true;
          const explained = explain(error);
          status.set("err", explained.message, explained.extra);
        }
      }

      input.area.addEventListener("input", run);
      return layout({
        body: h("div", { class: "stack" }, [input.el, result]),
        status,
      });
    },
  };
}

function epochTool() {
  return {
    id: "epoch",
    name: "Epoch",
    nav: "Unix e ISO-8601",
    hint: "Convierte marcas Unix e ISO-8601. Hasta 12 dígitos se leen como segundos; 13 o más, como milisegundos.",
    mount() {
      const input = h("input", {
        class: "text",
        type: "text",
        placeholder: "1700000000 o 2026-11-02T09:00:00Z",
        spellcheck: "false",
      });
      const status = statusBox();
      const metrics = h("div", { class: "metrics" });

      function show(date) {
        const described = lib.describeInstant(date);
        const rows = [
          ["Unix (segundos)", String(described.seconds)],
          ["Unix (milisegundos)", String(described.millis)],
          ["ISO UTC", described.iso],
          ["Local", described.local],
        ];
        metrics.replaceChildren(
          ...rows.map(([label, value]) => {
            const copy = h("button", { type: "button", class: "btn ghost", text: "Copiar" });
            copy.addEventListener("click", () => copyText(value, copy));
            return h("div", { class: "metric" }, [h("span", { text: label }), h("code", { text: value }), copy]);
          }),
        );
        status.set("ok", "Fecha reconocida");
      }

      function run() {
        try {
          const date = lib.parseInstant(input.value);
          if (!date) {
            metrics.replaceChildren();
            status.set("idle", "Listo");
            return;
          }
          show(date);
        } catch (error) {
          metrics.replaceChildren();
          const explained = explain(error);
          status.set("err", explained.message, explained.extra);
        }
      }

      input.addEventListener("input", run);
      return layout({
        toolbar: [
          input,
          h("button", {
            type: "button",
            class: "btn primary",
            text: "Ahora",
            onClick: () => {
              input.value = String(Math.trunc(Date.now() / 1000));
              run();
            },
          }),
        ],
        body: metrics,
        status,
      });
    },
  };
}

function uuidTool() {
  return {
    id: "uuid",
    name: "UUID",
    nav: "Identificadores v4",
    hint: "Genera UUID versión 4 con el generador del navegador.",
    mount() {
      const count = h("input", { class: "text count", type: "number", min: "1", max: "100", value: "1" });
      const output = labeledArea("Salida", "", { readOnly: true });
      const status = statusBox();

      function generate() {
        const total = Math.min(100, Math.max(1, Number(count.value) || 1));
        count.value = String(total);
        output.area.value = Array.from({ length: total }, () => lib.createUuid()).join("\n");
        status.set("ok", total === 1 ? "1 UUID" : `${total} UUID`);
      }

      generate();
      return layout({
        toolbar: [
          h("label", { class: "check" }, ["Cantidad", count]),
          h("button", { type: "button", class: "btn primary", text: "Generar", onClick: generate }),
        ],
        body: output.el,
        status,
      });
    },
  };
}

function hashTool() {
  return {
    id: "hash",
    name: "Hash",
    nav: "SHA-1 a SHA-512",
    hint: "Calcula SHA-1, SHA-256, SHA-384 y SHA-512 en local.",
    mount() {
      let algorithm = "SHA-256";
      let ticket = 0;
      const input = labeledArea("Entrada", "Texto a resumir");
      const hex = labeledArea("Hex", "", { readOnly: true });
      const base64 = labeledArea("Base64", "", { readOnly: true });
      const status = statusBox();
      const picker = selectControl(
        [
          ["SHA-1", "SHA-1"],
          ["SHA-256", "SHA-256"],
          ["SHA-384", "SHA-384"],
          ["SHA-512", "SHA-512"],
        ],
        (value) => {
          algorithm = value;
          run();
        },
      );
      picker.value = algorithm;

      async function run() {
        const value = input.area.value;
        const current = ++ticket;
        if (!value) {
          hex.area.value = "";
          base64.area.value = "";
          status.set("idle", "Listo");
          return;
        }
        try {
          const result = await lib.digest(algorithm, value);
          if (current !== ticket) return;
          hex.area.value = result.hex;
          base64.area.value = result.base64;
          status.set("ok", algorithm);
        } catch (error) {
          if (current !== ticket) return;
          fail(hex.area, status, error);
          base64.area.value = "";
        }
      }

      input.area.addEventListener("input", () => void run());
      return layout({
        toolbar: [picker],
        body: h("div", { class: "stack" }, [input.el, h("div", { class: "panes" }, [hex.el, base64.el])]),
        status,
      });
    },
  };
}

function htmlTool() {
  return {
    id: "html",
    name: "HTML",
    nav: "Entidades",
    hint: "Escapa y desescapa entidades HTML habituales (&, <, >, comillas y códigos numéricos).",
    mount() {
      return transformTool({
        modes: [
          ["escape", "Escapar"],
          ["unescape", "Desescapar"],
        ],
        placeholder: '<a href="ejemplo">',
        run(value, mode) {
          return mode === "unescape" || mode === "decode:unescape" ? lib.unescapeHtml(value) : lib.escapeHtml(value);
        },
      });
    },
  };
}

function transformTool({ modes, placeholder, run, bidirectional = false }) {
  let mode = modes[0][0];
  let direction = "encode";
  const input = labeledArea("Entrada", placeholder);
  const output = labeledArea("Salida", "", { readOnly: true });
  const status = statusBox();
  const buttons = modes.map(([, label], index) => segmentButton(label, index === 0));
  const encodeBtn = segmentButton("Codificar", true);
  const decodeBtn = segmentButton("Decodificar", false);

  function apply() {
    const value = input.area.value;
    if (!value) {
      output.area.value = "";
      status.set("idle", "Listo");
      return;
    }
    try {
      output.area.value = run(value, bidirectional ? { mode, direction } : mode);
      status.set("ok", `${output.area.value.length} caracteres`);
    } catch (error) {
      fail(output.area, status, error);
    }
  }

  buttons.forEach((button, index) => {
    button.addEventListener("click", () => {
      mode = modes[index][0];
      buttons.forEach((item, itemIndex) => item.setAttribute("aria-pressed", String(itemIndex === index)));
      apply();
    });
  });
  encodeBtn.addEventListener("click", () => setDirection("encode"));
  decodeBtn.addEventListener("click", () => setDirection("decode"));
  input.area.addEventListener("input", apply);

  function setDirection(next) {
    direction = next;
    encodeBtn.setAttribute("aria-pressed", String(next === "encode"));
    decodeBtn.setAttribute("aria-pressed", String(next === "decode"));
    apply();
  }

  return layout({
    toolbar: [
      bidirectional ? h("div", { class: "segment", role: "group", "aria-label": "Dirección" }, [encodeBtn, decodeBtn]) : null,
      h("div", { class: "segment", role: "group", "aria-label": "Modo" }, buttons),
    ],
    body: h("div", { class: "panes" }, [input.el, output.el]),
    status,
  });
}

function jwtMeta(decoded) {
  const payload = decoded.payload;
  const rows = [["Algoritmo", String(decoded.header.alg ?? "—")]];
  if (decoded.header.typ) rows.push(["Tipo", String(decoded.header.typ)]);
  if (payload && typeof payload === "object") {
    for (const key of ["iss", "sub", "aud", "jti"]) {
      if (payload[key] != null) rows.push([key, Array.isArray(payload[key]) ? payload[key].join(", ") : String(payload[key])]);
    }
    for (const key of ["exp", "nbf", "iat"]) {
      if (payload[key] == null) continue;
      rows.push([key, formatClaimTime(Number(payload[key]), key === "exp")]);
    }
  }
  rows.push(["Firma", decoded.signature || "(vacía)"]);
  return rows.map(([label, value]) => h("div", { class: "metric" }, [h("span", { text: label }), h("code", { text: value })]));
}

function formatClaimTime(seconds, checkExpiry) {
  if (!Number.isFinite(seconds)) return String(seconds);
  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) return String(seconds);
  const iso = date.toISOString();
  if (!checkExpiry) return iso;
  return date.getTime() < Date.now() ? `${iso} · caducado` : `${iso} · vigente`;
}

function layout({ toolbar = [], body, status }) {
  return h("div", { class: "tool" }, [
    toolbar.length ? h("div", { class: "toolbar" }, toolbar) : null,
    body,
    status.el,
  ]);
}

function labeledArea(label, placeholder, { readOnly = false } = {}) {
  const area = h("textarea", { spellcheck: "false", placeholder });
  area.readOnly = readOnly;
  const copy = h("button", { type: "button", class: "btn ghost", text: "Copiar" });
  copy.addEventListener("click", () => copyText(area.value, copy));
  return {
    area,
    el: h("div", { class: "area" }, [h("div", { class: "area-head" }, [h("span", { text: label }), copy]), area]),
  };
}

function statusBox() {
  const text = h("span", { text: "Listo" });
  const detail = h("pre", { class: "status-detail", hidden: true });
  const el = h("div", { class: "status", role: "status" }, [h("i", { class: "dot" }), h("div", {}, [text, detail])]);
  el.dataset.kind = "idle";
  return {
    el,
    set(kind, message, extra = "") {
      el.dataset.kind = kind;
      text.textContent = message;
      detail.textContent = extra;
      detail.hidden = !extra;
    },
  };
}

function fail(area, status, error) {
  const explained = explain(error);
  area.value = explained.hex;
  status.set("err", explained.message, explained.extra);
}

function explain(error) {
  if (error instanceof lib.ToolError) {
    return {
      message: error.message,
      extra: [error.details, error.snippet].filter(Boolean).join("\n"),
      hex: error.hex,
    };
  }
  return { message: "No se pudo procesar.", extra: error instanceof Error ? error.message : "", hex: "" };
}

function segmentButton(text, pressed) {
  return h("button", { type: "button", class: "seg", "aria-pressed": String(pressed), text });
}

function selectControl(options, onChange) {
  const node = h("select", { class: "select" });
  for (const [value, label] of options) node.append(h("option", { value, text: label }));
  node.addEventListener("change", () => onChange(node.value));
  return node;
}

function fileButton(label, onFile) {
  const input = h("input", { type: "file" });
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    input.value = "";
    if (file) void onFile(file);
  });
  return h("label", { class: "btn" }, [label, input]);
}

async function copyText(text, button) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = h("textarea");
    area.value = text;
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  const previous = button.textContent;
  button.textContent = "Copiado";
  window.setTimeout(() => {
    button.textContent = previous;
  }, 1200);
}

function h(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "hidden") node.hidden = true;
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of [].concat(children)) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}
