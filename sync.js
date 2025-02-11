// sync.js
require('dotenv').config();
const { Client } = require('@notionhq/client');
const fs = require('fs').promises;
const path = require('path');
const marked = require('marked');

// Debug: Print environment variables (masking the token)
console.log('Environment variables loaded:', {
  DATABASE_ID: process.env.NOTION_DATABASE_ID,
  TOKEN_EXISTS: !!process.env.NOTION_TOKEN
});

// Format database ID
function formatDatabaseId(id) {
  if (!id) throw new Error('Database ID is not defined in environment variables');
  return id.replace(/[^a-zA-Z0-9]/g, '');
}

// Get and format database ID
const DATABASE_ID = formatDatabaseId(process.env.NOTION_DATABASE_ID);
console.log('Using Database ID:', DATABASE_ID);

// Initialize Notion client
const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

// Test database connection
async function testDatabaseConnection() {
  try {
    console.log('Testing database connection...');
    const response = await notion.databases.retrieve({
      database_id: DATABASE_ID
    });
    console.log('Database connection successful:', response.title);
    return true;
  } catch (error) {
    console.error('Database connection failed:', error.message);
    return false;
  }
}

async function fetchNotionPosts() {
  try {
    // Test connection first
    const connectionTest = await testDatabaseConnection();
    if (!connectionTest) {
      throw new Error('Database connection test failed');
    }

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
    console.error('Error fetching Notion posts:', {
      message: error.message,
      code: error.code,
      database_id: DATABASE_ID
    });
    throw error;
  }
}

// Rest of your existing code remains the same...
