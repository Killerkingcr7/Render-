import React from 'react';
import ErrorModal from '../error-modal';
import PageError from '../page-error';
import UnhandledErrorModal from '../unhandled-error-modal';

type TPageErrorContainer = {
    buttonOnClick?: () => void;
    error_header?: React.ReactNode;
    error_messages?: Array<{ message: string; has_html?: boolean } | React.ReactNode>;
    redirect_labels: string[];
    redirect_urls?: string[];
    setError?: (has_error: boolean, error: React.ReactNode) => void;
    should_clear_error_on_click?: boolean;
    should_redirect?: boolean;
};

const PageErrorContainer = ({ error_header, error_messages, ...props }: TPageErrorContainer) => {
    // Check if we're in DTrader and suppress all error modals
    const isDTraderPath =
        window.location.hash?.includes('dtrader') ||
        window.location.pathname?.includes('dtrader') ||
        document.querySelector('#id-dtrader')?.classList.contains('dc-tabs__item--active');

    // Also check if DTrader tab is active by looking at tab classes
    const dtraderTabActive = document
        .querySelector('.dc-tabs__item:nth-child(4)')
        ?.classList.contains('dc-tabs__item--active');

    console.log('PageErrorContainer check:', {
        isDTraderPath,
        dtraderTabActive,
        hash: window.location.hash,
        activeTab: document.querySelector('.dc-tabs__item--active')?.textContent,
    });

    if (isDTraderPath || dtraderTabActive) {
        console.warn('Suppressing all error modals in DTrader');
        return null;
    }

    if (error_header && error_messages) {
        return <PageError header={error_header} messages={error_messages} {...props} />;
    }
    // If there are error messages from the backend, show an error modal with the messages
    else if (error_messages) {
        return <ErrorModal messages={error_messages} />;
    }
    return <UnhandledErrorModal />;
};

export default PageErrorContainer;
