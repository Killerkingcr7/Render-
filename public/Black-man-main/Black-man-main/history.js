const API_TOKEN = "n6rqpKj9hrdfbiM";
const APP_ID = "70549";
let tickHistory = [];
let ws;
let isDarkMode = false;
let isHistoryExpanded = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;

const DOM = {
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

function toggleTheme() {
  isDarkMode = !isDarkMode;
  document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  DOM.themeToggle.innerHTML = isDarkMode ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
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

async function startAnalysis() {
  if (!DOM.market || !DOM.tickCount) {
    showError('Market or tick count input missing');
    return;
  }

  const market = DOM.market.value || 'R_100';
  const tickLimit = parseInt(DOM.tickCount.value) || 100;
  localStorage.setItem('market', market);
  localStorage.setItem('tickCount', tickLimit);

  try {
    // Load historical data
    try {
      tickHistory = [];
      const historicalTicks = await fetchHistoricalTicks(market, tickLimit);
      tickHistory = historicalTicks.map(price => extractLastDigit(price, market));
      updateDisplay();
    } catch (error) {
      showError('Failed to load historical data. Using real-time updates.');
    }

    // Connect real-time updates
    if (ws) ws.close();
    ws = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${APP_ID}`);

    ws.onopen = () => {
      reconnectAttempts = 0;
      ws.send(JSON.stringify({ authorize: API_TOKEN }));
      ws.send(JSON.stringify({ ticks: market, subscribe: 1 }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.error) showError(data.error.message);
      if (data.tick) processTick(data.tick);
    };

    ws.onclose = () => {
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        setTimeout(startAnalysis, 2000 * reconnectAttempts);
      } else {
        showError('WebSocket connection lost');
      }
    };

    ws.onerror = () => showError('WebSocket error');
  } catch (error) {
    showError('Connection failed');
  }
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

  // Update progress bars - even/odd
  DOM.evenBar.style.width = `${evenPercent}%`;
  DOM.oddBar.style.width = `${oddPercent}%`;
  DOM.oddBar.style.right = '0';
  DOM.oddBar.style.left = 'auto';
  DOM.evenPercent.textContent = `${evenPercent}%`;
  DOM.oddPercent.textContent = `${oddPercent}%`;

  // Update progress bars - rise/fall
  DOM.riseBar.style.width = `${risePercent}%`;
  DOM.fallBar.style.width = `${fallPercent}%`;
  DOM.fallBar.style.right = '0';
  DOM.fallBar.style.left = 'auto';
  DOM.risePercent.textContent = `${risePercent}%`;
  DOM.fallPercent.textContent = `${fallPercent}%`;

  // Update circles
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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  if (!DOM.market || !DOM.tickCount || !DOM.lastTickValue || !DOM.lastTickTime || !DOM.totalTicks ||
      !DOM.currentMarket || !DOM.evenBar || !DOM.oddBar || !DOM.evenPercent || !DOM.oddPercent ||
      !DOM.riseBar || !DOM.fallBar || !DOM.risePercent || !DOM.fallPercent || !DOM.circleContainer ||
      !DOM.historyContainer || !DOM.seeMoreBtn || !DOM.themeToggle) {
    showError('Missing required DOM elements');
    return;
  }

  DOM.themeToggle.addEventListener('click', toggleTheme);
  DOM.seeMoreBtn.addEventListener('click', toggleHistory);
  DOM.market.addEventListener('change', startAnalysis);

  const savedMarket = localStorage.getItem('market') || 'R_100';
  const savedTickCount = localStorage.getItem('tickCount') || '100';
  DOM.market.value = savedMarket;
  DOM.tickCount.value = savedTickCount;

  if (localStorage.getItem('theme') === 'dark') toggleTheme();
  startAnalysis();
});
