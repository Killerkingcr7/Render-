```javascript
const API_TOKEN = "n6rqpKj9hrdfbiM";
const APP_ID = "70549";
let tickHistory = [];
let ws;
let isDarkMode = false;
let isPaused = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;
let isHistoryExpanded = false;

const DOM = {
  market: document.getElementById('market'),
  tickCount: document.getElementById('ticks'),
  connectBtn: document.getElementById('connect-btn'),
  pauseBtn: document.getElementById('pause-btn'),
  resetBtn: document.getElementById('reset-btn'),
  lastTickValue: document.getElementById('last-tick-value'),
  lastTickTime: document.getElementById('last-tick-time'),
  totalTicks: document.getElementById('total-ticks'),
  currentMarket: document.getElementById('current-market'),
  evenBar: document.getElementById('even-bar'),
  oddBar: document.getElementById('odd-bar'),
  evenPercent: document.getElementById('even-%'),
  oddPercent: document.getElementById('odd-%'),
  riseBar: document.getElementById('rise-bar'),
  fallBar: document.getElementById('fall-bar'),
  risePercent: document.getElementById('rise-%'),
  fallPercent: document.getElementById('fall-%'),
  circleContainer: document.getElementById('circle-container'),
  historyContainer: document.getElementById('history-container'),
  seeMoreBtn: document.getElementById('see-more-btn'),
  themeToggle: document.getElementById('theme-toggle')
};

function showError(message) {
  console.error('Error:', message);
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
      wsHistory.send(JSON.stringify({ ticks_history: market, count, end: 'latest', style: 'ticks' }));
    };
    wsHistory.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.error) {
        console.error('Historical error:', data.error);
        showError(`Historical data error: ${data.error.message}`);
        reject(data.error.message);
      } else if (data.history?.prices) {
        console.log('Historical ticks received:', data.history.prices.length);
        resolve(data.history.prices);
      }
      wsHistory.close();
    };
    wsHistory.onerror = (error) => {
      console.error('Historical WebSocket error:', error);
      showError('Failed to fetch historical data');
      reject('WebSocket error');
    };
    wsHistory.onclose = (event) => console.log('Historical WebSocket closed:', event);
  });
}

async function connectWebSocket() {
  if (!DOM.market || !DOM.tickCount) {
    showError('Market or tick count input missing');
    console.error('Missing DOM elements:', { market: !!DOM.market, tickCount: !!DOM.tickCount });
    return;
  }

  const market = DOM.market.value || 'R_100';
  const tickLimit = parseInt(DOM.tickCount.value) || 100;
  localStorage.setItem('market', market);
  localStorage.setItem('tickCount', tickLimit);
  console.log('Starting analysis:', { market, tickLimit });

  DOM.connectBtn.disabled = true;
  DOM.connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';

  try {
    // Load historical data
    try {
      tickHistory = [];
      const historicalTicks = await fetchHistoricalTicks(market, tickLimit);
      tickHistory = historicalTicks.map(price => extractLastDigit(price, market));
      console.log('Historical ticks processed:', tickHistory.length);
      updateDisplay();
    } catch (error) {
      console.warn('Historical data failed:', error);
      showError('Failed to load historical data. Using real-time updates.');
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
      DOM.connectBtn.innerHTML = '<i class="fas fa-stop"></i> Stop';
      DOM.connectBtn.disabled = false;
      DOM.pauseBtn.disabled = false;
      ws.send(JSON.stringify({ authorize: API_TOKEN }));
      ws.send(JSON.stringify({ ticks: market, subscribe: 1 }));
    };

    ws.onmessage = (event) => {
      if (isPaused) return;
      const data = JSON.parse(event.data);
      if (data.error) {
        console.error('Real-time error:', data.error);
        showError(`WebSocket error: ${data.error.message}`);
      }
      if (data.tick) {
        console.log('Tick received:', data.tick.quote);
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
        resetUI();
      }
    };

    ws.onerror = (error) => {
      console.error('Real-time WebSocket error:', error);
      showError('WebSocket error');
    };
  } catch (error) {
    console.error('Analysis error:', error);
    showError('Connection failed');
    resetUI();
  }
}

function resetUI() {
  DOM.connectBtn.innerHTML = '<i class="fas fa-play"></i> Start';
  DOM.connectBtn.disabled = false;
  DOM.pauseBtn.disabled = true;
}

function togglePause() {
  isPaused = !isPaused;
  DOM.pauseBtn.innerHTML = isPaused ? '<i class="fas fa-play"></i> Resume' : '<i class="fas fa-pause"></i> Pause';
}

function resetAnalysis() {
  tickHistory = [];
  disconnectWebSocket();
  updateDisplay();
}

function disconnectWebSocket() {
  if (ws) ws.close();
  resetUI();
}

function processTick(tick) {
  const market = DOM.market.value || 'R_100';
  const priceStr = formatPrice(tick.quote, getVolatility(market));
  const lastDigit = parseInt(priceStr.match(/\.(\d+)$/)?.[1].slice(-1) || priceStr.slice(-1));

  DOM.lastTickValue.textContent = priceStr;
  DOM.lastTickTime.textContent = new Date().toLocaleTimeString();

  tickHistory.push(lastDigit);
  const tickLimit = parseInt(DOM.tickCount.value) || 100;
  if (tickHistory.length > tickLimit) tickHistory.shift();

  requestAnimationFrame(() => updateDisplay(lastDigit));
}

function extractLastDigit(price, market) {
  const volatility = getVolatility(market);
  const formattedPrice = price.toFixed(getDecimalPlacesFromVolatility(volatility));
  return parseInt(formattedPrice.match(/\.(\d+)$/)?.[1].slice(-1) || formattedPrice.slice(-1));
}

function formatPrice(price, volatility) {
  return price.toFixed(getDecimalPlacesFromVolatility(volatility));
}

function getVolatility(market) {
  return { R_10: '10', R_25: '25', R_50: '50', R_75: '75', R_100: '100' }[market] || '100';
}

function getDecimalPlacesFromVolatility(volatility) {
  return { '10': 3, '25': 3, '50': 4, '75': 4 }[volatility] || 2;
}

function calculateRiseFall() {
  let rise = 0, fall = 0;
  for (let i = 1; i < tickHistory.length; i++) {
    if (tickHistory[i] > tickHistory[i - 1]) rise++;
    else if (tickHistory[i] < tickHistory[i - 1]) fall++;
  }
  const total = tickHistory.length - 1;
  const risePercent = total ? (rise / total * 100).toFixed(1) : 0;
  const fallPercent = total ? (100 - parseFloat(risePercent)).toFixed(1) : 0;
  return { risePercent, fallPercent };
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

  const { risePercent, fallPercent } = calculateRiseFall();

  DOM.evenBar.style.width = `${evenPercent}%`;
  DOM.oddBar.style.width = `${oddPercent}%`;
  DOM.oddBar.style.right = '0';
  DOM.oddBar.style.left = 'auto';
  DOM.evenPercent.textContent = `${evenPercent}%`;
  DOM.oddPercent.textContent = `${oddPercent}%`;

  DOM.riseBar.style.width = `${risePercent}%`;
  DOM.fallBar.style.width = `${fallPercent}%`;
  DOM.fallBar.style.right = '0';
  DOM.fallBar.style.left = 'auto';
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
    circle.className = `circle ${i === lastDigit ? 'current-tick' : ''} ${counts[i] === maxCount && total ? 'most-frequent' : ''} ${counts[i] === minCount && total ? 'least-frequent' : ''}`;
    circle.innerText = i;
    const stats = document.createElement('div');
    stats.className = 'stats';
    stats.innerText = `${percent}%`;
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
    item.innerText = num;
    DOM.historyContainer.appendChild(item);
  });
  DOM.seeMoreBtn.textContent = isHistoryExpanded ? 'See Less' : 'See More (Last 100 Digits)';
}

function toggleHistory() {
  isHistoryExpanded = !isHistoryExpanded;
  updateHistory();
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded fired');
  if (!DOM.market || !DOM.tickCount || !DOM.connectBtn || !DOM.pauseBtn || !DOM.resetBtn ||
      !DOM.lastTickValue || !DOM.lastTickTime || !DOM.totalTicks || !DOM.currentMarket ||
      !DOM.evenBar || !DOM.oddBar || !DOM.evenPercent || !DOM.oddPercent ||
      !DOM.riseBar || !DOM.fallBar || !DOM.risePercent || !DOM.fallPercent ||
      !DOM.circleContainer || !DOM.historyContainer || !DOM.seeMoreBtn || !DOM.themeToggle) {
    showError('Missing required DOM elements');
    console.error('Missing DOM elements:', Object.keys(DOM).filter(k => !DOM[k]));
    return;
  }

  DOM.themeToggle.addEventListener('click', toggleTheme);
  DOM.connectBtn.addEventListener('click', connectWebSocket);
  DOM.pauseBtn.addEventListener('click', togglePause);
  DOM.resetBtn.addEventListener('click', resetAnalysis);
  DOM.seeMoreBtn.addEventListener('click', toggleHistory);
  DOM.market.addEventListener('change', () => {
    console.log('Market changed to:', DOM.market.value);
    connectWebSocket();
  });
  DOM.tickCount.addEventListener('change', () => {
    console.log('Tick count changed to:', DOM.tickCount.value);
    connectWebSocket();
  });

  const savedMarket = localStorage.getItem('market') || 'R_100';
  const savedTickCount = localStorage.getItem('tickCount') || '100';
  DOM.market.value = savedMarket;
  DOM.tickCount.value = savedTickCount;
  console.log('Initial settings:', { market: savedMarket, tickCount: savedTickCount });

  if (localStorage.getItem('theme') === 'dark') toggleTheme();
  connectWebSocket();
});
```
