 const API_TOKEN = "n6rqpKj9hrdfbiM";
  const APP_ID = "70549";
  let tickHistory = [];
  let ws;
  let isDarkMode = false;
  
  // Initialize the app
  document.addEventListener('DOMContentLoaded', function() {
    // Theme toggle functionality
    const themeToggle = document.getElementById('themeToggle');
    themeToggle.addEventListener('click', toggleTheme);
    
    // Check for saved theme preference
    if (localStorage.getItem('theme') === 'dark') {
      toggleTheme();
    }
  });
  
  function toggleTheme() {
    isDarkMode = !isDarkMode;
    document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    document.getElementById('themeToggle').innerHTML = isDarkMode ? 
      '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }
  
  // Fetch historical ticks using WebSocket
  function fetchHistoricalTicks(market, count) {
    return new Promise((resolve, reject) => {
      const wsHistory = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${APP_ID}`);
      
      wsHistory.onopen = () => {
        document.getElementById('loadingIndicator').style.display = 'block';
        document.getElementById('connectBtn').disabled = true;
        document.getElementById('connectBtn').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
        
        wsHistory.send(JSON.stringify({
          ticks_history: market,
          count: count,
          end: "latest",
          style: "ticks"
        }));
      };
      
      wsHistory.onmessage = function(event) {
        const data = JSON.parse(event.data);
        if (data.error) {
          showError(data.error.message);
          reject(data.error.message);
          wsHistory.close();
          return;
        }
        
        if (data.history && data.history.prices) {
          resolve(data.history.prices);
          wsHistory.close();
        }
      };
      
      wsHistory.onerror = (error) => {
        showError("WebSocket error fetching historical data.");
        reject(error);
        wsHistory.close();
      };
    });
  }
  
  // Connect main WebSocket and subscribe to live ticks
  async function connectWebSocket() {
    const market = document.getElementById("market").value;
    const tickLimit = parseInt(document.getElementById("tickCount").value);
    tickHistory = [];
    
    // Update UI
    document.getElementById('currentMarket').textContent = document.getElementById('market').options[document.getElementById('market').selectedIndex].text;
    
    try {
      const historicalTicks = await fetchHistoricalTicks(market, tickLimit);
      tickHistory = historicalTicks.map(price => extractLastDigit(price, market));
      updateDisplay();
    } catch (error) {
      console.error("Error loading historical:", error);
      document.getElementById('loadingIndicator').style.display = 'none';
      document.getElementById('connectBtn').disabled = false;
      document.getElementById('connectBtn').innerHTML = '<i class="fas fa-play"></i> Start Analysis';
      return;
    }
    
    if (ws) ws.close();
    
    ws = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${APP_ID}`);
    
    ws.onopen = function() {
      console.log("Connected to WebSocket");
      document.getElementById('connectBtn').innerHTML = '<i class="fas fa-stop"></i> Stop Analysis';
      document.getElementById('connectBtn').disabled = false;
      document.getElementById('loadingIndicator').style.display = 'none';
      
      ws.send(JSON.stringify({ authorize: API_TOKEN }));
      subscribeToMarket(market);
    };
    
    ws.onmessage = function(event) {
      const data = JSON.parse(event.data);
      if (data.error) {
        showError(data.error.message);
        return;
      }
      if (data.tick) processTick(data.tick);
    };
    
    ws.onclose = function() {
      console.log("WebSocket disconnected");
      document.getElementById('connectBtn').innerHTML = '<i class="fas fa-play"></i> Start Analysis';
      document.getElementById('connectBtn').disabled = false;
    };
    
    ws.onerror = function(error) {
      showError("WebSocket connection error");
      console.error("WebSocket error:", error);
    };
  }
  
  function showError(message) {
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${message}`;
    errorElement.style.position = 'fixed';
    errorElement.style.bottom = '20px';
    errorElement.style.left = '50%';
    errorElement.style.transform = 'translateX(-50%)';
    errorElement.style.backgroundColor = 'var(--danger)';
    errorElement.style.color = 'white';
    errorElement.style.padding = '10px 20px';
    errorElement.style.borderRadius = '8px';
    errorElement.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
    errorElement.style.zIndex = '1000';
    errorElement.style.animation = 'fadeIn 0.3s ease';
    
    document.body.appendChild(errorElement);
    
    setTimeout(() => {
      errorElement.style.animation = 'fadeOut 0.3s ease';
      setTimeout(() => {
        document.body.removeChild(errorElement);
      }, 300);
    }, 5000);
  }
  
  function subscribeToMarket(market) {
    console.log("Subscribing to:", market);
    ws.send(JSON.stringify({ ticks: market, subscribe: 1 }));
  }
  
  function processTick(tick) {
    const raw = tick.quote;
    const market = document.getElementById("market").value;
    const volatility = getVolatility(market);
    let priceStr = formatPrice(raw, volatility);
    
    const match = priceStr.match(/\.(\d+)$/);
    let lastDigit = match ? match[1].slice(-1) : priceStr.slice(-1);
    
    document.getElementById("lastTickValue").textContent = priceStr;
    
    tickHistory.push(lastDigit);
    const tickLimit = parseInt(document.getElementById("tickCount").value);
    if (tickHistory.length > tickLimit) tickHistory.shift();
    
    updateDisplay(lastDigit);
  }
  
  function extractLastDigit(price, market) {
    const volatility = getVolatility(market);
    const formattedPrice = price.toFixed(getDecimalPlacesFromVolatility(volatility));
    const match = formattedPrice.match(/\.(\d+)$/);
    return match ? parseInt(match[1].slice(-1)) : parseInt(formattedPrice.slice(-1));
  }
  
  function formatPrice(price, volatility) {
    return price.toFixed(getDecimalPlacesFromVolatility(volatility));
  }
  
  function getVolatility(market) {
    const marketToVolatilityMap = {
      "R_10": "10",
      "R_25": "25",
      "R_50": "50",
      "R_75": "75",
      "R_100": "100",
    };
    return marketToVolatilityMap[market] || "100";
  }
  
  function getDecimalPlacesFromVolatility(volatility) {
    if (volatility === "10" || volatility === "25") return 3;
    if (volatility === "50" || volatility === "75") return 4;
    return 2;
  }
  
  function calculateRiseFall() {
    let rise = 0;
    let fall = 0;
    for (let i = 1; i < tickHistory.length; i++) {
      if (tickHistory[i] > tickHistory[i - 1]) {
        rise++;
      } else if (tickHistory[i] < tickHistory[i - 1]) {
        fall++;
      }
    }

    const total = tickHistory.length - 1; // We can't compare the first tick
    const risePercent = total ? ((rise / total) * 100) : 0;
    const fallPercent = total ? ((fall / total) * 100) : 0;

    return { rise, fall, risePercent, fallPercent };
  }

  function updateDisplay(lastDigit) {
    document.getElementById('totalTicks').textContent = tickHistory.length;
    
    let counts = Array(10).fill(0);
    tickHistory.forEach(num => counts[num]++);
    
    const total = tickHistory.length;
    const even = tickHistory.filter(n => n % 2 === 0).length;
    const odd = total - even;
    
    const evenPercent = total ? ((even / total) * 100).toFixed(1) : 0;
    const oddPercent = total ? ((odd / total) * 100).toFixed(1) : 0;
    
    const { rise, fall, risePercent, fallPercent } = calculateRiseFall();
    
    // Update stats bars
    document.getElementById('evenBar').style.width = `${evenPercent}%`;
    document.getElementById('evenBar').textContent = evenPercent >= 10 ? `${evenPercent}%` : '';
    document.getElementById('evenPercent').textContent = `${evenPercent}%`;
    
    document.getElementById('oddPercent').textContent = `${oddPercent}%`;
    
    document.getElementById('riseBar').style.width = `${risePercent}%`;
    document.getElementById('riseBar').textContent = risePercent >= 10 ? `${risePercent.toFixed(1)}%` : '';
    document.getElementById('risePercent').textContent = `${risePercent.toFixed(1)}%`;
    
    document.getElementById('fallPercent').textContent = `${fallPercent.toFixed(1)}%`;
    
    // Update digit circles
    const circleContainer = document.getElementById("circleContainer");
    circleContainer.innerHTML = "";
    
    for (let i = 0; i <= 9; i++) {
      let percent = total ? ((counts[i] / total) * 100).toFixed(1) : "0.0";
      const hue = i * 36;
      const color = `hsl(${hue}, 70%, 50%)`;
      
      const wrapper = document.createElement("div");
      wrapper.className = "digit-wrapper";
      
      const circle = document.createElement("div");
      circle.className = "circle";
      if (i == lastDigit) circle.classList.add("glow");
      circle.style.background = color;
      circle.innerText = i;
      
      const info = document.createElement("div");
      info.className = "digit-info";
      info.innerHTML = `<strong>${percent}%</strong><br>(${counts[i]})`;
      
      wrapper.appendChild(circle);
      wrapper.appendChild(info);
      circleContainer.appendChild(wrapper);
    }
    
    // Update history
    const historyContainer = document.getElementById("historyContainer");
    historyContainer.innerHTML = "";
    
    // Only show last 20 items for better mobile display
    const displayItems = tickHistory.slice(-20);
    
    displayItems.forEach((num, index) => {
      const isRecent = index >= displayItems.length - 5;
      const item = document.createElement("div");
      item.className = "history-item";
      if (isRecent) item.style.fontWeight = "800";
      item.innerText = num;
      historyContainer.appendChild(item);
    });
  }
