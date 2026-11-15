const fs = require('fs');
const path = require('path');

const DOMAIN = 'https://news-pageaura.pages.dev';
const KEY = 'dd5dc9a82ae9487e912c9d3c7cbf4c71';
const KEY_FILENAME = `${KEY}.txt`;

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const URLS_FILE = path.join(ROOT, 'urls.txt');
const REDIRECTS_FILE = path.join(PUBLIC_DIR, '_redirects');
const SITEMAP_FILE = path.join(PUBLIC_DIR, 'sitemap.xml');
const ROOT_KEY_FILE = path.join(ROOT, KEY_FILENAME);

if (!fs.existsSync(REDIRECTS_FILE)) {
  throw new Error('public/_redirects is missing. Deployment stopped.');
}

const redirectRules = fs.readFileSync(REDIRECTS_FILE, 'utf8')
  .split(/\r?\n/)
  .filter(line => line.trim() && !line.trim().startsWith('#'));

if (redirectRules.length > 2000) {
  throw new Error(`Redirect validation failed: ${redirectRules.length} rules.`);
}

// Load existing accumulated URLs from urls.txt if present (cumulative history)
let existingUrls = [];
if (fs.existsSync(URLS_FILE)) {
  existingUrls = fs.readFileSync(URLS_FILE, 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

const urlsSet = new Set(existingUrls);
urlsSet.add(`${DOMAIN}/`);

const finalUrls = Array.from(urlsSet);

// Save back cumulative unique URLs so they persist permanently
fs.writeFileSync(URLS_FILE, finalUrls.join('\n') + '\n', 'utf8');

if (finalUrls.length === 0) {
  throw new Error('No valid URLs found for sitemap.');
}

const lastmod = new Date().toISOString();

function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

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

  if (urlObj.hostname.toLowerCase() !== 'news-pageaura.pages.dev') {
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

fs.mkdirSync(PUBLIC_DIR, { recursive: true });
fs.writeFileSync(SITEMAP_FILE, xml, 'utf8');

// Ensure root key file content is automatically synced to public output directory
fs.writeFileSync(path.join(PUBLIC_DIR, KEY_FILENAME), KEY, 'utf8');

console.log(`Google News Sitemap Generated. Total cumulative URLs: ${finalUrls.length}`);
console.log(`changefreq: hourly`);
console.log(`lastmod: ${lastmod}`);
