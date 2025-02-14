// market-data.js
const https = require('https');

const MARKET_SYMBOLS = {
    us: [
        { symbol: 'SPY', name: 'S&P 500' },
        { symbol: 'QQQ', name: 'NASDAQ' },
        { symbol: 'XIC.TO', name: 'TSX' }
    ],
    europe: [
        { symbol: 'EZU', name: 'FTSE 100' },  // iShares MSCI Eurozone ETF
        { symbol: 'DAX', name: 'DAX' },
        { symbol: 'CAC.PA', name: 'CAC 40' }
    ],
    asia: [
        { symbol: 'EWJ', name: 'Nikkei 225' }, // iShares MSCI Japan ETF
        { symbol: 'MCHI', name: 'SSE' },       // iShares MSCI China ETF
        { symbol: 'EWH', name: 'HSI' }         // iShares MSCI Hong Kong ETF
    ]
};

function fetchAlphaVantageData(symbol) {
    return new Promise((resolve, reject) => {
        const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
        if (!apiKey) {
            console.error('Alpha Vantage API key not found');
            return resolve({
                price: '0.00',
                change: '0.00'
            });
        }

        const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`;
        console.log(`Fetching data for ${symbol}...`);

        https.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    const quote = response['Global Quote'];
                    
                    if (!quote || !quote['05. price'] || !quote['10. change percent']) {
                        console.error(`Invalid response format for ${symbol}:`, data);
                        resolve({
                            price: '0.00',
                            change: '0.00'
                        });
                        return;
                    }
                    
                    const price = parseFloat(quote['05. price']);
                    const changePercent = quote['10. change percent'].replace('%', '');
                    
                    resolve({
                        price: price.toFixed(2),
                        change: parseFloat(changePercent).toFixed(2)
                    });
                } catch (error) {
                    console.error(`Error processing data for ${symbol}:`, error);
                    resolve({
                        price: '0.00',
                        change: '0.00'
                    });
                }
            });
        }).on('error', (error) => {
            console.error(`Network error for ${symbol}:`, error);
            resolve({
                price: '0.00',
                change: '0.00'
            });
        });
    });
}

async function getMarketData() {
    console.log('Starting market data fetch...');
    const marketData = {
        us: [],
        europe: [],
        asia: []
    };

    try {
        for (const [region, symbols] of Object.entries(MARKET_SYMBOLS)) {
            console.log(`Fetching ${region} market data...`);
            for (const { symbol, name } of symbols) {
                try {
                    const data = await fetchAlphaVantageData(symbol);
                    const changePrefix = parseFloat(data.change) >= 0 ? '+' : '';
                    marketData[region].push({
                        name,
                        value: `${data.price} ${changePrefix}${data.change}%`,
                        class: parseFloat(data.change) >= 0 ? 'up' : 'down'
                    });
                    console.log(`Successfully fetched data for ${name}: ${data.price} ${changePrefix}${data.change}%`);
                    
                    // Add delay between requests to respect API rate limits
                    await new Promise(resolve => setTimeout(resolve, 1500));
                } catch (error) {
                    console.error(`Error fetching data for ${symbol}:`, error);
                    marketData[region].push({
                        name,
                        value: 'Data unavailable',
                        class: ''
                    });
                }
            }
        }
    } catch (error) {
        console.error('Error in getMarketData:', error);
    }

    console.log('Market data fetch completed:', JSON.stringify(marketData, null, 2));
    return marketData;
}

module.exports = {
    getMarketData
};
