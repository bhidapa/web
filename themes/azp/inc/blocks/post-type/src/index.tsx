import { InspectorControls, useBlockProps } from '@wordpress/block-editor';
import { registerBlockType } from '@wordpress/blocks';
import { PanelBody, ToggleControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import metadata from './block.json';

// @ts-expect-error typedefs are not correct
registerBlockType<{ icon: boolean; plural: boolean }>(metadata.name, {
  edit: ({ attributes, setAttributes }) => (
    <>
      <InspectorControls>
        <PanelBody>
          <ToggleControl
            required
            label={__('Icon', 'azp')}
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
            label={__('Plural', 'azp')}
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
