import { InspectorControls, useBlockProps } from '@wordpress/block-editor';
import { registerBlockType } from '@wordpress/blocks';
import { PanelBody, ToggleControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import metadata from './block.json';
import { InnerBlocks } from '@wordpress/block-editor';

// @ts-expect-error typedefs are not correct
registerBlockType<{ mustBeLoggedIn: boolean }>(metadata.name, {
  edit: ({ attributes, setAttributes }) => {
    const blockProps = useBlockProps();
    return (
      <>
        <InspectorControls>
          <PanelBody>
            <ToggleControl
              required
              label={__('Must be logged in?', 'azp')}
              help={
                attributes.mustBeLoggedIn
                  ? "Shows if the user is logged in but doesn't have access."
                  : "Shows if the user doesn't have access, even when logged out."
              }
              checked={attributes.mustBeLoggedIn}
              onChange={(mustBeLoggedIn) => setAttributes({ mustBeLoggedIn })}
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
