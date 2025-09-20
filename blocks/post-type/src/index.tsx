import { InspectorControls, useBlockProps } from '@wordpress/block-editor';
import { registerBlockType } from '@wordpress/blocks';
import { PanelBody, ToggleControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { name, attributes, category, title } from './block.json';

registerBlockType<{ icon: boolean; plural: boolean }>(name, {
  title,
  attributes: attributes as any,
  category,
  edit: ({ attributes, setAttributes }) => (
    <>
      <InspectorControls>
        <PanelBody>
          <ToggleControl
            required
            label={__('Icon', 'bhidapa')}
            help={
              attributes.icon
                ? 'Render the post type icon before the text.'
                : "Don't render the post type icon."
            }
            checked={attributes.icon}
            onChange={(icon) => setAttributes({ icon })}
          />
          <ToggleControl
            required
            label={__('Plural', 'bhidapa')}
            help={
              attributes.plural
                ? 'Render the plural post type name.'
                : 'Render the singular post type name.'
            }
            checked={attributes.plural}
            onChange={(plural) => setAttributes({ plural })}
          />
        </PanelBody>
      </InspectorControls>
      {/*  */}
      <p {...useBlockProps()}>
        {attributes.icon ? '{icon} ' : ''}
        {attributes.plural ? 'Plural ' : 'Singular '}Post Type
      </p>
    </>
  ),
});
