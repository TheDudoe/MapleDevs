/* GOOGLE INDEXING SCRIPT - VERSION 2.0 (MODERN) */
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SITEMAP_PATH = path.join(__dirname, '..', 'sitemap.xml');
let key;
let rawKey = process.env.GOOGLE_INDEXING_KEY;

console.log('🚀 GOOGLE INDEXER V2.0 STARTING...');

if (rawKey) {
    try {
        // Try parsing as raw JSON first
        key = JSON.parse(rawKey.trim());
    } catch (e) {
        try {
            // Failsafe: Try to decode as Base64 "Safe-Code"
            const decoded = Buffer.from(rawKey.trim(), 'base64').toString('utf8');
            key = JSON.parse(decoded);
            console.log('✅ Successfully decoded Safe-Code (Base64).');
        } catch (err) {
            console.error('❌ FATAL: Could not read secret. Please re-copy the Safe-Code.');
            process.exit(1);
        }
    }
} else {
    console.error('❌ FATAL: Secret GOOGLE_INDEXING_KEY is missing from GitHub Settings.');
    process.exit(1);
}

const jwtClient = new google.auth.JWT(key.client_email, null, key.private_key, ['https://www.googleapis.com/auth/indexing'], null);

async function indexUrls() {
    try {
        await jwtClient.authorize();
        const indexing = google.indexing('v3');
        const sitemap = fs.readFileSync(SITEMAP_PATH, 'utf8');
        const urlRegex = /<loc>(https:\/\/mapledevs\.ca\/.*?)<\/loc>/g;
        let match, urls = [];
        while ((match = urlRegex.exec(sitemap)) !== null) urls.push(match[1]);
        console.log(`🔍 Found ${urls.length} pages to index.`);
        for (const url of urls) {
            try {
                await new Promise(r => setTimeout(r, 200)); 
                await indexing.urlNotifications.publish({ auth: jwtClient, requestBody: { url: url, type: 'URL_UPDATED' } });
                console.log(`✅ Indexed: ${url}`);
            } catch (err) { console.error(`❌ Link error: ${url}`); }
        }
    } catch (err) { console.error('❌ Auth failed:', err.message); }
}
indexUrls();
