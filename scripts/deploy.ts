import { $ } from 'bun';

const endpoint = Bun.env['ENDPOINT'];
if (!endpoint) {
  throw new Error('ENDPOINT is not set');
}

const website = Bun.env['WEBSITE'];
if (!website) {
  throw new Error('WEBSITE is not set');
}

const bundles = ['mu-plugins', 'themes/azp', 'plugins/e-library'];

console.log(`Pushing to ${website}`);
for (const bundle of bundles) {
  console.log(`Syncing ${bundle}`);
  await $`rsync -azvc --no-perms --no-owner --no-group --delete \
    --exclude "*/node_modules" --exclude ".DS_Store" \
    ${bundle}/ \
    ${endpoint}:/mnt/efs/${website}/wp-content/${bundle}/`;
}
console.log('OK');
