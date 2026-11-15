const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DOMAIN = 'https://news.pageaura.xyz';
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DEST_FILE = path.join(ROOT, 'destination.txt');
const URLS_FILE = path.join(ROOT, 'urls.txt');

// Helper: Generate random 7-character alphanumeric string
function generateSlug(length = 7) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Helper: XML Escape
function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function run() {
  console.log('--- Starting News-PageAura Page & Sitemap Generation ---');

  // 1. Read destination URLs from destination.txt
  if (!fs.existsSync(DEST_FILE)) {
    console.error('ERROR: destination.txt not found!');
    process.exit(1);
  }

  const destinations = fs.readFileSync(DEST_FILE, 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (destinations.length === 0) {
    console.error('ERROR: destination.txt is empty!');
    process.exit(1);
  }

  // Pick a random destination URL from the pool
  const targetUrl = destinations[Math.floor(Math.random() * destinations.length)];

  // 2. Get current UTC or local date-time hierarchy
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hour = String(now.getUTCHours()).padStart(2, '0');

  const slug = generateSlug(7);
  const title = `Breaking News Update ${year}-${month}-${day} ${slug}`;

  // Relative path & full URL
  const relPath = `${year}/${month}/${day}/${hour}/${slug}`;
  const fullPageUrl = `${DOMAIN}/${relPath}/`;
  const targetFolder = path.join(PUBLIC_DIR, year, month, day, hour, slug);

  // Create hierarchical folder
  fs.mkdirSync(targetFolder, { recursive: true });

  // 3. Generate SEO-friendly index.html with JS redirect & fallback link
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="index, follow">
    <title>${escapeXml(title)}</title>
    <link rel="canonical" href="${fullPageUrl}">
    <script>
        setTimeout(function() {
            window.location.replace("${targetUrl}");
        }, 2500);
    </script>
</head>
<body>
    <h1>${escapeXml(title)}</h1>
    <p>Redirecting to breaking news source...</p>
    <p>If you are not redirected automatically, please click <a href="${targetUrl}" rel="nofollow">here</a>.</p>
</body>
</html>`;

  fs.writeFileSync(path.join(targetFolder, 'index.html'), htmlContent, 'utf8');
  console.log(`Generated page at: ${relPath}`);

  // Save generated URL to urls.txt history
  let existingUrls = [];
  if (fs.existsSync(URLS_FILE)) {
    existingUrls = fs.readFileSync(URLS_FILE, 'utf8').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  }
  if (!existingUrls.includes(fullPageUrl)) {
    existingUrls.push(fullPageUrl);
    fs.writeFileSync(URLS_FILE, existingUrls.join('\n') + '\n', 'utf8');
  }

  // 4. Hierarchical Sitemap Generation (Master -> Year -> Month -> Day -> Hour)
  const sitemapsDir = path.join(PUBLIC_DIR, 'sitemaps');
  fs.mkdirSync(sitemapsDir, { recursive: true });

  // Read all generated pages from urls.txt to organize in hierarchical sitemaps
  // Grouping URLs by Year/Month/Day/Hour
  const hierarchy = {}; // { year: { month: { day: { hour: [ {url, title, date} ] } } } }

  // For this run, we can also scan existing htmls or build from urls.txt
  // Let's parse all URLs in urls.txt
  for (const urlStr of existingUrls) {
    try {
      const u = new URL(urlStr);
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length >= 4) {
        const [y, m, d, h, s] = parts;
        if (!hierarchy[y]) hierarchy[y] = {};
        if (!hierarchy[y][m]) hierarchy[y][m] = {};
        if (!hierarchy[y][m][d]) hierarchy[y][m][d] = {};
        if (!hierarchy[y][m][d][h]) hierarchy[y][m][d][h] = [];
        
        hierarchy[y][m][d][h].push({
          url: urlStr,
          title: `News Update ${s}`,
          lastmod: now.toISOString()
        });
      }
    } catch (e) {
      // skip invalid
    }
  }

  const lastmod = now.toISOString();

  // Generate Hour, Day, Month, Year Sitemaps
  const yearFiles = [];

  for (const y of Object.keys(hierarchy)) {
    const monthFiles = [];
    for (const m of Object.keys(hierarchy[y])) {
      const dayFiles = [];
      for (const d of Object.keys(hierarchy[y][m])) {
        const hourFiles = [];
        for (const h of Object.keys(hierarchy[y][m][d])) {
          // Hour Sitemap (Contains actual URLs with <news:news>)
          let hourXml = '<?xml version="1.0" encoding="UTF-8"?>\n';
          hourXml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n';
          
          for (const item of hierarchy[y][m][d][h]) {
            hourXml += `  <url>\n`;
            hourXml += `    <loc>${escapeXml(item.url)}</loc>\n`;
            hourXml += `    <lastmod>${item.lastmod}</lastmod>\n`;
            hourXml += `    <changefreq>hourly</changefreq>\n`;
            hourXml += `    <priority>0.9</priority>\n`;
            hourXml += `    <news:news>\n`;
            hourXml += `      <news:publication>\n`;
            hourXml += `        <news:name>News PageAura</news:name>\n`;
            hourXml += `        <news:language>en</news:language>\n`;
            hourXml += `      </news:publication>\n`;
            hourXml += `      <news:publication_date>${item.lastmod}</news:publication_date>\n`;
            hourXml += `      <news:title>${escapeXml(item.title)}</news:title>\n`;
            hourXml += `    </news:news>\n`;
            hourXml += `  </url>\n`;
          }
          hourXml += '</urlset>\n';

          const hourFilename = `sitemap-${y}-${m}-${d}-${h}.xml`;
          fs.writeFileSync(path.join(sitemapsDir, hourFilename), hourXml, 'utf8');
          hourFiles.push(`${DOMAIN}/sitemaps/${hourFilename}`);
        }

        // Day Sitemap Index linking to Hour sitemaps
        let dayXml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        dayXml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
        for (const hUrl of hourFiles) {
          dayXml += `  <sitemap><loc>${hUrl}</loc><lastmod>${lastmod}</lastmod></sitemap>\n`;
        }
        dayXml += '</sitemapindex>\n';

        const dayFilename = `sitemap-${y}-${m}-${d}.xml`;
        fs.writeFileSync(path.join(sitemapsDir, dayFilename), dayXml, 'utf8');
        dayFiles.push(`${DOMAIN}/sitemaps/${dayFilename}`);
      }

      // Month Sitemap Index
      let monthXml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      monthXml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
      for (const dUrl of dayFiles) {
        monthXml += `  <sitemap><loc>${dUrl}</loc><lastmod>${lastmod}</lastmod></sitemap>\n`;
      }
      monthXml += '</sitemapindex>\n';

      const monthFilename = `sitemap-${y}-${m}.xml`;
      fs.writeFileSync(path.join(sitemapsDir, monthFilename), monthXml, 'utf8');
      monthFiles.push(`${DOMAIN}/sitemaps/${monthFilename}`);
    }

    // Year Sitemap Index
    let yearXml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    yearXml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    for (const mUrl of monthFiles) {
      yearXml += `  <sitemap><loc>${mUrl}</loc><lastmod>${lastmod}</lastmod></sitemap>\n`;
    }
    yearXml += '</sitemapindex>\n';

    const yearFilename = `sitemap-${y}.xml`;
    fs.writeFileSync(path.join(sitemapsDir, yearFilename), yearXml, 'utf8');
    yearFiles.push(`${DOMAIN}/sitemaps/${yearFilename}`);
  }

  // Master Sitemap Index (`public/sitemap.xml`) linking to Year sitemaps
  let masterXml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  masterXml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  for (const yUrl of yearFiles) {
    masterXml += `  <sitemap><loc>${yUrl}</loc><lastmod>${lastmod}</lastmod></sitemap>\n`;
  }
  masterXml += '</sitemapindex>\n';

  fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap.xml'), masterXml, 'utf8');
  console.log('Hierarchical sitemaps generated successfully.');

  // 5. Automatic Git Commit and Push
  try {
    console.log('Committing changes to GitHub...');
    execSync('git config --global user.name "github-actions[bot]"');
    execSync('git config --global user.email "github-actions[bot]@users.noreply.github.com"');
    execSync('git add public/ urls.txt destination.txt');
    
    // Check if there are changes to commit
    const status = execSync('git status --porcelain').toString();
    if (status.trim().length > 0) {
      execSync('git commit -m "chore: auto-generate hierarchical pages and sitemaps [skip ci]"');
      execSync('git push');
      console.log('Successfully pushed changes to GitHub repo sparkflare95/News-PageAura.');
    } else {
      console.log('No new changes to commit.');
    }
  } catch (error) {
    console.error('Git operation failed:', error.message);
  }
}

run();
