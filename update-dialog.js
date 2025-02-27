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
  console.log('Parsing dialog content...');
  
  // Print the first 200 characters of content for debugging
  console.log('Content preview:', content.substring(0, 200) + '...');
  
  const dialogItems = [];
  
  // Try different speaker formatting patterns
  const patterns = [
    /\*\*(.*?):\*\*/g,  // **Speaker:**
    /(.*?):/g           // Speaker:
  ];
  
  // Determine which pattern to use by testing each one
  let pattern = null;
  let matches = [];
  
  for (const p of patterns) {
    const testMatches = Array.from(content.matchAll(p));
    if (testMatches.length > 0) {
      pattern = p;
      matches = testMatches;
      console.log(`Found pattern match: ${pattern}, detected ${matches.length} speakers`);
      
      // Print out the detected speakers for debugging
      console.log('Detected speakers:', matches.map(m => m[1].trim()).join(', '));
      break;
    }
  }
  
  if (!pattern || matches.length === 0) {
    console.log('Could not identify dialog pattern in content');
    return DEFAULT_DIALOG;
  }
  
  // Extract dialog parts with indexes for proper ordering
  const dialogParts = [];
  let lastIndex = 0;
  
  for (const match of matches) {
    const speakerMatch = match[0];
    const speaker = match[1].trim();
    const startPos = match.index;
    
    // Skip if this is the first match and there's text before it
    if (dialogParts.length === 0 && startPos > 0) {
      // There's content before the first speaker
      const preamble = content.substring(0, startPos).trim();
      if (preamble) {
        console.log('Ignoring preamble text:', preamble);
      }
    }
    
    // Add the previous speaker's text
    if (dialogParts.length > 0) {
      const previousPart = dialogParts[dialogParts.length - 1];
      const textEnd = startPos;
      const speakerTextStart = previousPart.matchEnd;
      const text = content.substring(speakerTextStart, textEnd).trim();
      previousPart.text = text;
    }
    
    // Add this speaker
    dialogParts.push({
      speaker: speaker,
      matchEnd: startPos + speakerMatch.length,
      text: '' // Will be filled in the next iteration or at the end
    });
    
    lastIndex = startPos + speakerMatch.length;
  }
  
  // Get text for the last speaker
  if (dialogParts.length > 0) {
    const lastPart = dialogParts[dialogParts.length - 1];
    lastPart.text = content.substring(lastPart.matchEnd).trim();
  }
  
  // Log the extracted dialog parts
  console.log(`Extracted ${dialogParts.length} dialog parts`);
  
  // Map speakers to ensure correct alternation between A and B
  let firstSpeaker = null;
  let secondSpeaker = null;
  
  // Speaker mapping
  const speakerMap = {
    'taylor': 'A',
    'alex': 'A',
    'a': 'A',
    'jordan': 'B',
    'morgan': 'B',
    'b': 'B',
    'casey': 'B',
    'jake': 'B',
    'jason': 'B'
  };
  
  // Process each dialog part
  for (const part of dialogParts) {
    // Clean speaker name and convert to lowercase for mapping
    const speakerKey = part.speaker.toLowerCase().trim();
    let speakerType;
    
    // Determine if this is speaker A or B
    if (speakerMap[speakerKey]) {
      // Use predefined mapping
      speakerType = speakerMap[speakerKey];
    } else {
      // If we don't have a mapping, assign based on first/second appearance
      if (firstSpeaker === null) {
        firstSpeaker = speakerKey;
        speakerType = 'A';
      } else if (secondSpeaker === null && speakerKey !== firstSpeaker) {
        secondSpeaker = speakerKey;
        speakerType = 'B';
      } else {
        // For subsequent appearances, check if it matches first or second speaker
        speakerType = (speakerKey === firstSpeaker) ? 'A' : 'B';
      }
    }
    
    // Get the right character config
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
    
    // Skip empty text
    if (!part.text || part.text.trim() === '') {
      console.log(`Skipping empty text for speaker ${part.speaker}`);
      continue;
    }
    
    // Determine which image to use based on text content
    let image = characterConfig.imageDefault;
    
    // Check for nervous/worried tone
    const nervousKeywords = ['worried', 'nervous', 'concerned', 'not seeing', 'what\'s the point', 
                           'confused', 'unsure', 'doubt', 'anxiety', 'stress', 'panic', 'fear',
                           'volatile', 'down', 'lost'];
    if (characterConfig.imageNervous && 
        nervousKeywords.some(keyword => part.text.toLowerCase().includes(keyword))) {
      image = characterConfig.imageNervous;
    }
    
    // Check for calm/confident tone
    const calmKeywords = ['confident', 'calm', 'relax', 'patience', 'simple', 'certainly', 
                         'absolutely', 'definitely', 'without doubt', 'obviously', 'clearly',
                         'fascinating', 'interesting'];
    if (characterConfig.imageCalm && 
        calmKeywords.some(keyword => part.text.toLowerCase().includes(keyword))) {
      image = characterConfig.imageCalm;
    }
    
    console.log(`Adding dialog: Speaker ${speakerType} (${part.speaker}) with ${image.split('/').pop()}`);
    
    // Add the dialog item
    dialogItems.push({
      speaker: characterConfig.speaker,
      text: part.text,
      image: image
    });
  }
  
  // Return the default dialog if parsing produced no valid items
  if (dialogItems.length === 0) {
    console.log('Parsing produced no valid dialog items, using default');
    return DEFAULT_DIALOG;
  }
  
  console.log(`Successfully parsed ${dialogItems.length} dialog items`);
  
  // Log a sample of the parsed dialog
  const sampleSize = Math.min(2, dialogItems.length);
  console.log(`Sample of parsed dialog (first ${sampleSize} items):`);
  for (let i = 0; i < sampleSize; i++) {
    console.log(`Item ${i+1}: Speaker ${dialogItems[i].speaker}, Image: ${dialogItems[i].image.split('/').pop()}`);
    console.log(`Text preview: ${dialogItems[i].text.substring(0, 50)}...`);
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
