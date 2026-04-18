/**
 * MapleDevs — Job Digest Generator
 * 
 * This script compares the current scraping results with a previous snapshot
 * to identify "New Jobs" and generates a formatted digest (HTML/Markdown)
 * for the weekly newsletter.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const SHEET_ID = '2PACX-1vSkt2ROoihRVsL4f0m4dXZ1IzD7KYzEghgOwW7QPC2EN6sE4D_iI3stfllfdeq61coOrhdi47eeLmoY';
const SNAPSHOT_PATH = path.join(__dirname, 'tracked_jobs.json');

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
            featured: cl(c[8]||"").toLowerCase() === "yes",
            apply: cl(c[6]||"")
        });
    }
    return jobs;
}

async function run() {
    console.log('📬 Generating Job Digest...');
    
    // 1. Fetch current live jobs
    const csvData = await fetchCSV(`https://docs.google.com/spreadsheets/d/e/${SHEET_ID}/pub?output=csv`);
    const currentJobs = parseCSV(csvData);
    
    // 2. Load previous snapshot
    let prevJobs = [];
    if (fs.existsSync(SNAPSHOT_PATH)) {
        prevJobs = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
    }
    
    // 3. Find New Jobs
    const prevKeys = new Set(prevJobs.map(j => `${j.title}|${j.studio}`.toLowerCase()));
    const newJobs = currentJobs.filter(j => !prevKeys.has(`${j.title}|${j.studio}`.toLowerCase()));
    
    if (newJobs.length === 0) {
        console.log('✨ No new jobs since last digest. Skipping.');
        return;
    }
    
    console.log(`🔥 Found ${newJobs.length} new roles!`);
    
    // 4. Generate Digest content
    let digestMD = `# 🍁 MapleDevs Weekly Digest\n\nWe found ${newJobs.length} fresh roles at Canadian game studios this week!\n\n`;
    
    newJobs.forEach(j => {
        digestMD += `### ${j.title} at ${j.studio}\n`;
        digestMD += `📍 ${j.location}\n`;
        digestMD += `🔗 [View Details & Apply](https://mapledevs.ca/#q=${encodeURIComponent(j.title)})\n\n`;
    });
    
    digestMD += `---\n*Stop settling for US-only noise. Find your next role in Canada at MapleDevs.ca*`;
    
    // 5. Save digest and update snapshot
    fs.writeFileSync(path.join(__dirname, 'latest_digest.md'), digestMD);
    fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(currentJobs, null, 2));
    
    console.log('✅ Digest generated at scripts/latest_digest.md');
    console.log('🚀 Ready to be sent to your subscribers!');
}

run().catch(console.error);
