// sync.js
require('dotenv').config();
const { Client } = require('@notionhq/client');
const fs = require('fs').promises;
const path = require('path');
const marked = require('marked');

// Initialize Notion client
const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

const DATABASE_ID = process.env.NOTION_DATABASE_ID;

// Helper functions
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function getFirstTwoSentences(text) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  return sentences.slice(0, 2).join(' ').trim();
}

function getPostPath(date) {
  const year = new Date(date).getFullYear();
  const month = new Date(date).toLocaleString('default', { month: 'lowercase' });
  const filename = new Date(date).toISOString().slice(0,10).replace(/-/g, '') + '.html';
  return path.join('blog', year.toString(), month, filename);
}

async function ensureDirectoryExists(filePath) {
  const dirname = path.dirname(filePath);
  try {
    await fs.access(dirname);
  } catch {
    await fs.mkdir(dirname, { recursive: true });
  }
}

async function fetchNotionPosts() {
  try {
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
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
        },
      ],
    });

    return response.results;
  } catch (error) {
    console.error('Error fetching Notion posts:', error);
    throw error;
  }
}

async function generateBlogPost(post) {
  const properties = post.properties;
  const title = properties.Title.title[0].plain_text;
  const date = properties.Date.date.start;
  const content = properties.Content.rich_text[0].plain_text;
  const category = properties.Category.select.name;
  
  // Auto-generate slug if not present
  let slug = properties.Slug.rich_text[0]?.plain_text;
  if (!slug) {
    slug = generateSlug(title);
    await notion.pages.update({
      page_id: post.id,
      properties: {
        Slug: {
          rich_text: [{ text: { content: slug } }]
        }
      }
    });
  }
  
  // Auto-generate summary if not present
  let summary = properties.Summary.rich_text[0]?.plain_text;
  if (!summary) {
    summary = getFirstTwoSentences(content);
    await notion.pages.update({
      page_id: post.id,
      properties: {
        Summary: {
          rich_text: [{ text: { content: summary } }]
        }
      }
    });
  }

  // Convert markdown content to HTML
  const htmlContent = marked(content);
  
  // Read the template
  const template = await fs.readFile(path.join(__dirname, 'templates', 'post.html'), 'utf8');
  
  // Generate HTML
  const postHtml = template
    .replace('[POST_TITLE]', title)
    .replace('[POST_DATE]', new Date(date).toLocaleDateString())
    .replace('[POST_CATEGORY]', category)
    .replace('[POST_CONTENT]', htmlContent);
    
  // Get file path
  const filePath = getPostPath(date);
  
  return {
    path: filePath,
    html: postHtml,
    title,
    date,
    category,
    summary,
    slug
  };
}

async function updateBlogIndex(posts) {
  // Generate blog index data
  const postsData = posts.map(post => ({
    title: post.title,
    date: post.date,
    category: post.category,
    path: post.path,
    summary: post.summary
  }));

  // Save posts data for client-side rendering
  await fs.writeFile(
    path.join(__dirname, 'assets', 'js', 'blog-data.js'),
    `const blogPosts = ${JSON.stringify(postsData, null, 2)};`,
    'utf8'
  );
}

async function syncWebsite() {
  try {
    console.log('Fetching posts from Notion...');
    const notionPosts = await fetchNotionPosts();
    
    console.log('Generating blog posts...');
    const processedPosts = [];
    for (const post of notionPosts) {
      const processedPost = await generateBlogPost(post);
      await ensureDirectoryExists(processedPost.path);
      await fs.writeFile(processedPost.path, processedPost.html, 'utf8');
      processedPosts.push(processedPost);
    }
    
    console.log('Updating blog index...');
    await updateBlogIndex(processedPosts);
    
    console.log('Website sync completed successfully!');
  } catch (error) {
    console.error('Error syncing website:', error);
    process.exit(1);
  }
}

// Run sync
syncWebsite();
