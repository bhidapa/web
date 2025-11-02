import {
  InspectorControls,
  RichText,
  useBlockProps,
} from '@wordpress/block-editor';
import { registerBlockType } from '@wordpress/blocks';
import { PanelBody, TextControl, ToggleControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import metadata from './block.json';

// @ts-expect-error typedefs are not correct
registerBlockType<{
  prefix: string;
  field: string;
  subField: boolean;
  suffix: string;
}>(metadata.name, {
  edit: ({ attributes, setAttributes }) => (
    <>
      <InspectorControls>
        <PanelBody>
          <TextControl
            required
            label={__('Field', 'azp')}
            value={attributes.field}
            onChange={(value) => setAttributes({ field: value })}
          />
          <ToggleControl
            required
            label={__('Is sub field?', 'azp')}
            help={
              attributes.subField
                ? 'The field is a sub field within a repeater.'
                : 'The field is a regular field.'
            }
            checked={attributes.subField}
            onChange={(subField) => setAttributes({ subField })}
          />
        </PanelBody>
      </InspectorControls>
      {/*  */}
      <p {...useBlockProps()}>
        <RichText
          tagName="span"
          identifier="prefix"
          aria-label="Prefix"
          placeholder="Prefix "
          value={attributes.prefix}
          onChange={(prefix) => setAttributes({ prefix })}
        />
        {'{'}
        {attributes.field}
        {'}'}
        <RichText
          tagName="span"
          identifier="suffix"
          aria-label="Suffix"
          placeholder=" Suffix"
          value={attributes.suffix}
          onChange={(suffix) => setAttributes({ suffix })}
        />
      </p>
    </>
  ),
});
