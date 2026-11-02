import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  ToolError,
  createUuid,
  decodeBase64,
  decodeJwt,
  decodeUrl,
  digest,
  encodeBase64,
  encodeUrl,
  escapeHtml,
  formatJson,
  jsonToQuery,
  parseInstant,
  queryToJson,
  unescapeHtml,
} from "../assets/lib.js";

test("base64 roundtrip including unicode and url-safe", () => {
  assert.equal(encodeBase64("hola"), "aG9sYQ==");
  assert.equal(decodeBase64("aG9s\nYQ==").text, "hola");
  assert.equal(decodeBase64("data:text/plain;base64,aG9sYQ==").text, "hola");
  assert.equal(decodeBase64(encodeBase64("cañón")).text, "cañón");

  const urlSafe = encodeBase64(">>>?~", { urlSafe: true });
  assert.equal(/[+/=]/u.test(urlSafe), false);
  assert.equal(decodeBase64(urlSafe).text, ">>>?~");
});

test("base64 rejects invalid input and binary that is not utf-8", () => {
  assert.throws(() => decodeBase64("%%%%"), ToolError);
  const error = assertThrows(() => decodeBase64("/w=="));
  assert.match(error.message, /UTF-8/);
  assert.match(error.hex, /ff/);
});

test("json formats, sorts, minifies and points at the error", () => {
  assert.equal(formatJson('{"b":1,"a":2}', { sort: true }).text, '{\n  "a": 2,\n  "b": 1\n}');
  assert.equal(formatJson('{\n  "a": 1\n}', { minify: true }).text, '{"a":1}');
  assert.equal(formatJson("[1]", {}).summary, "Array · 1 elemento");

  const error = assertThrows(() => formatJson("{"));
  assert.equal(error.message, "JSON no válido");
  assert.match(error.details, /Línea 1/);
  assert.match(error.snippet, /\^/u);
});

test("url and query string", () => {
  assert.equal(encodeUrl("cañón"), "ca%C3%B1%C3%B3n");
  assert.equal(decodeUrl("ca%C3%B1%C3%B3n"), "cañón");
  assert.equal(queryToJson("a=1&b=2&b=3"), '{\n  "a": "1",\n  "b": [\n    "2",\n    "3"\n  ]\n}');
  assert.equal(jsonToQuery('{"a":"1","b":["2","3"]}'), "a=1&b=2&b=3");
});

test("jwt reads header and payload without checking the signature", () => {
  const header = encodeBase64(JSON.stringify({ alg: "none", typ: "JWT" }), { urlSafe: true });
  const payload = encodeBase64(JSON.stringify({ sub: "demo", exp: 1700000000 }), { urlSafe: true });
  const decoded = decodeJwt(`${header}.${payload}.`);
  assert.equal(decoded.header.alg, "none");
  assert.equal(decoded.payload.sub, "demo");
  assert.equal(decoded.signature, "");
});

test("epoch treats short numbers as seconds and long ones as milliseconds", () => {
  assert.equal(parseInstant("0").toISOString(), "1970-01-01T00:00:00.000Z");
  assert.equal(parseInstant("1700000000").getTime(), 1700000000000);
  assert.equal(parseInstant("1700000000000").getTime(), 1700000000000);
  assert.equal(parseInstant("2026-11-02T09:00:00Z").toISOString(), "2026-11-02T09:00:00.000Z");
  assert.equal(parseInstant("  "), null);
  assert.throws(() => parseInstant("ayer"), ToolError);
});

test("html entities and uuid shape", () => {
  assert.equal(escapeHtml(`<a href="x">`), "&lt;a href=&quot;x&quot;&gt;");
  assert.equal(unescapeHtml("&lt;a&gt;&#39;&#x2F;"), "<a>'/");
  assert.match(createUuid(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
});

test("hash matches node crypto", async () => {
  const result = await digest("SHA-256", "hola");
  assert.equal(result.hex, createHash("sha256").update("hola").digest("hex"));
  assert.equal(result.base64, createHash("sha256").update("hola").digest("base64"));
});

function assertThrows(fn) {
  try {
    fn();
  } catch (error) {
    return error;
  }
  assert.fail("expected a throw");
}
