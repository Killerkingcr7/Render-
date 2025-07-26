const API_TOKEN = "n6rqpKj9hrdfbiM";
const APP_ID = "70549";
let tickHistory = [];
let ws;
let isDarkMode = false;
let isPaused = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;
let isHistoryExpanded = false;
let isConnecting = false;

let DOM = {};

function toggleTheme() {
  isDarkMode = !isDarkMode;
  document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  if (DOM.themeToggle) {
    DOM.themeToggle.innerHTML = isDarkMode ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
  }
  localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
}

function showError(message) {
  const error = document.createElement('div');
  error.className = 'error-message';
  error.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${message}`;
  document.body.appendChild(error);
  setTimeout(() => error.remove(), 5000);
}

async function fetchHistoricalTicks(market, count) {
  const wsHistory = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${APP_ID}`);
  return new Promise((resolve, reject) => {
    wsHistory.onopen = () => wsHistory.send(JSON.stringify({ ticks_history: market, count, end: 'latest', style: 'ticks' }));
    wsHistory.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.error) {
        showError(data.error.message);
        reject(data.error.message);
      } else if (data.history?.prices) {
        resolve(data.history.prices);
      }
      wsHistory.close();
    };
    wsHistory.onerror = () => {
      showError('Failed to fetch historical data');
      reject();
    };
  });
}

async function connectWebSocket() {
  if (isConnecting) return;
  isConnecting = true;

  if (!DOM.market || !DOM.tickCount) {
    isConnecting = false;
    return;
  }

  const market = DOM.market.value;
  const tickLimit = parseInt(DOM.tickCount.value);
  localStorage.setItem('market', market);
  localStorage.setItem('tickCount', tickLimit);

  try {
    if (ws) {
      ws.onclose = null;
      ws.close();
    }

    tickHistory = [];
    const historicalTicks = await fetchHistoricalTicks(market, tickLimit);
    tickHistory = historicalTicks.map(price => extractLastDigit(price, market));
    updateDisplay();

    ws = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${APP_ID}`);

    ws.onopen = () => {
      reconnectAttempts = 0;
      isConnecting = false;
      ws.send(JSON.stringify({ authorize: API_TOKEN }));
      ws.send(JSON.stringify({ ticks: market, subscribe: 1 }));
    };

    ws.onmessage = (event) => {
      if (isPaused) return;
      const data = JSON.parse(event.data);
      if (data.error) showError(data.error.message);
      if (data.tick) processTick(data.tick);
    };

    ws.oncloor = () => {
      isConnecting = false;
      showError('WebSocket error');
    };
  } catch (error) {
    isConnecting = false;
    showError('Failed to connect');
  }
}

function disconnectWebSocket() {
  if (ws) ws.close();
}

function processTick(tick) {
  if (!DOM.market) return;

  const market = DOM.market.value;
  const priceStr = formatPrice(tick.quote, getVolatility(market));
  const lastDigit = parseInt(priceStr.match(/\.(\d+)$/)?.[1].slice(-1) || priceStr.slice(-1));

  if (DOM.lastTickValue) DOM.lastTickValue.textContent = priceStr;
  if (DOM.lastTickTime) DOM.lastTickTime.textContent = new Date().toLocaleTimeString();

  tickHistory.push(lastDigit);
  const tickLimit = DOM.tickCount ? parseInt(DOM.tickCount.value) : 100;
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
  if (DOM.totalTicks) DOM.totalTicks.textContent = total;
  if (DOM.currentMarket && DOM.market) {
    DOM.currentMarket.textContent = DOM.market.options[DOM.market.selectedIndex].text;
  }

  const counts = Array(10).fill(0);
  tickHistory.forEach(num => counts[num]++);

  const even = tickHistory.filter(n => n % 2 === 0).length;
  const evenPercent = total ? (even / total * 100).toFixed(1) : 0;
  const oddPercent = total ? (100 - parseFloat(evenPercent)).toFixed(1) : 0;

  const { risePercent, fallPercent } = calculateRiseFall();

  // Update progress bars - even/odd
  if (DOM.evenBar) {
    DOM.evenBar.style.width = `${evenPercent}%`;
  }
  if (DOM.oddBar) {
    DOM.oddBar.style.width = `${oddPercent}%`;
    DOM.oddBar.style.right = '0';
    DOM.oddBar.style.left = 'auto';
  }
  if (DOM.evenPercent) DOM.evenPercent.textContent = `${evenPercent}%`;
  if (DOM.oddPercent) DOM.oddPercent.textContent = `${oddPercent}%`;

  // Update progress bars - rise/fall
  if (DOM.riseBar) {
    DOM.riseBar.style.width = `${risePercent}%`;
  }
  if (DOM.fallBar) {
    DOM.fallBar.style.width = `${fallPercent}%`;
    DOM.fallBar.style.right = '0';
    DOM.fallBar.style.left = 'auto';
  }
  if (DOM.risePercent) DOM.risePercent.textContent = `${risePercent}%`;
  if (DOM.fallPercent) DOM.fallPercent.textContent = `${fallPercent}%`;

  // Update circles
  if (!DOM.circleContainer) return;
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

  // Update history
  updateHistory();
}

function updateHistory() {
  if (!DOM.historyContainer || !DOM.seeMoreBtn) return;

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

// Initialize DOM elements safely
function initializeDOM() {
  DOM = {
    market: document.getElementById('market'),
    tickCount: document.getElementById('ticks'),
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

  // Check for critical missing elements (only the ones that must exist)
  const criticalElements = ['market', 'tickCount', 'circleContainer', 'themeToggle', 'seeMoreBtn'];
  const missingCritical = [];

  for (const key of criticalElements) {
    if (!DOM[key]) {
      missingCritical.push(key);
      console.error(`Critical element missing: ${key} (looking for id="${key === 'tickCount' ? 'ticks' : key}")`);
    }
  }

  if (missingCritical.length > 0) {
    console.error('Missing critical DOM elements:', missingCritical);
    showError(`Missing critical elements: ${missingCritical.join(', ')}`);
    return false;
  }

  // Log missing optional elements for debugging
  const optionalElements = Object.keys(DOM).filter(key => !criticalElements.includes(key));
  const missingOptional = optionalElements.filter(key => !DOM[key]);
  if (missingOptional.length > 0) {
    console.warn('Missing optional DOM elements:', missingOptional);
  }

  return true;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Initialize DOM elements first
  if (!initializeDOM()) {
    return; // Exit if DOM elements are missing
  }

  // Add event listeners with null checks
  if (DOM.themeToggle) {
    DOM.themeToggle.addEventListener('click', toggleTheme);
  }

  if (DOM.seeMoreBtn) {
    DOM.seeMoreBtn.addEventListener('click', toggleHistory);
  }

  // Load saved settings BEFORE adding event listeners to avoid triggering them
  const savedMarket = localStorage.getItem('market');
  const savedTickCount = localStorage.getItem('tickCount');
  if (savedMarket && DOM.market) DOM.market.value = savedMarket;
  if (savedTickCount && DOM.tickCount) DOM.tickCount.value = savedTickCount;

  if (localStorage.getItem('theme') === 'dark') toggleTheme();

  // Auto-start analysis when market or tick count changes
  if (DOM.market) {
    DOM.market.addEventListener('change', () => {
      connectWebSocket();
    });
  }

  if (DOM.tickCount) {
    DOM.tickCount.addEventListener('input', () => {
      // Debounce the input to avoid too many requests
      clearTimeout(window.tickCountTimeout);
      window.tickCountTimeout = setTimeout(() => {
        connectWebSocket();
      }, 500);
    });
  }

  // Auto-start on page load
  connectWebSocket();
});
