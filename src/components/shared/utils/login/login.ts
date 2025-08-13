export const redirectToLogin = () => {
    // Get the current domain for the redirect URI
    const currentOrigin = window.location.origin;
    const redirectUri = `${currentOrigin}/callback`;
    
    // Construct the OAuth URL with proper redirect_uri
    const oauthUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=88245&redirect_uri=${encodeURIComponent(redirectUri)}`;
    
    console.log('🔐 Redirecting to OAuth with redirect_uri:', redirectUri);
    window.location.href = oauthUrl;
};
