// sync-daily.js
require('dotenv').config();
const { Client } = require('@notionhq/client');
const fs = require('fs').promises;
const path = require('path');

// Initialize Notion client
const notion = new Client({
    auth: process.env.NOTION_TOKEN
});

const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_KEY;

const MARKET_INDICES = {
    // US Markets
    'SPX': { name: 'S&P 500', market: 'us' },
    'IXIC': { name: 'NASDAQ', market: 'us' },
    'TSX': { name: 'TSX', market: 'us' },
    // European Markets
    'FTSE': { name: 'FTSE 100', market: 'eu' },
    'DAX': { name: 'DAX', market: 'eu' },
    'FCHI': { name: 'CAC 40', market: 'eu' },
    // Asian Markets
    'N225': { name: 'Nikkei 225', market: 'asia' },
    'SSE': { name: 'SSE', market: 'asia' },
    'HSI': { name: 'HSI', market: 'asia' }
};

async function fetchSingleIndex(symbol) {
    try {
        const response = await fetch(
            `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`
        );
        const data = await response.json();
        
        if (data['Global Quote']) {
            const quote = data['Global Quote'];
            return {
                price: parseFloat(quote['05. price']).toFixed(2),
                change: parseFloat(quote['10. change percent']).toFixed(2),
                direction: parseFloat(quote['10. change percent']) >= 0 ? '+' : ''
            };
        }
        return null;
    } catch (error) {
        console.error(`Error fetching data for ${symbol}:`, error);
        return null;
    }
}

async function fetchMarketData() {
    try {
        console.log('Fetching market data...');
        const marketData = {};
        
        // Alpha Vantage has a rate limit, so we need to fetch sequentially
        for (const [symbol, details] of Object.entries(MARKET_INDICES)) {
            console.log(`Fetching data for ${symbol}...`);
            const quoteData = await fetchSingleIndex(symbol);
            
            if (quoteData) {
                marketData[symbol] = {
                    name: details.name,
                    market: details.market,
                    price: quoteData.price,
                    change: quoteData.change,
                    direction: quoteData.direction
                };
            }
            
            // Add a small delay to respect rate limits
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
        
        console.log('Processed market data:', JSON.stringify(marketData, null, 2));
        return marketData;
    } catch (error) {
        console.error('Error fetching market data:', error);
        return {};
    }
}

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

async function processNotionData(page) {
    return {
        title: getPropertyValue(page.properties.Title, 'title'),
        status: getPropertyValue(page.properties.Status, 'select'),
        north_america_content: getPropertyValue(page.properties.North_America_Content),
        europe_content: getPropertyValue(page.properties.Europe_Content),
        asia_content: getPropertyValue(page.properties.Asia_Content),
        tech_content: getPropertyValue(page.properties.Tech_Content),
        macro_data: getPropertyValue(page.properties.Macro_Data)
    };
}

function generateMarketHtml(data) {
    const formatMarketData = (symbol, marketData) => {
        const indexData = marketData[symbol];
        if (!indexData) return { index: MARKET_INDICES[symbol].name, value: 'N/A', class: '' };
        return {
            index: indexData.name,
            value: `${indexData.price} ${indexData.direction}${indexData.change}%`,
            class: parseFloat(indexData.change) >= 0 ? 'up' : 'down'
        };
    };

    const usMarkets = [
        formatMarketData('SPX', data.marketData),
        formatMarketData('IXIC', data.marketData),
        formatMarketData('TSX', data.marketData)
    ];

    const europeMarkets = [
        formatMarketData('FTSE', data.marketData),
        formatMarketData('DAX', data.marketData),
        formatMarketData('FCHI', data.marketData)
    ];

    const asiaMarkets = [
        formatMarketData('N225', data.marketData),
        formatMarketData('SSE', data.marketData),
        formatMarketData('HSI', data.marketData)
    ];

    // Rest of the HTML generation code remains the same...
    // [Previous HTML template code here]
}

async function syncDailyMarket() {
    try {
        console.log('Starting Daily Market sync...');
        
        // Fetch market data
        console.log('Fetching market data...');
        const marketData = await fetchMarketData();
        
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

        console.log('Notion API Response:', JSON.stringify(response.results[0], null, 2));
        
        const notionData = await processNotionData(response.results[0]);
        
        // Generate HTML with combined data
        const finalHtml = generateMarketHtml({ 
            marketData,
            notionData
        });
        
        // Ensure pages directory exists
        const pagesDir = path.join(process.cwd(), 'pages');
        await fs.mkdir(pagesDir, { recursive: true });
        
        // Save the file in pages directory
        await fs.writeFile(
            path.join(pagesDir, 'daily.html'),
            finalHtml,
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
