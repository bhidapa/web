import { InspectorControls, useBlockProps } from '@wordpress/block-editor';
import { registerBlockType } from '@wordpress/blocks';
import { PanelBody, SelectControl } from '@wordpress/components';
import block from './block.json';
import * as prijave from './prijave';

type ImePrijave = keyof typeof prijave;

function Prijava({ imePrijave, ...rest }: { imePrijave: ImePrijave }) {
  const IzabranaPrijava = prijave[imePrijave];
  if (!IzabranaPrijava) {
    return (
      <p style={{ color: 'orange' }}>
        ⚠️ Prijava{imePrijave ? `"${imePrijave}" ` : ' '}nije pronađena
      </p>
    );
  }
  return <IzabranaPrijava {...rest} />;
}

registerBlockType<{ imePrijave: ImePrijave }>(block.name, {
  title: block.title,
  attributes: block.attributes as any,
  category: block.category,
  edit: ({ attributes, setAttributes }) => (
    <>
      <InspectorControls>
        <PanelBody>
          <SelectControl
            label="Prijava"
            options={[
              {
                disabled: true,
                label: 'Izaberite prijavu...',
                value: '',
              },
              ...Object.keys(prijave).map((prijava) => ({
                label: prijava,
                value: prijava,
              })),
            ]}
            value={attributes.imePrijave}
            onChange={(imePrijave) =>
              setAttributes({ imePrijave: imePrijave as ImePrijave })
            }
          />
        </PanelBody>
      </InspectorControls>
      {/*  */}
      <div {...useBlockProps()}>
        <Prijava imePrijave={attributes.imePrijave} />
      </div>
    </>
  ),
  save: ({ attributes }) => (
    <div {...useBlockProps.save()} data-wp-interactive="azp/forms">
      <Prijava imePrijave={attributes.imePrijave} />
    </div>
  ),
});
