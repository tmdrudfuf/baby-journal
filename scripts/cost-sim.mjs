// Cost simulation (M10, §41): monthly infra cost and margin for a few scenarios.
//   npm run cost:sim            (assumptions below; edit them, not the math)
// Numbers are list prices / estimates from docs/COST_MODEL.md, not measurements.

const PRICE = {
  opus: { in: 5, out: 25 }, // $ per million tokens
  haiku: { in: 1, out: 5 },
  r2GbMonth: 0.015,
  r2OpsPerFamily: 0.0005,
  playFee: 0.15,
};
const USAGE = {
  journalCalls: 30, journalIn: 500, journalOut: 200, // per active family per month
  dailyStories: 10, dailyIn: 900, dailyOut: 250, // Plus only
  asks: 8, askIn: 1500, askOut: 150, // Plus only; embeddings run in the edge runtime (no per-call fee)
  storageGbYear1: 0.07, originalsGb: 0.55,
};
const supabase = (families) => Math.max(25, families * 0.0006); // Pro base, then ~$0.0006/family (compute+disk)

const aiCost = (model, calls, tin, tout) => (calls * (tin * PRICE[model].in + tout * PRICE[model].out)) / 1e6;

function scenario({ families, paidShare, price, journalModel, freeJournal }) {
  const paid = families * paidShare;
  const free = families - paid;
  const journal = aiCost(journalModel, USAGE.journalCalls, USAGE.journalIn, USAGE.journalOut);
  const plusExtras = aiCost('opus', USAGE.dailyStories, USAGE.dailyIn, USAGE.dailyOut) + aiCost('opus', USAGE.asks, USAGE.askIn, USAGE.askOut);
  const ai = paid * (journal + plusExtras) + (freeJournal ? free * journal : 0);
  const storage = families * USAGE.storageGbYear1 * PRICE.r2GbMonth + paid * USAGE.originalsGb * PRICE.r2GbMonth + families * PRICE.r2OpsPerFamily;
  const infra = supabase(families) + storage + ai;
  const revenue = paid * price * (1 - PRICE.playFee);
  return { infra, ai, revenue, margin: revenue ? (revenue - infra) / revenue : -Infinity };
}

const fmt = (n) => `$${n >= 100 ? Math.round(n).toLocaleString('en-US') : n.toFixed(2)}`;
const rows = [];
for (const families of [1_000, 10_000, 100_000]) {
  for (const [label, opts] of [
    ['today: free gets AI journal (Opus)', { journalModel: 'opus', freeJournal: true }],
    ['free AI journal on Haiku', { journalModel: 'haiku', freeJournal: true }],
    ['AI journal paid-only (Opus)', { journalModel: 'opus', freeJournal: false }],
  ]) {
    const r = scenario({ families, paidShare: 0.2, price: 4.99, ...opts });
    rows.push({ families: families.toLocaleString('en-US'), scenario: label, infra: fmt(r.infra), ai: fmt(r.ai), revenue: fmt(r.revenue), margin: `${Math.round(r.margin * 100)}%` });
  }
}
console.table(rows);
