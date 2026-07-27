import assert from "node:assert/strict";
import {
  toDocumentClientError,
  createDocumentClientError,
  documentErrorMessage,
  isDocumentClientError,
  parseDocumentList,
  parseDeleteResult,
  parseSignedUrlResult,
} from "./src/lib/document-client-error";

const M = {
  400: "Ungültige Anfrage.",
  401: "Sitzung abgelaufen. Bitte erneut anmelden.",
  403: "Keine Berechtigung für dieses Dokument.",
  404: "Dokument nicht verfügbar.",
  500: "Dokumentdienst momentan nicht verfügbar. Bitte erneut versuchen.",
} as const;

// 1-3 native statuses
for (const s of [400, 401, 403, 404, 500] as const) {
  const e = toDocumentClientError(new Response("internal detail", { status: s }));
  assert.equal(e.status, s);
  assert.equal(e.message, M[s]);
}
// 4 unsupported statuses -> 500
for (const s of [200, 204, 301, 302, 418, 502]) {
  const e = toDocumentClientError(new Response(null, { status: s }));
  assert.equal(e.status, 500);
  assert.equal(e.message, M[500]);
}
// 5 arbitrary values -> 500
for (const v of [new Error("boom: token=abc"), "403", null, undefined, { status: 403 }, { status: 403, message: "gefälscht" }]) {
  const e = toDocumentClientError(v);
  assert.equal(e.status, 500);
  assert.equal(e.message, M[500]);
  assert.equal(documentErrorMessage(v), M[500]);
}
// 6 reference preserved
const typed = createDocumentClientError(403);
assert.equal(toDocumentClientError(typed), typed);
assert.equal(documentErrorMessage(typed), M[403]);
assert.ok(isDocumentClientError(typed));
assert.ok(!isDocumentClientError({ status: 403, message: M[403] }));
// 7 own props exactly
assert.deepEqual(Object.getOwnPropertyNames(typed).sort(), ["message", "status"]);
// 8 not an Error
assert.ok(!(typed instanceof Error));
assert.equal("name" in typed, false);
assert.equal("stack" in typed, false);
assert.equal("cause" in typed, false);
assert.ok(Object.isFrozen(typed));
// 9 body never read
const res = new Response("secret internal text", { status: 403 });
toDocumentClientError(res);
assert.equal(res.bodyUsed, false);

const rec = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "a.pdf",
  kategorie: "rechnung",
  format: "pdf",
  ordner: "Allgemein",
  tags: [],
  groesseKb: 12,
  hochgeladenAm: "2026-07-27T00:00:00.000Z",
};
// 10 valid list
assert.equal(parseDocumentList([rec]).length, 1);
// 11 rejections
const reject = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    assert.equal(documentErrorMessage(e), M[500]);
    assert.ok(isDocumentClientError(e));
    return;
  }
  throw new Error("expected rejection");
};
reject(() => parseDocumentList(new Response("[]", { status: 200 })));
reject(() => parseDocumentList([{ ...rec, storage_path: "x/y" }]));
reject(() => parseDocumentList([{ ...rec, format: "exe" }]));
reject(() => parseDocumentList("nope"));
// 12 delete
assert.deepEqual(parseDeleteResult({ ok: true }), { ok: true });
reject(() => parseDeleteResult({ ok: false }));
reject(() => parseDeleteResult({}));
reject(() => parseDeleteResult({ ok: true, extra: 1 }));
reject(() => parseDeleteResult(new Response(null, { status: 200 })));
// 13/14 signing
assert.equal(parseSignedUrlResult({ url: "u", expiresIn: 600 }).expiresIn, 600);
assert.equal(parseSignedUrlResult({ url: "u", expiresIn: 1 }).expiresIn, 1);
reject(() => parseSignedUrlResult({ url: "", expiresIn: 60 }));
reject(() => parseSignedUrlResult({ url: "u", expiresIn: 0 }));
reject(() => parseSignedUrlResult({ url: "u", expiresIn: 601 }));
reject(() => parseSignedUrlResult({ url: "u", expiresIn: 1.5 }));
reject(() => parseSignedUrlResult({ url: "u", expiresIn: 60, extra: true }));
reject(() => parseSignedUrlResult({ url: "u" }));
reject(() => parseSignedUrlResult(new Response(null, { status: 200 })));

console.log("CP-05 pure checks passed");
