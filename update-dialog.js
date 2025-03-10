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

// Character configurations - simple and fixed
const CHARACTER_CONFIG = {
  "A": {
    speaker: "A",
    imageDefault: "/assets/images/rpg/banker.png",
    imageNervous: "/assets/images/rpg/banker_nervous.png"
  },
  "B": {
    speaker: "B", 
    imageDefault: "/assets/images/rpg/wiseman.png",
    imageCalm: "/assets/images/rpg/wiseman_happy.png"
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
  },
  { 
    speaker: "A", 
    text: "Uh… okay?",
    image: "/assets/images/rpg/banker.png"
  },
  { 
    speaker: "B", 
    text: "From then on, he only painted with his feet. He became famous, made millions, and even got invited to give a TED Talk.",
    image: "/assets/images/rpg/wiseman.png"
  }
];

// Initialize Notion client
const notion = new Client({ auth: NOTION_KEY });

/**
 * Main function to update dialog
 */
async function updateDialog() {
  try {
    console.log('Starting dialog update process...');
    console.log('Script version: 2.0.0 (Simplified)');
    console.log('Using dialog.json path:', DIALOG_JSON_PATH);
    console.log('Using Notion database ID:', NOTION_DATABASE_ID);
    
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    
    // Check for date override from command line argument
    const dateArg = process.argv.find(arg => arg.startsWith('--date='));
    let targetDate = dateArg ? dateArg.split('=')[1] : today;
    
    // Normalize date format
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
    
    // Get the first matching entry
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
      console.log('Using default dialog content');
      await saveDialogJson(DEFAULT_DIALOG);
      return;
    }
    
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
  console.log(`Querying Notion database for date ${date}`);
  
  try {
    // Try to query with the specified date
    const response = await notion.databases.query({
      database_id: NOTION_DATABASE_ID,
      filter: {
        property: 'Date',
        date: {
          equals: date
        }
      }
    });
    
    console.log(`Found ${response.results.length} results for date ${date}`);
    return response;
  } catch (error) {
    console.error('Error querying Notion database:', error);
    throw error;
  }
}

/**
 * Simple dialog parser that alternates between speaker A and B
 */
function parseRawContentToDialog(content) {
  console.log('Parsing dialog content...');
  console.log('Content preview:', content.substring(0, 200) + '...');
  
  const dialogItems = [];
  
  // Use a simple approach: Split by "Alex:" and "Morgan:"
  // First, normalize all names to either Alex or Morgan
  let normalizedContent = content.replace(/\*\*Alex\*\*:/g, "Alex:");
  normalizedContent = normalizedContent.replace(/\*\*Morgan\*\*:/g, "Morgan:");
  
  // Also normalize A: and B: to Alex: and Morgan:
  normalizedContent = normalizedContent.replace(/A:/g, "Alex:");
  normalizedContent = normalizedContent.replace(/B:/g, "Morgan:");
  
  // Also normalize Taylor: to Alex: and Jordan: to Morgan:
  normalizedContent = normalizedContent.replace(/Taylor:/g, "Alex:");
  normalizedContent = normalizedContent.replace(/Jordan:/g, "Morgan:");
  
  // Split by Alex: and Morgan:
  const parts = normalizedContent.split(/(?:Alex:|Morgan:)/g);
  
  // The first part is likely empty
  if (parts[0].trim() === '') {
    parts.shift();
  }
  
  // Count how many "Alex:" and "Morgan:" there are in the content
  const alexCount = (normalizedContent.match(/Alex:/g) || []).length;
  const morganCount = (normalizedContent.match(/Morgan:/g) || []).length;
  
  console.log(`Detected ${alexCount} Alex parts and ${morganCount} Morgan parts`);
  
  // Determine speaker pattern
  const speakerPattern = [];
  let alexIndex = normalizedContent.indexOf("Alex:");
  let morganIndex = normalizedContent.indexOf("Morgan:");
  
  // Figure out who speaks first
  let firstSpeaker = (alexIndex !== -1 && (morganIndex === -1 || alexIndex < morganIndex)) ? "Alex" : "Morgan";
  
  console.log(`First speaker is ${firstSpeaker}`);
  
  // Re-scan the content to get the exact speaker sequence
  let currentPos = 0;
  const speakerPositions = [];
  
  while (true) {
    const nextAlex = normalizedContent.indexOf("Alex:", currentPos);
    const nextMorgan = normalizedContent.indexOf("Morgan:", currentPos);
    
    // If neither is found, we're done
    if (nextAlex === -1 && nextMorgan === -1) break;
    
    // If one is not found, use the other
    if (nextAlex === -1) {
      speakerPositions.push({ pos: nextMorgan, speaker: "Morgan" });
      currentPos = nextMorgan + 7; // Length of "Morgan:"
      continue;
    }
    
    if (nextMorgan === -1) {
      speakerPositions.push({ pos: nextAlex, speaker: "Alex" });
      currentPos = nextAlex + 5; // Length of "Alex:"
      continue;
    }
    
    // Both found, use the earlier one
    if (nextAlex < nextMorgan) {
      speakerPositions.push({ pos: nextAlex, speaker: "Alex" });
      currentPos = nextAlex + 5;
    } else {
      speakerPositions.push({ pos: nextMorgan, speaker: "Morgan" });
      currentPos = nextMorgan + 7;
    }
  }
  
  console.log(`Found ${speakerPositions.length} speakers in sequence`);
  
  // Now we have positions and speakers, extract the text
  for (let i = 0; i < speakerPositions.length; i++) {
    const current = speakerPositions[i];
    let endPos = normalizedContent.length;
    
    // If there's a next speaker, use their position as the end
    if (i < speakerPositions.length - 1) {
      endPos = speakerPositions[i+1].pos;
    }
    
    // Extract text and remove the speaker prefix
    let startPos = current.pos;
    if (current.speaker === "Alex") {
      startPos += 5; // Length of "Alex:"
    } else {
      startPos += 7; // Length of "Morgan:"
    }
    
    const text = normalizedContent.substring(startPos, endPos).trim();
    
    // Map Alex to A, Morgan to B
    const speakerType = current.speaker === "Alex" ? "A" : "B";
    const config = CHARACTER_CONFIG[speakerType];
    
    // Determine which image to use
    let image = config.imageDefault;
    
    if (speakerType === "A") {
      // Check for nervous keywords
      const nervousKeywords = ['worried', 'nervous', 'concerned', 'lost', 'unsure', 
                              'confused', 'what', 'down', 'trying', 'completely'];
      if (nervousKeywords.some(keyword => text.toLowerCase().includes(keyword))) {
        image = config.imageNervous;
      }
    } else if (speakerType === "B") {
      // Check for calm keywords
      const calmKeywords = ['simple', 'clear', 'moral', 'certainly', 'absolutely'];
      if (calmKeywords.some(keyword => text.toLowerCase().includes(keyword))) {
        image = config.imageCalm;
      }
    }
    
    // Add dialog item if text is not empty
    if (text.trim() !== '') {
      dialogItems.push({
        speaker: speakerType,
        text: text,
        image: image
      });
      
      console.log(`Dialog item ${i+1}: Speaker ${speakerType} (${current.speaker}), Image: ${image.split('/').pop()}`);
    }
  }
  
  if (dialogItems.length === 0) {
    console.log('No valid dialog items extracted. Using default dialog.');
    return DEFAULT_DIALOG;
  }
  
  console.log(`Successfully parsed ${dialogItems.length} dialog items`);
  return dialogItems;
}

/**
 * Save the dialog content to the JSON file
 */
async function saveDialogJson(dialogContent) {
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
