/**
 * Intigriti ruleset tests — `auditCompliance` behaviour.
 *
 * No JS test runner is currently wired up in the dashboard package
 * (no `vitest.config.ts`, no `jest.config.js`, no `test` script in
 * `dashboard/package.json`). When one is added, these tests should run
 * out-of-the-box — they only use a tiny `assertEq` helper that throws
 * on failure, so they can also be executed standalone:
 *
 *   cd /tmp/ehb-work/dashboard
 *   npx tsx ../tests/test_intigriti_ruleset.ts
 *
 * Or, once vitest is installed:
 *
 *   cd /tmp/ehb-work/dashboard
 *   npx vitest run ../tests/test_intigriti_ruleset.ts
 *
 * The file deliberately uses no test-runner globals so it can be
 * adopted by either runner without edits.
 */

import {
  auditCompliance,
  INTIGRITI_DEFAULTS,
} from "../dashboard/src/lib/intigriti-ruleset";

let failed = 0;
let passed = 0;

function check(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    // eslint-disable-next-line no-console
    console.log(`  ok  ${name}`);
  } catch (err) {
    failed += 1;
    // eslint-disable-next-line no-console
    console.error(`  FAIL ${name}\n    ${(err as Error).message}`);
  }
}

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

// ── Missing safe harbour → blocker ───────────────────────────────────
check("missing safe harbour is a blocker", () => {
  const verdict = auditCompliance({
    rateLimit: 30,
    scope: ["example.com"],
    rulesOfEngagement: {
      safeHarbour: false,
      userAgent: INTIGRITI_DEFAULTS.userAgent,
      customHeaders: { "X-EHB-Scan-Id": "{scanId}" },
    },
  });
  assert(verdict.ok === false, "expected verdict.ok === false");
  assert(
    verdict.blockers.some((b) => b.startsWith("safeHarbour:")),
    `expected a safeHarbour blocker, got ${JSON.stringify(verdict.blockers)}`
  );
});

// ── rateLimit > 100 → blocker ────────────────────────────────────────
check("rate limit above 100 req/min is a blocker", () => {
  const verdict = auditCompliance({
    rateLimit: 250,
    scope: ["example.com"],
    rulesOfEngagement: {
      safeHarbour: true,
      userAgent: INTIGRITI_DEFAULTS.userAgent,
      customHeaders: { "X-EHB-Scan-Id": "{scanId}" },
    },
  });
  assert(verdict.ok === false, "expected verdict.ok === false");
  assert(
    verdict.blockers.some((b) => b.startsWith("rateLimit:")),
    `expected a rateLimit blocker, got ${JSON.stringify(verdict.blockers)}`
  );
});

// ── missing X-EHB-Scan-Id custom header → required warning ───────────
check("missing X-EHB-Scan-Id header is a required-severity warning", () => {
  const verdict = auditCompliance({
    rateLimit: 30,
    scope: ["example.com"],
    rulesOfEngagement: {
      safeHarbour: true,
      userAgent: INTIGRITI_DEFAULTS.userAgent,
      customHeaders: { "X-Other": "v" },
    },
  });
  assert(
    verdict.ok === true,
    `expected verdict.ok === true (warning, not blocker), got ${JSON.stringify(verdict)}`
  );
  assert(
    verdict.warnings.some((w) => w.startsWith("customHeaders:")),
    `expected a customHeaders warning, got ${JSON.stringify(verdict.warnings)}`
  );
});

// ── happy path: full default config passes ──────────────────────────
check("default Intigriti config passes with no blockers/warnings", () => {
  const verdict = auditCompliance({
    rateLimit: INTIGRITI_DEFAULTS.rateLimit,
    scope: ["example.com"],
    rulesOfEngagement: {
      safeHarbour: true,
      userAgent: INTIGRITI_DEFAULTS.userAgent,
      customHeaders: INTIGRITI_DEFAULTS.customHeaders,
      destructivePayloadsAllowed:
        INTIGRITI_DEFAULTS.destructivePayloadsAllowed,
      redactPII: INTIGRITI_DEFAULTS.redactPII,
      respectRobotsTxt: INTIGRITI_DEFAULTS.respectRobotsTxt,
      timeWindow: INTIGRITI_DEFAULTS.timeWindow,
    },
  });
  assert(verdict.ok, `expected ok, got ${JSON.stringify(verdict)}`);
  assert(
    verdict.blockers.length === 0,
    `expected no blockers, got ${JSON.stringify(verdict.blockers)}`
  );
  assert(
    verdict.warnings.length === 0,
    `expected no warnings, got ${JSON.stringify(verdict.warnings)}`
  );
});

// ── empty scope → blocker (scopeStrict) ─────────────────────────────
check("empty scope is a blocker", () => {
  const verdict = auditCompliance({
    rateLimit: 30,
    scope: [],
    rulesOfEngagement: {
      safeHarbour: true,
      userAgent: INTIGRITI_DEFAULTS.userAgent,
      customHeaders: INTIGRITI_DEFAULTS.customHeaders,
    },
  });
  assert(verdict.ok === false, "expected verdict.ok === false");
  assert(
    verdict.blockers.some((b) => b.startsWith("scopeStrict:")),
    `expected a scopeStrict blocker, got ${JSON.stringify(verdict.blockers)}`
  );
});

// eslint-disable-next-line no-console
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
