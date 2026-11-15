const fs = require('fs');
const path = require('path');

const DOMAIN = 'https://news.pageaura.xyz';
const KEY = 'dd5dc9a82ae9487e912c9d3c7cbf4c71';
const KEY_FILENAME = `${KEY}.txt`;

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const URLS_FILE = path.join(ROOT, 'urls.txt');
const REDIRECTS_FILE = path.join(PUBLIC_DIR, '_redirects');
const SITEMAP_FILE = path.join(PUBLIC_DIR, 'sitemap.xml');
const ROOT_KEY_FILE = path.join(ROOT, KEY_FILENAME);

// Target destination links pool
const TARGET_DESTINATIONS = [
  "https://docs.google.com/forms/d/1bYAG8-tN6-j_A9OHAd_Pk2vk167nBda8mvjCixWqFrU/edit",
  "https://docs.google.com/forms/d/1SVagHdDqsiqd7SCWcVK5xqvonSPW6-H1ELcgHpKlWZQ/edit",
  "https://docs.google.com/forms/d/1nyXb6NssG8gFRsVXJG6twEhMF1Qxy19A-PlTErG5U7w/edit"
];

function generateRandomString(length = 7) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 1. Read existing redirects history from public/_redirects
let existingRedirectLines = [];
if (fs.existsSync(REDIRECTS_FILE)) {
  existingRedirectLines = fs.readFileSync(REDIRECTS_FILE, 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

const redirectMap = new Map();
for (const line of existingRedirectLines) {
  if (line.startsWith('#')) continue;
  const parts = line.split(/\s+/);
  if (parts.length >= 2) {
    redirectMap.set(parts[0], parts[1]);
  }
}

// 2. Generate a new random redirect rule per build
const randomSlug = `/${generateRandomString(7)}`;
const randomDestination = TARGET_DESTINATIONS[Math.floor(Math.random() * TARGET_DESTINATIONS.length)];

if (!redirectMap.has(randomSlug)) {
  redirectMap.set(randomSlug, randomDestination);
}

// Save back updated _redirects
let redirectsContent = "# Cloudflare Pages Redirect Rules (Cumulative & Preserved)\n";
for (const [p, d] of redirectMap.entries()) {
  redirectsContent += `${p}    ${d}    301\n`;
}

fs.mkdirSync(PUBLIC_DIR, { recursive: true });
fs.writeFileSync(REDIRECTS_FILE, redirectsContent.trim() + '\n', 'utf8');

// 3. Read existing URLs from urls.txt history
let existingUrls = [];
if (fs.existsSync(URLS_FILE)) {
  existingUrls = fs.readFileSync(URLS_FILE, 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

// 4. Combine base domain, all historical urls.txt entries, AND all redirect paths into a Set
const urlsSet = new Set(existingUrls);
urlsSet.add(`${DOMAIN}/`);

for (const [p] of redirectMap.entries()) {
  urlsSet.add(`${DOMAIN}${p}`);
}

const finalUrls = Array.from(urlsSet);

// Permanently save cumulative URLs back to urls.txt
fs.writeFileSync(URLS_FILE, finalUrls.join('\n') + '\n', 'utf8');

const lastmod = new Date().toISOString();

function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// 5. Generate Sitemap XML containing ALL cumulative URLs
let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
xml += '        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n';

for (const urlStr of finalUrls) {
  let urlObj;
  try {
    urlObj = new URL(urlStr);
  } catch {
    continue;
  }

  let pathSlug = urlObj.pathname.split('/').filter(Boolean).pop() || 'Latest News Updates';
  let newsTitle = pathSlug.replace(/[-_]/g, ' ');
  newsTitle = newsTitle.charAt(0).toUpperCase() + newsTitle.slice(1);

  xml += '  <url>\n';
  xml += `    <loc>${escapeXml(urlObj.href)}</loc>\n`;
  xml += `    <lastmod>${lastmod}</lastmod>\n`;
  xml += '    <changefreq>hourly</changefreq>\n';
  xml += '    <priority>0.9</priority>\n';
  xml += '    <news:news>\n';
  xml += '      <news:publication>\n';
  xml += '        <news:name>News PageAura</news:name>\n';
  xml += '        <news:language>en</news:language>\n';
  xml += '      </news:publication>\n';
  xml += `      <news:publication_date>${lastmod}</news:publication_date>\n`;
  xml += `      <news:title>${escapeXml(newsTitle)}</news:title>\n`;
  xml += '    </news:news>\n';
  xml += '  </url>\n';
}

xml += '</urlset>\n';

fs.writeFileSync(SITEMAP_FILE, xml, 'utf8');
fs.writeFileSync(path.join(PUBLIC_DIR, KEY_FILENAME), KEY, 'utf8');

console.log(`Successfully generated sitemap. Total cumulative URLs included: ${finalUrls.length}`);
