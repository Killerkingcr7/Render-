import React from 'react';
import PropTypes from 'prop-types';
import ErrorComponent from './index';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    componentDidCatch = (error, info) => {
        if (window.TrackJS) window.TrackJS.console.log(this.props.root_store);

        // Check if we're in DTrader and suppress the error modal
        const isDTraderActive = this.props.root_store?.dashboard?.active_tab === 3; // DTRADER tab index
        const isDTraderPath =
            window.location.hash?.includes('dtrader') || window.location.pathname?.includes('dtrader');

        if (isDTraderActive || isDTraderPath) {
            console.warn('Suppressing error modal in DTrader:', error);
            // Don't set hasError to true, just log the error
            return;
        }

        this.setState({
            hasError: true,
            error,
            info,
        });
    };
    render = () => (this.state.hasError ? <ErrorComponent should_show_refresh={true} /> : this.props.children);
}

ErrorBoundary.propTypes = {
    root_store: PropTypes.object,
    children: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.node), PropTypes.node]),
};

export default ErrorBoundary;
