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
    const htmlContent = marked.parse(post.content);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${post.title} - CF's Non Financial Advice</title>
    <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/assets/css/main.css">
    <link rel="stylesheet" href="/assets/css/components.css">
    <link rel="stylesheet" href="/assets/css/consolidated-cyberpunk.css">
    <link rel="stylesheet" href="/assets/css/blog-specific-styles.css">
    <style>
        /* Blog post specific styles that maintain consistency */
        .blog-post {
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem 1rem;
        }
        
        .blog-title {
            font-family: 'Press Start 2P', cursive;
            font-size: 1.5rem;
            color: #00fff5;
            margin-bottom: 1.5rem;
            line-height: 1.4;
        }
        
        .blog-meta {
            margin-bottom: 2rem;
            font-family: 'Press Start 2P', cursive;
            font-size: 0.7rem;
            color: var(--text-primary);
        }
        
        .blog-category {
            display: inline-block;
            padding: 0.2rem 0.8rem;
            background: rgba(255, 0, 255, 0.1);
            border: 1px solid var(--neon-pink);
            border-radius: 15px;
            margin-right: 1rem;
            color: var(--neon-pink);
        }
        
        .blog-date {
            color: var(--text-secondary);
        }
        
        .blog-content {
            font-family: 'Press Start 2P', cursive;
            font-size: 0.8rem;
            line-height: 1.8;
            color: var(--text-primary);
            white-space: pre-wrap;
            background: rgba(26, 26, 26, 0.9);
            border: 1px solid var(--neon-purple);
            border-radius: 0.5rem;
            padding: 2rem;
        }
        
        .blog-content h1 { 
            font-size: 1.3rem; 
            margin: 2rem 0 1rem;
            color: var(--neon-blue);
        }
        
        .blog-content h2 { 
            font-size: 1.1rem; 
            margin: 1.5rem 0 1rem;
            color: var(--neon-pink);
        }
        
        .blog-content h3 { 
            font-size: 1rem; 
            margin: 1.3rem 0 1rem;
            color: var(--neon-purple);
        }
        
        .blog-content p { 
            margin: 1rem 0; 
        }
        
        .blog-content ul, 
        .blog-content ol { 
            margin: 1rem 0; 
            padding-left: 2rem; 
        }
        
        .blog-content li {
            margin-bottom: 0.5rem;
        }
        
        .blog-content code { 
            background: rgba(0, 255, 245, 0.1);
            padding: 0.2rem 0.4rem;
            border-radius: 3px;
            border: 1px solid var(--neon-blue);
            font-family: monospace;
            font-size: 0.9rem;
        }
        
        .blog-content pre { 
            background: rgba(10, 10, 15, 0.95);
            padding: 1rem;
            border-radius: 5px;
            overflow-x: auto;
            border: 1px solid var(--neon-purple);
        }
        
        .blog-content blockquote { 
            border-left: 4px solid var(--neon-pink);
            padding-left: 1rem;
            margin: 1rem 0;
            color: var(--text-secondary);
        }
        
        .blog-content a {
            color: var(--neon-blue);
            text-decoration: none;
            transition: all 0.3s ease;
        }

        @media (max-width: 768px) {
            .blog-title {
                font-size: 1.2rem;
            }
            
            .blog-meta {
                font-size: 0.6rem;
            }
            
            .blog-content {
                font-size: 0.7rem;
                padding: 1rem;
            }
            
            .blog-content h1 { font-size: 1.1rem; }
            .blog-content h2 { font-size: 1rem; }
            .blog-content h3 { font-size: 0.9rem; }
        }
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
        // Load header and navigation
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

        // Load footer
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
