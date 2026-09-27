/**
 * npm run verify:sources
 *
 * Checks that every document the catalogue cites is still reachable, and exits
 * non-zero if an *official* one is missing. Wire this into CI so a dead citation
 * is a build failure rather than something a student discovers.
 *
 * Network flakiness is not a data-quality problem, so only `not_found` and a
 * hard `forbidden` are treated as failures. Timeouts and 5xx are reported but
 * do not fail the run.
 */
import { checkSources } from "../src/lib/verify-sources";

const GREEN = "\u001b[32m";
const RED = "\u001b[31m";
const YELLOW = "\u001b[33m";
const DIM = "\u001b[2m";
const OFF = "\u001b[0m";

const MARK: Record<string, string> = {
  ok: `${GREEN}ok  ${OFF}`,
  not_found: `${RED}404 ${OFF}`,
  forbidden: `${RED}403 ${OFF}`,
  server_error: `${YELLOW}5xx ${OFF}`,
  unreachable: `${YELLOW}--- ${OFF}`,
};

async function main() {
  const force = !process.argv.includes("--cached");
  process.stdout.write(
    force ? "Probing every source (one outbound request each)…\n\n" : "Using cached results…\n\n",
  );

  const report = await checkSources({ force });
  const s = report.summary;

  for (const h of [...report.health].sort((a, b) => {
    if (a.official !== b.official) return a.official ? -1 : 1;
    return a.outcome === b.outcome ? 0 : a.outcome === "ok" ? 1 : -1;
  })) {
    const used = h.usedBy.length ? `${DIM}${h.usedBy.length} citation(s)${OFF}` : `${DIM}uncited${OFF}`;
    process.stdout.write(
      `${MARK[h.outcome] ?? h.outcome}  ${h.publisher.slice(0, 52).padEnd(52)} ${used}\n`,
    );
    if (h.error) process.stdout.write(`      ${DIM}${h.error}${OFF}\n`);
  }

  process.stdout.write(
    `\n${s.official} official / ${s.total} sources · ` +
      `${GREEN}${s.ok} reachable${OFF} · ${s.notFound} missing · ` +
      `${s.forbidden} blocked · ${s.serverError} server errors · ${s.unreachable} unreachable\n`,
  );
  process.stdout.write(
    `${s.schemesCoveredByOfficial} schemes carry at least one official source. ` +
      `Oldest human read: ${report.health.reduce((a, h) => (a < h.lastHumanRead ? a : h.lastHumanRead), "9999")}\n`,
  );

  // A source being slow, or refusing our user agent, is not a broken citation.
  // Only a document that is definitively gone fails the build. Treating a 403 as
  // fatal would mean any portal that dislikes bots blocks the whole pipeline.
  const fatal = report.dead.filter((h) => h.official && h.outcome === "not_found");
  const blocked = report.dead.filter(
    (h) => h.official && (h.outcome === "forbidden" || h.outcome === "unreachable" || h.outcome === "server_error"),
  );

  if (blocked.length > 0) {
    process.stdout.write(
      `\n${YELLOW}${blocked.length} official source(s) could not be reached from here. ` +
        `This is usually bot-blocking or a slow portal, not a missing document:${OFF}\n`,
    );
    for (const h of blocked) {
      process.stdout.write(`  ${h.key}: ${h.url} (${h.outcome}${h.status ? ` ${h.status}` : ""})\n`);
    }
  }

  if (fatal.length > 0) {
    process.stdout.write(`\n${RED}${fatal.length} official source(s) are gone:${OFF}\n`);
    for (const h of fatal) {
      const affected = h.usedBy.join(", ");
      process.stdout.write(`  ${h.key}: ${h.url}\n`);
      if (affected) process.stdout.write(`    affects: ${affected}\n`);
    }
    process.exit(1);
  }

  process.stdout.write(
    `\n${GREEN}No official source is missing.${OFF}` +
      (blocked.length > 0 ? ` ${YELLOW}${blocked.length} unreachable — verify by hand.${OFF}` : "") +
      "\n",
  );
}

main().catch((err) => {
  process.stderr.write(`${RED}verification failed:${OFF} ${err}\n`);
  process.exit(2);
});
