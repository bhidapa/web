import { InspectorControls, useBlockProps } from '@wordpress/block-editor';
import { registerBlockType } from '@wordpress/blocks';
import { PanelBody, TextControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import block from './block.json';

registerBlockType<{ name: string }>(block.name, {
  title: block.title,
  attributes: block.attributes as any,
  category: block.category,
  edit: ({ attributes, setAttributes }) => (
    <>
      <InspectorControls>
        <PanelBody>
          <TextControl
            required
            label={__('Form Name', 'azp')}
            value={attributes.name}
            onChange={(name) => setAttributes({ name })}
          />
        </PanelBody>
      </InspectorControls>
      {/*  */}
      <p {...useBlockProps()}>
        Rendering form <i>{attributes.name}</i>
      </p>
    </>
  ),
  save: ({ attributes }) => {
    return <b>TODO: {attributes.name}</b>;
  },
});
