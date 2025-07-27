const API_TOKEN = "n6rqpKj9hrdfbiM";
const APP_ID = "70549";
let tickHistory = [];
let ws = null;
let isDarkMode = false;
let isPaused = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;
let isHistoryExpanded = false;
let currentMarket = "";
let isManualDisconnect = false;

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

async function connectWebSocket() {
  const market = DOM.market.value;
  const tickLimit = parseInt(DOM.tickCount.value);
  localStorage.setItem('market', market);
  localStorage.setItem('tickCount', tickLimit);
  currentMarket = market;

  DOM.connectBtn.disabled = true;
  DOM.connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
  isManualDisconnect = false;

  try {
    tickHistory = [];
    const historicalTicks = await fetchHistoricalTicks(market, tickLimit);
    tickHistory = historicalTicks.map(price => extractLastDigit(price, market));
    updateDisplay();

    if (ws) {
      ws.close();
    }

    ws = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${APP_ID}`);

    ws.onopen = () => {
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
      if (data.error) showError(data.error.message);
      if (data.tick) processTick(data.tick);
    };

    ws.onclose = (event) => {
      if (!isManualDisconnect && !event.wasClean && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        setTimeout(connectWebSocket, 2000 * reconnectAttempts);
      } else {
        resetUI();
      }
    };

    ws.onerror = () => showError('WebSocket error');

  } catch (error) {
    showError('Connection failed: ' + error.message);
    resetUI();
  }
}

function switchMarket(newMarket) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    connectWebSocket();
    return;
  }

  reconnectAttempts = 0; // Reset reconnection attempts
  ws.send(JSON.stringify({ forget: currentMarket }));
  ws.send(JSON.stringify({ ticks: newMarket, subscribe: 1 }));
  currentMarket = newMarket;
  
  const tickLimit = parseInt(DOM.tickCount.value);
  fetchHistoricalTicks(newMarket, tickLimit)
    .then(historicalTicks => {
      tickHistory = historicalTicks.map(price => extractLastDigit(price, newMarket));
      updateDisplay();
    })
    .catch(() => showError('Failed to load history'));
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
  isManualDisconnect = true;
  if (ws) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ forget: currentMarket }));
    }
    ws.close();
    ws = null;
  }
  resetUI();
}

// ... (keep all other functions exactly the same: processTick, extractLastDigit, formatPrice, 
// getVolatility, getDecimalPlacesFromVolatility, calculateRiseFall, updateDisplay, 
// updateHistory, toggleHistory)

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  DOM.themeToggle.addEventListener('click', toggleTheme);
  DOM.connectBtn.addEventListener('click', () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      disconnectWebSocket();
    } else {
      connectWebSocket();
    }
  });
  DOM.pauseBtn.addEventListener('click', togglePause);
  DOM.resetBtn.addEventListener('click', resetAnalysis);
  DOM.seeMoreBtn.addEventListener('click', toggleHistory);

  DOM.market.addEventListener('change', () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      switchMarket(DOM.market.value);
    }
  });

  const savedMarket = localStorage.getItem('market');
  const savedTickCount = localStorage.getItem('tickCount');
  if (savedMarket) DOM.market.value = savedMarket;
  if (savedTickCount) DOM.tickCount.value = savedTickCount;

  if (localStorage.getItem('theme') === 'dark') toggleTheme();
});
