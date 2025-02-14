// sync-daily.js
require('dotenv').config();
const { Client } = require('@notionhq/client');
const fs = require('fs').promises;
const path = require('path');

// Initialize Notion client
const notion = new Client({
    auth: process.env.NOTION_TOKEN
});

async function processMarketData(page) {
    return {
        title: page.properties.Title.title[0]?.plain_text || 'Untitled',
        status: page.properties.Status.select?.name || 'Draft',
        // US Markets
        us_sp500: page.properties.US_SP500.rich_text[0]?.plain_text || '',
        us_nasdaq: page.properties.US_NASDAQ.rich_text[0]?.plain_text || '',
        us_tsx: page.properties.US_TSX.rich_text[0]?.plain_text || '',
        // European Markets
        eu_ftse: page.properties.EU_FTSE.rich_text[0]?.plain_text || '',
        eu_dax: page.properties.EU_DAX.rich_text[0]?.plain_text || '',
        eu_cac: page.properties.EU_CAC.rich_text[0]?.plain_text || '',
        // Asian Markets
        asia_nikkei: page.properties.ASIA_NIKKEI.rich_text[0]?.plain_text || '',
        asia_sse: page.properties.ASIA_SSE.rich_text[0]?.plain_text || '',
        asia_hsi: page.properties.ASIA_HSI.rich_text[0]?.plain_text || '',
        tech_sector: page.properties.Tech_Sector.rich_text[0]?.plain_text || '',
        macro_data: page.properties.Macro_Data.rich_text[0]?.plain_text || '',
        north_america_content: page.properties.North_America_Content.rich_text[0]?.plain_text || '',
        europe_content: page.properties.Europe_Content.rich_text[0]?.plain_text || '',
        asia_content: page.properties.Asia_Content.rich_text[0]?.plain_text || '',
        tech_content: page.properties.Tech_Content.rich_text[0]?.plain_text || ''
    };
}

function generateMarketHtml(data) {
    const getMarketClass = (value) => {
        return value.includes('+') ? 'up' : 'down';
    };

    const usMarkets = [
        { index: 'S&P 500', value: data.us_sp500, class: getMarketClass(data.us_sp500) },
        { index: 'NASDAQ', value: data.us_nasdaq, class: getMarketClass(data.us_nasdaq) },
        { index: 'TSX', value: data.us_tsx, class: getMarketClass(data.us_tsx) }
    ];

    const europeMarkets = [
        { index: 'FTSE 100', value: data.eu_ftse, class: getMarketClass(data.eu_ftse) },
        { index: 'DAX', value: data.eu_dax, class: getMarketClass(data.eu_dax) },
        { index: 'CAC 40', value: data.eu_cac, class: getMarketClass(data.eu_cac) }
    ];

    const asiaMarkets = [
        { index: 'Nikkei 225', value: data.asia_nikkei, class: getMarketClass(data.asia_nikkei) },
        { index: 'SSE', value: data.asia_sse, class: getMarketClass(data.asia_sse) },
        { index: 'HSI', value: data.asia_hsi, class: getMarketClass(data.asia_hsi) }
    ];
    const macroItems = data.macro_data.split('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Daily Market Wrap-up - CF Ng's Non Financial Advice</title>
    <link rel="stylesheet" href="/assets/css/main.css">
    <link rel="stylesheet" href="/assets/css/components.css">
    <!-- Your existing styles here -->
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
        // Your existing component loading script
    </script>
</body>
</html>`;
}

async function syncDailyMarket() {
    try {
        console.log('Starting Daily Market sync...');
        
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
        
        const marketData = await processMarketData(response.results[0]);
        const htmlContent = generateMarketHtml(marketData);
        
        // Save the file
        await fs.writeFile(
            path.join(process.cwd(), 'daily.html'),
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
