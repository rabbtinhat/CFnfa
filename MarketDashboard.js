import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const MarketApp = () => {
  const [indices, setIndices] = React.useState([
    { symbol: 'S&P 500', price: '6,114.62', change: -0.01 },
    { symbol: 'Nasdaq', price: '22,114.49', change: 0.38 },
    { symbol: 'Dow 30', price: '44,546.09', change: -0.37 },
    { symbol: 'Japan 225', price: '39,149.21', change: -0.79 },
    { symbol: 'FTSE 100', price: '8,732.46', change: -0.32 }
  ]);

  const [dailyContent, setDailyContent] = React.useState([]);
  const [cryptoContent, setCryptoContent] = React.useState([]);
  const [blogContent, setBlogContent] = React.useState([]);

  // Mock chart data
  const chartData = React.useMemo(() => 
    Array.from({ length: 50 }, (_, i) => ({
      time: i,
      value: 6100 + Math.random() * 100
    }))
  , []);

  React.useEffect(() => {
    // Load content from other pages
    const loadPageContent = async () => {
      try {
        // Load daily.html content
        const dailyHtml = await window.fs.readFile('daily.html', { encoding: 'utf8' });
        const dailyDoc = new DOMParser().parseFromString(dailyHtml, 'text/html');
        const dailyMarketSections = Array.from(dailyDoc.querySelectorAll('.market-section')).slice(0, 3);
        setDailyContent(dailyMarketSections.map(section => ({
          title: section.querySelector('h2')?.textContent || '',
          content: section.querySelector('.market-content')?.textContent || ''
        })));

        // Load crypto.html content
        const cryptoHtml = await window.fs.readFile('crypto.html', { encoding: 'utf8' });
        const cryptoDoc = new DOMParser().parseFromString(cryptoHtml, 'text/html');
        const cryptoCards = Array.from(cryptoDoc.querySelectorAll('.metric-card')).slice(0, 3);
        setCryptoContent(cryptoCards.map(card => ({
          title: card.querySelector('.metric-title')?.textContent || '',
          description: card.querySelector('.description')?.textContent || ''
        })));

        // Load views-and-blogs.html content
        const blogHtml = await window.fs.readFile('views-and-blogs.html', { encoding: 'utf8' });
        const blogDoc = new DOMParser().parseFromString(blogHtml, 'text/html');
        const blogPosts = Array.from(blogDoc.querySelectorAll('.blog-post')).slice(0, 3);
        setBlogContent(blogPosts.map(post => ({
          title: post.querySelector('.blog-title')?.textContent || '',
          summary: post.querySelector('.blog-summary')?.textContent || '',
          date: post.querySelector('.blog-date')?.textContent || ''
        })));
      } catch (error) {
        console.error('Error loading page content:', error);
      }
    };

    loadPageContent();
  }, []);

  return (
    <div className="text-white">
      {/* Market Summary */}
      <div className="bg-gray-900 p-4 rounded-lg mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Market Summary</h2>
          <div className="flex space-x-4">
            <button className="text-gray-400 hover:text-white">Indices</button>
            <button className="text-gray-400 hover:text-white">Stocks</button>
            <button className="text-gray-400 hover:text-white">Crypto</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          {indices.map((item) => (
            <div key={item.symbol} className="bg-black p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm">{item.symbol}</span>
                <span className={`text-sm ${item.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {item.change}%
                </span>
              </div>
              <div className="text-lg font-bold mt-1">{item.price}</div>
            </div>
          ))}
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#4338ca" 
                dot={false}
              />
              <XAxis dataKey="time" hide={true} />
              <YAxis hide={true} />
              <Tooltip />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Content Sections */}
      <div className="space-y-8">
        {/* Daily Updates */}
        <div className="bg-white rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-900">Global Daily</h2>
            <a href="/pages/daily.html" className="text-indigo-600 hover:text-indigo-800">View all →</a>
          </div>
          <div className="space-y-4">
            {dailyContent.map((item, index) => (
              <div key={index} className="border-b border-gray-200 pb-4">
                <h3 className="font-semibold text-gray-800">{item.title}</h3>
                <p className="text-gray-600 mt-2">{item.content}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Crypto Updates */}
        <div className="bg-white rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-900">Crypto Market Metrics</h2>
            <a href="/pages/crypto.html" className="text-indigo-600 hover:text-indigo-800">View all →</a>
          </div>
          <div className="space-y-4">
            {cryptoContent.map((item, index) => (
              <div key={index} className="border-b border-gray-200 pb-4">
                <h3 className="font-semibold text-gray-800">{item.title}</h3>
                <p className="text-gray-600 mt-2">{item.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Blog Updates */}
        <div className="bg-white rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-900">Latest Views & Blogs</h2>
            <a href="/pages/views-and-blogs.html" className="text-indigo-600 hover:text-indigo-800">View all →</a>
          </div>
          <div className="space-y-4">
            {blogContent.map((post, index) => (
              <div key={index} className="border-b border-gray-200 pb-4">
                <div className="text-sm text-gray-500">{post.date}</div>
                <h3 className="font-semibold text-gray-800 mt-1">{post.title}</h3>
                <p className="text-gray-600 mt-2">{post.summary}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketApp;
