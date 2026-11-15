const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DOMAIN = 'https://news.pageaura.xyz';
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DEST_FILE = path.join(ROOT, 'destination.txt');
const GLOBAL_URLS_FILE = path.join(ROOT, 'urls.txt');

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
  console.log('--- Starting Batch Page & Sitemap Generation for ALL destination URLs ---');

  // 1. Read all destination URLs from destination.txt
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

  // 2. Get current UTC date-time hierarchy
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hour = String(now.getUTCHours()).padStart(2, '0');

  const generatedUrlsThisRun = [];

  // 3. Loop through EACH destination URL and create its hierarchical HTML page
  for (const targetUrl of destinations) {
    const slug = generateSlug(7);
    const title = `Breaking News Update ${year}-${month}-${day} ${slug}`;

    const relPath = `${year}/${month}/${day}/${hour}/${slug}`;
    const fullPageUrl = `${DOMAIN}/${relPath}/`;
    const targetFolder = path.join(PUBLIC_DIR, year, month, day, hour, slug);

    // Create hierarchical folder
    fs.mkdirSync(targetFolder, { recursive: true });

    // Generate SEO-friendly index.html
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
    generatedUrlsThisRun.push(fullPageUrl);
  }

  console.log(`Successfully generated ${generatedUrlsThisRun.length} pages for this hour.`);

  // 4. Save to global root urls.txt history
  let globalUrls = [];
  if (fs.existsSync(GLOBAL_URLS_FILE)) {
    globalUrls = fs.readFileSync(GLOBAL_URLS_FILE, 'utf8').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  }
  
  for (const u of generatedUrlsThisRun) {
    if (!globalUrls.includes(u)) {
      globalUrls.push(u);
    }
  }
  fs.writeFileSync(GLOBAL_URLS_FILE, globalUrls.join('\n') + '\n', 'utf8');

  // 5. Save Hour-wise urls.txt inside hierarchical public folder (e.g., public/2026/11/15/23/urls.txt)
  const hourFolderDir = path.join(PUBLIC_DIR, year, month, day, hour);
  fs.mkdirSync(hourFolderDir, { recursive: true });
  
  // Read existing hourly urls if any, and append new ones
  const hourlyUrlsFilePath = path.join(hourFolderDir, 'urls.txt');
  let hourlyUrls = [];
  if (fs.existsSync(hourlyUrlsFilePath)) {
    hourlyUrls = fs.readFileSync(hourlyUrlsFilePath, 'utf8').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  }
  for (const u of generatedUrlsThisRun) {
    if (!hourlyUrls.includes(u)) {
      hourlyUrls.push(u);
    }
  }
  fs.writeFileSync(hourlyUrlsFilePath, hourlyUrls.join('\n') + '\n', 'utf8');
  console.log(`Saved hourly URLs list at: public/${year}/${month}/${day}/${hour}/urls.txt`);

  // 6. Hierarchical Sitemap Generation (Master -> Year -> Month -> Day -> Hour Sitemaps)
  const sitemapsDir = path.join(PUBLIC_DIR, 'sitemaps');
  fs.mkdirSync(sitemapsDir, { recursive: true });

  const hierarchy = {};
  for (const urlStr of globalUrls) {
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
      // skip
    }
  }

  const lastmod = now.toISOString();
  const yearFiles = [];

  for (const y of Object.keys(hierarchy)) {
    const monthFiles = [];
    for (const m of Object.keys(hierarchy[y])) {
      const dayFiles = [];
      for (const d of Object.keys(hierarchy[y][m])) {
        const hourFiles = [];
        for (const h of Object.keys(hierarchy[y][m][d])) {
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

  let masterXml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  masterXml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  for (const yUrl of yearFiles) {
    masterXml += `  <sitemap><loc>${yUrl}</loc><lastmod>${lastmod}</lastmod></sitemap>\n`;
  }
  masterXml += '</sitemapindex>\n';

  fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap.xml'), masterXml, 'utf8');
  console.log('Hierarchical sitemaps generated successfully.');

  // 7. Automatic Git Commit and Push
  try {
    console.log('Committing changes to GitHub...');
    execSync('git config --global user.name "github-actions[bot]"');
    execSync('git config --global user.email "github-actions[bot]@users.noreply.github.com"');
    execSync('git add public/ urls.txt destination.txt');
    
    const status = execSync('git status --porcelain').toString();
    if (status.trim().length > 0) {
      execSync('git commit -m "chore: batch generate pages, hourly urls lists and sitemaps [skip ci]"');
      execSync('git push');
      console.log('Successfully pushed changes to GitHub.');
    } else {
      console.log('No new changes to commit.');
    }
  } catch (error) {
    console.error('Git operation failed:', error.message);
  }
}

run();
