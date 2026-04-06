import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import { name, proj } from './defs.ts';

export interface CreateAssociationArgs {
  /**
   * The name of the association.
   */
  name: string;
  /**
   * Instance to bind the association to.
   */
  instances: aws.ec2.Instance[];
  /**
   * Document to associate.
   */
  document: aws.ssm.Document;
  /**
   * SSM parameter dependencies for the association. The association will be
   * triggered when any of the dependencies change (get updated or created).
   */
  deps: {
    name: string;
    parameter: aws.ssm.Parameter;
  }[];
}

export function createAssociation({
  name: assocName,
  document,
  instances,
  deps,
}: CreateAssociationArgs) {
  const assoc = new aws.ssm.Association(assocName, {
    name: document.name,
    targets: [
      {
        key: 'InstanceIds',
        values: instances.map(({ id }) => id),
      },
    ],
  });
  for (const dep of deps) {
    const rule = new aws.cloudwatch.EventRule(`${dep.name}-event-rule`, {
      name: name(`${dep.name}-change`),
      description: 'Trigger on SSM parameter changes',
      eventPattern: pulumi.jsonStringify({
        source: ['aws.ssm'],
        'detail-type': ['Parameter Store Change'],
        detail: {
          name: [dep.parameter.name],
          operation: ['Update', 'Create'],
        },
      }),
      tags: { proj },
    });
    new aws.cloudwatch.EventTarget(`${dep.name}-event-target`, {
      rule: rule.name,
      arn: triggerFn.arn,
      input: pulumi.jsonStringify({ associationId: assoc.associationId }),
    });
  }
}

const lambdaRole = new aws.iam.Role('association-trigger-lambda-role', {
  assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
    Service: 'lambda.amazonaws.com',
  }),
  tags: { proj },
});

new aws.iam.RolePolicyAttachment('association-trigger-lambda-role-basic', {
  role: lambdaRole.name,
  policyArn: aws.iam.ManagedPolicy.AWSLambdaBasicExecutionRole,
});

new aws.iam.RolePolicy('association-trigger-lambda-role-policy', {
  role: lambdaRole.id,
  policy: pulumi.jsonStringify({
    Version: '2012-10-17',
    Statement: [
      { Effect: 'Allow', Action: 'ssm:StartAssociationsOnce', Resource: '*' },
    ],
  }),
});

const triggerFn = new aws.lambda.CallbackFunction(
  'association-trigger-lambda',
  {
    role: lambdaRole,
    callback: async (event: { associationId: string }) => {
      const { SSMClient, StartAssociationsOnceCommand } = await import(
        '@aws-sdk/client-ssm'
      );
      const client = new SSMClient();
      await client.send(
        new StartAssociationsOnceCommand({
          AssociationIds: [event.associationId],
        }),
      );
    },
    tags: { proj },
  },
);

new aws.lambda.Permission('association-trigger-lambda-permission', {
  action: 'lambda:InvokeFunction',
  function: triggerFn.name,
  principal: 'events.amazonaws.com',
});
