import { test, expect } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
test("probe", async () => {
  const db = new PGlite();
  expect((await db.query<{ x: number }>("select 1 as x")).rows[0]!.x).toBe(1);
  await db.close();
});
