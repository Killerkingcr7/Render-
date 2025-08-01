type TTabsTitle = {
    [key: string]: string | number;
};

type TDashboardTabIndex = {
    [key: string]: number;
};

export const tabs_title: TTabsTitle = Object.freeze({
    WORKSPACE: 'Workspace',
    CHART: 'Chart',
});

export const DBOT_TABS: TDashboardTabIndex = Object.freeze({
    DASHBOARD: 0,
    FREE_BOTS: 1,
    BOT_BUILDER: 2,
    CHART: 3,
    ANALYSIS_TOOL: 4,
    BULK_TRADING: 5,
    TUTORIAL: 6,
    SIGNALS: 7,
    TRADING_HUB: 8,
});

export const MAX_STRATEGIES = 10;

export const TAB_IDS = ['id-dbot-dashboard', 'id-free-bots', 'id-bot-builder', 'id-charts', 'id-analysis-tool', 'id-bulk-trading', 'id-tutorials', 'id-signals', 'id-trading-hub'];

export const DEBOUNCE_INTERVAL_TIME = 500;
