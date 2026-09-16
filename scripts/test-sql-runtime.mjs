const child = Bun.spawn([process.execPath, "test", "--timeout", "180000", "tests/sql"], {
  stdin: "inherit",
  stdout: "pipe",
  stderr: "pipe",
});

const [stdout, stderr, exitCode] = await Promise.all([
  new Response(child.stdout).text(),
  new Response(child.stderr).text(),
  child.exited,
]);

process.stdout.write(stdout);
process.stderr.write(stderr);

const clean = `${stdout}\n${stderr}`.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
const hasPassSummary = /(?:^|\n)\s*\d+\s+pass\s*(?:\r?\n|$)/m.test(clean);
const hasZeroFailures = /(?:^|\n)\s*0\s+fail\s*(?:\r?\n|$)/m.test(clean);
const hasRunSummary = /Ran\s+\d+\s+tests?\s+across\s+\d+\s+files?\./.test(clean);
const hasFatalSignal = /(panic|segmentation fault|access violation|fatal error|crash)/i.test(clean);

const verifiedPglite99 =
  exitCode === 99 && hasPassSummary && hasZeroFailures && hasRunSummary && !hasFatalSignal;

process.exit(verifiedPglite99 ? 0 : exitCode);
