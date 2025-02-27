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
    imageDefault: '/assets/images/rpg/wiseman.png',
    imageCalm: '/assets/images/rpg/banker.png' // Calm, confident tone image
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
    let targetDate = dateArg ? dateArg.split('=')[1] : today;
    
    // Normalize date format (in case it comes in as YYYY/MM/DD)
    targetDate = targetDate.replace(/\//g, '-');
    
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
    
    // Validate the dialog structure
    const validatedDialog = validateDialog(parsedDialog);
    
    // Save the parsed dialog to dialog.json
    await saveDialogJson(validatedDialog);
    
    console.log('Dialog updated successfully!');
  } catch (error) {
    console.error('Error updating dialog:', error);
    process.exit(1);
  }
}

/**
 * Query the Notion database for content with the specified date
 * Handles both YYYY-MM-DD and YYYY/MM/DD formats
 */
async function queryNotionDatabase(date) {
  // Convert YYYY-MM-DD to YYYY/MM/DD if needed
  const dateSlash = date.replace(/-/g, '/');
  
  // Try both formats since Notion's date filter can be particular
  try {
    // First try with the original format (YYYY-MM-DD)
    const response = await notion.databases.query({
      database_id: NOTION_DATABASE_ID,
      filter: {
        property: 'Date',
        date: {
          equals: date
        }
      }
    });
    
    if (response.results.length > 0) {
      return response;
    }
    
    // If no results, try with slash format
    console.log(`No results with date ${date}, trying ${dateSlash}`);
    return await notion.databases.query({
      database_id: NOTION_DATABASE_ID,
      filter: {
        property: 'Date',
        date: {
          equals: dateSlash
        }
      }
    });
  } catch (error) {
    console.error('Error querying Notion database:', error);
    throw error;
  }
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
  
  // Track speakers we've seen to assign consistent A/B values
  const speakerAssignments = {};
  let speakerCount = 0;
  
  // Process pairs of speaker and text
  for (let i = startIndex; i < parts.length; i += 2) {
    const speaker = parts[i].trim();
    const text = parts[i + 1]?.trim() || '';
    
    if (!speaker || !text) continue;
    
    // Assign A/B to any speaker consistently
    if (!speakerAssignments[speaker]) {
      // First speaker is A, second is B, and alternate from there
      speakerAssignments[speaker] = speakerCount === 0 ? 'A' : 'B';
      speakerCount++;
    }
    
    // Assign a character config, using CHARACTER_MAP if the speaker is known
    let characterConfig = CHARACTER_MAP[speaker];
    
    // If the speaker is not in our map, create a default config
    if (!characterConfig) {
      characterConfig = {
        speaker: speakerAssignments[speaker],
        imageDefault: speakerAssignments[speaker] === 'A' 
          ? '/assets/images/rpg/banker.png' 
          : '/assets/images/rpg/wiseman.png'
      };
      
      // Log unknown speaker for future reference
      console.log(`Unknown speaker "${speaker}" assigned as "${speakerAssignments[speaker]}" with default image`);
    } else {
      // Ensure the speaker value matches our assignment
      characterConfig.speaker = speakerAssignments[speaker];
    }
    
    // Determine which image to use based on text content
    let image = characterConfig.imageDefault;
    
    // Check for nervous/worried tone
    const nervousKeywords = ['worried', 'nervous', 'concerned', 'not seeing', 'what\'s the point', 
                           'confused', 'unsure', 'doubt', 'anxiety', 'stress', 'panic', 'fear'];
    if (characterConfig.imageNervous && 
        nervousKeywords.some(keyword => text.toLowerCase().includes(keyword))) {
      image = characterConfig.imageNervous;
    }
    
    // Check for calm/confident tone
    const calmKeywords = ['confident', 'calm', 'relax', 'patience', 'simple', 'certainly', 
                         'absolutely', 'definitely', 'without doubt', 'obviously', 'clearly'];
    if (characterConfig.imageCalm && 
        calmKeywords.some(keyword => text.toLowerCase().includes(keyword))) {
      image = characterConfig.imageCalm;
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
 * Validate dialog structure and ensure it meets requirements
 */
function validateDialog(dialog) {
  if (!Array.isArray(dialog) || dialog.length === 0) {
    console.log('Invalid dialog structure, using default');
    return DEFAULT_DIALOG;
  }
  
  // Validate each dialog item
  const validDialog = dialog.filter(item => {
    // Must have speaker, text, and image
    if (!item.speaker || !item.text || !item.image) {
      console.log('Skipping invalid dialog item:', item);
      return false;
    }
    
    // Speaker must be either A or B
    if (item.speaker !== 'A' && item.speaker !== 'B') {
      console.log(`Invalid speaker value "${item.speaker}", should be A or B. Item:`, item);
      // Fix it instead of rejecting
      item.speaker = item.speaker === 'a' ? 'A' : 'B';
    }
    
    // Text should not be empty
    if (item.text.trim() === '') {
      console.log('Skipping dialog item with empty text');
      return false;
    }
    
    // Make sure image path is properly formatted
    if (!item.image.startsWith('/')) {
      item.image = '/' + item.image;
    }
    
    return true;
  });
  
  // Ensure we have at least one valid item
  if (validDialog.length === 0) {
    console.log('No valid dialog items after validation, using default');
    return DEFAULT_DIALOG;
  }
  
  console.log(`Validated ${validDialog.length} dialog items`);
  return validDialog;
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
