import { InnerBlocks, useBlockProps } from '@wordpress/block-editor';
import { registerBlockType } from '@wordpress/blocks';
import metadata from './block.json';

// @ts-expect-error typedefs are not correct
registerBlockType(metadata.name, {
  edit: () => {
    const blockProps = useBlockProps();
    return (
      <div {...blockProps}>
        <InnerBlocks />
      </div>
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
