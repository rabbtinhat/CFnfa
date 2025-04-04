// sync-daily.js
require('dotenv').config();
const { Client } = require('@notionhq/client');
const fs = require('fs').promises;
const path = require('path');
const { getMarketData } = require('./MarketApp');

// Initialize Notion client
const notion = new Client({
    auth: process.env.NOTION_TOKEN
});

function getPropertyValue(property, type = 'rich_text') {
    if (!property) return '';
    
    switch (type) {
        case 'title':
            return property.title?.[0]?.plain_text || '';
        case 'rich_text':
            return property.rich_text?.[0]?.plain_text || '';
        case 'select':
            return property.select?.name || '';
        default:
            return '';
    }
}

async function processMarketData(page, marketData) {
    // Debug log
    console.log('Processing page with properties:', JSON.stringify(page.properties, null, 2));
    console.log('Market data:', JSON.stringify(marketData, null, 2));

    const processed = {
        title: getPropertyValue(page.properties.Title, 'title'),
        status: getPropertyValue(page.properties.Status, 'select'),
        marketData: marketData,
        northAmericaContent: getPropertyValue(page.properties.North_America_Content),
        europeContent: getPropertyValue(page.properties.Europe_Content),
        asiaContent: getPropertyValue(page.properties.Asia_Content),
        techContent: getPropertyValue(page.properties.Tech_Content),
        cryptoContent: getPropertyValue(page.properties.Crypto_Content),
        macroData: getPropertyValue(page.properties.Macro_Data)
    };

    console.log('Processed data:', JSON.stringify(processed, null, 2));
    return processed;
}

function generateMarketHtml(data) {
    console.log('Generating HTML with data:', JSON.stringify(data, null, 2));

    const { us = [], europe = [], asia = [] } = data.marketData || {};
    const macroItems = data.macroData.split('\n').filter(item => item.trim() !== '');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Daily Equity Market Wrap-up - CF's Non Financial Advice</title>
    <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/assets/css/main.css">
    <link rel="stylesheet" href="/assets/css/components.css">
    <link rel="stylesheet" href="/assets/css/consolidated-cyberpunk.css">
    <link rel="stylesheet" href="/assets/css/daily-specific-styles.css">
</head>
<body>
    <div id="header"></div>
    
    <main>
        <div class="container">
            <h1 class="page-title">Daily Equity Market Wrap-up</h1>
            <div class="date-header">
                ${new Date().toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                })}
            </div>

            <div class="quick-overview">
                <div class="overview-card">
                    <h3>North America Markets</h3>
                    ${us.map(market => `
                        <div class="market-value ${market.class}">
                            ${market.name}: ${market.value}
                        </div>
                    `).join('')}
                </div>
                
                <div class="overview-card">
                    <h3>Europe Markets</h3>
                    ${europe.map(market => `
                        <div class="market-value ${market.class}">
                            ${market.name}: ${market.value}
                        </div>
                    `).join('')}
                </div>

                <div class="overview-card">
                    <h3>Asia Markets</h3>
                    ${asia.map(market => `
                        <div class="market-value ${market.class}">
                            ${market.name}: ${market.value}
                        </div>
                    `).join('')}
                </div>
            </div>

            <section class="market-section">
                <h2>North America Market</h2>
                <div class="market-content">
                    ${data.northAmericaContent}
                </div>
            </section>

            <section class="market-section">
                <h2>Europe Market</h2>
                <div class="market-content">
                    ${data.europeContent}
                </div>
            </section>

            <section class="market-section">
                <h2>Asia Market</h2>
                <div class="market-content">
                    ${data.asiaContent}
                </div>
            </section>

            <section class="market-section">
                <h2>Technology Sector</h2>
                <div class="market-content">
                    ${data.techContent}
                </div>
            </section>

            <section class="market-section">
                <h2>Crypto</h2>
                <div class="market-content">
                    ${data.cryptoContent}
                </div>
            </section>

            <section class="market-section">
                <h2>Upcoming Macro Data</h2>
                <ul class="macro-list">
                    ${macroItems.map(item => `
                        <li class="macro-item">${item}</li>
                    `).join('')}
                </ul>
            </section>
            
        </div>
    </main>

    <div id="footer"></div>

    <script>
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

async function syncDailyMarket() {
    try {
        console.log('Starting Daily Market sync...');
        
        // Fetch market data from Yahoo Finance
        console.log('Fetching market data...');
        const marketData = await getMarketData();
        console.log('Market data fetched:', JSON.stringify(marketData, null, 2));
        
        // Format today's date exactly as it appears in your Notion titles
        const today = new Date();
        // Note: Using en-US locale to match "Apr 03, 2025" format exactly
        const formattedToday = today.toLocaleDateString('en-US', {
            month: 'short',  // "Apr"
            day: '2-digit',  // "03"
            year: 'numeric'  // "2025"
        });
        
        console.log(`Looking for entries with today's date: "${formattedToday}"`);
        
        // Get all published entries
        console.log('Querying Notion database...');
        const response = await notion.databases.query({
            database_id: process.env.NOTION_DAILY_DATABASE_ID,
            filter: {
                property: 'Status',
                select: {
                    equals: 'Published'
                }
            },
            // Don't limit the sort direction to descending - get all entries
            page_size: 100 // Get more results to ensure we find today's
        });
        
        if (response.results.length === 0) {
            console.log('No published daily market updates found');
            return;
        }

        console.log(`Found ${response.results.length} published entries`);
        
        // Find entry that exactly matches today's date
        let targetPage = null;
        let latestPage = null;
        let latestDate = new Date(0); // Start with epoch time
        
        for (const page of response.results) {
            const title = getPropertyValue(page.properties.Title, 'title');
            console.log(`Checking entry: "${title}"`);
            
            // Check for exact match with today's date
            if (title === formattedToday) {
                console.log(`Found exact match for today (${formattedToday})`);
                targetPage = page;
                break;
            }
            
            // Parse date from title for comparison (as fallback)
            try {
                const pageDate = new Date(title);
                if (!isNaN(pageDate.getTime()) && pageDate > latestDate) {
                    latestDate = pageDate;
                    latestPage = page;
                    console.log(`New latest date found: ${title}`);
                }
            } catch (e) {
                console.log(`Could not parse date from title: "${title}"`);
            }
        }
        
        // If no exact match for today, use the latest date entry
        if (!targetPage && latestPage) {
            console.log('No exact match for today, using latest date entry instead');
            targetPage = latestPage;
            const title = getPropertyValue(targetPage.properties.Title, 'title');
            console.log(`Using entry with title: "${title}"`);
        } else if (!targetPage) {
            // If we couldn't find by date parsing, fall back to first result (most recent by API sort)
            console.log('Falling back to first result from query');
            targetPage = response.results[0];
            const title = getPropertyValue(targetPage.properties.Title, 'title');
            console.log(`Using entry with title: "${title}"`);
        }
        
        const pageData = await processMarketData(targetPage, marketData);
        console.log('Data processing complete');
        
        const htmlContent = generateMarketHtml(pageData);
        console.log('HTML content generated');
        
        // Ensure pages directory exists
        const pagesDir = path.join(process.cwd(), 'pages');
        console.log('Creating pages directory if it doesn\'t exist:', pagesDir);
        await fs.mkdir(pagesDir, { recursive: true });
        
        // Save the file in pages directory
        const filePath = path.join(pagesDir, 'daily.html');
        console.log('Saving file to:', filePath);
        await fs.writeFile(filePath, htmlContent, 'utf8');
        
        console.log('Daily market sync completed successfully!');
        
    } catch (error) {
        console.error('Daily market sync failed:', error);
        if (error.response) {
            console.error('API Response:', error.response.data);
        }
        throw error;
    }
}

// Run the sync
syncDailyMarket()
    .then(() => console.log('Done!'))
    .catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });
