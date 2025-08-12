export const APP_IDS = {
    LOCALHOST: 88245, // Keep for development
    TMP_STAGING: 88245, // Keep for staging
    STAGING: 88245,
    STAGING_BE: 88245,
    STAGING_ME: 88245,
    PRODUCTION: 88245, // Your app ID
    PRODUCTION_BE: 88245,
    PRODUCTION_ME: 88245,
    LIVE: 88245, // Your app ID
};

export const domain_app_ids = {
    'master.bot-standalone.pages.dev': APP_IDS.TMP_STAGING,
    'staging-dbot.deriv.com': APP_IDS.STAGING,
    'staging-dbot.deriv.be': APP_IDS.STAGING_BE,
    'staging-dbot.deriv.me': APP_IDS.STAGING_ME,
    'dbot.deriv.com': APP_IDS.PRODUCTION,
    'dbot.deriv.be': APP_IDS.PRODUCTION_BE,
    'dbot.deriv.me': APP_IDS.PRODUCTION_ME,
    'bot.derivlite.com': APP_IDS.LIVE,
    'dectrading.netlify.app': APP_IDS.LIVE, // Your domain
};

export const getAppId = () => {
    let app_id = window.localStorage.getItem('config.app_id');

    if (!app_id || app_id === '69811') {
        console.warn("⚠️ App ID is invalid, forcing correct App ID...");
        app_id = '88245'; // Updated to use your app ID
        window.localStorage.setItem('config.app_id', app_id);
    }

    console.log("🔍 [config.ts] Using App ID:", app_id);
    return app_id;
};
