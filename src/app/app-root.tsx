import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import ErrorBoundary from '@/components/error-component/error-boundary';
import ErrorComponent from '@/components/error-component/error-component';
import ChunkLoader from '@/components/loader/chunk-loader';
import TradingAssesmentModal from '@/components/trading-assesment-modal';
import { api_base } from '@/external/bot-skeleton';
import { useStore } from '@/hooks/useStore';
import { localize } from '@deriv-com/translations';
import './app-root.scss';

const AppContent = lazy(() => import('./app-content.jsx'));

const AppRootLoader = () => {
    return <ChunkLoader message={localize('Initializing Deriv Bot...')} />;
};

const ErrorComponentWrapper = observer(() => {
    const { common, dashboard } = useStore();

    if (!common.error) return null;

    // Suppress error modal when in DTrader
    const isDTraderActive = dashboard?.active_tab === 3; // DTRADER tab index
    if (isDTraderActive) {
        console.warn('Suppressing error modal in DTrader');
        // Clear the error silently
        common.setError(false, {});
        return null;
    }

    return (
        <ErrorComponent
            header={common.error?.header}
            message={common.error?.message}
            redirect_label={common.error?.redirect_label}
            redirectOnClick={common.error?.redirectOnClick}
            should_clear_error_on_click={common.error?.should_clear_error_on_click}
            setError={common.setError}
            redirect_to={common.error?.redirect_to}
            should_redirect={common.error?.should_redirect}
        />
    );
});

const AppRoot = () => {
    const store = useStore();
    const api_base_initialized = useRef(false);
    const [is_api_initialized, setIsApiInitialized] = useState(false);

    useEffect(() => {
        const initializeApi = async () => {
            if (!api_base_initialized.current) {
                await api_base.init();
                api_base_initialized.current = true;
                setIsApiInitialized(true);
            }
        };

        // Global error handler to prevent modals in DTrader
        const handleUnhandledRejection = event => {
            const isDTraderActive = store?.dashboard?.active_tab === 3;
            if (isDTraderActive) {
                console.warn('Suppressing unhandled rejection in DTrader:', event.reason);
                event.preventDefault();
            }
        };

        const handleError = event => {
            const isDTraderActive = store?.dashboard?.active_tab === 3;
            if (isDTraderActive) {
                console.warn('Suppressing error in DTrader:', event.error);
                event.preventDefault();
            }
        };

        window.addEventListener('unhandledrejection', handleUnhandledRejection);
        window.addEventListener('error', handleError);

        initializeApi();

        return () => {
            window.removeEventListener('unhandledrejection', handleUnhandledRejection);
            window.removeEventListener('error', handleError);
        };
    }, [store]);

    if (!store || !is_api_initialized) return <AppRootLoader />;

    return (
        <Suspense fallback={<AppRootLoader />}>
            <ErrorBoundary root_store={store}>
                <ErrorComponentWrapper />
                <AppContent />
                <TradingAssesmentModal />
            </ErrorBoundary>
        </Suspense>
    );
};

export default AppRoot;
