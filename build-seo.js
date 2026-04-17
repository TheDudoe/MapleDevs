const fs = require('fs');
const path = require('path');

const https = require('https');
const slugify = require('slugify');

const ROOT_DIR = path.join(__dirname, '..');
const INDEX_PATH = path.join(ROOT_DIR, 'index.html');
const SHEET_ID = '2PACX-1vSkt2ROoihRVsL4f0m4dXZ1IzD7KYzEghgOwW7QPC2EN6sE4D_iI3stfllfdeq61coOrhdi47eeLmoY';

if (!fs.existsSync(INDEX_PATH)) {
    console.error('index.html not found!');
    process.exit(1);
}

const baseHTML_raw = fs.readFileSync(INDEX_PATH, 'utf8');

// NUCLEAR CLEANUP: Remove any rogue JSON text from top of file
let baseHTML = baseHTML_raw.trim();
if (baseHTML.startsWith('{')) {
    const docTypeIdx = baseHTML.toLowerCase().indexOf('<!doctype');
    if (docTypeIdx !== -1) baseHTML = baseHTML.substring(docTypeIdx);
}

const SEO_TARGETS = [
    // --- L1: PRIMARY CITIES ---
    { folder: 'vancouver', hash: '#city=Vancouver', title: 'Vancouver Game Studio Jobs | Verified & Canadian - MapleDevs', desc: 'Find verified game dev jobs at studios located in Vancouver, BC. No US roles. Salaries, entry-level, and remote roles included.' },
    { folder: 'toronto', hash: '#city=Toronto', title: 'Toronto Game Dev Jobs | Verified & Canadian - MapleDevs', desc: 'Find verified game dev jobs at studios located in Toronto, ON. No US roles.' },
    { folder: 'montreal', hash: '#city=Montreal', title: 'Montreal Game Studio Jobs | Verified & Canadian - MapleDevs', desc: 'Find verified game dev jobs at studios located in Montreal, QC. Best opportunities in Canada.' },
    
    // --- L2: REGIONAL HUBS ---
    { folder: 'ottawa', hash: '#city=Ottawa', title: 'Ottawa Game Dev Jobs | Canada - MapleDevs', desc: 'Find verified game dev jobs at studios located in Ottawa, ON.' },
    { folder: 'quebec-city', hash: '#city=Quebec+City', title: 'Quebec City Game Studio Jobs | Canada - MapleDevs', desc: 'Find verified game dev jobs at studios located in Quebec City, QC.' },
    { folder: 'edmonton', hash: '#city=Edmonton', title: 'Edmonton Game Studio Jobs | Canada - MapleDevs', desc: 'Find verified game dev jobs at studios located in Edmonton, AB.' },
    { folder: 'calgary', hash: '#city=Calgary', title: 'Calgary Game Dev Jobs | Canada - MapleDevs', desc: 'Find verified game dev jobs at studios located in Calgary, AB.' },
    { folder: 'victoria', hash: '#city=Victoria', title: 'Victoria Game Dev Jobs | BC Canada - MapleDevs', desc: 'Find verified game dev jobs at studios located in Victoria, BC.' },
    { folder: 'london', hash: '#city=London', title: 'London Ontario Game Dev Jobs | Canada - MapleDevs', desc: 'Find verified game dev jobs at studios located in London, ON.' },
    { folder: 'halifax', hash: '#city=Halifax', title: 'Halifax Game Dev Jobs | Nova Scotia - MapleDevs', desc: 'Find verified game dev jobs at studios located in Halifax, NS.' },
    { folder: 'kitchener', hash: '#city=Kitchener', title: 'Kitchener Waterloo Game Jobs | Ontario - MapleDevs', desc: 'Find verified game dev jobs at studios located in Kitchener-Waterloo, ON.' },
    { folder: 'burnaby', hash: '#city=Burnaby', title: 'Burnaby BC Game Studio Jobs | Canada - MapleDevs', desc: 'Find verified game dev jobs at studios located in Burnaby, BC.' },

    // --- L3: SPECIALIZED ROLES ---
    { folder: 'programming', hash: '#role=programming', title: 'Game Programming & Engineering Jobs Canada - MapleDevs', desc: 'Find C++, Unity, Unreal, and general programming jobs at Canadian game studios.' },
    { folder: 'art', hash: '#role=art', title: 'Game Art & Animation Jobs Canada - MapleDevs', desc: 'Discover 2D, 3D, UI, and VFX artist jobs at verified game studios operating across Canada.' },
    { folder: 'design', hash: '#role=design', title: 'Game Design & Level Design Jobs Canada - MapleDevs', desc: 'Find game design, level design, and narrative design jobs at Canadian studios.' },
    { folder: 'producer', hash: '#role=production', title: 'Game Producer & Production Jobs Canada - MapleDevs', desc: 'Find game producer, project manager, and production jobs at Canadian studios.' },
    { folder: 'qa', hash: '#role=qa', title: 'Game QA & Testing Jobs Canada - MapleDevs', desc: 'Find quality assurance, game testing, and QA lead jobs at Canadian studios.' },
    { folder: 'audio', hash: '#role=audio', title: 'Game Audio & Sound Design Jobs Canada - MapleDevs', desc: 'Find sound design, music, and audio engineering jobs at Canadian game studios.' },
    { folder: 'ui-ux', hash: '#role=design', title: 'Game UI & UX Design Jobs Canada - MapleDevs', desc: 'Find UI/UX design and user research jobs at Canadian game studios.' },

    // --- L4: CATEGORIES ---
    { folder: 'junior', hash: '#exp=junior', title: 'Junior & Entry-Level Game Dev Jobs Canada - MapleDevs', desc: 'Break into the Canadian games industry. Browse verified entry-level and junior roles.' },
    { folder: 'remote', hash: '#mode=Remote', title: 'Remote Game Dev Jobs Canada | Work From Home - MapleDevs', desc: 'Find 100% remote game developer jobs at studios operating in Canada.' },
    { folder: 'internship', hash: '#type=Internship', title: 'Game Development Internships Canada | Student Jobs - MapleDevs', desc: 'Find game dev internships, co-ops, and student roles at Canadian game studios.' }
];

// Helper to safely replace tag content
function safeReplaceMeta(html, propertyOrName, newValue, isProperty = true) {
    const attr = isProperty ? 'property' : 'name';
    const regex = new RegExp(`<meta [^>]*${attr}="${propertyOrName}"[^>]*content="[^"]*"[^>]*>`, 'i');
    return html.replace(regex, `<meta ${attr}="${propertyOrName}" content="${newValue}">`);
}

function injectSEO(html, target) {
    let output = html;

    // 1. Remove ANY naked JSON that might be lurking in the head (Final Safeguard)
    output = output.replace(/^[^{]*\{[^{}]*"@context":[^{}]*\}/s, '');

    // 2. Safe Title Replace
    output = output.replace(/<title>.*?<\/title>/i, `<title>${target.title}</title>`);
    
    // 3. Robust Meta Replacements
    output = safeReplaceMeta(output, 'description', target.desc, false);
    output = safeReplaceMeta(output, 'og:title', target.title, true);
    output = safeReplaceMeta(output, 'og:description', target.desc, true);
    output = safeReplaceMeta(output, 'og:url', `https://mapledevs.ca/${target.folder}/`, true);

    // 4. Update Canonical
    output = output.replace(/<link rel="canonical" href="[^"]*"/i, `<link rel="canonical" href="https://mapledevs.ca/${target.folder}/"`);

    // 5. Add immediate hash redirect
    const redirectScript = `\n    <script>if(!window.location.hash) window.location.hash = '${target.hash}';</script>\n`;
    output = output.replace('<head>', '<head>' + redirectScript);
    
    return output;
}

async function fetchCSV(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return resolve(fetchCSV(res.headers.location));
            }
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', (err) => reject(err));
    });
}

function parseCSV(t) {
    const ls = t.trim().split("\n");
    const jobs = [];
    const csvLine = (l) => {
        const r=[]; let c="", q=false;
        for(let i=0; i<l.length; i++){
            const ch=l[i]; if(ch==='"') q=!q; else if(ch===',' && !q) { r.push(c); c=""; } else c+=ch;
        }
        r.push(c); return r;
    };
    const cl = (s) => s.replace(/^"|"$/g,"").trim();
    for(let i=1; i<ls.length; i++){
        const c = csvLine(ls[i]);
        if(!c[0] || !c[1]) continue;
        jobs.push({ 
            title: cl(c[0]), 
            studio: cl(c[1]), 
            location: cl(c[2]||""), 
            desc: cl(c[5]||""),
            featured: cl(c[8]||"").toLowerCase() === "yes"
        });
    }
    return jobs;
}

async function build() {
    console.log('🚀 Starting Massive SEO Build...');
    
    // 1. Fetch live jobs for individual pages
    const csvData = await fetchCSV(`https://docs.google.com/spreadsheets/d/e/${SHEET_ID}/pub?output=csv`);
    const jobs = parseCSV(csvData);

    let sitemapXML = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Heartbeat: ${new Date().toISOString()} -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://mapledevs.ca/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`;

    // 2. Generate Category Pages
    console.log(`📂 Generating ${SEO_TARGETS.length} Category Hubs...`);
    for (const target of SEO_TARGETS) {
        const targetDir = path.join(ROOT_DIR, target.folder);
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir);
        const html = injectSEO(baseHTML, target);
        fs.writeFileSync(path.join(targetDir, 'index.html'), html);
        sitemapXML += `\n  <url><loc>https://mapledevs.ca/${target.folder}/</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`;
    }

    // 3. Generate Individual Job Pages (The Traffic Rocket)
    console.log(`🎯 Generating ${jobs.length} Individual Job Pages...`);
    const jobsDir = path.join(ROOT_DIR, 'jobs');
    if (!fs.existsSync(jobsDir)) fs.mkdirSync(jobsDir);

    for (const job of jobs) {
        const slug = slugify(`${job.title}-${job.studio}-${job.location}`, { lower: true, strict: true });
        const jobPath = path.join(jobsDir, slug);
        if (!fs.existsSync(jobPath)) fs.mkdirSync(jobPath);

        const target = {
            folder: `jobs/${slug}`,
            hash: `#id=${slug}`, // We'll update the frontend to handle #id= slugs too
            title: `${job.title} at ${job.studio} | Canadian Game Jobs - MapleDevs`,
            desc: `Apply for ${job.title} at ${job.studio} in ${job.location}. Verified Canadian game industry opportunity.`
        };

        const html = injectSEO(baseHTML, target);
        fs.writeFileSync(path.join(jobPath, 'index.html'), html);
        sitemapXML += `\n  <url><loc>https://mapledevs.ca/jobs/${slug}/</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>`;
    }

    sitemapXML += `\n</urlset>`;
    fs.writeFileSync(path.join(ROOT_DIR, 'sitemap.xml'), sitemapXML);
    console.log('✅ Sitemap updated with all URLs.');
    console.log('Done!');
}

build().catch(console.error);
