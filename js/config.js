/* ============ SETTINGS (edit these) ============ */
window.APP_CONFIG = {
  // Your Apps Script Web App URL (Deploy > Manage deployments). It ends with /exec.
  // Editing the existing deployment (New version) keeps the same URL.
  SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbx8e7AgMDUMKWMw83wIuBk2fqLsgsF-LcIprpPwRnuQrys5qfp6L5aNC7hAbwR1-IHy/exec',

  APP_NAME: 'MS Designs & Printing',
  APP_SUB: 'Business Management System',
  APP_LOGO: 'logo.png',      // the company logo, next to index.html; empty shows the MS mark
  BRAND_COLOR: '',           // e.g. '#0e5a61'; leave '' for the standard blue
  CURRENCY: 'GMD',

  // Background notifications (Firebase Cloud Messaging). These are the PUBLIC web-app values of the company's own Firebase project: they are not secrets.
  // The private key stays on the server only (Script property FCM_SERVICE_ACCOUNT, see DEPLOY.md). Leave FIREBASE as null to hide "Turn on notifications".
  FIREBASE: {
    apiKey: 'AIzaSyAlxp2zEh_KfzBopNEjGi7RwQakC1tZ1eE',
    authDomain: 'jangafrika-13cc2.firebaseapp.com',
    projectId: 'jangafrika-13cc2',
    storageBucket: 'jangafrika-13cc2.firebasestorage.app',
    messagingSenderId: '1045761535833',
    appId: '1:1045761535833:web:72209f733e94124e9ee648'
  },
  VAPID_KEY: 'BMqHM6Pn8Bbm-ZuloibGiPSjzqLWEIZTJONx0LTg0Jtz7g8SJTcOFZzVi5dx0tUYTkTabUFCNPJLvGcrUszXrq0',

  // "Continue with Google" on the sign-in page: the OAuth client ID from Google Cloud (ends in .apps.googleusercontent.com).
  // It is NOT a secret. Put the same ID in System settings > GOOGLE_CLIENT_ID. Leave '' to hide the Google button.
  // Never put a client secret here or anywhere else.
  GOOGLE_CLIENT_ID: '560389458832-d2jchnffug3g4lr2tv2b81qln6rggeqt.apps.googleusercontent.com'
};
/* ================================================ */
