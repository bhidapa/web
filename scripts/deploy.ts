import { $ } from 'bun';

const endpoint = Bun.env['ENDPOINT'];
if (!endpoint) {
  throw new Error('ENDPOINT is not set');
}

const website = Bun.env['WEBSITE'];
if (!website) {
  throw new Error('WEBSITE is not set');
}

const themeForWebsite: Record<string, string> = {
  bhidapa: 'bhd',
  akp: 'azp',
};
const theme = themeForWebsite[website];
if (!theme) {
  throw new Error(`No theme configured for website ${website}`);
}

const bundles = ['mu-plugins', `themes/${theme}`, 'plugins/e-library'];

console.log(`Pushing to ${website}`);
await Promise.all(
  bundles.map((bundle) => {
    console.log(`Syncing ${bundle}`);
    return $`rsync -azvc --no-perms --no-owner --no-group --delete \
      --exclude "*/node_modules" --exclude ".DS_Store" \
      ${bundle}/ \
      ${endpoint}:/mnt/efs/${website}/wp-content/${bundle}/`;
  }),
);
console.log('OK');
