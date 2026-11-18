// Update version in cookie-consent.php when changing this file.
const { lang, translations: t } = window.cookieConsent;

/** @param {'granted' | 'denied'} state */
function updateAnalyticsConsent(state) {
  // gtag is defined in the head by the plugin before site kit loads google analytics
  window.gtag('consent', 'update', { analytics_storage: state });
}

window.CookieConsent.run({
  guiOptions: {
    consentModal: {
      position: 'bottom right',
    },
  },
  categories: {
    necessary: {
      readOnly: true,
    },
    analytics: {
      // drop the ga cookies when consent is revoked, denying only stops new ones being written
      autoClear: {
        cookies: [{ name: /^_ga/ }],
      },
      services: {
        'Google Analytics': {
          // also runs on every page load when consent was given earlier
          onAccept: () => updateAnalyticsConsent('granted'),
          onReject: () => updateAnalyticsConsent('denied'),
        },
      },
    },
  },
  language: {
    // the server already picked the polylang language so there is only one translation
    default: lang,
    translations: {
      [lang]: {
        consentModal: {
          title: t.consentTitle,
          description: t.consentDescription,
          acceptAllBtn: t.acceptAllBtn,
          acceptNecessaryBtn: t.acceptNecessaryBtn,
          showPreferencesBtn: t.showPreferencesBtn,
        },
        preferencesModal: {
          title: t.preferencesTitle,
          acceptAllBtn: t.acceptAllBtn,
          acceptNecessaryBtn: t.acceptNecessaryBtn,
          savePreferencesBtn: t.savePreferencesBtn,
          closeIconLabel: t.closeIconLabel,
          serviceCounterLabel: t.serviceCounterLabel,
          sections: [
            {
              title: t.usageTitle,
              description: t.usageDescription,
            },
            {
              title: `${t.necessaryTitle} <span class="pm__badge">${t.alwaysEnabled}</span>`,
              description: t.necessaryDescription,
              linkedCategory: 'necessary',
            },
            {
              title: t.analyticsTitle,
              description: t.analyticsDescription,
              linkedCategory: 'analytics',
            },
            {
              title: t.questionsTitle,
              // contains the mailto link to info@bhidapa.ba
              description: t.questionsDescription,
            },
          ],
        },
      },
    },
  },
});
