import { describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { rateLimit, clientKey, toHeaders } from "@/lib/rate-limit";
import { classify, probeUrls, type ProbeResult } from "@/lib/http";
import { summarise, ALL_SOURCE_URLS, PROBE_TTL_MS } from "@/lib/verify-sources";
import { SOURCES, TOTAL_SOURCE_COUNT } from "@data/sources";

describe("rate limiting", () => {
  it("allows exactly `limit` calls inside a window, then refuses", () => {
    const opts = { limit: 3, windowMs: 60_000, now: 1_000 };
    expect(rateLimit("k", opts).ok).toBe(true);
    expect(rateLimit("k", opts).ok).toBe(true);
    expect(rateLimit("k", opts).ok).toBe(true);
    const fourth = rateLimit("k", opts);
    expect(fourth.ok).toBe(false);
    expect(fourth.remaining).toBe(0);
  });

  it("counts remaining down", () => {
    const opts = { limit: 2, windowMs: 60_000, now: 0 };
    expect(rateLimit("r", opts).remaining).toBe(1);
    expect(rateLimit("r", opts).remaining).toBe(0);
  });

  it("resets once the window has passed", () => {
    const first = rateLimit("w", { limit: 1, windowMs: 1_000, now: 0 });
    expect(first.ok).toBe(true);
    expect(rateLimit("w", { limit: 1, windowMs: 1_000, now: 500 }).ok).toBe(false);
    // Past resetAt: a fresh window, not a permanent ban.
    expect(rateLimit("w", { limit: 1, windowMs: 1_000, now: 1_500 }).ok).toBe(true);
  });

  it("keeps clients independent", () => {
    const opts = { limit: 1, windowMs: 60_000, now: 0 };
    expect(rateLimit("a", opts).ok).toBe(true);
    expect(rateLimit("b", opts).ok).toBe(true);
    expect(rateLimit("a", opts).ok).toBe(false);
  });

  it("never reports negative remaining or negative reset", () => {
    const opts = { limit: 1, windowMs: 1_000, now: 0 };
    for (let i = 0; i < 50; i += 1) {
      const r = rateLimit("flood", opts);
      expect(r.remaining).toBeGreaterThanOrEqual(0);
      expect(r.resetIn).toBeGreaterThanOrEqual(0);
    }
  });

  it("derives a client key from proxy headers and scopes it", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } });
    expect(clientKey(req, "match")).toBe("match:1.2.3.4");

    const bare = new Request("http://x");
    expect(clientKey(bare, "match")).toBe("match:unknown");

    // The same IP in two scopes must not share a bucket.
    const a = clientKey(req, "match");
    const b = clientKey(req, "schemes");
    expect(a).not.toBe(b);
  });

  it("exposes standard headers", () => {
    const h = toHeaders(rateLimit("h", { limit: 5, windowMs: 2_000, now: 0 }));
    expect(h["X-RateLimit-Limit"]).toBe("5");
    expect(h["X-RateLimit-Remaining"]).toBe("4");
    expect(h["X-RateLimit-Reset"]).toBe("2");
  });
});

describe("source probing", () => {
  it("maps HTTP status to an outcome", () => {
    expect(classify(200)).toBe("ok");
    expect(classify(204)).toBe("ok");
    expect(classify(301)).toBe("unreachable");
    expect(classify(403)).toBe("forbidden");
    expect(classify(404)).toBe("not_found");
    expect(classify(410)).toBe("not_found");
    expect(classify(451)).toBe("forbidden");
    expect(classify(500)).toBe("server_error");
    expect(classify(503)).toBe("server_error");
  });

  it("gives up instead of hanging", async () => {
    const started = Date.now();
    // RFC 5737 blackhole address: connect will not answer.
    const res = await probeUrls(["http://192.0.2.1/never"], {
      timeoutMs: 700,
      concurrency: 1,
    });
    const only = res[0];
    if (!only) throw new Error("expected one probe result");
    expect(res).toHaveLength(1);
    expect(only.outcome).toBe("unreachable");
    expect(Date.now() - started).toBeLessThan(15_000);
  });

  it("respects the concurrency cap and preserves order", async () => {
    const urls = Array.from({ length: 8 }, (_, i) => `http://192.0.2.${i + 1}/x`);
    const res = await probeUrls(urls, { timeoutMs: 300, concurrency: 3 });
    expect(res.map((r) => r.url)).toEqual(urls);
  });
});

describe("a HEAD 404 is not evidence a document is gone", () => {
  // scholarships.gov.in answers 404 to HEAD and 206 to GET for the same live PDF.
  // Before this was handled, one verification run reported 8 "missing" official
  // documents, every one of which was in fact reachable.
  const server = http.createServer((req, res) => {
    if (req.method === "HEAD") {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(206, { "Content-Type": "application/pdf" }).end("%PDF-1.4\n");
  });

  const base = () => `http://127.0.0.1:${(server.address() as AddressInfo).port}/doc.pdf`;

  it("re-asks with GET and reports the document as reachable", async () => {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const res = await probeUrls([base()], { timeoutMs: 5_000, concurrency: 1 });
      expect(res[0]?.outcome).toBe("ok");
      expect(res[0]?.status).toBe(206);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("still reports a genuine GET 404 as not_found", async () => {
    const gone = http.createServer((req, res) => res.writeHead(404).end());
    await new Promise<void>((resolve) => gone.listen(0, "127.0.0.1", resolve));
    try {
      const url = `http://127.0.0.1:${(gone.address() as AddressInfo).port}/missing.pdf`;
      const res = await probeUrls([url], { timeoutMs: 5_000, concurrency: 1 });
      expect(res[0]?.outcome).toBe("not_found");
    } finally {
      await new Promise<void>((resolve) => gone.close(() => resolve()));
    }
  });

  it("still reports a genuine 403 as forbidden", async () => {
    const blocked = http.createServer((req, res) => res.writeHead(403).end());
    await new Promise<void>((resolve) => blocked.listen(0, "127.0.0.1", resolve));
    try {
      const url = `http://127.0.0.1:${(blocked.address() as AddressInfo).port}/botwall.pdf`;
      const res = await probeUrls([url], { timeoutMs: 5_000, concurrency: 1 });
      expect(res[0]?.outcome).toBe("forbidden");
    } finally {
      await new Promise<void>((resolve) => blocked.close(() => resolve()));
    }
  });
});

describe("source health summary", () => {
  const allUrls = () => [...new Set(Object.values(SOURCES).map((s) => s.url))];
  const allOk = () => allUrls().map((url) => ({ url, outcome: "ok" as const, status: 200, ms: 10 }));

  it("counts outcomes and only alarms on official failures", () => {
    const results: ProbeResult[] = allOk();
    const rep = summarise(results);
    expect(rep.summary.total).toBe(allUrls().length);
    expect(rep.summary.registeredKeys).toBe(TOTAL_SOURCE_COUNT);
    expect(rep.summary.ok).toBe(allUrls().length);
    expect(rep.summary.officialFailures).toBe(0);
    expect(rep.dead).toHaveLength(0);

    // Break one document. If it is official, that is an alarm.
    const target = results[0];
    if (!target) throw new Error("expected at least one source");
    const officialBefore = rep.health[0]?.official ?? false;
    results[0] = { url: target.url, outcome: "not_found", status: 404, ms: 10 };

    const broken = summarise(results);
    expect(broken.summary.notFound).toBe(1);
    expect(broken.dead).toHaveLength(1);
    expect(broken.summary.officialFailures).toBe(officialBefore ? 1 : 0);
  });

  it("attributes a document to every scheme and quota rule that cites it", () => {
    const rep = summarise(allOk());
    const cited = rep.health.filter((h) => h.usedBy.length > 0);
    expect(cited.length).toBeGreaterThan(0);
    for (const h of cited) {
      expect(h.usedBy.length, h.key).toBeGreaterThan(0);
      for (const id of h.usedBy) expect(id).toMatch(/^(scheme|quota):[A-Za-z0-9_]+$/);
      // No record listed twice for the same document.
      expect(new Set(h.usedBy).size, h.key).toBe(h.usedBy.length);
    }
    // Quota rules are cited independently of schemes and must be counted too.
    expect(rep.health.some((h) => h.usedBy.some((id) => id.startsWith("quota:")))).toBe(true);
  });

  it("folds several registry keys that cite one document into one probe", () => {
    // The TNEA 2026 brochure backs the reservation roster, the ex-servicemen quota
    // and the sports quota. That is one document, not three.
    const BROCHURE = "https://static.tneaonline.org/docs/2_Information_Brochure_2026.pdf";
    const shared = Object.entries(SOURCES).filter(([, s]) => s.url === BROCHURE);
    expect(shared.length).toBeGreaterThan(1);

    const rep = summarise([{ url: BROCHURE, outcome: "ok", status: 200, ms: 1 }]);
    const row = rep.health[0];
    if (!row) throw new Error("expected a row for the brochure");
    expect(row.alsoCitedAs.length).toBe(shared.length - 1);
    // Every record citing any of those keys attaches to the single document.
    expect(row.usedBy.length).toBeGreaterThan(1);
  });

  it("never lets a duplicate citation look uncited", () => {
    const rep = summarise(allOk());
    for (const h of rep.health) {
      expect(SOURCES[h.key], h.key).toBeDefined();
      expect(SOURCES[h.key].url).toBe(h.url);
    }
    expect(rep.dead).toHaveLength(0);
  });

  it("uses a TTL long enough that we are not a load generator", () => {
    expect(PROBE_TTL_MS).toBeGreaterThanOrEqual(60 * 60 * 1000);
  });

  it("probes every distinct document exactly once", () => {
    expect(new Set(ALL_SOURCE_URLS).size).toBe(ALL_SOURCE_URLS.length);
    expect(ALL_SOURCE_URLS.length).toBeLessThanOrEqual(TOTAL_SOURCE_COUNT);
    expect(ALL_SOURCE_URLS.length).toBeGreaterThan(0);
  });
});
