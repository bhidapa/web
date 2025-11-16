import { AnyFieldApi } from '@tanstack/react-form';
import {
  TextControl as WpTextControl,
  RadioControl as WpRadioControl,
} from '@wordpress/components';

// TextControl

export interface TextControlProps
  extends Omit<
    React.ComponentProps<typeof WpTextControl>,
    'name' | 'value' | 'onChange' | 'onBlur'
  > {
  field: AnyFieldApi;
}

export function TextControl({ field, ...rest }: TextControlProps) {
  return (
    <WpTextControl
      __next40pxDefaultSize
      __nextHasNoMarginBottom
      {...rest}
      label={createLabel(rest)}
      name={field.name}
      value={field.state.value}
      onBlur={field.handleBlur}
      onChange={field.handleChange}
    />
  );
}

// RadioControl

export interface RadioControlProps
  extends Omit<
    React.ComponentProps<typeof WpRadioControl>,
    'name' | 'selected' | 'onChange' | 'onBlur'
  > {
  field: AnyFieldApi;
}

export function RadioControl({ field, ...rest }: RadioControlProps) {
  return (
    <WpRadioControl
      {...rest}
      label={createLabel(rest)}
      name={field.name}
      selected={field.state.value}
      onBlur={field.handleBlur}
      onChange={field.handleChange}
    />
  );
}

// utilities

function createLabel({
  label,
  required,
}: {
  label?: React.ReactNode;
  required?: boolean;
}) {
  if (!label) {
    return null;
  }
  return (
    <>
      {label}
      {required && <span style={{ color: 'red', fontWeight: '800' }}>*</span>}
    </>
  );
}
