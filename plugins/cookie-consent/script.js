// Update version in cookie-consent.php when changing this file.
const { lang, translations: t } = window.cookieConsent;

// functional is the wp consent api's strictly necessary category, it never needs consent and opt-in would deny it otherwise
window.wp_set_consent('functional', 'allow');

/** @param {'allow' | 'deny'} value */
function setStatisticsConsent(value) {
  // site kit maps the wp consent api "statistics" category to google's analytics_storage
  window.wp_set_consent('statistics', value);
  // the banner has a single analytics category, so anonymous statistics follow the same choice
  window.wp_set_consent('statistics-anonymous', value);
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
          onAccept: () => setStatisticsConsent('allow'),
          onReject: () => setStatisticsConsent('deny'),
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
