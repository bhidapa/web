import '@typeform/embed/build/css/popup.css';
import { createPopup } from '@typeform/embed';
import domReady from '@wordpress/dom-ready';

domReady(() => {
  for (const root of document.querySelectorAll(
    // initialized typeforms with the form id
    '.wp-block-bhidapa-typeform[data-typeform-form-id]',
  )) {
    const formId = root.getAttribute('data-typeform-form-id');
    if (!formId) {
      console.warn('Typeform block is the form ID data');
      continue;
    }
    const button = root.querySelector('button');
    if (!button) {
      console.warn('Typeform block is missing button element');
      continue;
    }
    const { open } = createPopup(formId, {
      iframeProps: {
        style: [
          'border: 0',
          'border-radius: 0',
          // creates a new stacking context and can force the browser
          // to use hardware acceleration
          'transform: translateZ(0px)',
        ].join(';'),
      },
    });
    button.onclick = open;
  }
});
