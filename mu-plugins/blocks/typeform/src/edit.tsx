import {
  InnerBlocks,
  InspectorControls,
  useBlockProps,
} from '@wordpress/block-editor';
import { registerBlockType } from '@wordpress/blocks';
import { PanelBody, TextControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import block from './block.json';

registerBlockType<{ formId: string }>(block.name, {
  title: block.title,
  attributes: block.attributes as any,
  category: block.category,
  edit: ({ attributes, setAttributes }) => (
    <>
      <InspectorControls>
        <PanelBody>
          <TextControl
            __next40pxDefaultSize
            __nextHasNoMarginBottom
            required
            label={__('Form ID', 'bhidapa')}
            help={
              <>
                You can find <i>{`<form-id>`}</i> from the public URL of your
                form:
                <br />
                <code style={{ wordBreak: 'break-all' }}>
                  https://form.typeform.com/to/<i>{`<form-id>`}</i>
                </code>
                <br />
                Or from admin panel:
                <br />
                <code style={{ wordBreak: 'break-all' }}>
                  https://admin.typeform.com/form/<i>{`<form-id>`}</i>/*
                </code>
              </>
            }
            value={attributes.formId || ''}
            onChange={(formId) => setAttributes({ formId })}
          />
        </PanelBody>
      </InspectorControls>
      {/*  */}
      <div {...useBlockProps()}>
        <InnerBlocks
          allowedBlocks={['core/button']}
          templateLock="all"
          template={[
            ['core/button', { tagName: 'button', text: 'Open the form!' }],
          ]}
        />
      </div>
    </>
  ),
  save: ({ attributes }) => (
    <div {...useBlockProps.save()} data-typeform-form-id={attributes.formId}>
      <InnerBlocks.Content />
    </div>
  ),
});
