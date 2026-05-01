/* GOOGLE INDEXING SCRIPT - VERSION 3.0 (DEBUG ENABLED) */
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SITEMAP_PATH = path.join(__dirname, '..', 'sitemap.xml');
let key;
let rawKey = process.env.GOOGLE_INDEXING_KEY;

if (rawKey) {
    try {
        key = JSON.parse(rawKey.trim());
    } catch (e) {
        try {
            const decoded = Buffer.from(rawKey.trim(), 'base64').toString('utf8');
            key = JSON.parse(decoded);
            console.log('✅ Successfully decoded Safe-Code.');
        } catch (err) {
            console.error('❌ FATAL: Could not read secret.');
            process.exit(1);
        }
    }
} else {
    console.error('❌ FATAL: Secret GOOGLE_INDEXING_KEY is missing.');
    process.exit(1);
}

const jwtClient = new google.auth.JWT(key.client_email, null, key.private_key, ['https://www.googleapis.com/auth/indexing'], null);

async function indexUrls() {
    console.log('🔗 Starting Google Indexing... (Owner Permission Required)');
    try {
        await jwtClient.authorize();
        const indexing = google.indexing('v3');
        const sitemap = fs.readFileSync(SITEMAP_PATH, 'utf8');
        const urlRegex = /<loc>(https:\/\/mapledevs\.ca\/.*?)<\/loc>/g;
        let match, urls = [];
        while ((match = urlRegex.exec(sitemap)) !== null) urls.push(match[1]);
        
        console.log(`🔍 Found ${urls.length} pages to submit.`);

        for (const url of urls) {
            try {
                await new Promise(r => setTimeout(r, 200)); 
                await indexing.urlNotifications.publish({
                    auth: jwtClient,
                    requestBody: { url: url, type: 'URL_UPDATED' }
                });
                console.log(`✅ Indexed: ${url}`);
            } catch (err) {
                // This will now print the EXACT reason (e.g., 403 Permission Denied)
                console.error(`❌ Error for ${url}:`, err.message);
            }
        }
    } catch (err) {
        console.error('❌ Auth failed:', err.message);
    }
}
indexUrls();
