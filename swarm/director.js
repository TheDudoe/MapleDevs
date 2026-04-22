const fs = require('fs-extra');
const path = require('path');
const { updateState, updateAgent } = require('./utils');

async function publish(contentPackage) {
    const agentId = 'director';
    await updateAgent(agentId, 'Active', 'Publishing content...');

    const ROOT_DIR = path.join(__dirname, '..');
    const BLOG_DIR = path.join(ROOT_DIR, 'blog');

    try {
        // 1. Handle Blog Post
        if (contentPackage.blog) {
            const { slug, final_markdown } = contentPackage.blog;
            const postDir = path.join(BLOG_DIR, slug);
            await fs.ensureDir(postDir);

            // Save the markdown
            await fs.writeFile(path.join(postDir, 'content.md'), final_markdown);
            
            // Create a BEAUTIFUL index.html for the post
            const titleMatch = final_markdown.match(/^# (.*)/m) || final_markdown.match(/title: "(.*)"/);
            const title = titleMatch ? titleMatch[1] : 'Industry Update';
            const cleanBody = final_markdown.replace(/^---[\s\S]*?---/, '').replace(/^# .*/, '').trim();
            const htmlContent = cleanBody.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');

            const blogHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} | MapleDevs Blog</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Outfit', sans-serif; background: #0a0b10; color: #e0e0e6; line-height: 1.8; margin: 0; padding: 0; }
        .container { max-width: 800px; margin: 0 auto; padding: 80px 20px; }
        header { border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 40px; margin-bottom: 40px; }
        h1 { font-size: 42px; background: linear-gradient(90deg, #00f2ff, #7000ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 10px; }
        .back { color: #00f2ff; text-decoration: none; font-size: 14px; display: block; margin-bottom: 20px; }
        .content p { margin-bottom: 24px; font-size: 18px; }
        .content h3 { color: #00f2ff; margin-top: 40px; }
        footer { margin-top: 80px; padding-top: 40px; border-top: 1px solid rgba(255,255,255,0.1); color: #9494a3; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <a href="/blog/" class="back">← Back to Blog Feed</a>
        <header>
            <h1>${title}</h1>
            <div style="color: #9494a3;">Published by MapleDevs AI Swarm • April 2026</div>
        </header>
        <div class="content">
            ${htmlContent}
        </div>
        <footer>
            &copy; 2026 MapleDevs. Verified Canadian Game Industry Jobs.
        </footer>
    </div>
</body>
</html>`;
            await fs.writeFile(path.join(postDir, 'index.html'), blogHtml);
            
            // 1b. Update main index.html ticker using markers
            const indexPath = path.join(ROOT_DIR, 'index.html');
            if (await fs.pathExists(indexPath)) {
                let indexContent = await fs.readFile(indexPath, 'utf-8');
                
                const tickerHtml = `<!-- SWARM_TICKER_START -->
<div id="news-ticker" class="news-ticker" style="background:var(--maple-gradient); color:#fff; padding:6px 1rem; text-align:center; font-size:12px; font-weight:600; position:relative; z-index:300;">
  <div class="nt-inner" style="max-width:var(--max-w); margin:0 auto; display:flex; align-items:center; justify-content:center; gap:8px;">
    <span style="background:rgba(255,255,255,0.2); padding:2px 6px; border-radius:4px; font-size:10px; text-transform:uppercase;">Latest News</span>
    <a href="/blog/${slug}/" id="latest-news-link" style="color:#fff; text-decoration:none; display:flex; align-items:center; gap:4px;">
      <span id="latest-news-title">${title}</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
    </a>
  </div>
</div>
<!-- SWARM_TICKER_END -->`;

                const tickerRegex = /<!-- SWARM_TICKER_START -->[\s\S]*?<!-- SWARM_TICKER_END -->/;
                if (tickerRegex.test(indexContent)) {
                    indexContent = indexContent.replace(tickerRegex, tickerHtml);
                    await fs.writeFile(indexPath, indexContent);
                    console.log(`[Director] Updated website ticker safely.`);
                }
            }

            // 1c. Update blog/index.html archive using markers
            const blogArchivePath = path.join(ROOT_DIR, 'blog', 'index.html');
            if (await fs.pathExists(blogArchivePath)) {
                let archiveContent = await fs.readFile(blogArchivePath, 'utf-8');
                const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                
                const newCardHtml = `<!-- ═══════ BLOG POSTS START ═══════ -->
            <a href="/blog/${slug}/" class="blog-card">
                <span class="date">${date}</span>
                <h2>${title}</h2>
                <p>${title}. New industry updates and opportunities.</p>
            </a>`;
                
                if (archiveContent.includes('<!-- ═══════ BLOG POSTS START ═══════ -->')) {
                    archiveContent = archiveContent.replace('<!-- ═══════ BLOG POSTS START ═══════ -->', newCardHtml);
                    await fs.writeFile(blogArchivePath, archiveContent);
                    console.log(`[Director] Added to blog archive.`);
                }
            }

            console.log(`[Director] Published blog post: ${slug}`);
        }

        // 2. Update Stats
        const state = await fs.readJson(path.join(__dirname, 'state.json'));
        state.stats.blogs_written += contentPackage.blog ? 1 : 0;
        state.stats.jobs_approved += contentPackage.approvedCount || 0;
        state.last_run = new Date().toISOString();
        state.status = 'idle';
        await updateState(state);

        await updateAgent(agentId, 'Idle', 'All systems synchronized.');
        
    } catch (error) {
        console.error('[Director Error]', error);
        await updateAgent(agentId, 'Idle', `Error: ${error.message}`);
        throw error;
    }
}

module.exports = publish;
