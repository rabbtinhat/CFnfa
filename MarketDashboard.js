import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ChevronRight } from 'lucide-react';

const MarketDashboard = () => {
  const [marketData, setMarketData] = useState([]);
  const [historicalData, setHistoricalData] = useState([]);
  const [selectedTimeframe, setSelectedTimeframe] = useState('1D');
  const [activeTab, setActiveTab] = useState('Indices');

  useEffect(() => {
    fetchMarketData();
    fetchHistoricalData();
  }, []);

  const fetchMarketData = async () => {
    try {
      // In production, replace with actual Yahoo Finance API call
      const mockData = [
        { symbol: '^GSPC', name: 'S&P 500', price: 6114.62, change: -0.01 },
        { symbol: '^IXIC', name: 'Nasdaq', price: 22114.49, change: 0.38 },
        { symbol: '^DJI', name: 'Dow 30', price: 44546.09, change: -0.37 },
        { symbol: '^N225', name: 'Nikkei 225', price: 39149.21, change: -0.79 },
        { symbol: '^FTSE', name: 'FTSE 100', price: 8732.46, change: -0.32 }
      ];
      setMarketData(mockData);
    } catch (error) {
      console.error('Error fetching market data:', error);
    }
  };

  const fetchHistoricalData = async () => {
    // Mock historical data for the chart
    const mockHistorical = Array.from({ length: 50 }, (_, i) => ({
      timestamp: new Date(Date.now() - (50 - i) * 3600000).toISOString(),
      value: 6000 + Math.random() * 200
    }));
    setHistoricalData(mockHistorical);
  };

  return (
    <div className="w-full bg-black text-white">
      <div className="max-w-7xl mx-auto px-4">
        {/* Market Navigation */}
        <div className="flex space-x-6 py-4 border-b border-gray-800">
          {['Indices', 'Stocks', 'Crypto', 'Futures', 'Forex'].map((tab) => (
            <button
              key={tab}
              className={`text-sm ${activeTab === tab ? 'text-white' : 'text-gray-400'} hover:text-white`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Market Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 py-4">
          {marketData.map((item) => (
            <div key={item.symbol} className="bg-gray-900 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">{item.name}</span>
                <span className={`text-sm ${item.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {item.change}%
                </span>
              </div>
              <div className="text-lg font-bold mt-1">{item.price.toLocaleString()}</div>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="h-96 w-full bg-gray-900 rounded-lg p-4 mt-4">
          <div className="flex justify-between items-center mb-4">
            <div className="flex space-x-4">
              {['1D', '1W', '1M', '3M', '1Y'].map((timeframe) => (
                <button
                  key={timeframe}
                  className={`text-sm ${selectedTimeframe === timeframe ? 'text-white' : 'text-gray-400'} hover:text-white`}
                  onClick={() => setSelectedTimeframe(timeframe)}
                >
                  {timeframe}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer>
            <LineChart data={historicalData}>
              <XAxis 
                dataKey="timestamp" 
                hide={true}
              />
              <YAxis hide={true} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none' }}
                labelStyle={{ color: '#9ca3af' }}
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#4f46e5"
                dot={false}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default MarketDashboard;
