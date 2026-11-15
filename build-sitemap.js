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

// Target destination links pool (Aap yahan apne Google Forms ya destination links rakh sakte hain)
const TARGET_DESTINATIONS = [
  "https://docs.google.com/forms/d/1bYAG8-tN6-j_A9OHAd_Pk2vk167nBda8mvjCixWqFrU/edit",
  "https://docs.google.com/forms/d/1SVagHdDqsiqd7SCWcVK5xqvonSPW6-H1ELcgHpKlWZQ/edit",
  "https://docs.google.com/forms/d/1nyXb6NssG8gFRsVXJG6twEhMF1Qxy19A-PlTErG5U7w/edit"
];

// Helper to generate a random 7-character string (e.g., /nyhfzhq)
function generateRandomString(length = 7) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 1. Read existing redirects history from public/_redirects if present
let existingRedirectLines = [];
if (fs.existsSync(REDIRECTS_FILE)) {
  existingRedirectLines = fs.readFileSync(REDIRECTS_FILE, 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

// Parse existing redirects to keep a record of used paths and destinations
const redirectMap = new Map(); // path -> destination
for (const line of existingRedirectLines) {
  if (line.startsWith('#')) continue;
  const parts = line.split(/\s+/);
  if (parts.length >= 2) {
    const p = parts[0];
    const d = parts[1];
    redirectMap.set(p, d);
  }
}

// 2. Automatically generate a new random redirect rule if needed (e.g., 1 new per build)
const randomSlug = `/${generateRandomString(7)}`; const randomDestination = TARGET_DESTINATIONS[Math.floor(Math.random() * TARGET_DESTINATIONS.length)];  if (!redirectMap.has(randomSlug)) { redirectMap.set(randomSlug, randomDestination); }  // Rebuild cumulative _redirects content let redirectsContent = "# Cloudflare Pages Redirect Rules (Cumulative & Preserved)\n"; for (const [p, d] of redirectMap.entries()) { redirectsContent += `${p}    ${d}    301\n`; }  fs.mkdirSync(PUBLIC_DIR, { recursive: true }); fs.writeFileSync(REDIRECTS_FILE, redirectsContent.trim() + '\n', 'utf8');  // 3. Extract all full URLs for urls.txt and Sitemap generation const urlsSet = new Set(); urlsSet.add(`${DOMAIN}/`);

for (const [p] of redirectMap.entries()) {
  urlsSet.add(`${DOMAIN}${p}`);
}

const finalUrls = Array.from(urlsSet);

// Save cumulative history to urls.txt permanently
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

// 4. Generate Google News & Standard XML Sitemap containing all preserved redirect slugs
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
  xml += `    <loc>${escapeXml(urlObj.href)}</loc>\n`; xml += `    <lastmod>${lastmod}</lastmod>\n`;
  xml += '    <changefreq>hourly</changefreq>\n';
  xml += '    <priority>0.9</priority>\n';
  xml += '    <news:news>\n';
  xml += '      <news:publication>\n';
  xml += '        <news:name>News PageAura</news:name>\n';
  xml += '        <news:language>en</news:language>\n';
  xml += '      </news:publication>\n';
  xml += `      <news:publication_date>${lastmod}</news:publication_date>\n`; xml += `      <news:title>${escapeXml(newsTitle)}</news:title>\n`;
  xml += '    </news:news>\n';
  xml += '  </url>\n';
}

xml += '</urlset>\n';

fs.writeFileSync(SITEMAP_FILE, xml, 'utf8');

// Sync IndexNow key file
fs.writeFileSync(path.join(PUBLIC_DIR, KEY_FILENAME), KEY, 'utf8');

console.log(`Successfully generated redirect rules. Total preserved redirects: ${redirectMap.size}`);
console.log(`Sitemap generated with ${finalUrls.length} URLs.`);
