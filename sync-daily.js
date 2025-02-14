// sync-daily.js
require('dotenv').config();
const { Client } = require('@notionhq/client');
const fs = require('fs').promises;
const path = require('path');

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

    return {
        title: getPropertyValue(page.properties.Title, 'title'),
        status: getPropertyValue(page.properties.Status, 'select'),
        // Market data from Yahoo Finance
        marketData,
        // Content
        north_america_content: getPropertyValue(page.properties.North_America_Content),
        europe_content: getPropertyValue(page.properties.Europe_Content),
        asia_content: getPropertyValue(page.properties.Asia_Content),
        tech_content: getPropertyValue(page.properties.Tech_Content),
        macro_data: getPropertyValue(page.properties.Macro_Data)
    };
}

function generateMarketHtml(data) {
    const getMarketClass = (value) => {
        return value.includes('+') ? 'up' : 'down';
    };

    const { us: usMarkets, europe: europeMarkets, asia: asiaMarkets } = data.marketData;

    const macroItems = data.macro_data.split('\n').filter(item => item.trim() !== '');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Daily Market Wrap-up - CF Ng's Non Financial Advice</title>
    <link rel="stylesheet" href="/assets/css/main.css">
    <link rel="stylesheet" href="/assets/css/components.css">
    <style>
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }
        .date-header {
            color: #666;
            margin-bottom: 2rem;
        }
        .quick-overview {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 1rem;
            margin-bottom: 2rem;
        }
        .overview-card {
            background-color: #f0f7ff;
            padding: 1rem;
            border-radius: 0.5rem;
        }
        .market-value {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .up { color: #22c55e; }
        .down { color: #ef4444; }
        .market-section {
            background: white;
            padding: 1.5rem;
            border-radius: 0.5rem;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            margin-bottom: 2rem;
        }
        .market-section h2 {
            font-size: 1.5rem;
            font-weight: bold;
            margin-bottom: 1rem;
            color: #1a1a1a;
        }
        .market-content {
            color: #4a4a4a;
            line-height: 1.6;
        }
        .macro-list {
            list-style: none;
            padding: 0;
        }
        .macro-item {
            display: flex;
            align-items: center;
            padding: 0.5rem 0;
        }
        .macro-item::before {
            content: "→";
            margin-right: 0.5rem;
            color: #3b82f6;
        }
        @media (max-width: 768px) {
            .quick-overview {
                grid-template-columns: 1fr;
            }
            .container {
                padding: 1rem;
            }
        }
    </style>
</head>
<body>
    <div id="header"></div>
    
    <main>
        <div class="container">
            <h1>Daily Market Wrap-up</h1>
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
                    <h3>US Markets</h3>
                    ${usMarkets.map(market => `
                        <div class="market-value ${market.class}">
                            ${market.index}: ${market.value}
                        </div>
                    `).join('')}
                </div>
                
                <div class="overview-card">
                    <h3>European Markets</h3>
                    ${europeMarkets.map(market => `
                        <div class="market-value ${market.class}">
                            ${market.index}: ${market.value}
                        </div>
                    `).join('')}
                </div>

                <div class="overview-card">
                    <h3>Asian Markets</h3>
                    ${asiaMarkets.map(market => `
                        <div class="market-value ${market.class}">
                            ${market.index}: ${market.value}
                        </div>
                    `).join('')}
                </div>
            </div>

            <section class="market-section">
                <h2>North America Market</h2>
                <div class="market-content">
                    ${data.north_america_content}
                </div>
            </section>

            <section class="market-section">
                <h2>Europe Market</h2>
                <div class="market-content">
                    ${data.europe_content}
                </div>
            </section>

            <section class="market-section">
                <h2>Asia Market</h2>
                <div class="market-content">
                    ${data.asia_content}
                </div>
            </section>

            <section class="market-section">
                <h2>Technology Sector</h2>
                <div class="market-content">
                    ${data.tech_content}
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
        // Load header and footer components
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

const { getMarketData } = require('./market-data');

async function syncDailyMarket() {
    try {
        console.log('Starting Daily Market sync...');
        
        // Fetch market data from Yahoo Finance
        console.log('Fetching market data...');
        const marketData = await getMarketData();
        
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
            page_size: 1 // We only need the latest entry
        });
        
        if (response.results.length === 0) {
            console.log('No published daily market update found');
            return;
        }

        // Debug log
        console.log('Notion API Response:', JSON.stringify(response.results[0], null, 2));
        
        const pageData = await processMarketData(response.results[0], marketData);
        const htmlContent = generateMarketHtml(marketData);
        
        // Ensure pages directory exists
        const pagesDir = path.join(process.cwd(), 'pages');
        await fs.mkdir(pagesDir, { recursive: true });
        
        // Save the file in pages directory
        await fs.writeFile(
            path.join(pagesDir, 'daily.html'),
            htmlContent,
            'utf8'
        );
        
        console.log('Daily market sync completed successfully!');
        
    } catch (error) {
        console.error('Daily market sync failed:', error);
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
