// sync.js
require('dotenv').config();
const { Client } = require('@notionhq/client');
const fs = require('fs').promises;
const path = require('path');
const { marked } = require('marked');

// Initialize Notion client
const notion = new Client({
    auth: process.env.NOTION_TOKEN
});

// Helper function to clean title (remove date prefix if exists)
function cleanTitle(title) {
    // Remove date pattern like "20250210" from the beginning of the title
    return title.replace(/^\d{8}\s+/, '');
}

async function processPost(page) {
    const rawTitle = page.properties.Title.title[0]?.plain_text || 'Untitled';
    console.log(`Processing post: ${rawTitle}`);
    
    // Get the content directly from the Content property
    const content = page.properties.Content.rich_text[0]?.plain_text || '';
    
    return {
        title: cleanTitle(rawTitle),
        slug: page.properties.Slug.rich_text[0]?.plain_text || '',
        date: page.properties.Date.date?.start || '',
        summary: page.properties.Summary.rich_text[0]?.plain_text || '',
        category: page.properties.Category.select?.name || 'Daily update',
        content: content,
    };
}

function generateHtml(post) {
    // Convert content to HTML using marked
    const htmlContent = marked.parse(post.content);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${post.title} - CF Ng's Non Financial Advice</title>
    <link rel="stylesheet" href="/assets/css/main.css">
    <link rel="stylesheet" href="/assets/css/components.css">
    <style>
        .blog-post {
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem 1rem;
        }
        .blog-title {
            font-size: 2rem;
            font-weight: bold;
            margin-bottom: 1rem;
        }
        .blog-meta {
            margin-bottom: 2rem;
            color: #666;
        }
        .blog-category {
            display: inline-block;
            padding: 0.2rem 0.8rem;
            background-color: #f0f0f0;
            border-radius: 15px;
            margin-right: 1rem;
        }
        .blog-content {
            line-height: 1.6;
            white-space: pre-wrap;
        }
        .blog-content h1 { font-size: 1.8rem; margin: 1.5rem 0; font-weight: bold; }
        .blog-content h2 { font-size: 1.5rem; margin: 1.3rem 0; font-weight: bold; }
        .blog-content h3 { font-size: 1.3rem; margin: 1.1rem 0; font-weight: bold; }
        .blog-content p { margin: 1rem 0; }
        .blog-content ul, .blog-content ol { margin: 1rem 0; padding-left: 2rem; }
        .blog-content code { background: #f4f4f4; padding: 0.2rem 0.4rem; border-radius: 3px; }
        .blog-content pre { background: #f4f4f4; padding: 1rem; border-radius: 5px; overflow-x: auto; }
        .blog-content blockquote { border-left: 4px solid #ddd; padding-left: 1rem; margin: 1rem 0; color: #666; }
    </style>
</head>
<body>
    <div id="header"></div>
    <main>
        <article class="blog-post">
            <h1 class="blog-title">${post.title}</h1>
            <div class="blog-meta">
                <span class="blog-category">${post.category}</span>
                <span class="blog-date">${new Date(post.date).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                })}</span>
            </div>
            <div class="blog-content">
                ${htmlContent}
            </div>
        </article>
    </main>
    <div id="footer"></div>

    <script>
        // Load components
        fetch('/components/header.html')
            .then(response => response.text())
            .then(data => {
                document.getElementById('header').innerHTML = data;
                return fetch('/components/nav.html');
            })
            .then(response => response.text())
            .then(data => {
                document.getElementById('nav').innerHTML = data;
            });

        fetch('/components/footer.html')
            .then(response => response.text())
            .then(data => {
                document.getElementById('footer').innerHTML = data;
            });
    </script>
</body>
</html>`;
}

async function syncNotionToWebsite() {
    try {
        console.log('Starting Notion sync...');
        
        const response = await notion.databases.query({
            database_id: process.env.NOTION_DATABASE_ID,
            filter: {
                property: 'Status',
                select: {
                    equals: 'Published'
                }
            },
            sorts: [
                {
                    property: 'Date',
                    direction: 'descending',
                }
            ],
        });
        
        console.log(`Found ${response.results.length} published posts`);
        
        const posts = await Promise.all(
            response.results.map(page => processPost(page))
        );
        
        const contentDir = path.join(process.cwd(), 'content', 'posts');
        await fs.mkdir(contentDir, { recursive: true });
        
        const postsIndex = posts.map(post => ({
            title: post.title,
            slug: post.slug,
            date: post.date,
            category: post.category,
            summary: post.summary
        }));
        
        await fs.writeFile(
            path.join(contentDir, 'index.json'),
            JSON.stringify(postsIndex, null, 2),
            'utf8'
        );
        
        for (const post of posts) {
            const fileName = `${post.slug || 'untitled'}.html`;
            const filePath = path.join(contentDir, fileName);
            
            const htmlContent = generateHtml(post);
            await fs.writeFile(filePath, htmlContent, 'utf8');
            console.log(`Saved: ${fileName}`);
        }
        
        console.log('Sync completed successfully!');
        
    } catch (error) {
        console.error('Sync failed:', error);
        throw error;
    }
}

// Run the sync
syncNotionToWebsite()
    .then(() => console.log('Done!'))
    .catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });
