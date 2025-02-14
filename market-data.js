// market-data.js
const https = require('https');

const MARKET_SYMBOLS = {
    us: [
        { symbol: '^GSPC', name: 'S&P 500' },  // S&P 500
        { symbol: '^IXIC', name: 'NASDAQ' },   // NASDAQ
        { symbol: '^GSPTSE', name: 'TSX' }     // Toronto Stock Exchange
    ],
    europe: [
        { symbol: '^FTSE', name: 'FTSE 100' }, // FTSE 100
        { symbol: '^GDAXI', name: 'DAX' },     // German DAX
        { symbol: '^FCHI', name: 'CAC 40' }    // French CAC 40
    ],
    asia: [
        { symbol: '^N225', name: 'Nikkei 225' },  // Japanese Nikkei
        { symbol: '000001.SS', name: 'SSE' },     // Shanghai Composite
        { symbol: '^HSI', name: 'HSI' }           // Hang Seng Index
    ]
};

function fetchYahooFinanceData(symbol) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'query1.finance.yahoo.com',
            path: `/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (!response.chart?.result?.[0]) {
                        throw new Error('Invalid response format');
                    }

                    const result = response.chart.result[0];
                    const quotes = result.indicators.quote[0];
                    const prices = result.meta;
                    
                    // Get current and previous close
                    const currentClose = quotes.close[quotes.close.length - 1];
                    const previousClose = quotes.close[quotes.close.length - 2];
                    
                    // Calculate percentage change
                    const percentChange = ((currentClose - previousClose) / previousClose) * 100;
                    
                    resolve({
                        price: currentClose.toFixed(2),
                        change: percentChange.toFixed(2)
                    });
                } catch (error) {
                    console.error(`Error processing ${symbol}:`, error.message);
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            console.error(`Network error for ${symbol}:`, error.message);
            reject(error);
        });

        // Set timeout
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error(`Timeout for ${symbol}`));
        });

        req.end();
    });
}

async function getMarketData() {
    console.log('Starting market data fetch...');
    const marketData = {
        us: [],
        europe: [],
        asia: []
    };

    for (const [region, symbols] of Object.entries(MARKET_SYMBOLS)) {
        console.log(`Fetching ${region} market data...`);
        for (const { symbol, name } of symbols) {
            try {
                console.log(`Fetching data for ${name} (${symbol})...`);
                const data = await fetchYahooFinanceData(symbol);
                const changePrefix = parseFloat(data.change) >= 0 ? '+' : '';
                marketData[region].push({
                    name,
                    value: `${data.price} ${changePrefix}${data.change}%`,
                    class: parseFloat(data.change) >= 0 ? 'up' : 'down'
                });
                console.log(`Successfully fetched data for ${name}: ${data.price} ${changePrefix}${data.change}%`);
                
                // Add delay between requests to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error(`Failed to fetch data for ${name}:`, error.message);
                // Add a placeholder on error
                marketData[region].push({
                    name,
                    value: 'Data unavailable',
                    class: ''
                });
            }
        }
    }

    return marketData;
}

module.exports = {
    getMarketData
};
