import './style.css';
import { InspectorControls, useBlockProps } from '@wordpress/block-editor';
import { registerBlockType } from '@wordpress/blocks';
import block from './block.json';
import { PanelBody, TextControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

registerBlockType<{ taxonomy: string }>(block.name, {
  title: block.title,
  attributes: block.attributes as any,
  category: block.category,
  edit: ({ attributes, setAttributes }) => (
    <>
      <InspectorControls>
        <PanelBody>
          <TextControl
            required
            label={__('Taxonomy', 'bhidapa')}
            value={attributes.taxonomy}
            onChange={(taxonomy) => setAttributes({ taxonomy })}
          />
        </PanelBody>
      </InspectorControls>
      {/* */}
      <div {...useBlockProps()}>{attributes.taxonomy}</div>
    </>
  ),
});
