const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// --- CONFIG ---
const KEY_PATH = 'c:/Users/wupei/Downloads/mapledevs-493406-92f28ff2a109.json';
const SITEMAP_PATH = path.join(__dirname, '..', 'sitemap.xml');

let key;
if (process.env.GOOGLE_INDEXING_KEY) {
    try {
        key = JSON.parse(process.env.GOOGLE_INDEXING_KEY);
        console.log('🔑 Using credentials from GOOGLE_INDEXING_KEY environment variable.');
    } catch (e) {
        console.error('❌ Failed to parse GOOGLE_INDEXING_KEY env var.');
        process.exit(1);
    }
} else if (fs.existsSync(KEY_PATH)) {
    key = require(KEY_PATH);
    console.log('🔑 Using credentials from local file.');
} else {
    console.error(`❌ No credentials found (check env var GOOGLE_INDEXING_KEY or file at ${KEY_PATH})`);
    process.exit(1);
}

const jwtClient = new google.auth.JWT(
    key.client_email,
    null,
    key.private_key,
    ['https://www.googleapis.com/auth/indexing'],
    null
);

async function indexUrls() {
    console.log('🔗 Starting Google Indexing Ping...');
    
    try {
        await jwtClient.authorize();
        const indexing = google.indexing('v3');

        // Extract URLs from sitemap
        const sitemap = fs.readFileSync(SITEMAP_PATH, 'utf8');
        const urlRegex = /<loc>(https:\/\/mapledevs\.ca\/.*?)<\/loc>/g;
        let match;
        const urls = [];

        while ((match = urlRegex.exec(sitemap)) !== null) {
            urls.push(match[1]);
        }

        console.log(`🔍 Found ${urls.length} URLs in sitemap.`);

        for (const url of urls) {
            try {
                // Rate limiting protection
                await new Promise(resolve => setTimeout(resolve, 200)); 

                const res = await indexing.urlNotifications.publish({
                    auth: jwtClient,
                    requestBody: {
                        url: url,
                        type: 'URL_UPDATED'
                    }
                });
                console.log(`✅ Indexed: ${url}`);
            } catch (err) {
                console.error(`❌ Failed to index ${url}:`, err.message);
                if (err.message.includes('403')) {
                    console.error('⚠️ Ensure your service account has OWNER permission in Search Console.');
                    process.exit(1);
                }
            }
        }
    } catch (err) {
        console.error('❌ Authentication failed:', err);
    }
}

indexUrls();
