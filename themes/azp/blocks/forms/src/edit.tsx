import { InspectorControls, useBlockProps } from '@wordpress/block-editor';
import { registerBlockType } from '@wordpress/blocks';
import { PanelBody, SelectControl } from '@wordpress/components';
import block from './block.json';
import * as prijave from './prijave';
import { Attributes, ImePrijave } from './attributes';

registerBlockType<Attributes>(block.name, {
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
        {prijave[attributes.imePrijave] ? (
          <p>
            ℹ️ Izabrana je prijava "{attributes.imePrijave}". Pregledajte
            stranicu kako bi vidjeli formu.
          </p>
        ) : (
          <p style={{ color: 'orange' }}>
            ⚠️ Prijava
            {attributes.imePrijave ? `"${attributes.imePrijave}" ` : ' '}nije
            pronađena
          </p>
        )}
      </div>
    </>
  ),
  save: ({ attributes }) => (
    <div
      {...useBlockProps.save()}
      data-azp-forms-root
      data-azp-forms-attributes={JSON.stringify(attributes)}
    >
      Aplikaciona forma se učitava. Molimo pričekajte...
    </div>
  ),
});
