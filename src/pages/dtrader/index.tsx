import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import MarketSelector from './components/market-selector';
import TradingChart from './components/trading-chart';
import TradingPanel from './components/trading-panel';
import './dtrader.scss';

// Error boundary component
class DTraderErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.warn('DTrader Error Boundary caught an error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className='dtrader'>
                    <div className='dtrader__error-fallback'>
                        <h3>DTrader is loading...</h3>
                        <p>Initializing trading interface with simulated data.</p>
                        <button onClick={() => this.setState({ hasError: false })} className='dtrader__retry-button'>
                            Retry
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

const DTrader: React.FC = observer(() => {
    const store = useStore();
    const chart_store = store?.chart_store;
    const [headerPrice, setHeaderPrice] = useState<number>(0);
    const [headerChange, setHeaderChange] = useState<number>(0);

    // Format price based on symbol-specific decimal places
    const formatPrice = (price: number, symbol?: string) => {
        const currentSymbol = symbol || chart_store?.symbol || '';

        // Define decimal places for each symbol
        const decimalPlaces: { [key: string]: number } = {
            // 2 decimal places
            '1HZ50V': 2, // Volatility 50 (1s)
            '1HZ25V': 2, // Volatility 25 (1s)
            '1HZ10V': 2, // Volatility 10 (1s)
            '1HZ75V': 2, // Volatility 75 (1s)
            '1HZ100V': 2, // Volatility 100 (1s)
            R_100: 2, // Volatility 100

            // 3 decimal places
            R_25: 3, // Volatility 25
            R_10: 3, // Volatility 10
            '1HZ30V': 3, // Volatility 30 (1s)
            '1HZ90V': 3, // Volatility 90 (1s)
            '1HZ15V': 3, // Volatility 15 (1s)

            // 4 decimal places
            R_50: 4, // Volatility 50
            R_75: 4, // Volatility 75
        };

        const places = decimalPlaces[currentSymbol] || 5; // Default to 5 decimal places for unknown symbols
        return price.toFixed(places);
    };

    // Listen for price updates from the chart component
    useEffect(() => {
        const handlePriceUpdate = (event: CustomEvent) => {
            const { price, change } = event.detail;
            setHeaderPrice(price);
            setHeaderChange(change);
        };

        window.addEventListener('priceUpdate', handlePriceUpdate as EventListener);

        return () => {
            window.removeEventListener('priceUpdate', handlePriceUpdate as EventListener);
        };
    }, []);

    return (
        <DTraderErrorBoundary>
            <div className='dtrader'>
                <div className='dtrader__main-content'>
                    <div className='dtrader__chart-section'>
                        <div className='dtrader__chart-header'>
                            <MarketSelector />
                            <div className='dtrader__chart-info'>
                                <span className='dtrader__current-price'>
                                    {headerPrice > 0 ? formatPrice(headerPrice) : '--'}
                                </span>
                                <span
                                    className={`dtrader__price-change ${headerChange >= 0 ? 'positive' : 'negative'}`}
                                >
                                    {headerPrice > 0 ? (
                                        <>
                                            {headerChange >= 0 ? '+' : ''}
                                            {headerChange.toFixed(3)} ({((headerChange / headerPrice) * 100).toFixed(3)}
                                            %)
                                        </>
                                    ) : (
                                        '--'
                                    )}
                                </span>
                                <div className='dtrader__market-info'>
                                    <span className='market-symbol'>Current: {chart_store?.symbol || '1HZ10V'}</span>
                                </div>
                            </div>
                        </div>
                        <TradingChart />
                    </div>

                    <div className='dtrader__trading-section'>
                        <TradingPanel />
                    </div>
                </div>
            </div>
        </DTraderErrorBoundary>
    );
});

export default DTrader;
