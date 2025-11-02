import {
  InnerBlocks,
  InspectorControls,
  useBlockProps,
} from '@wordpress/block-editor';
import { registerBlockType } from '@wordpress/blocks';
import { PanelBody, TextControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import metadata from './block.json';

// @ts-expect-error typedefs are not correct
registerBlockType<{ field: string }>(metadata.name, {
  edit: ({ attributes, setAttributes }) => {
    const blockProps = useBlockProps();
    return (
      <>
        <InspectorControls>
          <PanelBody>
            <TextControl
              required
              label={__('Field', 'azp')}
              value={attributes.field}
              onChange={(value) => setAttributes({ field: value })}
            />
          </PanelBody>
        </InspectorControls>
        {/*  */}
        <div {...blockProps}>
          <InnerBlocks />
        </div>
      </>
    );
  },
  save: () => {
    const blockProps = useBlockProps.save();
    return (
      <div {...blockProps}>
        <InnerBlocks.Content />
      </div>
    );
  },
});
