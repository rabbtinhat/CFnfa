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
        
        console.log('Querying Notion database...');
        const response = await notion.databases.query({
            database_id: process.env.NOTION_DAILY_DATABASE_ID,
            filter: {
                property: 'Status',
                select: {
                    equals: 'Published'
                }
            },
            sorts: [
                {
                    property: 'Title',
                    direction: 'descending',
                }
            ],
            page_size: 1
        });
        
        if (response.results.length === 0) {
            console.log('No published daily market update found');
            return;
        }

        console.log('Found latest published entry in Notion');
        
        const pageData = await processMarketData(response.results[0], marketData);
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
