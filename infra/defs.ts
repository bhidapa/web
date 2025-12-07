import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';

export interface Website {
  name: string;
  hostedZone: string;
  domain: string;
  /** Disable caching on Cloudfront. Mainly useful for development. */
  noCache?: boolean;
  /** Alternative domains that all redirect back to the {@link domain main domain}. */
  alternate?: {
    name: string;
    domain: string;
    /** If the hosted zone is different from the main website, set it. */
    hostedZone?: string;
    /** @default 'CNAME' */
    recordType?: 'CNAME' | 'A';
  }[];
}

export const websites: Website[] = [
  {
    name: 'bhidapa',
    hostedZone: 'bhidapa.ba',
    domain: 'bhidapa.ba',
    noCache: true,
    alternate: [
      {
        name: 'www',
        domain: 'www.bhidapa.ba',
      },
    ],
  },
  {
    name: 'akp',
    hostedZone: 'akp.ba',
    domain: 'akp.ba',
    alternate: [
      {
        name: 'www',
        domain: 'www.akp.ba',
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

export const region = aws.config.region!;
export const proj = pulumi.getProject();
export const stack = pulumi.getStack();
export function name(suffix?: string) {
  if (!suffix) {
    return `${proj}-${stack}`;
  }
  return `${proj}-${stack}-${suffix}`;
}
