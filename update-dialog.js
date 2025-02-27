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
    console.log('Script version: 1.1.0');
    console.log('Using dialog.json path:', DIALOG_JSON_PATH);
    console.log('Using Notion database ID:', NOTION_DATABASE_ID);
    
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
    
    // Detect which property contains the content (handle case differences)
    let contentProperty;
    const propertyNames = Object.keys(page.properties);
    
    // Look for content in various possible property names (case-insensitive)
    const contentPropertyName = propertyNames.find(
      name => name.toLowerCase() === 'content'
    );
    
    if (contentPropertyName) {
      contentProperty = page.properties[contentPropertyName];
    } else {
      console.log('Could not find content property. Available properties:', propertyNames);
      console.log('Using default dialog content');
      await saveDialogJson(DEFAULT_DIALOG);
      return;
    }
    
    // Handle different property types (rich_text or title)
    let rawContent = '';
    if (contentProperty.rich_text && contentProperty.rich_text.length > 0) {
      rawContent = contentProperty.rich_text.map(text => text.plain_text).join('');
    } else if (contentProperty.title && contentProperty.title.length > 0) {
      rawContent = contentProperty.title.map(text => text.plain_text).join('');
    } else {
      console.log('Content property is empty or in an unexpected format');
      console.log('Property content:', contentProperty);
      console.log('Using default dialog content');
      await saveDialogJson(DEFAULT_DIALOG);
      return;
    }
    
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
  console.log(`Querying Notion database ${NOTION_DATABASE_ID} for date ${date}`);
  
  // Convert YYYY-MM-DD to YYYY/MM/DD if needed
  const dateSlash = date.replace(/-/g, '/');
  
  // Try both formats since Notion's date filter can be particular
  try {
    // First try with the original format (YYYY-MM-DD)
    console.log(`Trying date format: ${date}`);
    let response = await notion.databases.query({
      database_id: NOTION_DATABASE_ID,
      filter: {
        property: 'Date',
        date: {
          equals: date
        }
      }
    });
    
    if (response.results.length > 0) {
      console.log(`Found ${response.results.length} results with date ${date}`);
      return response;
    }
    
    // If no results, try with slash format
    console.log(`No results with date ${date}, trying ${dateSlash}`);
    response = await notion.databases.query({
      database_id: NOTION_DATABASE_ID,
      filter: {
        property: 'Date',
        date: {
          equals: dateSlash
        }
      }
    });
    
    console.log(`Found ${response.results.length} results with date ${dateSlash}`);
    
    // If still nothing, try without any date filter to debug
    if (response.results.length === 0) {
      console.log('No results with either date format, checking database structure...');
      const dbResponse = await notion.databases.retrieve({ database_id: NOTION_DATABASE_ID });
      console.log('Database properties:', Object.keys(dbResponse.properties));
      
      // Try to find the actual date property name
      const dateProperty = Object.keys(dbResponse.properties).find(key => 
        dbResponse.properties[key].type === 'date'
      );
      
      if (dateProperty && dateProperty !== 'Date') {
        console.log(`Found date property with name: ${dateProperty}, trying query with this name...`);
        response = await notion.databases.query({
          database_id: NOTION_DATABASE_ID,
          filter: {
            property: dateProperty,
            date: {
              equals: date
            }
          }
        });
        console.log(`Found ${response.results.length} results using property name ${dateProperty}`);
      } else {
        // Get a sample of entries to diagnose
        console.log('Fetching a few entries to diagnose database structure...');
        const sampleResponse = await notion.databases.query({
          database_id: NOTION_DATABASE_ID,
          page_size: 3
        });
        
        if (sampleResponse.results.length > 0) {
          console.log('Sample entry properties:', Object.keys(sampleResponse.results[0].properties));
          // Look for any properties that might contain dates
          const firstEntry = sampleResponse.results[0];
          for (const [key, value] of Object.entries(firstEntry.properties)) {
            console.log(`Property ${key} has type ${value.type}`);
          }
        }
      }
    }
    
    return response;
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
  
  // Try different speaker formatting patterns
  const patterns = [
    /\*\*(.*?):\*\*/g,  // **Speaker:**
    /(.*?):/g           // Speaker:
  ];
  
  let parts = [];
  let pattern = null;
  
  // Try each pattern until we find one that works
  for (const p of patterns) {
    parts = content.split(p);
    if (parts.length > 1) {
      pattern = p;
      console.log(`Using pattern: ${pattern}`);
      break;
    }
  }
  
  if (parts.length <= 1) {
    console.log('Could not identify dialog pattern in content');
    console.log('Content:', content);
    return DEFAULT_DIALOG;
  }
  
  // Skip the first part if it's empty (content starts with a speaker)
  let startIndex = parts[0].trim() === '' ? 1 : 0;
  
  // Track speakers we've seen to assign consistent A/B values
  const speakerAssignments = {};
  let speakerCount = 0;
  
  // Support for different speaker formats (A:, Alex:, etc.)
  const speakerMap = {
    'a': 'A',
    'b': 'B',
    'alex': 'A',
    'taylor': 'A',
    'casey': 'B',
    'morgan': 'B',
    'jake': 'B',
    'jason': 'B'
  };
  
  // Process pairs of speaker and text
  for (let i = startIndex; i < parts.length; i += 2) {
    // Get the speaker and clean it up
    let speaker = parts[i].trim();
    
    // Remove extra formatting if present
    speaker = speaker.replace(/^\*|\*$/g, '').trim();
    
    // Get the corresponding text
    const text = parts[i + 1]?.trim() || '';
    
    if (!speaker || !text) continue;
    
    // Try to map the speaker to A or B
    let speakerKey = speaker.toLowerCase();
    
    // Handle formats like "A:" or "A" directly
    if (speakerKey === 'a' || speakerKey === 'b') {
      speakerKey = speakerKey.toUpperCase();
    } else {
      // For actual names, check our map or assign dynamically
      if (!speakerAssignments[speakerKey]) {
        if (speakerMap[speakerKey]) {
          // Use predefined mapping
          speakerAssignments[speakerKey] = speakerMap[speakerKey];
        } else {
          // Assign dynamically
          speakerAssignments[speakerKey] = speakerCount === 0 ? 'A' : 'B';
          speakerCount++;
        }
      }
    }
    
    const speakerType = speakerKey === 'a' || speakerKey === 'b' 
      ? speakerKey 
      : speakerAssignments[speakerKey] || 'A';
    
    // Get character config or create default
    let characterConfig;
    if (speakerType === 'A') {
      characterConfig = CHARACTER_MAP['Alex'] || {
        speaker: 'A',
        imageDefault: '/assets/images/rpg/banker.png',
        imageNervous: '/assets/images/rpg/banker_nervous.png'
      };
    } else {
      characterConfig = CHARACTER_MAP['Morgan'] || {
        speaker: 'B',
        imageDefault: '/assets/images/rpg/wiseman.png',
        imageCalm: '/assets/images/rpg/banker.png'
      };
    }
    
    // Ensure the speaker value is correctly assigned
    characterConfig.speaker = speakerType;
    
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
  
  console.log(`Successfully parsed ${dialogItems.length} dialog items`);
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
