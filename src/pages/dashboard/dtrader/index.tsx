import React, { useCallback, useEffect, useRef, useState } from 'react';
import chart_api from '@/external/bot-skeleton/services/api/chart-api';
import './dtrader.scss';

interface MarketData {
    symbol: string;
    name: string;
    market?: string;
    submarket?: string;
}

type TSubscription = {
    [key: string]: null | {
        unsubscribe?: () => void;
    };
};

type TError = null | {
    error?: {
        code?: string;
        message?: string;
    };
};

const subscriptions: TSubscription = {};

const DTrader: React.FC = () => {
    console.log('DTrader component rendering...');

    // Add error state
    const [hasError, setHasError] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const [selectedMarket, setSelectedMarket] = useState<MarketData>({
        symbol: '1HZ10V',
        name: 'Volatility 10 (1s) Index',
    });
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [currentPrice, setCurrentPrice] = useState<number>(0);
    const [priceChange, setPriceChange] = useState<number>(0);
    const [lastDigit, setLastDigit] = useState<number>(0);
    const [digitStats, setDigitStats] = useState<{ [key: number]: number }>({});
    const [priceHistory, setPriceHistory] = useState<number[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('Connecting...');
    const subscriptionIdRef = useRef<string>('');
    const lastSubscriptionTimeRef = useRef<number>(0);
    const subscriptionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const [availableMarkets, setAvailableMarkets] = useState<MarketData[]>([]);
    const [isLoadingMarkets, setIsLoadingMarkets] = useState(true);

    // Cleanup all subscriptions on unmount
    useEffect(() => {
        return () => {
            if (chart_api.api) {
                chart_api.api.forgetAll('ticks');
            }
        };
    }, []);

    // Fetch available markets from API with timeout and better error handling
    const fetchAvailableMarkets = useCallback(async () => {
        console.log('🔄 Fetching available markets...');
        setIsLoadingMarkets(true);

        // Always set fallback markets first to ensure UI works - prioritized by popularity
        const fallbackMarkets: MarketData[] = [
            // Most Popular: 1-second Volatility Indices (V10-V100)
            { symbol: '1HZ10V', name: 'Volatility 10 (1s) Index', market: 'synthetic_index', submarket: 'random_index' },
            { symbol: '1HZ25V', name: 'Volatility 25 (1s) Index', market: 'synthetic_index', submarket: 'random_index' },
            { symbol: '1HZ50V', name: 'Volatility 50 (1s) Index', market: 'synthetic_index', submarket: 'random_index' },
            { symbol: '1HZ75V', name: 'Volatility 75 (1s) Index', market: 'synthetic_index', submarket: 'random_index' },
            { symbol: '1HZ100V', name: 'Volatility 100 (1s) Index', market: 'synthetic_index', submarket: 'random_index' },
            
            // Regular Volatility Indices
            { symbol: 'R_10', name: 'Volatility 10 Index', market: 'synthetic_index', submarket: 'random_index' },
            { symbol: 'R_25', name: 'Volatility 25 Index', market: 'synthetic_index', submarket: 'random_index' },
            { symbol: 'R_50', name: 'Volatility 50 Index', market: 'synthetic_index', submarket: 'random_index' },
            { symbol: 'R_75', name: 'Volatility 75 Index', market: 'synthetic_index', submarket: 'random_index' },
            { symbol: 'R_100', name: 'Volatility 100 Index', market: 'synthetic_index', submarket: 'random_index' },
            
            // Jump Indices (Popular for advanced traders)
            { symbol: 'JD10', name: 'Jump 10 Index', market: 'synthetic_index', submarket: 'jump_index' },
            { symbol: 'JD25', name: 'Jump 25 Index', market: 'synthetic_index', submarket: 'jump_index' },
            { symbol: 'JD50', name: 'Jump 50 Index', market: 'synthetic_index', submarket: 'jump_index' },
            { symbol: 'JD75', name: 'Jump 75 Index', market: 'synthetic_index', submarket: 'jump_index' },
            { symbol: 'JD100', name: 'Jump 100 Index', market: 'synthetic_index', submarket: 'jump_index' },
            
            // Crash & Boom Indices
            { symbol: 'BOOM1000', name: 'Boom 1000 Index', market: 'synthetic_index', submarket: 'crash_boom' },
            { symbol: 'BOOM500', name: 'Boom 500 Index', market: 'synthetic_index', submarket: 'crash_boom' },
            { symbol: 'CRASH1000', name: 'Crash 1000 Index', market: 'synthetic_index', submarket: 'crash_boom' },
            { symbol: 'CRASH500', name: 'Crash 500 Index', market: 'synthetic_index', submarket: 'crash_boom' },
            
            // Step Index
            { symbol: 'STEPIDX', name: 'Step Index', market: 'synthetic_index', submarket: 'step_index' },
            
            // Popular Forex Pairs
            { symbol: 'frxEURUSD', name: 'EUR/USD', market: 'forex', submarket: 'major_pairs' },
            { symbol: 'frxGBPUSD', name: 'GBP/USD', market: 'forex', submarket: 'major_pairs' },
            { symbol: 'frxUSDJPY', name: 'USD/JPY', market: 'forex', submarket: 'major_pairs' },
            { symbol: 'frxAUDUSD', name: 'AUD/USD', market: 'forex', submarket: 'major_pairs' },
        ];

        // Set fallback markets immediately
        setAvailableMarkets(fallbackMarkets);
        if (!selectedMarket.symbol) {
            setSelectedMarket(fallbackMarkets[0]);
            console.log(`🎯 Set default market: ${fallbackMarkets[0].symbol}`);
        }

        try {
            // Try to fetch from API with timeout
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('API timeout')), 5000)
            );

            const apiPromise = (async () => {
                if (!chart_api?.api) {
                    await chart_api.init();
                }

                const activeSymbolsRequest = {
                    active_symbols: 'brief',
                    product_type: 'basic',
                };

                return await chart_api.api.send(activeSymbolsRequest);
            })();

            const response = await Promise.race([apiPromise, timeoutPromise]);
            
            if (response && (response as any).active_symbols) {
                const apiMarkets = (response as any).active_symbols
                    .filter((symbol: any) => {
                        return (
                            symbol.market === 'synthetic_index' ||
                            symbol.market === 'forex' ||
                            symbol.market === 'commodities' ||
                            symbol.market === 'stock_indices'
                        );
                    })
                    .map((symbol: any) => ({
                        symbol: symbol.symbol,
                        name: symbol.display_name,
                        market: symbol.market,
                        submarket: symbol.submarket,
                    }))
                    .sort((a: MarketData, b: MarketData) => {
                        // Custom sorting by popularity and type
                        const getMarketPriority = (market: MarketData) => {
                            // 1-second volatility indices (most popular)
                            if (market.symbol?.match(/^1HZ\d+V$/)) return 1;
                            
                            // Regular volatility indices
                            if (market.symbol?.match(/^R_\d+$/)) return 2;
                            
                            // Jump indices
                            if (market.submarket === 'jump_index' || market.symbol?.startsWith('JD')) return 3;
                            
                            // Crash & Boom indices
                            if (market.submarket === 'crash_boom' || market.symbol?.includes('BOOM') || market.symbol?.includes('CRASH')) return 4;
                            
                            // Step indices
                            if (market.submarket === 'step_index' || market.symbol?.includes('STEP')) return 5;
                            
                            // Other synthetic indices
                            if (market.market === 'synthetic_index') return 6;
                            
                            // Forex major pairs
                            if (market.market === 'forex' && market.submarket === 'major_pairs') return 7;
                            
                            // Other forex
                            if (market.market === 'forex') return 8;
                            
                            // Commodities
                            if (market.market === 'commodities') return 9;
                            
                            // Stock indices
                            if (market.market === 'stock_indices') return 10;
                            
                            // Everything else
                            return 11;
                        };
                        
                        const priorityA = getMarketPriority(a);
                        const priorityB = getMarketPriority(b);
                        
                        if (priorityA !== priorityB) {
                            return priorityA - priorityB;
                        }
                        
                        // Within same priority, sort alphabetically
                        return a.name.localeCompare(b.name);
                    });

                if (apiMarkets.length > 0) {
                    setAvailableMarkets(apiMarkets);
                    console.log(`✅ Loaded ${apiMarkets.length} markets from API`);
                }
            }
        } catch (error) {
            console.warn('⚠️ Using fallback markets:', error);
            // Fallback markets are already set above
        } finally {
            setIsLoadingMarkets(false);
        }
    }, [selectedMarket.symbol]);

    // Helper functions
    const getLastDigit = (price: number, symbol: string): number => {
        // Use appropriate decimal precision for each symbol
        let multiplier = 100; // Default for 2 decimal places

        if (['R_25', 'R_10', '1HZ30V', '1HZ90V', '1HZ15V'].includes(symbol)) {
            multiplier = 1000; // 3 decimal places
        } else if (['R_50', 'R_75'].includes(symbol)) {
            multiplier = 10000; // 4 decimal places
        }

        const scaledPrice = Math.round(price * multiplier);
        return scaledPrice % 10;
    };

    const formatPrice = (price: number): string => {
        const decimalPlaces: { [key: string]: number } = {
            '1HZ50V': 2,
            '1HZ25V': 2,
            '1HZ10V': 2,
            '1HZ75V': 2,
            '1HZ100V': 2,
            R_100: 2,
            R_25: 3,
            R_10: 3,
            '1HZ30V': 3,
            '1HZ90V': 3,
            '1HZ15V': 3,
            R_50: 4,
            R_75: 4,
        };

        const places = decimalPlaces[selectedMarket.symbol] || 5;
        return price.toFixed(places);
    };

    const getDigitPercentage = (digit: number): string => {
        const totalTicks = Object.values(digitStats).reduce((sum, count) => sum + count, 0);
        if (totalTicks > 0 && digitStats[digit]) {
            return ((digitStats[digit] / totalTicks) * 100).toFixed(1);
        }
        return '10.0';
    };

    // Request functions similar to Chart component
    const requestForgetStream = (subscription_id: string) => {
        subscription_id && chart_api.api.forget(subscription_id);
    };

    const requestSubscribe = useCallback(async (req: any, callback: (data: any) => void) => {
        try {
            requestForgetStream(subscriptionIdRef.current);
            const history = await chart_api.api.send(req);
            
            if (history?.subscription?.id) {
                subscriptionIdRef.current = history.subscription.id;
            }
            
            if (history) callback(history);
            
            if (req.subscribe === 1) {
                subscriptions[history?.subscription?.id] = chart_api.api
                    .onMessage()
                    ?.subscribe(({ data }: { data: any }) => {
                        callback(data);
                    });
            }
        } catch (e) {
            const error = e as TError;
            if (error?.error?.code === 'MarketIsClosed') {
                console.warn('Market is closed');
                callback([]);
            } else {
                console.warn('Subscription error:', error?.error?.message);
            }
            callback([]);
        }
    }, []);

    // Subscribe to market data - memoized to prevent infinite re-renders
    const subscribeToMarketData = useCallback(async (symbol: string) => {
        try {
            console.log(`📊 Subscribing to ${symbol} market data...`);
            
            // Clean up any existing subscriptions first
            if (subscriptionIdRef.current && chart_api.api) {
                console.log(`🧹 Cleaning up previous subscription: ${subscriptionIdRef.current}`);
                chart_api.api.forget(subscriptionIdRef.current);
                subscriptionIdRef.current = '';
            }

            const request = {
                ticks_history: symbol,
                end: 'latest',
                count: 1000,
                subscribe: 1,
            };

            await requestSubscribe(request, (data: any) => {
                if (data.tick && data.tick.symbol === symbol) {
                    // Handle real-time tick data
                    const price = parseFloat(data.tick.quote);

                    setCurrentPrice(prevPrice => {
                        const change = prevPrice ? price - prevPrice : 0;
                        setPriceChange(change);
                        return price;
                    });

                    const digit = getLastDigit(price, symbol);
                    setLastDigit(digit);

                    // Update price history and digit stats
                    setPriceHistory(prev => {
                        const newHistory = [...prev, price].slice(-1000);

                        // Recalculate digit stats
                        const newStats: { [key: number]: number } = {};
                        newHistory.forEach((p: number) => {
                            const d = getLastDigit(p, symbol);
                            newStats[d] = (newStats[d] || 0) + 1;
                        });
                        setDigitStats(newStats);

                        return newHistory;
                    });
                    
                    // Update connection status on first tick
                    setConnectionStatus(`Connected to ${symbol}`);
                } else if (data.history?.prices) {
                    // Handle historical data
                    console.log(`📈 Received ${data.history.prices.length} historical prices for ${symbol}`);
                    const prices = data.history.prices.map((p: string) => parseFloat(p));
                    setPriceHistory(prices);

                    const latestPrice = prices[prices.length - 1];
                    setCurrentPrice(latestPrice);

                    // Calculate digit statistics
                    const stats: { [key: number]: number } = {};
                    prices.forEach((price: number) => {
                        const digit = getLastDigit(price, symbol);
                        stats[digit] = (stats[digit] || 0) + 1;
                    });
                    setDigitStats(stats);
                    setLastDigit(getLastDigit(latestPrice, symbol));
                    
                    // Update connection status
                    setConnectionStatus(`Connected to ${symbol}`);
                    console.log(`✅ ${symbol} data loaded: Price ${latestPrice}, Last digit ${getLastDigit(latestPrice, symbol)}`);
                }
            });

            console.log(`✅ Subscribed to ${symbol} market data`);
        } catch (error) {
            console.error('❌ Failed to subscribe to market data:', error);
            setConnectionStatus('Subscription failed');
        }
    }, []); // Empty dependency array to prevent recreation

    // Initialize API and fetch markets once on mount
    useEffect(() => {
        const initializeAPI = async () => {
            try {
                setConnectionStatus('Initializing API...');
                console.log('🔄 Initializing Deriv API for DTrader...');

                if (!chart_api?.api) {
                    await chart_api.init();
                }

                if (chart_api?.api && chart_api.api.connection) {
                    setConnectionStatus('Connected to Deriv');
                    setIsConnected(true);
                    console.log('✅ Deriv API connected successfully');
                    
                    // Fetch available markets after API is connected
                    await fetchAvailableMarkets();
                } else {
                    setConnectionStatus('Demo Mode - No API');
                    console.warn('❌ API not available, running in demo mode');
                    // Still fetch markets in demo mode
                    await fetchAvailableMarkets();
                }
            } catch (error) {
                setConnectionStatus('Demo Mode - API Error');
                setErrorMessage(String(error));
                console.error('❌ API initialization error:', error);
                // Fallback to hardcoded markets
                await fetchAvailableMarkets();
            }
        };

        // Initialize markets first, then API
        fetchAvailableMarkets();
        
        // Only initialize API once
        if (!isConnected) {
            initializeAPI().catch(error => {
                setHasError(true);
                setErrorMessage('Failed to initialize DTrader');
                console.error('Component initialization error:', error);
            });
        }

        // Cleanup on unmount
        return () => {
            try {
                if (subscriptionIdRef.current && chart_api?.api) {
                    chart_api.api.forget(subscriptionIdRef.current);
                }
            } catch (error) {
                console.warn('Cleanup error:', error);
            }
        };
    }, []); // Empty dependency array - only run once

    // Subscribe to market data when symbol changes or connection is established (with debouncing)
    useEffect(() => {
        if (isConnected && selectedMarket.symbol) {
            console.log(`🔄 Market changed to: ${selectedMarket.symbol}`);
            
            // Clear any existing timeout
            if (subscriptionTimeoutRef.current) {
                clearTimeout(subscriptionTimeoutRef.current);
            }
            
            // Check rate limiting (minimum 2 seconds between requests)
            const now = Date.now();
            const timeSinceLastRequest = now - lastSubscriptionTimeRef.current;
            const minInterval = 2000; // 2 seconds
            
            if (timeSinceLastRequest < minInterval) {
                const delay = minInterval - timeSinceLastRequest;
                console.log(`⏳ Rate limiting: waiting ${delay}ms before next subscription`);
                
                subscriptionTimeoutRef.current = setTimeout(() => {
                    performMarketSubscription();
                }, delay);
            } else {
                performMarketSubscription();
            }
        }
        
        function performMarketSubscription() {
            // Reset price data when switching markets
            setCurrentPrice(0);
            setPriceChange(0);
            setLastDigit(0);
            setDigitStats({});
            setPriceHistory([]);
            setConnectionStatus(`Connecting to ${selectedMarket.symbol}...`);
            
            // Update last request time
            lastSubscriptionTimeRef.current = Date.now();
            
            // Subscribe to new market data
            subscribeToMarketData(selectedMarket.symbol);
        }
        
        // Cleanup timeout on unmount or dependency change
        return () => {
            if (subscriptionTimeoutRef.current) {
                clearTimeout(subscriptionTimeoutRef.current);
            }
        };
    }, [selectedMarket.symbol, isConnected, subscribeToMarketData]);

    // Handle orientation changes and window resize
    useEffect(() => {
        const handleResize = () => {
            // Force re-render on orientation change to adjust layout
            const isMobile = window.innerWidth <= 768;
            const isLandscape = window.innerWidth > window.innerHeight;
            
            console.log(`📱 Screen: ${window.innerWidth}x${window.innerHeight}, Mobile: ${isMobile}, Landscape: ${isLandscape}`);
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleResize);
        
        // Initial check
        handleResize();

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('orientationchange', handleResize);
        };
    }, []);

    // Show error fallback if component has crashed
    if (hasError) {
        return (
            <div className='dtrader'>
                <div className='dtrader__main-content'>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '400px',
                            flexDirection: 'column',
                            gap: '20px',
                            color: '#666',
                        }}
                    >
                        <div style={{ fontSize: '2rem' }}>⚠️</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: '600' }}>DTrader Error</div>
                        <div style={{ fontSize: '1rem', textAlign: 'center', maxWidth: '400px' }}>
                            {errorMessage || 'Something went wrong. Please refresh the page and try again.'}
                        </div>
                        <button
                            onClick={() => {
                                setHasError(false);
                                setErrorMessage('');
                                window.location.reload();
                            }}
                            style={{
                                padding: '10px 20px',
                                background: '#ff444f',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                            }}
                        >
                            Refresh Page
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    try {
        return (
            <div className='dtrader'>
                <div className='dtrader__main-content'>
                    <div className='dtrader__chart-section'>
                        <div className='dtrader__chart-header'>
                            <div className='market-selector'>
                                <div
                                    className='market-selector__current'
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                >
                                    <span className='market-selector__name'>{selectedMarket.name}</span>
                                    <span className={`market-selector__arrow ${isDropdownOpen ? 'open' : ''}`}>▼</span>
                                </div>

                                {isDropdownOpen && (
                                    <div className='market-selector__dropdown'>
                                        {isLoadingMarkets ? (
                                            <div className='market-selector__loading'>
                                                <span>Loading markets...</span>
                                            </div>
                                        ) : (
                                            <>
                                                {/* Group markets by submarket for better organization */}
                                                {[
                                                    { key: 'random_index_1s', label: '🔥 Most Popular - Volatility Indices (1s)', filter: (m: MarketData) => m.symbol?.match(/^1HZ\d+V$/) },
                                                    { key: 'random_index', label: '📈 Volatility Indices', filter: (m: MarketData) => m.symbol?.match(/^R_\d+$/) },
                                                    { key: 'jump_index', label: '⚡ Jump Indices', filter: (m: MarketData) => m.submarket === 'jump_index' || m.symbol?.startsWith('JD') },
                                                    { key: 'crash_boom', label: '💥 Crash & Boom', filter: (m: MarketData) => m.submarket === 'crash_boom' || m.symbol?.includes('BOOM') || m.symbol?.includes('CRASH') },
                                                    { key: 'step_index', label: '📊 Step Index', filter: (m: MarketData) => m.submarket === 'step_index' || m.symbol?.includes('STEP') },
                                                    { key: 'other_synthetic', label: '🎲 Other Synthetic', filter: (m: MarketData) => m.market === 'synthetic_index' && !m.symbol?.match(/^(1HZ\d+V|R_\d+|JD\d+)$/) && !m.symbol?.includes('BOOM') && !m.symbol?.includes('CRASH') && !m.symbol?.includes('STEP') },
                                                    { key: 'forex', label: '💱 Forex', filter: (m: MarketData) => m.market === 'forex' },
                                                    { key: 'commodities', label: '🥇 Commodities', filter: (m: MarketData) => m.market === 'commodities' },
                                                    { key: 'stock_indices', label: '📊 Stock Indices', filter: (m: MarketData) => m.market === 'stock_indices' }
                                                ].map(category => {
                                                    const marketsInCategory = availableMarkets.filter(category.filter);
                                                    if (marketsInCategory.length === 0) return null;

                                                    return (
                                                        <div key={category.key} className='market-selector__category'>
                                                            <div className='market-selector__category-header'>
                                                                {category.label}
                                                                <span className='market-selector__category-count'>({marketsInCategory.length})</span>
                                                            </div>
                                                            {marketsInCategory.map(market => (
                                                                <div
                                                                    key={market.symbol}
                                                                    className={`market-selector__option ${market.symbol === selectedMarket.symbol ? 'selected' : ''}`}
                                                                    onClick={() => {
                                                                        console.log(`🎯 User selected market: ${market.symbol} (${market.name})`);
                                                                        setSelectedMarket(market);
                                                                        setIsDropdownOpen(false);
                                                                        
                                                                        // Show immediate feedback
                                                                        setConnectionStatus(`Switching to ${market.symbol}...`);
                                                                    }}
                                                                >
                                                                    <div className='market-option__info'>
                                                                        <span className='market-option__name'>{market.name}</span>
                                                                        <span className='market-option__symbol'>{market.symbol}</span>
                                                                    </div>
                                                                    {market.symbol === selectedMarket.symbol && (
                                                                        <span className='market-option__selected'>✓</span>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    );
                                                })}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className='dtrader__chart-info'>
                                <span className='dtrader__current-price'>
                                    {currentPrice > 0 ? formatPrice(currentPrice) : '--'}
                                </span>
                                <span className={`dtrader__price-change ${priceChange >= 0 ? 'positive' : 'negative'}`}>
                                    {currentPrice > 0 ? (
                                        <>
                                            {priceChange >= 0 ? '+' : ''}
                                            {priceChange.toFixed(3)} ({((priceChange / currentPrice) * 100).toFixed(3)}
                                            %)
                                        </>
                                    ) : (
                                        '--'
                                    )}
                                </span>
                                <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '4px' }}>
                                    {connectionStatus} • {selectedMarket.symbol}
                                </div>
                            </div>
                        </div>
                        <div className='trading-chart'>
                            <div className='trading-chart__container'>
                                <div className='trading-chart__placeholder'>
                                    <div className='trading-chart__price-display'>
                                        <div className='trading-chart__current-price'>
                                            {currentPrice > 0 ? formatPrice(currentPrice) : '--'}
                                        </div>
                                        <div
                                            className={`trading-chart__price-change ${priceChange >= 0 ? 'positive' : 'negative'}`}
                                        >
                                            {currentPrice > 0 ? (
                                                <>
                                                    {priceChange >= 0 ? '+' : ''}
                                                    {priceChange.toFixed(3)} (
                                                    {((priceChange / currentPrice) * 100).toFixed(3)}%)
                                                </>
                                            ) : (
                                                '--'
                                            )}
                                        </div>
                                    </div>

                                    {/* Real-time Digit Circles */}
                                    {isConnected && currentPrice > 0 ? (
                                        <div className='main-digit-circles'>
                                            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(digit => {
                                                const percentage = getDigitPercentage(digit);
                                                const isCurrentLastDigit = digit === lastDigit;

                                                // Find highest and lowest percentages
                                                const totalTicks = Object.values(digitStats).reduce(
                                                    (sum, count) => sum + count,
                                                    0
                                                );
                                                const allPercentages = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => {
                                                    const count = digitStats[d] || 0;
                                                    return totalTicks > 0 ? (count / totalTicks) * 100 : 0;
                                                });

                                                const maxPercentage = Math.max(...allPercentages);
                                                const minPercentage = Math.min(...allPercentages.filter(p => p > 0));
                                                const currentPercentage = parseFloat(percentage);

                                                const isHighest =
                                                    Math.abs(currentPercentage - maxPercentage) < 0.1 &&
                                                    maxPercentage > 0 &&
                                                    totalTicks > 100;
                                                const isLowest =
                                                    Math.abs(currentPercentage - minPercentage) < 0.1 &&
                                                    minPercentage > 0 &&
                                                    totalTicks > 100;

                                                return (
                                                    <div key={digit} className='main-digit-item'>
                                                        <div
                                                            className={`main-digit-circle ${isCurrentLastDigit ? 'main-digit-circle--current' : ''} ${isHighest ? 'main-digit-circle--highest' : ''} ${isLowest ? 'main-digit-circle--lowest' : ''}`}
                                                        >
                                                            <div className='main-digit-circle__number'>{digit}</div>
                                                            <div className='main-digit-circle__percentage'>
                                                                {percentage}%
                                                            </div>
                                                        </div>
                                                        {isCurrentLastDigit && (
                                                            <div className='main-digit-cursor'>
                                                                <div className='main-digit-cursor__arrow'>▲</div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                height: '100px',
                                                color: '#666',
                                                fontSize: '1rem',
                                            }}
                                        >
                                            {connectionStatus}...
                                        </div>
                                    )}

                                    <div
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            height: '200px',
                                            background: '#f8f9fa',
                                            borderRadius: '8px',
                                            color: '#666',
                                            fontSize: '1.1rem',
                                            marginTop: '1rem',
                                            gap: '10px',
                                        }}
                                    >
                                        <div>
                                            📈 Live Price Data: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
                                        </div>
                                        <div style={{ fontSize: '0.9rem' }}>
                                            {priceHistory.length > 0
                                                ? `${priceHistory.length} ticks received`
                                                : 'Waiting for data...'}
                                        </div>
                                        {isConnected && currentPrice > 0 && (
                                            <div style={{ fontSize: '0.9rem', textAlign: 'center' }}>
                                                <div>
                                                    Last Digit: <strong>{lastDigit}</strong>
                                                </div>
                                                <div>
                                                    Total Ticks:{' '}
                                                    <strong>
                                                        {Object.values(digitStats).reduce(
                                                            (sum, count) => sum + count,
                                                            0
                                                        )}
                                                    </strong>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className='dtrader__trading-section'>
                        <div className='deriv-trading-panel'>
                            {/* Header */}
                            <div className='deriv-trading-panel__header'>
                                <div className='deriv-trading-panel__title'>DTrader</div>
                            </div>

                            {/* Trade Type */}
                            <div className='deriv-trading-panel__section'>
                                <label className='deriv-trading-panel__label'>Trade Type</label>
                                <div className='deriv-trading-panel__dropdown'>
                                    <select className='deriv-trading-panel__select'>
                                        <option value='rise_fall'>Rise/Fall</option>
                                        <option value='higher_lower'>Higher/Lower</option>
                                        <option value='touch_no_touch'>Touch/No Touch</option>
                                        <option value='matches_differs'>Matches/Differs</option>
                                        <option value='even_odd'>Even/Odd</option>
                                        <option value='over_under'>Over/Under</option>
                                    </select>
                                </div>
                            </div>

                            {/* Duration */}
                            <div className='deriv-trading-panel__section'>
                                <label className='deriv-trading-panel__label'>Duration</label>
                                <div className='deriv-trading-panel__duration-group'>
                                    <input
                                        type='number'
                                        className='deriv-trading-panel__input'
                                        defaultValue='5'
                                        min='1'
                                        max='10'
                                    />
                                    <select className='deriv-trading-panel__duration-select'>
                                        <option value='t'>Ticks</option>
                                        <option value='s'>Seconds</option>
                                        <option value='m'>Minutes</option>
                                        <option value='h'>Hours</option>
                                        <option value='d'>Days</option>
                                    </select>
                                </div>
                            </div>

                            {/* Stake */}
                            <div className='deriv-trading-panel__section'>
                                <label className='deriv-trading-panel__label'>Stake</label>
                                <div className='deriv-trading-panel__stake-group'>
                                    <input
                                        type='number'
                                        className='deriv-trading-panel__stake-input'
                                        defaultValue='10'
                                        min='0.35'
                                        step='0.01'
                                    />
                                    <span className='deriv-trading-panel__currency'>USD</span>
                                </div>
                            </div>

                            {/* Payout Info */}
                            <div className='deriv-trading-panel__payout-section'>
                                <div className='deriv-trading-panel__payout-row'>
                                    <span className='deriv-trading-panel__payout-label'>Payout</span>
                                    <span className='deriv-trading-panel__payout-value'>19.50 USD</span>
                                </div>
                                <div className='deriv-trading-panel__payout-row'>
                                    <span className='deriv-trading-panel__payout-label'>Profit</span>
                                    <span className='deriv-trading-panel__profit-value'>9.50 USD</span>
                                </div>
                            </div>

                            {/* Trade Buttons */}
                            <div className='deriv-trading-panel__buttons'>
                                <button className='deriv-trading-panel__btn deriv-trading-panel__btn--rise'>
                                    <div className='deriv-trading-panel__btn-content'>
                                        <div className='deriv-trading-panel__btn-label'>Rise</div>
                                        <div className='deriv-trading-panel__btn-payout'>19.50 USD</div>
                                    </div>
                                </button>
                                <button className='deriv-trading-panel__btn deriv-trading-panel__btn--fall'>
                                    <div className='deriv-trading-panel__btn-content'>
                                        <div className='deriv-trading-panel__btn-label'>Fall</div>
                                        <div className='deriv-trading-panel__btn-payout'>19.50 USD</div>
                                    </div>
                                </button>
                            </div>

                            {/* Additional Info */}
                            <div className='deriv-trading-panel__info'>
                                <div className='deriv-trading-panel__info-item'>
                                    <span className='deriv-trading-panel__info-label'>Barrier</span>
                                    <span className='deriv-trading-panel__info-value'>
                                        {currentPrice > 0 ? formatPrice(currentPrice) : '--'}
                                    </span>
                                </div>
                                <div className='deriv-trading-panel__info-item'>
                                    <span className='deriv-trading-panel__info-label'>Current Spot</span>
                                    <span className='deriv-trading-panel__info-value'>
                                        {currentPrice > 0 ? formatPrice(currentPrice) : '--'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    } catch (renderError) {
        console.error('DTrader render error:', renderError);
        return (
            <div className='dtrader'>
                <div className='dtrader__main-content'>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '400px',
                            flexDirection: 'column',
                            gap: '20px',
                            color: '#666',
                        }}
                    >
                        <div style={{ fontSize: '2rem' }}>🔧</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: '600' }}>DTrader Render Error</div>
                        <div style={{ fontSize: '1rem', textAlign: 'center', maxWidth: '400px' }}>
                            The component failed to render. Please refresh the page.
                        </div>
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                padding: '10px 20px',
                                background: '#ff444f',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                            }}
                        >
                            Refresh Page
                        </button>
                    </div>
                </div>
            </div>
        );
    }
};

export default DTrader;
