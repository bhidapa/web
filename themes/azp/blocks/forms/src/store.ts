import { store } from '@wordpress/interactivity';

store('azp/forms', {
  actions: {
    logTime: (event: any) => {
      console.log(new Date());
    },
  },
});
