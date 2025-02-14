// market-data.js
const https = require('https');

const MARKET_SYMBOLS = {
    us: [
        { symbol: 'SPY', name: 'S&P 500' },
        { symbol: 'QQQ', name: 'NASDAQ' },
        { symbol: 'TSX.TO', name: 'TSX' }
    ],
    europe: [
        { symbol: 'FTSE.L', name: 'FTSE 100' },
        { symbol: 'DAX.DE', name: 'DAX' },
        { symbol: 'CAC.PA', name: 'CAC 40' }
    ],
    asia: [
        { symbol: 'N225.NK', name: 'Nikkei 225' },
        { symbol: '000001.SS', name: 'SSE' },
        { symbol: 'HSI.HK', name: 'HSI' }
    ]
};

// For development/testing, return mock data
function getMockMarketData() {
    return {
        us: [
            { name: 'S&P 500', value: '5,023.45 +0.57%', class: 'up' },
            { name: 'NASDAQ', value: '15,990.30 +0.95%', class: 'up' },
            { name: 'TSX', value: '21,243.12 +0.31%', class: 'up' }
        ],
        europe: [
            { name: 'FTSE 100', value: '7,595.23 -0.15%', class: 'down' },
            { name: 'DAX', value: '17,047.45 +0.42%', class: 'up' },
            { name: 'CAC 40', value: '7,768.55 +0.68%', class: 'up' }
        ],
        asia: [
            { name: 'Nikkei 225', value: '38,157.94 +1.21%', class: 'up' },
            { name: 'SSE', value: '2,865.90 -0.42%', class: 'down' },
            { name: 'HSI', value: '15,878.07 -0.83%', class: 'down' }
        ]
    };
}

async function getMarketData() {
    console.log('Getting market data...');
    // For now, return mock data to ensure the rest of the system works
    // We can implement the actual API calls later
    return getMockMarketData();
}

module.exports = {
    getMarketData
};
