import './style.css';
import { useBlockProps } from '@wordpress/block-editor';
import { registerBlockType } from '@wordpress/blocks';
import block from './block.json';

registerBlockType<{}>(block.name, {
  title: block.title,
  attributes: block.attributes as any,
  category: block.category,
  edit: () => <div {...useBlockProps()}>Category</div>,
});
