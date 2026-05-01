/**
 * MapleDevs — Automated Job Scraper
 * 
 * This script scrapes Canadian game studio career pages using free, public APIs
 * (Greenhouse Job Board API, Lever Postings API) and updates your Google Sheet.
 * 
 * Supported ATS platforms:
 * - Greenhouse (boards-api.greenhouse.io) — No auth needed
 * - Lever (api.lever.co) — No auth needed
 * 
 * HOW TO ADD A NEW STUDIO:
 * 1. Find their careers page URL
 * 2. Check if it's powered by Greenhouse or Lever:
 *    - Greenhouse: URL contains "boards.greenhouse.io/{token}" or "job-boards.greenhouse.io/{token}"
 *    - Lever: URL contains "jobs.lever.co/{token}"
 * 3. Add an entry to the STUDIOS array below with the token and platform
 * 
 * SETUP REQUIRED:
 * 1. Create a Google Cloud service account (see README.md)
 * 2. Share your Google Sheet with the service account email
 * 3. Set environment variables (see below)
 * 
 * ENV VARS:
 * - GOOGLE_SHEET_ID: Your Google Sheet ID (from the URL)
 * - GOOGLE_SERVICE_ACCOUNT_EMAIL: Service account email
 * - GOOGLE_PRIVATE_KEY: Service account private key (base64 encoded)
 */

const https = require('https');

// ═══════════════════════════════════════════════
// STUDIO CONFIGURATION
// Add your Canadian game studios here!
// ═══════════════════════════════════════════════
const STUDIOS = [
  // ─── Greenhouse Studios ───
  // To find tokens: visit the studio's careers page and look for
  // "boards.greenhouse.io/{TOKEN}" or "job-boards.greenhouse.io/{TOKEN}" in the URL
  {
    name: "Digital Extremes",
    platform: "greenhouse",
    token: "digitalextremes",
    city: "London, Ontario",
    // Filter to only Canadian jobs (some studios post worldwide)
    locationFilter: null, // null = include all (they're Canada-only)
  },
  {
    name: "Behaviour Interactive",
    platform: "greenhouse",
    token: "behaviourinteractive",
    city: "Montreal, Quebec",
    locationFilter: "Canada"
  },
  {
    name: "Klei Entertainment",
    platform: "greenhouse",
    token: "klei",
    city: "Vancouver, BC",
    locationFilter: "Canada"
  },
  {
    name: "Thunder Lotus Games",
    platform: "greenhouse",
    token: "thunderlotus",
    city: "Montreal, Quebec",
    locationFilter: "Canada"
  },
  {
    name: "Torn Banner Studios",
    platform: "greenhouse",
    token: "tornbanner",
    city: "Toronto, Ontario",
    locationFilter: "Canada"
  },
  {
    name: "Big Blue Bubble",
    platform: "greenhouse",
    token: "bigbluebubble",
    city: "London, Ontario",
    locationFilter: "Canada"
  },
  // ─── EXAMPLE: How to add more Greenhouse studios ───
  // {
  //   name: "Studio Name",
  //   platform: "greenhouse",
  //   token: "studiotoken",        // from their careers URL
  //   city: "Vancouver, BC",       // default city if job doesn't specify
  //   locationFilter: "canada",    // only include jobs with "canada" in location
  // },

  // ─── Lever Studios ───
  // To find tokens: visit the studio's careers page and look for
  // "jobs.lever.co/{TOKEN}" in the URL
  // ─── EXAMPLE: How to add Lever studios ───
  // {
  //   name: "Studio Name",
  //   platform: "lever",
  //   token: "studioname",
  //   city: "Montreal, QC",
  //   locationFilter: "canada",
  // },
];

// Canadian location keywords for filtering
const CANADA_KEYWORDS = [
  'canada', 'canadian', 'toronto', 'montreal', 'vancouver', 'ottawa',
  'calgary', 'edmonton', 'winnipeg', 'quebec', 'ontario', 'british columbia',
  'alberta', 'manitoba', 'saskatchewan', 'nova scotia', 'new brunswick',
  'london, on', 'kitchener', 'waterloo', 'halifax', 'victoria, bc',
  'bc', 'ab', 'on', 'qc', 'mb', 'sk', 'ns', 'nb', 'pe', 'nl',
];

// ═══════════════════════════════════════════════
// HTTP HELPERS
// ═══════════════════════════════════════════════
function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'MapleDevs-JobScraper/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error(`Invalid JSON from ${url}`)); }
        } else {
          reject(new Error(`HTTP ${res.statusCode} from ${url}`));
        }
      });
    }).on('error', reject);
  });
}

// ═══════════════════════════════════════════════
// GREENHOUSE SCRAPER
// ═══════════════════════════════════════════════
async function scrapeGreenhouse(studio) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${studio.token}/jobs?content=true`;
  console.log(`  📡 Fetching: ${url}`);

  try {
    const data = await httpGet(url);
    const jobs = data.jobs || [];
    console.log(`  ✅ Found ${jobs.length} jobs at ${studio.name}`);

    return jobs
      .filter(job => {
        if (!studio.locationFilter) return true;
        const loc = (job.location?.name || '').toLowerCase();
        return CANADA_KEYWORDS.some(kw => loc.includes(kw));
      })
      .map(job => ({
        title: job.title || '',
        studio: studio.name,
        location: job.location?.name || studio.city || '',
        type: guessJobType(job.title, job.content || ''),
        mode: guessWorkMode(job.title, job.location?.name || '', job.content || ''),
        description: summarizeText(stripHTML(job.content || '')),
        applyUrl: job.absolute_url || '',
        posted: job.first_published ? new Date(job.first_published).toISOString().split('T')[0] : '',
        featured: 'No',
        student: guessStudentFriendly(job.title, job.content || '') ? 'Yes' : 'No',
        salary: '',
        sourceId: `gh_${studio.token}_${job.id}`, // unique ID for dedup
      }));
  } catch (err) {
    console.error(`  ❌ Error scraping ${studio.name}: ${err.message}`);
    return [];
  }
}

// ═══════════════════════════════════════════════
// LEVER SCRAPER
// ═══════════════════════════════════════════════
async function scrapeLever(studio) {
  const url = `https://api.lever.co/v0/postings/${studio.token}?mode=json`;
  console.log(`  📡 Fetching: ${url}`);

  try {
    const jobs = await httpGet(url);
    console.log(`  ✅ Found ${jobs.length} jobs at ${studio.name}`);

    return jobs
      .filter(job => {
        if (!studio.locationFilter) return true;
        const loc = (job.categories?.location || '').toLowerCase();
        return CANADA_KEYWORDS.some(kw => loc.includes(kw));
      })
      .map(job => ({
        title: job.text || '',
        studio: studio.name,
        location: job.categories?.location || studio.city || '',
        type: job.categories?.commitment || guessJobType(job.text, job.descriptionPlain || ''),
        mode: guessWorkMode(job.text, job.categories?.location || '', job.descriptionPlain || ''),
        description: summarizeText(job.descriptionPlain || ''),
        applyUrl: job.hostedUrl || job.applyUrl || '',
        posted: job.createdAt ? new Date(job.createdAt).toISOString().split('T')[0] : '',
        featured: 'No',
        student: guessStudentFriendly(job.text, job.descriptionPlain || '') ? 'Yes' : 'No',
        salary: '',
        sourceId: `lv_${studio.token}_${job.id}`,
      }));
  } catch (err) {
    console.error(`  ❌ Error scraping ${studio.name}: ${err.message}`);
    return [];
  }
}

// ═══════════════════════════════════════════════
// SMART GUESSERS
// ═══════════════════════════════════════════════
function guessJobType(title, content) {
  const text = (title + ' ' + content).toLowerCase();
  if (text.includes('intern') || text.includes('co-op') || text.includes('coop')) return 'Internship';
  if (text.includes('contract') || text.includes('temporary') || text.includes('temp ')) return 'Contract';
  if (text.includes('part-time') || text.includes('part time')) return 'Part-time';
  return 'Full-time';
}

function guessWorkMode(title, location, content) {
  const text = (title + ' ' + location + ' ' + content).toLowerCase();
  if (text.includes('fully remote') || text.includes('100% remote') || text.includes('remote only')) return 'Remote';
  if (text.includes('hybrid') || text.includes('flexible')) return 'Hybrid';
  if (text.includes('remote')) return 'Remote';
  if (text.includes('on-site') || text.includes('onsite') || text.includes('in-office')) return 'On-site';
  return 'On-site'; // default assumption
}

function guessStudentFriendly(title, content) {
  const text = (title + ' ' + content).toLowerCase();
  return text.includes('intern') || text.includes('co-op') || text.includes('coop')
    || text.includes('junior') || text.includes('entry level') || text.includes('entry-level')
    || text.includes('new grad') || text.includes('graduate');
}

function stripHTML(html) {
  if (typeof html !== 'string') return '';
  return html
    // 1. Unescape generic HTML entities first so we can catch double-escaped ones
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // 2. Strip HTML tags
    .replace(/<[^>]*>/g, ' ')
    // 3. Remove non-breaking spaces (case insensitive) and other annoying entities
    .replace(/&nbsp;/ig, ' ')
    .replace(/&rsquo;/ig, "'")
    .replace(/&lsquo;/ig, "'")
    .replace(/&ldquo;/ig, '"')
    .replace(/&rdquo;/ig, '"')
    .replace(/&ndash;/ig, '-')
    .replace(/&mdash;/ig, '-')
    // 4. Cleanup excessive whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

function summarizeText(text) {
  if (!text) return '';
  
  // Remove annoying boilerplate headings from the front of the text
  let cleanText = text.replace(/^\s*(about this position|about the role|the role|position overview|job description|who we are|about us)[\s:*_-]+/ig, '').trim();
  
  // Try to cleanly extract the first 1-2 grammatical sentences
  const sentences = cleanText.match(/[^.!?]+[.!?]+(\s|$)/g);
  if (sentences && sentences.length >= 2) {
    let summary = sentences[0].trim() + ' ' + sentences[1].trim();
    if (summary.length > 250) summary = sentences[0].trim();
    if (summary.length > 250) return summary.substring(0, 250) + '...';
    return summary;
  } else if (sentences && sentences.length === 1) {
    let summary = sentences[0].trim();
    if (summary.length > 250) return summary.substring(0, 250) + '...';
    return summary;
  }
  
  // Fallback for bulleted lists without punctuation 
  if (cleanText.length > 250) return cleanText.substring(0, 250) + '...';
  return cleanText.trim();
}

// ═══════════════════════════════════════════════
// MAIN SCRAPER
// ═══════════════════════════════════════════════
async function scrapeAll() {
  console.log('🍁 MapleDevs Job Scraper');
  console.log('========================\n');

  let allJobs = [];

  for (const studio of STUDIOS) {
    console.log(`📋 Scraping: ${studio.name} (${studio.platform})`);

    let jobs = [];
    switch (studio.platform) {
      case 'greenhouse':
        jobs = await scrapeGreenhouse(studio);
        break;
      case 'lever':
        jobs = await scrapeLever(studio);
        break;
      default:
        console.log(`  ⚠️ Unknown platform: ${studio.platform}`);
    }

    allJobs = allJobs.concat(jobs);
    console.log();

    // Rate limiting: be nice to their servers
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n📊 Total jobs scraped: ${allJobs.length}`);
  console.log(`   Studios processed: ${STUDIOS.length}`);
  console.log(`   Unique studios with jobs: ${new Set(allJobs.map(j => j.studio)).size}`);

  return allJobs;
}

// ═══════════════════════════════════════════════
// GOOGLE SHEETS INTEGRATION
// ═══════════════════════════════════════════════
// This section uses the Google Sheets API to:
// 1. Read existing jobs from the sheet
// 2. Add new jobs that don't exist yet
// 3. Remove jobs that are no longer on studio career pages
//
// REQUIRES: google-auth-library and googleapis npm packages
// Install with: npm install googleapis google-auth-library

async function updateGoogleSheet(scrapedJobs) {
  // Check if we have the required env vars
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKeyB64 = process.env.GOOGLE_PRIVATE_KEY;

  if (!sheetId || !clientEmail || !privateKeyB64) {
    console.log('\n⚠️  Google Sheets env vars not set. Outputting to console instead.\n');
    console.log('To enable Google Sheets sync, set these environment variables:');
    console.log('  GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY\n');
    console.log('Scraped jobs (CSV format):\n');
    console.log('Title,Studio,Location,Type,Mode,Description,Apply URL,Posted,Featured,Student,Salary');
    scrapedJobs.forEach(j => {
      console.log(`"${j.title}","${j.studio}","${j.location}","${j.type}","${j.mode}","${j.description.replace(/"/g, '""')}","${j.applyUrl}","${j.posted}","${j.featured}","${j.student}","${j.salary}"`);
    });
    return;
  }

  try {
    const { google } = require('googleapis');
    let privateKey = privateKeyB64;
    if (!privateKey.includes('BEGIN PRIVATE KEY')) {
      privateKey = Buffer.from(privateKeyB64, 'base64').toString('utf-8');
    } else {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    const auth = new google.auth.JWT(clientEmail, null, privateKey, [
      'https://www.googleapis.com/auth/spreadsheets',
    ]);

    const sheets = google.sheets({ version: 'v4', auth });
    const range = 'Sheet1!A:K'; // Columns A through K

    // Read existing data
    console.log('\n📖 Reading existing sheet data...');
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: range,
    });

    const rows = existing.data.values || [];
    const existingJobs = new Set();

    // Build a set of existing job identifiers (title + studio)
    for (let i = 1; i < rows.length; i++) {
      const key = (rows[i][0] + '|' + rows[i][1]).toLowerCase();
      existingJobs.add(key);
    }

    // Find new jobs to add
    const newJobs = scrapedJobs.filter(j => {
      const key = (j.title + '|' + j.studio).toLowerCase();
      return !existingJobs.has(key);
    });

    // Find jobs to remove (in sheet but not in scraped data)
    const scrapedKeys = new Set(scrapedJobs.map(j => (j.title + '|' + j.studio).toLowerCase()));
    const studioNames = new Set(STUDIOS.map(s => s.name.toLowerCase()));
    const rowsToRemove = [];

    for (let i = rows.length - 1; i >= 1; i--) {
      const studio = (rows[i][1] || '').toLowerCase();
      const key = (rows[i][0] + '|' + rows[i][1]).toLowerCase();
      // Only remove jobs from studios we actively scrape
      if (studioNames.has(studio) && !scrapedKeys.has(key)) {
        rowsToRemove.push(i + 1); // 1-indexed for Sheets API
      }
    }

    console.log(`   Existing jobs: ${rows.length - 1}`);
    console.log(`   New jobs to add: ${newJobs.length}`);
    console.log(`   Expired jobs to remove: ${rowsToRemove.length}`);

    // Remove expired jobs (delete rows from bottom to top)
    if (rowsToRemove.length > 0) {
      console.log('\n🗑️  Removing expired jobs...');
      for (const rowIdx of rowsToRemove) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: sheetId,
          resource: {
            requests: [{
              deleteDimension: {
                range: {
                  sheetId: 0,
                  dimension: 'ROWS',
                  startIndex: rowIdx - 1,
                  endIndex: rowIdx,
                },
              },
            }],
          },
        });
      }
      console.log(`   ✅ Removed ${rowsToRemove.length} expired jobs`);
    }

    // Add new jobs
    if (newJobs.length > 0) {
      console.log('\n➕ Adding new jobs...');
      const newRows = newJobs.map(j => [
        j.title, j.studio, j.location, j.type, j.mode,
        j.description, j.applyUrl, j.posted, j.featured, j.student, j.salary
      ]);

      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: 'Sheet1!A:K',
        valueInputOption: 'USER_ENTERED',
        resource: { values: newRows },
      });
      console.log(`   ✅ Added ${newJobs.length} new jobs`);
    }

    console.log('\n🎉 Google Sheet updated successfully!');

  } catch (err) {
    console.error('\n❌ Error updating Google Sheet:', err.message);
    console.log('\nMake sure you have installed: npm install googleapis google-auth-library');
  }
}

// ═══════════════════════════════════════════════
// RUN
// ═══════════════════════════════════════════════
(async () => {
  try {
    const jobs = await scrapeAll();
    await updateGoogleSheet(jobs);
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
})();
