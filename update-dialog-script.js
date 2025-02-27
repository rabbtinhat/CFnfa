// update-dialog.js
// This script fetches dialog content from a Notion database for today's date
// and updates the dialog.json file with the new content

const { Client } = require('@notionhq/client');
const fs = require('fs');
const path = require('path');

// Configuration
const NOTION_KEY = process.env.NOTION_KEY || process.env.NOTION_TOKEN; // Set this in GitHub Secrets
const NOTION_DATABASE_ID = process.env.NOTION_DIALOG_DATABASE_ID || process.env.NOTION_DATABASE_ID; // Set this in GitHub Secrets
const DIALOG_JSON_PATH = process.env.DIALOG_JSON_PATH || './assets/js/dialog.json';

// Create directory for dialog.json if it doesn't exist
const dialogDir = path.dirname(DIALOG_JSON_PATH);
if (!fs.existsSync(dialogDir)) {
  console.log(`Creating directory: ${dialogDir}`);
  fs.mkdirSync(dialogDir, { recursive: true });
}

// Character mapping configuration
const CHARACTER_MAP = {
  'Alex': {
    speaker: 'A',
    imageDefault: '/assets/images/rpg/banker.png',
    imageNervous: '/assets/images/rpg/banker_nervous.png'
  },
  'Morgan': {
    speaker: 'B',
    imageDefault: '/assets/images/rpg/wiseman.png'
  }
};

// Default dialog to use as fallback
const DEFAULT_DIALOG = [
  { 
    speaker: "A", 
    text: "The crypto market just crashed again... Do you think I should buy the dip or wait it out?",
    image: "/assets/images/rpg/banker.png"
  },
  { 
    speaker: "B", 
    text: "That reminds me the story about a struggling artist, who could barely sell a painting for $10...",
    image: "/assets/images/rpg/wiseman.png"
  }
  // ... (abbreviated for brevity)
];

// Initialize Notion client
const notion = new Client({ auth: NOTION_KEY });

/**
 * Main function to update dialog
 */
async function updateDialog() {
  try {
    console.log('Starting dialog update process...');
    
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    
    // Check for date override from command line argument
    const dateArg = process.argv.find(arg => arg.startsWith('--date='));
    const targetDate = dateArg ? dateArg.split('=')[1] : today;
    
    console.log(`Looking for dialog content for date: ${targetDate}`);
    
    // Query Notion database for today's content
    const response = await queryNotionDatabase(targetDate);
    
    if (response.results.length === 0) {
      console.log(`No content found for date: ${targetDate}`);
      console.log('Using default dialog content');
      await saveDialogJson(DEFAULT_DIALOG);
      return;
    }
    
    // Get the first (and hopefully only) matching entry
    const page = response.results[0];
    const contentProperty = page.properties.Content;
    
    if (!contentProperty || !contentProperty.rich_text || contentProperty.rich_text.length === 0) {
      console.log('Content property is empty or missing');
      console.log('Using default dialog content');
      await saveDialogJson(DEFAULT_DIALOG);
      return;
    }
    
    // Extract the rich text content
    const rawContent = contentProperty.rich_text.map(text => text.plain_text).join('');
    
    // Parse the raw content into dialog format
    const parsedDialog = parseRawContentToDialog(rawContent);
    
    // Save the parsed dialog to dialog.json
    await saveDialogJson(parsedDialog);
    
    console.log('Dialog updated successfully!');
  } catch (error) {
    console.error('Error updating dialog:', error);
    process.exit(1);
  }
}

/**
 * Query the Notion database for content with the specified date
 */
async function queryNotionDatabase(date) {
  return await notion.databases.query({
    database_id: NOTION_DATABASE_ID,
    filter: {
      property: 'Date',
      date: {
        equals: date
      }
    }
  });
}

/**
 * Parse raw text content into dialog format
 */
function parseRawContentToDialog(content) {
  const dialogItems = [];
  
  // Split by speaker indicators (**Speaker:**)
  const speakerRegex = /\*\*(.*?):\*\*/g;
  const parts = content.split(speakerRegex);
  
  // Skip the first part if it's empty (content starts with a speaker)
  let startIndex = parts[0].trim() === '' ? 1 : 0;
  
  // Process pairs of speaker and text
  for (let i = startIndex; i < parts.length; i += 2) {
    const speaker = parts[i].trim();
    const text = parts[i + 1]?.trim() || '';
    
    if (!speaker || !text) continue;
    
    // Get the character config for this speaker
    const characterConfig = CHARACTER_MAP[speaker] || {
      speaker: speaker === 'Alex' ? 'A' : 'B',
      imageDefault: '/assets/images/rpg/banker.png'
    };
    
    // Determine which image to use based on text content
    // This is a simple implementation - can be made more sophisticated
    let image = characterConfig.imageDefault;
    
    // If the character has a nervous image and the text suggests nervousness
    const nervousKeywords = ['worried', 'nervous', 'concerned', 'not seeing', 'what\'s the point'];
    if (characterConfig.imageNervous && 
        nervousKeywords.some(keyword => text.toLowerCase().includes(keyword))) {
      image = characterConfig.imageNervous;
    }
    
    // Add the dialog item
    dialogItems.push({
      speaker: characterConfig.speaker,
      text: text,
      image: image
    });
  }
  
  // Return the default dialog if parsing produced no valid items
  if (dialogItems.length === 0) {
    console.log('Parsing produced no valid dialog items, using default');
    return DEFAULT_DIALOG;
  }
  
  return dialogItems;
}

/**
 * Save the dialog content to the JSON file
 */
async function saveDialogJson(dialogContent) {
  // Ensure the directory exists
  const dialogDir = path.dirname(DIALOG_JSON_PATH);
  if (!fs.existsSync(dialogDir)) {
    fs.mkdirSync(dialogDir, { recursive: true });
  }
  
  // Write the file
  fs.writeFileSync(
    DIALOG_JSON_PATH, 
    JSON.stringify(dialogContent, null, 2),
    'utf8'
  );
  
  console.log(`Dialog saved to ${DIALOG_JSON_PATH}`);
}

// Run the update function
updateDialog();
