# Dev tools

Utilidades locales para el día a día: Base64, JSON, URL, query strings, JWT, fechas Unix, UUID, hashes SHA y entidades HTML.

El texto se procesa en el navegador. No hay servidor de datos ni cuentas.

## Arrancar

```bash
python serve.py
```

Abre `http://127.0.0.1:8765/`. Si `python` no existe en Windows, prueba `py serve.py`.

Usa este servidor. En Windows, `python -m http.server` puede entregar los `.js` como texto plano y el navegador entonces no carga la página. Tampoco abras `index.html` como archivo: el hash usa la API criptográfica del navegador, que solo funciona en `http://` o `https://`.

## Herramientas

| Herramienta | Qué hace |
| --- | --- |
| Base64 | Codifica y decodifica UTF-8, también URL-safe y archivos |
| JSON | Valida, formatea, minifica y puede ordenar claves |
| URL | `encodeURIComponent` o `encodeURI` |
| Query | Query string ↔ objeto JSON |
| JWT | Lee cabecera y payload. No verifica la firma |
| Epoch | Unix (segundos o milisegundos) ↔ ISO-8601 |
| UUID | Genera identificadores v4 |
| Hash | SHA-1, SHA-256, SHA-384, SHA-512 |
| HTML | Escapa y desescapa entidades habituales |

## Tests

```bash
node --test
```

## Añadir una herramienta

La lógica pura vive en `assets/lib.js`. La interfaz, en `assets/app.js`: crea una función que devuelva `{ id, name, nav, hint, mount }` y métela en el array `tools`.
