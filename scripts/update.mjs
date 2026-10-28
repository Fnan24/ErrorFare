// Haalt deals op uit sources.json, rekent prijzen om naar euro (ECB-koersen) en schrijft deals.json.
// Draait op Node 20+, zonder dependencies.
import { readFile, writeFile } from "node:fs/promises";

const UA = "Mozilla/5.0 (compatible; FoutprijsRadar/1.0)";
const MAX_AGE_DAYS = 10;
const MAX_DEALS = 300;

export function decode(s = "") {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#8217;/g, "'").replace(/&#8211;/g, "-").replace(/&#8364;/g, "€")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/\s+/g, " ").trim();
}

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1] : "";
}

export function parseFeed(xml) {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  return blocks.map((b) => {
    let link = decode(tag(b, "link"));
    if (!link) {
      const m = b.match(/<link[^>]*href="([^"]+)"/i);
      link = m ? m[1] : "";
    }
    const date = decode(tag(b, "pubDate") || tag(b, "published") || tag(b, "updated"));
    const t = Date.parse(date);
    return {
      title: decode(tag(b, "title")),
      link,
      time: Number.isFinite(t) ? new Date(t).toISOString() : null,
    };
  }).filter((x) => x.title && x.link);
}

function toNumber(raw) {
  let s = raw.replace(/\s/g, "");
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, ""));
  if (/,\d{1,2}$/.test(s)) return Number(s.replace(/\./g, "").replace(",", "."));
  return Number(s.replace(/,/g, ""));
}

const CUR = { "€": "EUR", EUR: "EUR", "$": "USD", USD: "USD", "£": "GBP", GBP: "GBP" };

export function parsePrice(title) {
  const re = /(€|\$|£|EUR|USD|GBP)\s?(\d[\d.,]*\d|\d)|(\d[\d.,]*\d|\d)\s?(€|EUR|USD|GBP)/i;
  const m = title.match(re);
  if (!m) return null;
  const cur = CUR[(m[1] || m[4]).toUpperCase()] || CUR[m[1] || m[4]];
  const amount = toNumber(m[2] || m[3]);
  return Number.isFinite(amount) && amount > 0 ? { amount, cur } : null;
}

export function classify(title) {
  return {
    error: /error fare|mistake fare|price error|pricing error|foutprijs|fout in de prijs/i.test(title),
    oneway: /one[- ]?way|enkele reis|single/i.test(title),
    cabin: /business|first class|premium economy/i.test(title) ? "premium" : "economy",
  };
}

async function getText(url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" }, signal: ctl.signal });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.text();
  } finally {
    clearTimeout(timer);
  }
}

async function getRates() {
  const xml = await getText("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml");
  const rates = { EUR: 1 };
  for (const m of xml.matchAll(/currency=['"](\w+)['"]\s+rate=['"]([\d.]+)['"]/g)) rates[m[1]] = Number(m[2]);
  const d = xml.match(/time=['"]([\d-]+)['"]/);
  return { rates, date: d ? d[1] : null };
}

async function main() {
  const sources = JSON.parse(await readFile("sources.json", "utf8")).filter((s) => s.enabled !== false);
  let old = { deals: [] };
  try { old = JSON.parse(await readFile("deals.json", "utf8")); } catch {}

  const { rates, date: ratesDate } = await getRates();
  const status = [];
  const fresh = [];

  for (const s of sources) {
    try {
      const items = parseFeed(await getText(s.url));
      if (!items.length) throw new Error("geen items gevonden");
      for (const it of items) {
        const p = parsePrice(it.title);
        const c = classify(it.title);
        const eur = p && rates[p.cur] ? Math.round(p.amount / rates[p.cur]) : null;
        fresh.push({
          id: it.link,
          title: it.title.replace(/[\u{1F300}-\u{1FAFF}☀-➿️]/gu, "").replace(/\s+/g, " ").trim(),
          link: it.link,
          source: s.name,
          time: it.time || new Date().toISOString(),
          priceEur: eur,
          priceOrig: p ? `${p.amount} ${p.cur}` : null,
          ...c,
        });
      }
      status.push({ name: s.name, ok: true, count: items.length });
    } catch (e) {
      status.push({ name: s.name, ok: false, error: String(e.message || e) });
    }
  }

  const byId = new Map(old.deals.map((d) => [d.id, d]));
  for (const d of fresh) byId.set(d.id, { ...byId.get(d.id), ...d });
  const cutoff = Date.now() - MAX_AGE_DAYS * 864e5;
  const deals = [...byId.values()]
    .filter((d) => Date.parse(d.time) >= cutoff)
    .sort((a, b) => Date.parse(b.time) - Date.parse(a.time))
    .slice(0, MAX_DEALS);

  await writeFile("deals.json", JSON.stringify({ updated: new Date().toISOString(), ratesDate, sources: status, deals }, null, 1));
  console.log(status.map((s) => `${s.name}: ${s.ok ? s.count + " items" : "MISLUKT (" + s.error + ")"}`).join("\n"));
  if (status.every((s) => !s.ok)) process.exitCode = 1;
}

if (process.argv[1] && process.argv[1].endsWith("update.mjs")) main();
