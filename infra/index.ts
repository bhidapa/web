import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as awsx from '@pulumi/awsx';

const websites = [
  {
    name: 'akp',
    hostedZone: 'akp.ba',
    domain: 'testing.akp.ba',
  },
];

const region = aws.config.region!;
const proj = pulumi.getProject();
const stack = pulumi.getStack();
function name(suffix?: string) {
  if (!suffix) {
    return `${proj}-${stack}`;
  }
  return `${proj}-${stack}-${suffix}`;
}

// VPC
const vpc = new aws.ec2.Vpc('vpc', {
  cidrBlock: '192.168.0.0/16',
  tags: { proj, Name: name() },
});
const privateSubnet1 = new aws.ec2.Subnet('private-subnet-1', {
  vpcId: vpc.id,
  cidrBlock: '192.168.1.0/24',
  availabilityZone: `${region}a`,
  tags: { proj, Name: name('private-1') },
});
const privateSubnet2 = new aws.ec2.Subnet('private-subnet-2', {
  vpcId: vpc.id,
  cidrBlock: '192.168.2.0/24',
  availabilityZone: `${region}b`,
  tags: { proj, Name: name('private-2') },
});
const publicSubnet1 = new aws.ec2.Subnet('public-subnet-1', {
  vpcId: vpc.id,
  cidrBlock: '192.168.100.0/24',
  availabilityZone: `${region}a`,
  mapPublicIpOnLaunch: true,
  tags: { proj, Name: name('public-1') },
});
const publicSubnet2 = new aws.ec2.Subnet('public-subnet-2', {
  vpcId: vpc.id,
  cidrBlock: '192.168.200.0/24',
  availabilityZone: `${region}b`,
  mapPublicIpOnLaunch: true,
  tags: { proj, Name: name('public-2') },
});

// Public Subnet
const igw = new aws.ec2.InternetGateway('igw', {
  vpcId: vpc.id,
  tags: { proj, Name: name('igw') },
});
const publicRouteTable = new aws.ec2.RouteTable('public-route-table', {
  vpcId: vpc.id,
  tags: { proj, Name: name('public-route-table') },
});
new aws.ec2.Route('public-route', {
  routeTableId: publicRouteTable.id,
  destinationCidrBlock: '0.0.0.0/0',
  gatewayId: igw.id,
});
new aws.ec2.RouteTableAssociation('public-route-table-association-1', {
  subnetId: publicSubnet1.id,
  routeTableId: publicRouteTable.id,
});
new aws.ec2.RouteTableAssociation('public-route-table-association-2', {
  subnetId: publicSubnet2.id,
  routeTableId: publicRouteTable.id,
});
const eip = new aws.ec2.Eip('nat-gw-eip', {
  domain: 'vpc',
  tags: { proj, Name: name('nat-gw-eip') },
});
const natgw = new aws.ec2.NatGateway('nat-gw', {
  subnetId: publicSubnet1.id,
  allocationId: eip.id,
  tags: { proj, Name: name('nat-gw') },
});

// Private Subnet
const privateRouteTable = new aws.ec2.RouteTable('private-route-table', {
  vpcId: vpc.id,
  tags: { proj, Name: name('private-route-table') },
});
new aws.ec2.Route('private-route', {
  routeTableId: privateRouteTable.id,
  destinationCidrBlock: '0.0.0.0/0',
  natGatewayId: natgw.id,
});
new aws.ec2.RouteTableAssociation('private-route-table-association-1', {
  subnetId: privateSubnet1.id,
  routeTableId: privateRouteTable.id,
});
new aws.ec2.RouteTableAssociation('private-route-table-association-2', {
  subnetId: privateSubnet2.id,
  routeTableId: privateRouteTable.id,
});
new aws.ec2.MainRouteTableAssociation('main-route-table-association', {
  vpcId: vpc.id,
  routeTableId: privateRouteTable.id,
});

// Security Groups
const lbSecurityGroup = new aws.ec2.SecurityGroup('lb-sg', {
  name: name('lb-sg'),
  vpcId: vpc.id,
  description: 'Security group for Application Load Balancer',
  ingress: [
    { protocol: 'tcp', fromPort: 80, toPort: 80, cidrBlocks: ['0.0.0.0/0'] },
    { protocol: 'tcp', fromPort: 443, toPort: 443, cidrBlocks: ['0.0.0.0/0'] },
  ],
  egress: [
    { protocol: '-1', fromPort: 0, toPort: 0, cidrBlocks: ['0.0.0.0/0'] },
  ],
  tags: { proj },
});
const wpSecurityGroup = new aws.ec2.SecurityGroup('wp-sg', {
  name: name('wp-sg'),
  vpcId: vpc.id,
  description: 'Security group for ECS WordPress tasks',
  ingress: [
    {
      protocol: 'tcp',
      fromPort: 80,
      toPort: 80,
      securityGroups: [lbSecurityGroup.id],
    },
  ],
  egress: [
    { protocol: '-1', fromPort: 0, toPort: 0, cidrBlocks: ['0.0.0.0/0'] },
  ],
  tags: { proj },
});
const dbSecurityGroup = new aws.ec2.SecurityGroup('wp-db-sg', {
  name: name('wp-db-sg'),
  vpcId: vpc.id,
  description: 'Security group for Aurora database',
  ingress: [
    {
      protocol: 'tcp',
      fromPort: 3306,
      toPort: 3306,
      securityGroups: [wpSecurityGroup.id],
    },
  ],
  tags: { proj },
});
const efsSecurityGroup = new aws.ec2.SecurityGroup('wp-fs-sg', {
  name: name('wp-fs-sg'),
  vpcId: vpc.id,
  description: 'Security group for EFS',
  ingress: [
    {
      protocol: 'tcp',
      fromPort: 2049,
      toPort: 2049,
      securityGroups: [wpSecurityGroup.id],
    },
  ],
  tags: { proj },
});

// Aurora Serverless v2 MySQL
const dbPassword = new aws.secretsmanager.Secret('wp-db-password', {
  name: name('wp-db-password'),
  tags: { proj },
});
const dbPasswordValue = aws.secretsmanager.getRandomPasswordOutput({
  passwordLength: 16,
  excludeCharacters: '"\'@/\\',
});
new aws.secretsmanager.SecretVersion('wp-db-password-version', {
  secretId: dbPassword.id,
  secretString: dbPasswordValue.randomPassword,
});
const dbSubnetGroup = new aws.rds.SubnetGroup('wp-db-subnet-group', {
  name: name('wp-db-subnet-group'),
  subnetIds: [privateSubnet1.id, privateSubnet2.id],
  description: 'Subnet group for Aurora database',
  tags: { proj },
});
const dbEngine = aws.rds.EngineType.AuroraMysql;
const dbCluster = new aws.rds.Cluster('wp-db-cluster', {
  clusterIdentifier: name('wp-db'),
  engine: dbEngine,
  engineVersion: '8.0.mysql_aurora.3.10.0',
  serverlessv2ScalingConfiguration: {
    maxCapacity: 3,
    minCapacity: 0,
  },
  masterUsername: 'wp',
  masterPassword: dbPasswordValue.randomPassword,
  dbSubnetGroupName: dbSubnetGroup.name,
  vpcSecurityGroupIds: [dbSecurityGroup.id],
  backupRetentionPeriod: 7,
  preferredBackupWindow: '03:00-04:00',
  preferredMaintenanceWindow: 'mon:04:00-mon:05:00',
  storageEncrypted: true,
  skipFinalSnapshot: true,
  tags: { proj },
});
new aws.rds.ClusterInstance('wp-db-master', {
  identifier: name('wp-db-master'),
  clusterIdentifier: dbCluster.id,
  instanceClass: 'db.serverless',
  engine: dbEngine,
  engineVersion: dbCluster.engineVersion,
  tags: { proj },
});
// TODO: automatically create databases for each website (see wp/create-dbs.sql)

// EFS File System
const efs = new aws.efs.FileSystem('wp-fs', {
  creationToken: name('wp-fs'),
  tags: { proj },
});
new aws.efs.MountTarget('wp-fs-mount-target-1', {
  fileSystemId: efs.id,
  subnetId: privateSubnet1.id,
  securityGroups: [efsSecurityGroup.id],
});
new aws.efs.MountTarget('wp-fs-mount-target-2', {
  fileSystemId: efs.id,
  subnetId: privateSubnet2.id,
  securityGroups: [efsSecurityGroup.id],
});
new aws.efs.BackupPolicy('wp-fs-backup-policy', {
  fileSystemId: efs.id,
  backupPolicy: {
    status: 'ENABLED',
  },
});

// WordPress Repository
const wpRepo = new aws.ecr.Repository('wp-repo', {
  name: name('wp'),
  imageScanningConfiguration: {
    scanOnPush: true,
  },
  tags: { proj },
});
const wpImage = new awsx.ecr.Image('wp-image', {
  repositoryUrl: wpRepo.repositoryUrl,
  context: '../wp',
  platform: 'linux/amd64',
});

// ECS Cluster and Roles
const wpCluster = new aws.ecs.Cluster('wp-cluster', {
  name: name('wp'),
});
const taskExecutionRole = new aws.iam.Role('wp-service-task-exec-role', {
  name: name('wp-service'),
  assumeRolePolicy: JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Action: 'sts:AssumeRole',
        Effect: 'Allow',
        Principal: {
          Service: 'ecs-tasks.amazonaws.com',
        },
      },
    ],
  }),
  tags: { proj },
});
new aws.iam.RolePolicyAttachment('wp-service-task-exec-role-base-policy', {
  role: taskExecutionRole.name,
  // can pull images from ECR and write logs to CloudWatch
  policyArn:
    'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy',
});
new aws.iam.RolePolicy('wp-service-task-exec-role-secrets-policy', {
  name: name('wp-service-secrets-policy'),
  role: taskExecutionRole.id,
  // can pull db password from Secrets Manager
  policy: JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: ['secretsmanager:GetSecretValue'],
        Resource: dbPassword.arn,
      },
    ],
  }),
});

// For Each Website
for (const website of websites) {
  // Application Load Balancer
  const hostedZone = aws.route53.getZone({
    name: website.hostedZone,
    privateZone: false,
  });
  const cert = new aws.acm.Certificate(`wp-${website.name}-cert`, {
    domainName: website.domain,
    validationMethod: 'DNS',
  });
  const certRecord = new aws.route53.Record(
    `wp-${website.name}-cert-validation-record`,
    {
      zoneId: hostedZone.then((zone) => zone.zoneId),
      name: cert.domainValidationOptions[0].resourceRecordName,
      records: [cert.domainValidationOptions[0].resourceRecordValue],
      type: cert.domainValidationOptions[0].resourceRecordType,
      ttl: 60,
    },
  );
  const certValidation = new aws.acm.CertificateValidation(
    `wp-${website.name}-cert-validation`,
    {
      certificateArn: cert.arn,
      validationRecordFqdns: [certRecord.fqdn],
    },
  );
  const lb = new awsx.lb.ApplicationLoadBalancer(
    `wp-${website.name}-lb`,
    {
      name: name(`wp-${website.name}-lb`),
      securityGroups: [lbSecurityGroup.id],
      subnets: [publicSubnet1, publicSubnet2],
      defaultTargetGroup: {
        name: name(`wp-${website.name}-tg`),
        vpcId: vpc.id,
        port: 80,
        protocol: 'HTTP',
        tags: { proj },
        healthCheck: {
          enabled: true,
          matcher: '200-399',
          path: '/', // TODO: integrate with WP_Site_Health but needs authentication
        },
      },
      listeners: [
        {
          port: 80,
          protocol: 'HTTP',
          defaultActions: [
            {
              type: 'redirect',
              redirect: {
                port: '443',
                protocol: 'HTTP',
                statusCode: 'HTTP_301',
              },
            },
          ],
        },
        {
          port: 443,
          protocol: 'HTTPS',
          certificateArn: cert.arn,
        },
      ],
      tags: { proj },
    },
    {
      dependsOn: [certValidation],
    },
  );
  new aws.route53.Record(`wp-${website.name}-dns-a`, {
    zoneId: hostedZone.then((zone) => zone.zoneId),
    name: website.domain,
    type: 'A',
    aliases: [
      {
        name: lb.loadBalancer.dnsName,
        zoneId: lb.loadBalancer.zoneId,
        evaluateTargetHealth: true,
      },
    ],
  });

  const fargateService = new awsx.ecs.FargateService(
    `wp-${website.name}-service`,
    {
      name: name(`wp-${website.name}`),
      cluster: wpCluster.arn,
      taskDefinitionArgs: {
        family: name(`wp-${website.name}`),
        executionRole: {
          roleArn: taskExecutionRole.arn,
        },
        cpu: '512', // .5 vCPU
        memory: '1024', // 1 GB
        container: {
          name: 'wp',
          image: wpImage.imageUri,
          essential: true,
          portMappings: [{ containerPort: 80 }],
          environment: [
            { name: 'WORDPRESS_DB_HOST', value: dbCluster.endpoint },
            { name: 'WORDPRESS_DB_NAME', value: website.name },
            { name: 'WORDPRESS_DB_USER', value: dbCluster.masterUsername },
          ],
          secrets: [
            { name: 'WORDPRESS_DB_PASSWORD', valueFrom: dbPassword.arn },
          ],
          mountPoints: [
            {
              sourceVolume: 'wp-data',
              containerPath: '/var/www/html',
              readOnly: false,
            },
          ],
          logConfiguration: {
            logDriver: 'awslogs',
            options: {
              'awslogs-create-group': 'true',
              'awslogs-group': `/ecs/${name('wp')}/${website.name}`,
              'awslogs-region': region,
              'awslogs-stream-prefix': website.name,
            },
          },
        },
        volumes: [
          {
            name: 'wp-data',
            efsVolumeConfiguration: {
              rootDirectory: `/${website.name}`,
              fileSystemId: efs.id,
              transitEncryption: 'ENABLED',
            },
          },
        ],
      },
      desiredCount: 1,
      networkConfiguration: {
        subnets: [privateSubnet1.id, privateSubnet2.id],
        securityGroups: [wpSecurityGroup.id],
        assignPublicIp: false,
      },
      loadBalancers: [
        {
          targetGroupArn: lb.defaultTargetGroup.arn,
          containerName: 'wp',
          containerPort: 80,
        },
      ],
      tags: { proj },
    },
  );

  // Auto Scaling
  const autoScalingTarget = new aws.appautoscaling.Target(
    `wp-${website.name}-autoscaling-target`,
    {
      serviceNamespace: 'ecs',
      resourceId: pulumi.interpolate`service/${wpCluster.name}/${fargateService.service.name}`,
      scalableDimension: 'ecs:service:DesiredCount',
      maxCapacity: 3,
      minCapacity: 1,
    },
  );
  new aws.appautoscaling.Policy(`wp-${website.name}-autoscaling-policy`, {
    name: name(`wp-${website.name}-policy`),
    policyType: 'TargetTrackingScaling',
    resourceId: autoScalingTarget.resourceId,
    scalableDimension: autoScalingTarget.scalableDimension,
    serviceNamespace: autoScalingTarget.serviceNamespace,
    targetTrackingScalingPolicyConfiguration: {
      predefinedMetricSpecification: {
        predefinedMetricType: 'ECSServiceAverageCPUUtilization',
      },
      targetValue: 70.0,
      scaleInCooldown: 300,
      scaleOutCooldown: 300,
    },
  });
}
