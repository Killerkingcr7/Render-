const API_TOKEN = "n6rqpKj9hrdfbiM";
const APP_ID = "70549";
let tickHistory = [];
let ws;
let isDarkMode = false;
let isHistoryExpanded = false;

// Only select elements that exist in your HTML
const DOM = {
  market: document.getElementById('market'),
  tickCount: document.getElementById('ticks'),
  lastTickValue: document.getElementById('last-tick-value'),
  lastTickTime: document.getElementById('last-tick-time'),
  circleContainer: document.getElementById('circle-container'),
  historyContainer: document.getElementById('history-container'),
  seeMoreBtn: document.getElementById('see-more-btn'),
  themeToggle: document.getElementById('theme-toggle'),
  evenBar: document.getElementById('even-bar'),
  oddBar: document.getElementById('odd-bar'),
  evenPercent: document.getElementById('even-%'),
  oddPercent: document.getElementById('odd-%'),
  riseBar: document.getElementById('rise-bar'),
  fallBar: document.getElementById('fall-bar'),
  risePercent: document.getElementById('rise-%'),
  fallPercent: document.getElementById('fall-%'),
  totalTicks: document.getElementById('total-ticks'),
  currentMarket: document.getElementById('current-market')
};

// 1. THEME TOGGLE (using your existing button)
function toggleTheme() {
  isDarkMode = !isDarkMode;
  document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  DOM.themeToggle.innerHTML = isDarkMode ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
  localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
}

// 2. HISTORICAL DATA FETCH (simplified)
async function fetchHistoricalTicks(market, count) {
  return new Promise((resolve) => {
    const wsHistory = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${APP_ID}`);
    
    wsHistory.onopen = () => {
      wsHistory.send(JSON.stringify({ authorize: API_TOKEN }));
      wsHistory.send(JSON.stringify({ ticks_history: market, count, end: 'latest', style: 'ticks' }));
    };
    
    wsHistory.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.history?.prices) {
        resolve(data.history.prices);
      }
      wsHistory.close();
    };
  });
}

// 3. MAIN FUNCTION (auto-runs on load)
async function startAnalysis() {
  if (!DOM.market) return;

  const market = DOM.market.value;
  const tickLimit = parseInt(DOM.tickCount.value) || 100;
  
  try {
    // Load historical data
    const historicalTicks = await fetchHistoricalTicks(market, tickLimit);
    tickHistory = historicalTicks.map(price => extractLastDigit(price, market));
    updateDisplay();
    
    // Connect real-time updates
    ws = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${APP_ID}`);
    
    ws.onopen = () => {
      ws.send(JSON.stringify({ authorize: API_TOKEN }));
      ws.send(JSON.stringify({ ticks: market, subscribe: 1 }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.tick) processTick(data.tick);
    };
    
  } catch (error) {
    console.error("Connection error:", error);
  }
}

// 4. PROCESS TICKS (real-time + historical)
function processTick(tick) {
  const market = DOM.market.value;
  const priceStr = formatPrice(tick.quote, getVolatility(market));
  const lastDigit = priceStr.slice(-1);

  DOM.lastTickValue.textContent = priceStr;
  DOM.lastTickTime.textContent = new Date().toLocaleTimeString();

  tickHistory.push(lastDigit);
  if (tickHistory.length > (parseInt(DOM.tickCount.value) || 100)) {
    tickHistory.shift();
  }
  
  updateDisplay(lastDigit);
}

// 5. DISPLAY UPDATES (matches your HTML structure)
function updateDisplay(lastDigit = null) {
  const total = tickHistory.length;
  DOM.totalTicks.textContent = total;
  DOM.currentMarket.textContent = DOM.market.options[DOM.market.selectedIndex].text;

  // Digit counts
  const counts = Array(10).fill(0);
  tickHistory.forEach(num => counts[num]++);

  // Even/Odd calculation
  const even = tickHistory.filter(n => n % 2 === 0).length;
  const evenPercent = total ? (even / total * 100).toFixed(1) : 0;
  const oddPercent = (100 - parseFloat(evenPercent)).toFixed(1);
  DOM.evenBar.style.width = `${evenPercent}%`;
  DOM.oddBar.style.width = `${oddPercent}%`;
  DOM.evenPercent.textContent = `${evenPercent}%`;
  DOM.oddPercent.textContent = `${oddPercent}%`;

  // Rise/Fall calculation
  let rise = 0, fall = 0;
  for (let i = 1; i < tickHistory.length; i++) {
    if (tickHistory[i] > tickHistory[i-1]) rise++;
    else if (tickHistory[i] < tickHistory[i-1]) fall++;
  }
  const risePercent = total > 1 ? (rise / (total-1) * 100).toFixed(1) : 0;
  const fallPercent = total > 1 ? (fall / (total-1) * 100).toFixed(1) : 0;
  DOM.riseBar.style.width = `${risePercent}%`;
  DOM.fallBar.style.width = `${fallPercent}%`;
  DOM.risePercent.textContent = `${risePercent}%`;
  DOM.fallPercent.textContent = `${fallPercent}%`;

  // Update circles
  DOM.circleContainer.innerHTML = '';
  const maxCount = Math.max(...counts);
  const minCount = Math.min(...counts.filter(c => c > 0)) || 0;

  for (let i = 0; i <= 9; i++) {
    const percent = total ? (counts[i] / total * 100).toFixed(1) : 0;
    const circle = document.createElement('div');
    circle.className = `circle ${i === parseInt(lastDigit) ? 'current-tick' : ''} 
                        ${counts[i] === maxCount ? 'most-frequent' : ''} 
                        ${counts[i] === minCount ? 'least-frequent' : ''}`;
    circle.textContent = i;
    DOM.circleContainer.appendChild(circle);
  }

  // Update history
  updateHistory();
}

// 6. HISTORY SECTION (matches your "See More" button)
function updateHistory() {
  DOM.historyContainer.innerHTML = '';
  const displayCount = isHistoryExpanded ? 100 : 10;
  tickHistory.slice(-displayCount).forEach(num => {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.textContent = num;
    DOM.historyContainer.appendChild(item);
  });
  DOM.seeMoreBtn.textContent = isHistoryExpanded ? 'See Less' : 'See More (Last 100 Digits)';
}

// Helper functions
function extractLastDigit(price, market) {
  return formatPrice(price, getVolatility(market)).slice(-1);
}

function formatPrice(price, volatility) {
  return price.toFixed(getDecimalPlacesFromVolatility(volatility));
}

function getVolatility(market) {
  return market.includes('10') ? '10' : 
         market.includes('25') ? '25' : 
         market.includes('50') ? '50' : 
         market.includes('75') ? '75' : '100';
}

function getDecimalPlacesFromVolatility(volatility) {
  return volatility === '10' ? 3 : 
         volatility === '25' ? 3 : 
         volatility === '50' ? 4 : 
         volatility === '75' ? 4 : 2;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Theme
  if (localStorage.getItem('theme') === 'dark') toggleTheme();
  DOM.themeToggle.addEventListener('click', toggleTheme);

  // See More button
  DOM.seeMoreBtn.addEventListener('click', () => {
    isHistoryExpanded = !isHistoryExpanded;
    updateHistory();
  });

  // Market change listener
  DOM.market.addEventListener('change', startAnalysis);

  // Start analysis
  startAnalysis();
});
