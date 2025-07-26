const API_TOKEN = "n6rqpKj9hrdfbiM";
const APP_ID = "70549";
let tickHistory = [];
let ws;
let isDarkMode = false;
let isHistoryExpanded = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;

let DOM = {};

function showError(message) {
  console.error('Error:', message); // Log to console for debugging
  const error = document.createElement('div');
  error.className = 'error-message';
  error.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${message}`;
  document.body.appendChild(error);
  setTimeout(() => error.remove(), 5000);
}

function toggleTheme() {
  isDarkMode = !isDarkMode;
  document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  DOM.themeToggle.innerHTML = isDarkMode ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
  localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
}

async function fetchHistoricalTicks(market, count) {
  return new Promise((resolve, reject) => {
    const wsHistory = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${APP_ID}`);
    
    wsHistory.onopen = () => {
      console.log('Historical WebSocket opened');
      wsHistory.send(JSON.stringify({ authorize: API_TOKEN }));
      wsHistory.send(JSON.stringify({ ticks_history: market, count, end: 'latest', style: 'ticks' }));
    };
    
    wsHistory.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.error) {
        console.error('Historical WebSocket error:', data.error);
        showError(`Historical data error: ${data.error.message}`);
        reject(data.error.message);
      }
      if (data.history?.prices) {
        console.log('Historical ticks received:', data.history.prices);
        resolve(data.history.prices);
        wsHistory.close();
      }
    };
    
    wsHistory.onerror = (error) => {
      console.error('Historical WebSocket error:', error);
      showError('Failed to fetch historical data');
      reject('WebSocket error');
    };
    
    wsHistory.onclose = (event) => {
      console.log('Historical WebSocket closed:', event);
      if (!event.wasClean) reject('Historical WebSocket closed unexpectedly');
    };
  });
}

async function connectWebSocket() {
  if (!DOM.market || !DOM.tickCount) {
    showError('Market or tick count input missing');
    console.error('Missing DOM elements:', { market: !!DOM.market, tickCount: !!DOM.tickCount });
    return;
  }

  const market = DOM.market.value || 'R_100'; // Fallback to default market
  const tickLimit = parseInt(DOM.tickCount.value) || 100;
  localStorage.setItem('market', market);
  localStorage.setItem('tickCount', tickLimit);

  try {
    // Load historical data (non-blocking)
    try {
      const historicalTicks = await fetchHistoricalTicks(market, tickLimit);
      tickHistory = historicalTicks.map(price => extractLastDigit(price, market));
      console.log('Historical ticks processed:', tickHistory);
      updateDisplay();
    } catch (error) {
      console.warn('Historical data fetch failed, continuing with real-time:', error);
      showError('Failed to load historical data. Using real-time updates.');
      tickHistory = []; // Reset to avoid stale data
      updateDisplay();
    }

    // Connect real-time updates
    if (ws) {
      console.log('Closing existing WebSocket');
      ws.close();
    }
    ws = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${APP_ID}`);

    ws.onopen = () => {
      console.log('Real-time WebSocket opened');
      reconnectAttempts = 0;
      ws.send(JSON.stringify({ authorize: API_TOKEN }));
      ws.send(JSON.stringify({ ticks: market, subscribe: 1 }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.error) {
        console.error('Real-time WebSocket error:', data.error);
        showError(`WebSocket error: ${data.error.message}`);
      }
      if (data.tick) {
        console.log('Tick received:', data.tick);
        processTick(data.tick);
      }
    };

    ws.onclose = (event) => {
      console.log('Real-time WebSocket closed:', event);
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        console.log(`Reconnecting attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
        setTimeout(connectWebSocket, 2000 * reconnectAttempts);
      } else {
        showError('WebSocket connection lost');
      }
    };

    ws.onerror = (error) => {
      console.error('Real-time WebSocket error:', error);
      showError('WebSocket connection error');
    };
  } catch (error) {
    console.error('Connection error:', error);
    showError('Connection failed');
  }
}

function processTick(tick) {
  const market = DOM.market.value || 'R_100';
  const priceStr = formatPrice(tick.quote, getVolatility(market));
  const lastDigit = parseInt(priceStr.slice(-1)) || 0;

  DOM.lastTickValue.textContent = priceStr;
  DOM.lastTickTime.textContent = new Date().toLocaleTimeString();

  tickHistory.push(lastDigit);
  if (tickHistory.length > (parseInt(DOM.tickCount.value) || 100)) {
    tickHistory.shift();
  }

  requestAnimationFrame(() => updateDisplay(lastDigit));
}

function updateDisplay(lastDigit = null) {
  const total = tickHistory.length;
  DOM.totalTicks.textContent = total;
  DOM.currentMarket.textContent = DOM.market.options[DOM.market.selectedIndex]?.text || 'Unknown';

  const counts = Array(10).fill(0);
  tickHistory.forEach(num => counts[num]++);

  const even = tickHistory.filter(n => n % 2 === 0).length;
  const evenPercent = total ? (even / total * 100).toFixed(1) : 0;
  const oddPercent = total ? (100 - parseFloat(evenPercent)).toFixed(1) : 0;
  DOM.evenBar.style.width = `${evenPercent}%`;
  DOM.oddBar.style.width = `${oddPercent}%`;
  DOM.evenPercent.textContent = `${evenPercent}%`;
  DOM.oddPercent.textContent = `${oddPercent}%`;

  let rise = 0, fall = 0;
  for (let i = 1; i < tickHistory.length; i++) {
    if (tickHistory[i] > tickHistory[i - 1]) rise++;
    else if (tickHistory[i] < tickHistory[i - 1]) fall++;
  }
  const totalMovements = total - 1;
  const risePercent = totalMovements ? (rise / totalMovements * 100).toFixed(1) : 0;
  const fallPercent = totalMovements ? (fall / totalMovements * 100).toFixed(1) : 0;
  DOM.riseBar.style.width = `${risePercent}%`;
  DOM.fallBar.style.width = `${fallPercent}%`;
  DOM.risePercent.textContent = `${risePercent}%`;
  DOM.fallPercent.textContent = `${fallPercent}%`;

  DOM.circleContainer.innerHTML = '';
  const maxCount = Math.max(...counts);
  const minCount = Math.min(...counts.filter(c => c > 0)) || 0;

  for (let i = 0; i <= 9; i++) {
    const percent = total ? (counts[i] / total * 100).toFixed(1) : 0;
    const wrapper = document.createElement('div');
    wrapper.className = 'circle-wrapper';
    const circle = document.createElement('div');
    circle.className = `circle ${i === lastDigit ? 'current-tick' : ''} ${
      counts[i] === maxCount && total ? 'most-frequent' : ''
    } ${counts[i] === minCount && total ? 'least-frequent' : ''}`;
    circle.textContent = i;
    const stats = document.createElement('div');
    stats.className = 'stats';
    stats.textContent = `${percent}%`;
    wrapper.appendChild(circle);
    wrapper.appendChild(stats);
    DOM.circleContainer.appendChild(wrapper);
  }

  updateHistory();
}

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

function extractLastDigit(price, market) {
  const formattedPrice = formatPrice(price, getVolatility(market));
  return parseInt(formattedPrice.slice(-1)) || 0;
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

function initializeDOM() {
  DOM = {
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
    currentMarket: document.getElementById('current-market'),
  };

  const missingElements = Object.entries(DOM)
    .filter(([_, element]) => !element)
    .map(([key]) => key);

  if (missingElements.length > 0) {
    showError(`Missing DOM elements: ${missingElements.join(', ')}`);
    console.error('Missing DOM elements:', missingElements);
    return false;
  }

  return true;
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded fired');
  if (!initializeDOM()) {
    console.error('DOM initialization failed');
    return;
  }

  if (localStorage.getItem('theme') === 'dark') toggleTheme();
  DOM.themeToggle.addEventListener('click', toggleTheme);
  DOM.seeMoreBtn.addEventListener('click', () => {
    isHistoryExpanded = !isHistoryExpanded;
    updateHistory();
  });
  DOM.market.addEventListener('change', () => {
    console.log('Market changed to:', DOM.market.value);
    connectWebSocket();
  });

  const savedMarket = localStorage.getItem('market') || 'R_100';
  const savedTickCount = localStorage.getItem('tickCount') || '100';
  DOM.market.value = savedMarket;
  DOM.tickCount.value = savedTickCount;
  console.log('Initial settings:', { market: savedMarket, tickCount: savedTickCount });

  connectWebSocket();
});
