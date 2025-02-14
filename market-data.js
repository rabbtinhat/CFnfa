// market-data.js
const https = require('https');

const MARKET_SYMBOLS = {
    us: [
        { symbol: '^GSPC', name: 'S&P 500' },
        { symbol: '^IXIC', name: 'NASDAQ' },
        { symbol: '^GSPTSE', name: 'TSX' }
    ],
    europe: [
        { symbol: '^FTSE', name: 'FTSE 100' },
        { symbol: '^GDAXI', name: 'DAX' },
        { symbol: '^FCHI', name: 'CAC 40' }
    ],
    asia: [
        { symbol: '^N225', name: 'Nikkei 225' },
        { symbol: '000001.SS', name: 'SSE' },
        { symbol: '^HSI', name: 'HSI' }
    ]
};

function fetchYahooFinanceData(symbol) {
    return new Promise((resolve, reject) => {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d`;
        
        https.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    const result = response.chart.result[0];
                    
                    if (!result) {
                        reject(new Error(`No data found for ${symbol}`));
                        return;
                    }
                    
                    const quote = result.indicators.quote[0];
                    const close = quote.close[quote.close.length - 1];
                    const previousClose = quote.close[quote.close.length - 2];
                    
                    const percentChange = ((close - previousClose) / previousClose) * 100;
                    
                    resolve({
                        price: close.toFixed(2),
                        change: percentChange.toFixed(2)
                    });
                } catch (error) {
                    reject(error);
                }
            });
        }).on('error', reject);
    });
}

async function getMarketData() {
    const marketData = {
        us: [],
        europe: [],
        asia: []
    };

    for (const [region, symbols] of Object.entries(MARKET_SYMBOLS)) {
        for (const { symbol, name } of symbols) {
            try {
                const data = await fetchYahooFinanceData(symbol);
                const changePrefix = parseFloat(data.change) >= 0 ? '+' : '';
                marketData[region].push({
                    name,
                    value: `${data.price} ${changePrefix}${data.change}%`
                });
            } catch (error) {
                console.error(`Error fetching data for ${symbol}:`, error);
                marketData[region].push({
                    name,
                    value: 'Data unavailable'
                });
            }
        }
    }

    return marketData;
}

module.exports = {
    getMarketData
};
