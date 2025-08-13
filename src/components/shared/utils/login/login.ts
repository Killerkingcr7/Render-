export const redirectToLogin = () => {
    // Get the current domain for the redirect URI
    const currentOrigin = window.location.origin;
    const redirectUri = `${currentOrigin}/callback`;
    
    // Debug logging
    console.log('🔍 OAuth Debug Info:');
    console.log('- Current Origin:', currentOrigin);
    console.log('- Current Hostname:', window.location.hostname);
    console.log('- Redirect URI:', redirectUri);
    console.log('- App ID: 96171');
    
    // Construct the OAuth URL with proper redirect_uri
    const oauthUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=96171&redirect_uri=${encodeURIComponent(redirectUri)}`;
    
    console.log('🔐 Full OAuth URL:', oauthUrl);
    console.log('🚀 Redirecting to OAuth...');
    
    window.location.href = oauthUrl;
};
