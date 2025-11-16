import { useForm } from '@tanstack/react-form';
import { Button, Flex, FlexBlock, FlexItem } from '@wordpress/components';
import { RadioControl, TextControl } from './FormControl';

export function Konkurs() {
  const form = useForm({
    defaultValues: {
      edukacijskiProgram: '',
      titula: '',
      ime: '',
      prezime: '',
      profesija: '',
    },
    onSubmit: async ({ value }) => {
      // Do something with form data
      console.log(value);
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
    >
      <Flex direction="column" gap={4}>
        <FlexItem>
          <form.Field
            name="edukacijskiProgram"
            children={(field) => (
              <RadioControl
                field={field}
                label="Edukacijski program za koji se prijavljujete"
                required
                options={[
                  {
                    label: 'Integrativna psihoterapija djece i adolescenata',
                    value: 'IDAP',
                  },
                  {
                    label: 'Integrativna psihoterapija',
                    value: 'IP',
                  },
                  {
                    label:
                      'Specijalistička edukacija iz seksualnog zdravlja, terapije i savjetovanja',
                    value: 'STS',
                  },
                ]}
              />
            )}
          />
        </FlexItem>

        <Flex direction={['column', 'row']}>
          <FlexItem>
            <form.Field
              name="titula"
              children={(field) => (
                <TextControl field={field} label="Titula" required />
              )}
            />
          </FlexItem>
          <FlexBlock>
            <form.Field
              name="ime"
              children={(field) => (
                <TextControl field={field} label="Ime" required />
              )}
            />
          </FlexBlock>
          <FlexBlock>
            <form.Field
              name="prezime"
              children={(field) => (
                <TextControl field={field} label="Prezime" required />
              )}
            />
          </FlexBlock>
        </Flex>

        <FlexBlock>
          <form.Field
            name="profesija"
            children={(field) => (
              <TextControl field={field} label="Profesija" required />
            )}
          />
        </FlexBlock>

        <Flex justify="flex-end">
          <FlexItem>
            <Button type="submit" variant="primary">
              Submit
            </Button>
          </FlexItem>
        </Flex>
      </Flex>
    </form>
  );
}
