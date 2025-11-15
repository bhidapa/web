// wp-scripts will build and output a css file to build/style-index.css
// this is why we need to `"style": "file:./view.css"` in block.json
import './view.css';

import { createRoot } from '@wordpress/element';
import domReady from '@wordpress/dom-ready';
import { Attributes } from './attributes';
import * as prijave from './prijave';

domReady(() => {
  const el = document.querySelector('[data-azp-forms-root]')!;
  const attributes: Attributes = JSON.parse(
    el.getAttribute('data-azp-forms-attributes')!,
  );
  const Prijava = prijave[attributes.imePrijave];
  createRoot(document.querySelector('[data-azp-forms-root]')!).render(
    <Prijava />,
  );
});
