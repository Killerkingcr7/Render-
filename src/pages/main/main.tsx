import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import ChunkLoader from '@/components/loader/chunk-loader';
import DesktopWrapper from '@/components/shared_ui/desktop-wrapper';
import Dialog from '@/components/shared_ui/dialog';
import MobileWrapper from '@/components/shared_ui/mobile-wrapper';
import Tabs from '@/components/shared_ui/tabs/tabs';
import TradingViewModal from '@/components/trading-view-chart/trading-view-modal';
import { DBOT_TABS } from '@/constants/bot-contents';
import { api_base, load, updateWorkspaceName } from '@/external/bot-skeleton';
import { save_types } from '@/external/bot-skeleton/constants/save-type';
import { CONNECTION_STATUS } from '@/external/bot-skeleton/services/api/observables/connection-status-stream';
import { useApiBase } from '@/hooks/useApiBase';
import { useStore } from '@/hooks/useStore';
import { Localize, localize } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';
import RunPanel from '../../components/run-panel';
import ChartModal from '../chart/chart-modal';
import Dashboard from '../dashboard';
import RunStrategy from '../dashboard/run-strategy';
import {
    AnalysisToolIcon,
    BotBuilderIcon,
    BotIcon,
    BulkTradingIcon,
    ChartsIcon,
    DashboardIcon,
    DTraderIcon,
    FreeBotsIcon,
    SignalsIcon,
    TradingHubIcon,
    TutorialsIcon,
} from './components/tab-icons';

const Chart = lazy(() => import('../chart'));
const Tutorial = lazy(() => import('../tutorials'));
const BotBuilder = lazy(() => import('../bot-builder'));
const DTrader = lazy(() => import('../dtrader'));

const AppWrapper = observer(() => {
    const { connectionStatus } = useApiBase();
    const { dashboard, load_modal, run_panel, summary_card } = useStore();
    const { active_tab, is_chart_modal_visible, setActiveTab } = dashboard;
    const { onEntered } = load_modal;
    const {
        is_dialog_open,
        dialog_options,
        onCancelButtonClick,
        onCloseDialog,
        onOkButtonClick,
        stopBot,
        is_drawer_open,
    } = run_panel;
    const { cancel_button_text, ok_button_text, title, message } = dialog_options as { [key: string]: string };
    const { clear } = summary_card;
    const { isDesktop } = useDevice();

    const [bots, setBots] = useState<Array<{ title: string; image: string; filePath: string; xmlContent: string }>>([]);

    useEffect(() => {
        if (connectionStatus !== CONNECTION_STATUS.OPENED) {
            const is_bot_running = document.getElementById('db-animation__stop-button') !== null;
            if (is_bot_running) {
                clear();
                stopBot();
                api_base.setIsRunning(false);
            }
        }
    }, [clear, connectionStatus, stopBot]);

    useEffect(() => {
        const fetchBots = async () => {
            const botFiles = [
                'under 8 entry.xml',
                'dec  entry point.xml',
                'Over the years .xml',
                'Thunder ⚡.xml',
                'Wantam switcher.xml',
                'Reborn HnR.xml',
            ];
            const botPromises = botFiles.map(async file => {
                try {
                    const response = await fetch(file);
                    if (!response.ok) {
                        throw new Error(`Failed to fetch ${file}: ${response.statusText}`);
                    }
                    const text = await response.text();
                    const parser = new DOMParser();
                    const xml = parser.parseFromString(text, 'application/xml');
                    return {
                        title: file.split('/').pop() || file,
                        image: xml.getElementsByTagName('image')[0]?.textContent || 'default_image_path',
                        filePath: file,
                        xmlContent: text,
                    };
                } catch (error) {
                    console.error(error);
                    return null;
                }
            });
            const bots = (await Promise.all(botPromises)).filter(Boolean) as Array<{
                title: string;
                image: string;
                filePath: string;
                xmlContent: string;
            }>;
            setBots(bots);
        };

        fetchBots();
    }, []);

    const handleTabChange = React.useCallback(
        (tab_index: number) => {
            setActiveTab(tab_index);
        },
        [setActiveTab]
    );

    const handleBotClick = useCallback(
        async (bot: { title: string; filePath: string; xmlContent: string }) => {
            setActiveTab(DBOT_TABS.BOT_BUILDER);
            try {
                console.log('Loading bot:', bot.title, bot.filePath);
                console.log('XML Content:', bot.xmlContent);

                // Use the load function directly instead of load_modal.loadFileFromContent
                await load({
                    block_string: bot.xmlContent,
                    file_name: bot.title,
                    workspace: (window as unknown as { Blockly?: { derivWorkspace?: unknown } }).Blockly
                        ?.derivWorkspace,
                    from: save_types.UNSAVED,
                    drop_event: {},
                    strategy_id: null,
                    showIncompatibleStrategyDialog: false,
                });

                updateWorkspaceName();
                console.log('Bot loaded successfully!');
            } catch (error) {
                console.error('Error loading bot file:', error);
            }
        },
        [setActiveTab]
    );

    const handleOpen = useCallback(async () => {
        await load_modal.loadFileFromRecent();
        setActiveTab(DBOT_TABS.BOT_BUILDER);
    }, [load_modal, setActiveTab]);

    const handleBulkTradingBotClick = useCallback(async () => {
        setActiveTab(DBOT_TABS.BOT_BUILDER);
        try {
            // Pre-built bulk trading bot XML
            const bulkTradingBotXML = `<?xml version="1.0" encoding="UTF-8"?>
<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
    <variable id="bulk_stake">BULK_STAKE</variable>
    <variable id="contracts_count">CONTRACTS_COUNT</variable>
  </variables>
  <block type="trade_definition" id="trade_def_1" deletable="false" x="0" y="0">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="market_1" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">R_100</field>
        <next>
          <block type="trade_definition_tradetype" id="tradetype_1" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">callput</field>
            <field name="TRADETYPE_LIST">callput</field>
            <next>
              <block type="trade_definition_contracttype" id="contracttype_1" deletable="false" movable="false">
                <field name="TYPE_LIST">both</field>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="trade_definition_tradeoptions" id="tradeoptions_1" x="0" y="200">
    <field name="DURATIONTYPE_LIST">t</field>
    <field name="CURRENCY_LIST">USD</field>
    <value name="DURATION">
      <shadow type="math_number">
        <field name="NUM">5</field>
      </shadow>
    </value>
    <value name="AMOUNT">
      <shadow type="math_number">
        <field name="NUM">1</field>
      </shadow>
    </value>
  </block>
  <block type="before_purchase" id="before_purchase_1" x="0" y="350">
    <statement name="BEFOREPURCHASE_STACK">
      <block type="bulk_purchase" id="bulk_purchase_1">
        <value name="NUM_TRADES">
          <shadow type="math_number">
            <field name="NUM">5</field>
          </shadow>
        </value>
        <field name="CONTRACT_TYPE">CALL</field>
      </block>
    </statement>
  </block>
  <block type="after_purchase" id="after_purchase_1" x="0" y="500">
    <statement name="AFTERPURCHASE_STACK">
      <block type="trade_again" id="trade_again_1" />
    </statement>
  </block>
</xml>`;

            // Load the bulk trading bot
            await load({
                block_string: bulkTradingBotXML,
                file_name: 'Bulk Trading Bot',
                workspace: (window as unknown as { Blockly?: { derivWorkspace?: unknown } }).Blockly?.derivWorkspace,
                from: save_types.UNSAVED,
                drop_event: {},
                strategy_id: null,
                showIncompatibleStrategyDialog: false,
            });

            const windowWithBlockly = window as unknown as {
                Blockly?: { derivWorkspace?: { strategy_to_load?: string } };
            };
            if (windowWithBlockly.Blockly?.derivWorkspace) {
                windowWithBlockly.Blockly.derivWorkspace.strategy_to_load = bulkTradingBotXML;
            }

            updateWorkspaceName();
            console.log('✅ Bulk Trading Bot loaded successfully!');
        } catch (error) {
            console.error('Error loading Bulk Trading Bot:', error);
            alert('Failed to load Bulk Trading Bot. Please try again.');
        }
    }, [setActiveTab]);

    const showRunPanel = [
        DBOT_TABS.BOT_BUILDER,
        DBOT_TABS.DTRADER,
        DBOT_TABS.CHART,
        DBOT_TABS.ANALYSIS_TOOL,
        DBOT_TABS.BULK_TRADING,
        DBOT_TABS.SIGNALS,
    ].includes(active_tab);

    return (
        <React.Fragment>
            <div className='main'>
                <div className='main__container'>
                    <Tabs
                        active_index={active_tab}
                        className='main__tabs'
                        onTabItemChange={onEntered}
                        onTabItemClick={handleTabChange}
                        top
                    >
                        {/* Dashboard Tab - First */}
                        <div
                            label={
                                <>
                                    <DashboardIcon />
                                    <Localize i18n_default_text='Dashboard' />
                                </>
                            }
                            id='id-dbot-dashboard'
                        >
                            <Dashboard handleTabChange={handleTabChange} />
                            <button onClick={handleOpen}>Load Bot</button>
                        </div>

                        {/* Free Bots Tab - Second */}
                        <div
                            label={
                                <>
                                    <FreeBotsIcon />
                                    <Localize i18n_default_text='Free Bots' />
                                </>
                            }
                            id='id-free-bots'
                        >
                            <div className='free-bots'>
                                <h2 className='free-bots__heading'>
                                    <Localize i18n_default_text='Free Bots' />
                                </h2>
                                <div className='free-bots__content-wrapper'>
                                    <ul className='free-bots__content'>
                                        {bots.map((bot, index) => (
                                            <li
                                                className='free-bot'
                                                key={index}
                                                onClick={() => {
                                                    handleBotClick(bot);
                                                }}
                                            >
                                                <BotIcon />
                                                <div className='free-bot__details'>
                                                    <h3 className='free-bot__title'>{bot.title}</h3>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* Bot Builder Tab - Third */}
                        <div
                            label={
                                <>
                                    <BotBuilderIcon />
                                    <Localize i18n_default_text='Bot Builder' />
                                </>
                            }
                            id='id-bot-builder'
                        >
                            <Suspense fallback={<ChunkLoader message={localize('Loading Bot Builder...')} />}>
                                <BotBuilder />
                            </Suspense>
                        </div>

                        {/* DTrader Tab - Fourth */}
                        <div
                            label={
                                <>
                                    <DTraderIcon />
                                    <Localize i18n_default_text='DTrader' />
                                </>
                            }
                            id='id-dtrader'
                        >
                            <Suspense fallback={<ChunkLoader message={localize('Loading DTrader...')} />}>
                                <DTrader />
                            </Suspense>
                        </div>

                        {/* Charts Tab - Fifth */}
                        <div
                            label={
                                <>
                                    <ChartsIcon />
                                    <Localize i18n_default_text='Charts' />
                                </>
                            }
                            id='id-charts'
                        >
                            <Suspense fallback={<ChunkLoader message={localize('Please wait, loading chart...')} />}>
                                <Chart show_digits_stats={false} />
                            </Suspense>
                        </div>

                        {/* Analysis Tool Tab - Sixth */}
                        <div
                            label={
                                <>
                                    <AnalysisToolIcon />
                                    <Localize i18n_default_text='Analysis Tool' />
                                </>
                            }
                            id='id-analysis-tool'
                        >
                            <div
                                className={classNames('dashboard__chart-wrapper', {
                                    'dashboard__chart-wrapper--expanded': is_drawer_open && isDesktop,
                                    'dashboard__chart-wrapper--modal': is_chart_modal_visible && isDesktop,
                                })}
                            >
                                <iframe
                                    src='/Black-man-main/Black-man-main/index.html'
                                    width='100%'
                                    height='600px'
                                    style={{ border: 'none', display: 'block' }}
                                    title='Analysis Tool'
                                    scrolling='yes'
                                />
                            </div>
                        </div>

                        {/* The rest of the tabs follow in their original order */}
                        <div
                            label={
                                <>
                                    <TutorialsIcon />
                                    <Localize i18n_default_text='Tutorials' />
                                </>
                            }
                            id='id-tutorials'
                        >
                            <Suspense
                                fallback={<ChunkLoader message={localize('Please wait, loading tutorials...')} />}
                            >
                                <Tutorial handleTabChange={handleTabChange} />
                            </Suspense>
                        </div>
                        <div
                            label={
                                <>
                                    <BulkTradingIcon />
                                    <Localize i18n_default_text='Bulk Trading' />
                                </>
                            }
                            id='id-bulk-trading'
                        >
                            <div className='bulk-trading'>
                                <h2 className='bulk-trading__heading'>
                                    <Localize i18n_default_text='Bulk Trading Bot' />
                                </h2>
                                <div className='bulk-trading__description'>
                                    <p>
                                        <Localize i18n_default_text='This pre-built bot demonstrates simultaneous contract purchases for diversified trading strategies.' />
                                    </p>
                                </div>
                                <div className='bulk-trading__content-wrapper'>
                                    <div className='bulk-trading__bot-preview'>
                                        <h3>
                                            <Localize i18n_default_text='Pre-built Bulk Trading Strategy' />
                                        </h3>
                                        <ul className='bulk-trading__features'>
                                            <li>
                                                ✅ <Localize i18n_default_text='Purchases 5 contracts simultaneously' />
                                            </li>
                                            <li>
                                                ✅{' '}
                                                <Localize i18n_default_text='Risk diversification across multiple positions' />
                                            </li>
                                            <li>
                                                ✅ <Localize i18n_default_text='Automated profit/loss management' />
                                            </li>
                                            <li>
                                                ✅{' '}
                                                <Localize i18n_default_text='Customizable contract types and amounts' />
                                            </li>
                                        </ul>
                                        <button
                                            className='bulk-trading__load-btn'
                                            onClick={() => handleBulkTradingBotClick()}
                                        >
                                            <Localize i18n_default_text='Load Bulk Trading Bot' />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div
                            label={
                                <>
                                    <SignalsIcon />
                                    <Localize i18n_default_text='Signals' />
                                </>
                            }
                            id='id-signals'
                        >
                            <div
                                className={classNames('dashboard__chart-wrapper', {
                                    'dashboard__chart-wrapper--expanded': is_drawer_open && isDesktop,
                                    'dashboard__chart-wrapper--modal': is_chart_modal_visible && isDesktop,
                                })}
                            >
                                <iframe
                                    src='signals'
                                    width='100%'
                                    height='600px'
                                    style={{ border: 'none', display: 'block' }}
                                    title='Signals'
                                    scrolling='yes'
                                />
                            </div>
                        </div>
                        <div
                            label={
                                <>
                                    <TradingHubIcon />
                                    <Localize i18n_default_text='Trading Hub' />
                                </>
                            }
                            id='id-Trading-Hub'
                        >
                            <div
                                className={classNames('dashboard__chart-wrapper', {
                                    'dashboard__chart-wrapper--expanded': is_drawer_open && isDesktop,
                                    'dashboard__chart-wrapper--modal': is_chart_modal_visible && isDesktop,
                                })}
                            >
                                <iframe
                                    src='https://mekop.netlify.app'
                                    height='600px'
                                    frameBorder='0'
                                    title='Trading Hub'
                                />
                            </div>
                        </div>
                    </Tabs>
                </div>
            </div>
            <DesktopWrapper>
                <div className='main__run-strategy-wrapper'>
                    <RunStrategy />
                    {showRunPanel && <RunPanel />}
                </div>
                <ChartModal />
                <TradingViewModal />
            </DesktopWrapper>
            <MobileWrapper>
                <RunPanel />
            </MobileWrapper>
            <Dialog
                cancel_button_text={cancel_button_text || localize('Cancel')}
                confirm_button_text={ok_button_text || localize('Ok')}
                has_close_icon
                is_visible={is_dialog_open}
                onCancel={onCancelButtonClick}
                onClose={onCloseDialog}
                onConfirm={onOkButtonClick || onCloseDialog}
                title={title}
            >
                {message}
            </Dialog>
        </React.Fragment>
    );
});

const Main = AppWrapper;
export default Main;
