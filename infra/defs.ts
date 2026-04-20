import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';

export interface WordpressWebsite {
  type: 'wordpress';
  name: string;
  hostedZone: string;
  domain: string;
  /** Disable caching on Cloudfront. Mainly useful for development. */
  noCache?: boolean;
  /** Alternative domains that all redirect back to the {@link domain main domain}. */
  alternate?: {
    name: string;
    domain: string;
    recordType: 'A' | 'CNAME';
    /** If the hosted zone is different from the main website, set it. */
    hostedZone?: string;
  }[];
}

export interface StaticWebsite {
  type: 'static';
  name: string;
  hostedZone: string;
  domain: string;
  /** Disable caching on Cloudfront. Mainly useful for development. */
  noCache?: boolean;
  // No alternate domains for S3 websites, we dont need them for now.
  // To support alternate domains, we need to use CloudFront Functions.
  alternate?: never[];
}

const wp: WordpressWebsite[] = [
  {
    type: 'wordpress',
    name: 'bhidapa',
    hostedZone: 'bhidapa.ba',
    domain: 'bhidapa.ba',
    alternate: [
      {
        name: 'www',
        domain: 'www.bhidapa.ba',
        recordType: 'CNAME',
      },
      {
        hostedZone: 'bhidapa.com',
        name: 'com',
        domain: 'bhidapa.com',
        recordType: 'A',
      },
      {
        hostedZone: 'bhidapa.com',
        name: 'www-com',
        domain: 'www.bhidapa.com',
        recordType: 'A',
      },
      {
        hostedZone: 'psychotherapy.ba',
        name: 'psych',
        domain: 'psychotherapy.ba',
        recordType: 'A',
      },
      {
        hostedZone: 'psychotherapy.ba',
        name: 'www-psych',
        domain: 'www.psychotherapy.ba',
        recordType: 'A',
      },
    ],
  },
  {
    type: 'wordpress',
    name: 'akp',
    hostedZone: 'akp.ba',
    domain: 'akp.ba',
    alternate: [
      {
        name: 'www',
        domain: 'www.akp.ba',
        recordType: 'CNAME',
      },
      {
        name: 'academy-bhidapa',
        domain: 'academy.bhidapa.ba',
        hostedZone: 'bhidapa.ba',
        recordType: 'A', // because we have TXT records for this domain
      },
    ],
  },
];

/*

clone websites to static files using siteone-crawler https://crawler.siteone.io/:

```sh
siteone-crawler \
  --url=https://example.com \
  --offline-export-dir=./example-clone \
  --offline-export-preserve-urls \
  --offline-export-remove-unwanted-code=0
```

then sync to an s3 bucket using rclone https://rclone.org/:

```sh
rclone sync ./example-clone s3:example-bucket \
  --progress \
  --transfers=32
```

*/

const st: StaticWebsite[] = [
  {
    type: 'static',
    name: 'congress',
    hostedZone: 'bhidapa.ba',
    domain: 'congress.bhidapa.ba',
  },
];

export function isStatic(
  website: WordpressWebsite | StaticWebsite,
): website is StaticWebsite {
  return website.type === 'static';
}

export function isWordpress(
  website: WordpressWebsite | StaticWebsite,
): website is WordpressWebsite {
  return website.type === 'wordpress';
}

export const websites = [...wp, ...st];

export function portOf(website: WordpressWebsite): number {
  return 8000 + websites.indexOf(website) + 1;
}

export const region = aws.config.region!;
export const proj = pulumi.getProject();
export const stack = pulumi.getStack();
export function name(suffix?: string) {
  if (!suffix) {
    return `${proj}-${stack}`;
  }
  return `${proj}-${stack}-${suffix}`;
}

const caller = aws.getCallerIdentityOutput();
export const accountId = caller.accountId;
