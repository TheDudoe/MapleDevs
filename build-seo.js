const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const INDEX_PATH = path.join(ROOT_DIR, 'index.html');

if (!fs.existsSync(INDEX_PATH)) {
    console.error('index.html not found!');
    process.exit(1);
}

const baseHTML_raw = fs.readFileSync(INDEX_PATH, 'utf8');

// NUCLEAR CLEANUP: Remove any rogue JSON text that might have leaked to the top of index.html
let baseHTML = baseHTML_raw.trim();
if (baseHTML.startsWith('{')) {
    console.log('⚠️ Detected rogue JSON at top of index.html. Scrubbing...');
    const docTypeIdx = baseHTML.toLowerCase().indexOf('<!doctype');
    if (docTypeIdx !== -1) {
        baseHTML = baseHTML.substring(docTypeIdx);
    }
}

const SEO_TARGETS = [
    {
        folder: 'vancouver',
        hash: '#city=Vancouver',
        title: 'Vancouver Game Studio Jobs | Verified & Canadian - MapleDevs',
        desc: 'Find verified game dev jobs at studios located in Vancouver, BC. No US roles. Salaries, entry-level, and remote roles included.',
    },
    {
        folder: 'toronto',
        hash: '#city=Toronto',
        title: 'Toronto Game Dev Jobs | Verified & Canadian - MapleDevs',
        desc: 'Find verified game dev jobs at studios located in Toronto, ON. No US roles. Salaries, entry-level, and remote roles included.',
    },
    {
        folder: 'montreal',
        hash: '#city=Montreal',
        title: 'Montreal Game Studio Jobs | Verified & Canadian - MapleDevs',
        desc: 'Find verified game dev jobs at studios located in Montreal, QC. Browse the best opportunities in the Canadian game industry.',
    },
    {
        folder: 'junior',
        hash: '#exp=junior',
        title: 'Junior & Entry-Level Game Dev Jobs Canada - MapleDevs',
        desc: 'Break into the Canadian games industry. Browse verified entry-level, junior, co-op, and internship roles for game developers.',
    },
    {
        folder: 'programming',
        hash: '#role=programming',
        title: 'Game Programming & Engineering Jobs Canada - MapleDevs',
        desc: 'Find C++, Unity, Unreal, and general programming jobs at Canadian game studios. 100% verified Canadian listings.',
    },
    {
        folder: 'art',
        hash: '#role=art',
        title: 'Game Art & Animation Jobs Canada - MapleDevs',
        desc: 'Discover 2D, 3D, UI, and VFX artist jobs at verified game studios operating across Canada.',
    }
];

// Helper to inject SEO tags
function injectSEO(html, target) {
    let output = html;

    // Replace Title
    output = output.replace(/<title>.*?<\/title>/i, `<title>${target.title}</title>`);
    
    // Sniper-Precise Meta Replacements (Prevents "eating" subsequent lines)
    output = output.replace(/<meta name="description" content="[^"]*"\s*\/?>/i, `<meta name="description" content="${target.desc}">`);
    output = output.replace(/<meta property="og:title" content="[^"]*"\s*\/?>/i, `<meta property="og:title" content="${target.title}">`);
    output = output.replace(/<meta property="og:description" content="[^"]*"\s*\/?>/i, `<meta property="og:description" content="${target.desc}">`);
    output = output.replace(/<meta property="og:url" content="[^"]*"\s*\/?>/i, `<meta property="og:url" content="https://mapledevs.ca/${target.folder}/">`);

    // Add immediate hash redirect script at the top of <head>
    const redirectScript = `
    <script>
      if(window.location.hash === '') {
          window.location.hash = '${target.hash}';
      }
    </script>
    `;
    output = output.replace('<head>', '<head>\n' + redirectScript);
    return output;
}

console.log('Generating SEO Landing Pages...');

let sitemapXML = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Heartbeat: ${new Date().toISOString()} -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://mapledevs.ca/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`;

for (const target of SEO_TARGETS) {
    const targetDir = path.join(ROOT_DIR, target.folder);
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir);
    }

    const modifiedHTML = injectSEO(baseHTML, target);
    fs.writeFileSync(path.join(targetDir, 'index.html'), modifiedHTML);
    
    sitemapXML += `
  <url>
    <loc>https://mapledevs.ca/${target.folder}/</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;

    console.log(`✅ Generated /${target.folder}/index.html`);
}

sitemapXML += `\n</urlset>`;
fs.writeFileSync(path.join(ROOT_DIR, 'sitemap.xml'), sitemapXML);
console.log('✅ Generated sitemap.xml');

console.log('Done!');
