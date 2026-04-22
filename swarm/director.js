const fs = require('fs-extra');
const path = require('path');
const { updateState, updateAgent } = require('./utils');

/**
 * Publisher Agent
 * Takes polished JSON content and injects it into the site template.
 */
async function publish(contentPackage) {
    const agentId = 'director';
    await updateAgent(agentId, 'Active', 'Publishing to premium template...');

    const ROOT_DIR = path.join(__dirname, '..');
    const BLOG_DIR = path.join(ROOT_DIR, 'blog');

    try {
        if (contentPackage.blog) {
            const { slug, meta_description, html_body, title } = contentPackage.blog;
            const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            
            // 1. Template Injection
            const templatePath = path.join(ROOT_DIR, 'blog-template.html');
            if (!await fs.pathExists(templatePath)) throw new Error('MISSING_TEMPLATE: blog-template.html not found.');
            
            let html = await fs.readFile(templatePath, 'utf-8');
            html = html.replace(/{{TITLE}}/g, title || 'Industry Update');
            html = html.replace(/{{META_DESCRIPTION}}/g, meta_description || '');
            html = html.replace(/{{DATE}}/g, date);
            html = html.replace(/{{CONTENT}}/g, html_body);

            // 2. Strict Routing (Flat file in /blog/)
            const filePath = path.join(BLOG_DIR, `${slug}.html`);
            await fs.writeFile(filePath, html);
            
            // 3. Update Website Ticker (Force .html extension)
            const indexPath = path.join(ROOT_DIR, 'index.html');
            if (await fs.pathExists(indexPath)) {
                let indexContent = await fs.readFile(indexPath, 'utf-8');
                const tickerHtml = `<!-- SWARM_TICKER_START -->
<div id="news-ticker" class="news-ticker" style="background:var(--maple-gradient); color:#fff; padding:6px 1rem; text-align:center; font-size:12px; font-weight:600; position:relative; z-index:300;">
  <div class="nt-inner" style="max-width:1200px; margin:0 auto; display:flex; align-items:center; justify-content:center; gap:8px;">
    <span style="background:rgba(255,255,255,0.2); padding:2px 6px; border-radius:4px; font-size:10px; text-transform:uppercase;">Latest News</span>
    <a href="/blog/${slug}.html" id="latest-news-link" style="color:#fff; text-decoration:none; display:flex; align-items:center; gap:4px;">
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
                }
            }

            // 4. Update Blog Archive (Force .html extension)
            const blogArchivePath = path.join(BLOG_DIR, 'index.html');
            if (await fs.pathExists(blogArchivePath)) {
                let archiveContent = await fs.readFile(blogArchivePath, 'utf-8');
                const newCardHtml = `<!-- ═══════ BLOG POSTS START ═══════ -->
            <a href="/blog/${slug}.html" class="blog-card">
                <span class="date">${date}</span>
                <h2>${title}</h2>
                <p>${meta_description}</p>
            </a>`;
                if (archiveContent.includes('<!-- ═══════ BLOG POSTS START ═══════ -->')) {
                    archiveContent = archiveContent.replace('<!-- ═══════ BLOG POSTS START ═══════ -->', newCardHtml);
                    // Global fix: Remove trailing slashes from other links in archive if they exist
                    archiveContent = archiveContent.replace(/href="\/blog\/([^\/]+)\/"/g, 'href="/blog/$1.html"');
                    await fs.writeFile(blogArchivePath, archiveContent);
                }
            }

            console.log(`[Publisher] Published: /blog/${slug}.html`);
        }

        const state = await fs.readJson(path.join(__dirname, 'state.json'));
        state.stats.blogs_written += contentPackage.blog ? 1 : 0;
        state.last_run = new Date().toISOString();
        state.status = 'idle';
        await updateState(state);
        await updateAgent(agentId, 'Idle', 'Publisher Complete.');
        
    } catch (error) {
        console.error('[Publisher Error]', error);
        await updateAgent(agentId, 'Idle', 'Publisher Error');
        throw error;
    }
}

module.exports = publish;
