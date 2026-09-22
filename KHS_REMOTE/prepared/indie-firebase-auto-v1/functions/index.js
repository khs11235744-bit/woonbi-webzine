'use strict';

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onRequest } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const crypto = require('node:crypto');

setGlobalOptions({ region: 'asia-northeast3' });
initializeApp();
const db = getFirestore();

const CINEMA = '000057';
const BRAND = 'indieart';
const CGID = 'FE8EF4D2-F22D-4802-A39A-D58F23A29C1E';
const BASE = 'https://www.dtryx.com';
const MAIN = `${BASE}/cinema/main.do?cgid=${CGID}&BrandCd=${BRAND}&CinemaCd=${CINEMA}`;
const UA = 'Mozilla/5.0 INDI+P FirebaseSync/1.0';
const KST = 'Asia/Seoul';

const NEWS_QUERIES = [
  { id: 'festival_official', category: '영화제', query: '(site:festival-cannes.com OR site:berlinale.de OR site:labiennale.org OR site:sundance.org OR site:locarnofestival.ch OR site:iffr.com OR site:tiff.net OR site:biff.kr) film festival' },
  { id: 'world_indie', category: '해외 독립·예술', query: 'independent film OR arthouse cinema OR art house film festival' },
  { id: 'art_press', category: '해외 독립·예술', query: '(site:indiewire.com OR site:screendaily.com OR site:bfi.org.uk OR site:mubi.com OR site:filmcomment.com) independent film OR arthouse OR film festival' },
  { id: 'asia_indie', category: '아시아', query: 'Asian cinema independent film festival OR auteur film Asia' },
  { id: 'korea_official', category: '국내 영화', query: '(site:kofic.or.kr OR site:magazine.kofic.or.kr OR site:indieground.kr OR site:koreafilm.or.kr) 한국영화 독립영화 예술영화' },
  { id: 'korea_indie', category: '한국 독립·예술', query: '(site:indieground.kr OR site:koreafilm.or.kr OR site:biff.kr OR site:jeonjufest.kr) 독립영화 예술영화 GV 기획전' },
  { id: 'art_cinema', category: '예술영화관', query: '(site:koreafilm.or.kr OR site:cinematheque.seoul.kr OR site:indiespace.kr OR site:artnine.co.kr OR site:sangsangmadang.com OR site:emuartspace.com) 영화 기획전 GV 상영' },
  { id: 'pohang_art', category: '지역 예술', query: '(site:phcf.or.kr OR site:ilwol.phcf.or.kr OR site:poma.pohang.go.kr) 포항 전시 공연 문화 예술 영화 축제' }
];

const OFFICIAL_DOMAINS = [
  'festival-cannes.com', 'berlinale.de', 'labiennale.org', 'sundance.org',
  'locarnofestival.ch', 'iffr.com', 'tiff.net', 'biff.kr', 'kofic.or.kr',
  'magazine.kofic.or.kr', 'indieground.kr', 'koreafilm.or.kr',
  'cinematheque.seoul.kr', 'indiespace.kr', 'artnine.co.kr',
  'sangsangmadang.com', 'emuartspace.com', 'phcf.or.kr', 'ilwol.phcf.or.kr',
  'poma.pohang.go.kr'
];

function nowIso() { return new Date().toISOString(); }
function kstStamp() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: KST, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).format(new Date()).replace(',', '') + ' KST';
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function decodeHtml(s = '') {
  return String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n) || 32));
}
function cleanHtml(s = '') {
  return decodeHtml(String(s).replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ').trim();
}
function pick(re, text) {
  const m = re.exec(text); return m ? cleanHtml(m[1]) : '';
}
function unique(xs) { return [...new Set(xs.filter(Boolean))]; }
function shorten(s = '', limit = 92) {
  s = String(s).trim(); if (s.length <= limit) return s;
  const cut = s.slice(0, limit + 24);
  const m = cut.match(/^([\s\S]{42,}?)[.!?…](?:\s|$)/);
  return m ? `${m[1].trim()}${cut[m[1].length] || ''}` : `${s.slice(0, limit).trim()}…`;
}
function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function tagText(xml, tag) {
  const m = String(xml).match(new RegExp(`<${escapeRe(tag)}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escapeRe(tag)}>`, 'i'));
  return m ? cleanHtml(m[1]) : '';
}
function sourceTag(xml) {
  const m = String(xml).match(/<source(?:\s+url="([^"]*)")?[^>]*>([\s\S]*?)<\/source>/i);
  return m ? { sourceUrl: decodeHtml(m[1] || ''), source: cleanHtml(m[2] || '') } : { sourceUrl: '', source: '' };
}
function domainOf(url = '') {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; }
}
function isOfficial(url = '') {
  const d = domainOf(url);
  return OFFICIAL_DOMAINS.some(x => d === x || d.endsWith(`.${x}`));
}
function normalizeTitle(t = '') { return String(t).toLowerCase().replace(/[^0-9a-z가-힣]+/gi, ''); }
function coreTitle(t = '') { return String(t).replace(/\s+-\s+[^-]+$/, '').trim(); }
function goodNewsTitle(t = '') {
  t = String(t).trim();
  if (!t || /undefined/i.test(t)) return false;
  if (/^\d{1,2}-\d{1,2}\s+[A-Za-z]+,?\s+\d{4}/.test(t)) return false;
  if (/Films \+ Events/i.test(t)) return false;
  if (/^[\d\s,./-]+(?:-[^-]+)?$/.test(t)) return false;
  return coreTitle(t).length >= 18;
}
async function fetchText(url, { timeoutMs = 25000, headers = {} } = {}) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, signal: ac.signal, redirect: 'follow' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} ${url}`);
    return await res.text();
  } finally { clearTimeout(timer); }
}
async function fetchJson(url, opts) { return JSON.parse(await fetchText(url, opts)); }

async function setStatus(key, patch) {
  await db.collection('public').doc('automationStatus').set({
    [key]: { ...patch, checkedAt: nowIso() },
    lastHeartbeat: nowIso(), version: 'firebase-auto-v1'
  }, { merge: true });
}

async function movieDetail(code) {
  const page = await fetchText(`${BASE}/movie/view.do?MovieCd=${encodeURIComponent(code)}`, { timeoutMs: 20000 });
  const title = pick(/<h3 class="h3">([\s\S]*?)<\/h3>/i, page);
  const eng = pick(/<h4 class="h4">([\s\S]*?)<\/h4>/i, page);
  const poster = (page.match(/<div class="poster">[\s\S]*?<img src="([^"]+)"/i) || [,''])[1];
  const synopsis = pick(/<div class="tit">줄거리<\/div>\s*<div class="txt">([\s\S]*?)<\/div>/i, page);
  const director = pick(/<dt>감독<\/dt>\s*<dd>([\s\S]*?)<\/dd>/i, page);
  const actors = pick(/<dt>배우<\/dt>\s*<dd>([\s\S]*?)<\/dd>/i, page);
  const infoMatch = page.match(/<h4 class="h4">[\s\S]*?<\/h4>\s*<div class="etc">([\s\S]*?)<\/div>/i);
  const meta = infoMatch ? [...infoMatch[1].matchAll(/<span>([\s\S]*?)<\/span>/gi)].map(m => cleanHtml(m[1])) : [];
  const trailer = (page.match(/data-source="([^"]+\.mp4)"/i) || [,''])[1];
  const stills = unique([...page.matchAll(/https:\/\/img\.dtryx\.com\/poster\/[^"']+\.Large\.(?:jpg|png|jpeg)/gi)].map(m => m[0]));
  return { code, title, eng, director, actors, short: shorten(synopsis), synopsis, poster, still: stills[0] || '', stills: stills.slice(0, 8), trailer, meta, sourceUrl: `${BASE}/movie/view.do?MovieCd=${code}` };
}

async function collectDtryx() {
  const html = await fetchText(MAIN, { timeoutMs: 25000 });
  const playing = html.split('<!-- // 현재상영작 top 10 -->', 1)[0];
  const movieCodes = unique([...playing.matchAll(/MovieCd=(\d{6})/g)].map(m => m[1]));
  const movies = {};
  for (const code of movieCodes.slice(0, 30)) {
    try { movies[code] = await movieDetail(code); }
    catch (e) { console.warn('movie detail skipped', code, e.message); }
    await sleep(40);
  }
  const enabled = [];
  for (const m of html.matchAll(/<a href="#" class="btnDay([^"]*)" data-dt="(\d{4}-\d{2}-\d{2})">/gi)) {
    if (!m[1].includes('disabled')) enabled.push(m[2]);
  }
  const dates = unique(enabled).sort();
  const days = [];
  for (const date of dates) {
    const q = new URLSearchParams({ BrandCd: BRAND, CinemaCd: CINEMA, PlaySDT: date, cgid: CGID });
    const body = await fetchJson(`${BASE}/cinema/showseq_list.do?${q.toString()}`, { timeoutMs: 20000 });
    const sessions = (body.Showseqlist || []).map(s => ({
      code: s.MovieCd || '', title: s.MovieNmNat || s.MovieNm || '', start: s.StartTime || '', end: s.EndTime || '',
      minutes: Number(s.RunningTime || 0), age: String(s.RatingNm || '').replace('이상관람가', '').replace('전체관람가', '전체'),
      availableSeats: Number(s.RemainSeatCnt || 0), showSeq: Number(s.ShowSeq || 1), screenCode: s.ScreenCd || '01',
      screenName: s.ScreenNm || '', bookable: String(s.NextSkipYn || '').toUpperCase() === 'Y'
    })).sort((a, b) => a.start.localeCompare(b.start));
    days.push({ date, sessions });
  }
  if (!days.length) throw new Error('Dtryx returned no enabled screening days; last-good data preserved.');
  const updated = kstStamp();
  const live = { updated, source: 'Dtryx 인디플러스 포항 공개 편성', cinema: { name: '인디플러스 포항', code: CINEMA }, days };
  const movieOut = { updated, source: 'Dtryx 공개 영화 상세 페이지', movies };
  const programHits = ['GV', '기획전'].filter(k => html.includes(k));
  const note = programHits.length ? `공개 극장 메인 페이지에 ${programHits.join(', ')} 표기가 있습니다. 공식 극장 소식에서 상세를 확인하세요.` : '공개 극장 메인 페이지 기준 별도 GV/기획전 표기를 확인하지 못했습니다.';
  const programs = { updated, source: 'Dtryx 인디플러스 포항 극장 메인 페이지', items: [], note };
  return { live, movies: movieOut, programs, stats: { days: days.length, sessions: days.reduce((n, d) => n + d.sessions.length, 0), movies: Object.keys(movies).length } };
}

async function runDtryxSync() {
  try {
    const out = await collectDtryx();
    const batch = db.batch();
    batch.set(db.collection('public').doc('live'), out.live);
    batch.set(db.collection('public').doc('movies'), out.movies);
    batch.set(db.collection('public').doc('programs'), out.programs);
    await batch.commit();
    await setStatus('dtryx', { ok: true, lastSuccess: nowIso(), lastError: null, ...out.stats });
    console.log('Dtryx sync OK', out.stats);
    return out.stats;
  } catch (e) {
    console.error('Dtryx sync FAILED', e);
    await setStatus('dtryx', { ok: false, lastError: String(e?.message || e).slice(0, 1000) });
    throw e;
  }
}

function parseGoogleNewsRss(xml, spec) {
  const rows = [];
  for (const m of String(xml).matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const item = m[1];
    const titleOriginal = tagText(item, 'title');
    const url = tagText(item, 'link');
    const descriptionOriginal = tagText(item, 'description').slice(0, 600);
    const publishedRaw = tagText(item, 'pubDate');
    const src = sourceTag(item);
    const published = new Date(publishedRaw);
    const publishedAt = Number.isFinite(published.getTime()) ? published.toISOString() : '';
    if (!titleOriginal || !url) continue;
    const id = crypto.createHash('sha1').update(titleOriginal + url).digest('hex').slice(0, 14);
    rows.push({ id, category: spec.category, queryId: spec.id, titleOriginal, url, descriptionOriginal, publishedAt, ...src });
  }
  return rows;
}

async function collectNews() {
  const now = Date.now();
  const cutoff = now - 14 * 86400000;
  const all = [];
  for (const spec of NEWS_QUERIES) {
    try {
      const p = new URLSearchParams({ q: spec.query, hl: 'en-US', gl: 'US', ceid: 'US:en' });
      const xml = await fetchText(`https://news.google.com/rss/search?${p.toString()}`, { timeoutMs: 25000 });
      for (const row of parseGoogleNewsRss(xml, spec)) {
        const ts = row.publishedAt ? Date.parse(row.publishedAt) : now;
        if (Number.isFinite(ts) && ts < cutoff) continue;
        const dom = domainOf(row.sourceUrl);
        row.official = isOfficial(row.sourceUrl);
        let score = row.official ? 20 : 0;
        if (['국내 영화', '지역 예술', '예술영화관'].includes(row.category)) score += 8;
        if (row.category === '영화제') score += 6;
        if (['해외 독립·예술', '한국 독립·예술'].includes(row.category)) score += 4;
        if (Number.isFinite(ts)) score += Math.max(0, 12 - Math.max(0, (now - ts) / 86400000));
        row.score = Math.round(score * 100) / 100;
        row.sourceDomain = dom;
        all.push(row);
      }
    } catch (e) { console.warn('news query failed', spec.id, e.message); }
    await sleep(60);
  }
  const dedup = new Map();
  for (const x of all) {
    const key = normalizeTitle(x.titleOriginal);
    if (key && !dedup.has(key)) dedup.set(key, x);
  }
  const items = [...dedup.values()].sort((a, b) => (b.score - a.score) || String(b.publishedAt).localeCompare(String(a.publishedAt)));
  const per = {};
  const selected = [];
  for (const x of items) {
    const n = per[x.category] || 0;
    if (n >= 12) continue;
    per[x.category] = n + 1; selected.push(x);
    if (selected.length >= 36) break;
  }
  if (!selected.length) throw new Error('News RSS returned zero usable items; last-good data preserved.');
  return { generatedAt: nowIso(), lookbackDays: 14, itemCount: selected.length, items: selected };
}

async function buildWeekly(raw) {
  let previous = {};
  try {
    const snap = await db.collection('public').doc('newsWeekly').get();
    if (snap.exists) previous = Object.fromEntries((snap.data().items || []).filter(x => x.id).map(x => [x.id, x]));
  } catch (e) { console.warn('previous news cache unavailable', e.message); }
  const limits = { '영화제': 6, '해외 독립·예술': 5, '아시아': 3, '국내 영화': 6, '한국 독립·예술': 5, '예술영화관': 5, '지역 예술': 6 };
  const counts = {}, selected = [];
  const items = [...raw.items].filter(x => goodNewsTitle(x.titleOriginal)).sort((a, b) => (Number(b.official) - Number(a.official)) || (b.score - a.score) || String(b.publishedAt).localeCompare(String(a.publishedAt)));
  for (const x of items) {
    const c = x.category || '기타';
    if ((counts[c] || 0) >= (limits[c] || 3)) continue;
    counts[c] = (counts[c] || 0) + 1;
    const prev = previous[x.id] || {};
    selected.push({
      id: x.id, category: c, source: x.source || '', official: Boolean(x.official), publishedAt: x.publishedAt || '',
      url: x.url || '', sourceUrl: x.sourceUrl || '', titleOriginal: coreTitle(x.titleOriginal),
      titleKo: prev.titleKo || '', summaryKo: prev.summaryKo || '', whyItMatters: prev.whyItMatters || '',
      keyPoints: prev.keyPoints || [], tags: prev.tags || [], translationStatus: prev.translationStatus || 'pending'
    });
    if (selected.length >= 32) break;
  }
  return {
    generatedAt: nowIso(), periodLabel: '최근 2주 / 자동 편집본',
    translationPolicy: '원문 전문을 복제하지 않고 제목·핵심 내용만 한국어로 번역·요약',
    digestTitle: '이번 주 세계 독립·예술영화 뉴스', digestSummary: '', items: selected
  };
}

async function runNewsSync() {
  try {
    const raw = await collectNews();
    const weekly = await buildWeekly(raw);
    const batch = db.batch();
    batch.set(db.collection('public').doc('newsRaw'), raw);
    batch.set(db.collection('public').doc('newsWeekly'), weekly);
    await batch.commit();
    const translated = weekly.items.filter(x => x.translationStatus === 'translated-reviewed' && x.titleKo && x.summaryKo).length;
    await setStatus('news', { ok: true, lastSuccess: nowIso(), lastError: null, rawCount: raw.itemCount, weeklyCount: weekly.items.length, translatedCount: translated, pendingCount: weekly.items.length - translated });
    console.log('News sync OK', { raw: raw.itemCount, weekly: weekly.items.length, translated });
    return { raw: raw.itemCount, weekly: weekly.items.length, translated };
  } catch (e) {
    console.error('News sync FAILED', e);
    await setStatus('news', { ok: false, lastError: String(e?.message || e).slice(0, 1000) });
    throw e;
  }
}

exports.syncDtryxSchedule = onSchedule('every 30 minutes', async () => { await runDtryxSync(); });
exports.syncNewsSchedule = onSchedule('every 3 hours', async () => { await runNewsSync(); });

exports.syncHealth = onRequest({ cors: true }, async (req, res) => {
  try {
    const [status, live, news] = await Promise.all([
      db.collection('public').doc('automationStatus').get(),
      db.collection('public').doc('live').get(),
      db.collection('public').doc('newsWeekly').get()
    ]);
    const s = status.exists ? status.data() : {};
    const l = live.exists ? live.data() : {};
    const n = news.exists ? news.data() : {};
    res.set('Cache-Control', 'no-store');
    res.status(200).json({ ok: true, automation: s, liveUpdated: l.updated || null, newsGeneratedAt: n.generatedAt || null, checkedAt: nowIso() });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e), checkedAt: nowIso() });
  }
});
