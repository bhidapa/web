// TODO: remove "wp-" prefix from all names

import * as aws from '@pulumi/aws';
import * as docker_build from '@pulumi/docker-build';
import * as pulumi from '@pulumi/pulumi';
import { name, proj } from './defs.ts';

export interface NewImageArgs {
  /**
   * The name of the image.
   * It should match the Dockerfile name in the `images` directory.
   */
  name: string;
}

export function newImage({ name: imageName }: NewImageArgs) {
  const repo = new aws.ecr.Repository(`wp-${imageName}-repo`, {
    name: name(`wp-${imageName}`),
    forceDelete: true,
    imageScanningConfiguration: {
      scanOnPush: true,
    },
    tags: { proj },
  });
  new aws.ecr.LifecyclePolicy(`wp-${imageName}-repo-lifecycle-policy`, {
    repository: repo.name,
    policy: {
      rules: [
        {
          rulePriority: 1,
          description: 'Keep last 10 untagged images',
          selection: {
            tagStatus: 'untagged',
            countType: 'imageCountMoreThan',
            countNumber: 10,
          },
          action: {
            type: 'expire',
          },
        },
      ],
    },
  });
  const authToken = aws.ecr.getAuthorizationTokenOutput({
    registryId: repo.registryId,
  });
  const image = new docker_build.Image(
    `wp-${imageName}-image`,
    {
      push: true,
      context: { location: '../images' },
      dockerfile: { location: `../images/${imageName}.Dockerfile` },
      platforms: ['linux/arm64'],
      registries: [
        {
          address: repo.repositoryUrl,
          username: authToken.userName,
          password: authToken.password,
        },
      ],
      cacheFrom: [
        {
          registry: {
            ref: pulumi.interpolate`${repo.repositoryUrl}:cache`,
          },
        },
      ],
      cacheTo: [
        {
          registry: {
            imageManifest: true,
            ociMediaTypes: true,
            ref: pulumi.interpolate`${repo.repositoryUrl}:cache`,
          },
        },
      ],
      tags: [pulumi.interpolate`${repo.repositoryUrl}:current`],
    },
    {
      // we retain on delete because pulumi will delete the image in the repo
      // if the image state/arguments change leading to undesireded deletions
      // of images that are still in use by running services. for example, if the
      // contexthash changes, pulumi will delete the old image and create a new one
      // but the new image is the same as the old one so nothing will be pushed to the
      // repo but the old (current) image will be deleted causing outages.
      // instead, we rely on the lifecycle policy of the repo above to clean up old images
      // and not have pulumi delete them.
      retainOnDelete: true,
    },
  );
  return {
    repositoryUrl: repo.repositoryUrl,
    imageUri: pulumi.interpolate`${repo.repositoryUrl}@${image.digest}`,
  };
}
