import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as awsx from '@pulumi/awsx';
import * as aws_native from '@pulumi/aws-native';

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
  enableDnsHostnames: true, // some services (like EFS) use a named hostname over DNS
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
const dbSecurityGroup = new aws.ec2.SecurityGroup('db-sg', {
  name: name('db-sg'),
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
const efsSecurityGroup = new aws.ec2.SecurityGroup('fs-sg', {
  name: name('fs-sg'),
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
const dbPassword = new aws_native.secretsmanager.Secret('db-password', {
  name: name('db-password'),
  generateSecretString: {
    passwordLength: 16,
    excludeCharacters: '"\'@/\\',
  },
  tags: [{ key: 'proj', value: proj }],
});
const dbSubnetGroup = new aws.rds.SubnetGroup('db-subnet-group', {
  name: name('db-subnet-group'),
  subnetIds: [privateSubnet1.id, privateSubnet2.id],
  description: 'Subnet group for Aurora database',
  tags: { proj },
});
const dbEngine = aws.rds.EngineType.AuroraMysql;
const dbCluster = new aws.rds.Cluster('db-cluster', {
  clusterIdentifier: name('db'),
  engine: dbEngine,
  engineVersion: '8.0.mysql_aurora.3.10.0',
  serverlessv2ScalingConfiguration: {
    maxCapacity: 3,
    minCapacity: 0,
  },
  masterUsername: 'wp',
  // TODO: is there a nicer way to supply the master password?
  masterPassword: aws.secretsmanager.getSecretVersionOutput({
    secretId: dbPassword.id,
  }).secretString,
  dbSubnetGroupName: dbSubnetGroup.name,
  vpcSecurityGroupIds: [dbSecurityGroup.id],
  backupRetentionPeriod: 7,
  preferredBackupWindow: '03:00-04:00',
  preferredMaintenanceWindow: 'mon:04:00-mon:05:00',
  storageEncrypted: true,
  skipFinalSnapshot: true,
  enableHttpEndpoint: true, // enables Data API so that queries can be run over the AWS console query editor
  tags: { proj },
});
new aws.rds.ClusterInstance('db-master', {
  identifier: name('db-master'),
  clusterIdentifier: dbCluster.id,
  instanceClass: 'db.serverless',
  engine: dbEngine,
  engineVersion: dbCluster.engineVersion,
  tags: { proj },
});
// TODO: automatically create databases for each website (see wp/create-dbs.sql)

// EFS File System
const efs = new aws.efs.FileSystem('fs', {
  creationToken: name('fs'),
  tags: { proj },
});
new aws.efs.MountTarget('fs-mount-target-1', {
  fileSystemId: efs.id,
  subnetId: privateSubnet1.id,
  securityGroups: [efsSecurityGroup.id],
});
new aws.efs.MountTarget('fs-mount-target-2', {
  fileSystemId: efs.id,
  subnetId: privateSubnet2.id,
  securityGroups: [efsSecurityGroup.id],
});
new aws.efs.BackupPolicy('fs-backup-policy', {
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
  settings: [{ name: 'containerInsights', value: 'enhanced' }],
});
const taskExecutionRole = new aws.iam.Role('wp-service-task-exec-role', {
  name: name('wp-service'),
  assumeRolePolicy: {
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
  },
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
  policy: {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: ['secretsmanager:GetSecretValue'],
        Resource: dbPassword.id,
      },
    ],
  },
});
new aws.iam.RolePolicy('wp-service-task-exec-role-fs-mount-policy', {
  name: name('wp-service-fs-mount-policy'),
  role: taskExecutionRole.id,
  policy: {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: [
          'elasticfilesystem:ClientMount',
          'elasticfilesystem:ClientWrite',
        ],
        Resource: efs.arn,
      },
    ],
  },
});

// Application Load Balancer
const lb = new awsx.lb.ApplicationLoadBalancer('lb', {
  name: name('lb'),
  securityGroups: [lbSecurityGroup.id],
  subnets: [publicSubnet1, publicSubnet2],
  listener: {
    port: 80,
    protocol: 'HTTP',
    tags: { proj },
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
  tags: { proj },
});
const lbHttps = new aws.lb.Listener('lb-https-listener', {
  loadBalancerArn: lb.loadBalancer.arn,
  port: 443,
  protocol: 'HTTPS',
  defaultActions: [
    {
      // 404 for all unmatched routes
      type: 'fixed-response',
      fixedResponse: {
        contentType: 'text/plain',
        statusCode: '404',
        messageBody: 'Not Found',
      },
    },
  ],
});

// For Each Website
for (const website of websites) {
  // Use Application Load Balancer
  const tg = new aws.lb.TargetGroup(`${website.name}-lb-tg`, {
    name: name(`${website.name}-lb-tg`),
    vpcId: vpc.id,
    port: 80,
    protocol: 'HTTP',
    tags: { proj },
    healthCheck: {
      enabled: true,
      matcher: '200-399',
      path: '/', // TODO: integrate with WP_Site_Health but needs authentication
    },
  });
  new aws.lb.ListenerRule(`${website.name}-lb-rule`, {
    listenerArn: lbHttps.arn,
    conditions: [
      {
        hostHeader: {
          values: [website.domain],
        },
      },
    ],
    actions: [
      {
        type: 'forward',
        targetGroupArn: tg.arn,
      },
    ],
    tags: { proj },
  });

  // SSL Certificate
  const hostedZone = aws.route53.getZone({
    name: website.hostedZone,
    privateZone: false,
  });
  const cert = new aws.acm.Certificate(`${website.name}-cert`, {
    domainName: website.domain,
    validationMethod: 'DNS',
    tags: { proj, Name: name(`${website.name}-cert`) }, // not up
  });
  const certRecord = new aws.route53.Record(
    `${website.name}-cert-validation-record`,
    {
      zoneId: hostedZone.then((zone) => zone.zoneId),
      name: cert.domainValidationOptions[0].resourceRecordName,
      records: [cert.domainValidationOptions[0].resourceRecordValue],
      type: cert.domainValidationOptions[0].resourceRecordType,
      ttl: 60,
    },
  );
  new aws.acm.CertificateValidation(`${website.name}-cert-validation`, {
    certificateArn: cert.arn,
    validationRecordFqdns: [certRecord.fqdn],
  });
  new aws.lb.ListenerCertificate(
    `${website.name}-lb-https-listener-cert-attachment`,
    {
      listenerArn: lbHttps.arn,
      certificateArn: cert.arn,
    },
  );

  // Point domain DNS to Load Balancer
  new aws.route53.Record(`${website.name}-dns-a`, {
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

  const fsAccessPoint = new aws.efs.AccessPoint(`${website.name}-fs-ap`, {
    fileSystemId: efs.id,
    posixUser: {
      gid: 0,
      uid: 0,
    },
    rootDirectory: {
      path: `/${website.name}`,
      creationInfo: {
        ownerGid: 0,
        ownerUid: 0,
        permissions: '755',
      },
    },
    tags: { proj },
  });

  const logGroup = new aws.cloudwatch.LogGroup(`${website.name}-log-group`, {
    name: `/ecs/${name('wp')}/${website.name}`,
    retentionInDays: 7,
    tags: { proj },
  });

  const fargateService = new awsx.ecs.FargateService(
    `${website.name}-service`,
    {
      name: website.name,
      cluster: wpCluster.arn,
      taskDefinitionArgs: {
        family: name(website.name),
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
          healthCheck: {
            command: ['CMD-SHELL', 'curl -f http://localhost:80 || exit 1'],
          },
          environment: [
            { name: 'WORDPRESS_DB_HOST', value: dbCluster.endpoint },
            { name: 'WORDPRESS_DB_NAME', value: website.name },
            { name: 'WORDPRESS_DB_USER', value: dbCluster.masterUsername },
            { name: 'WORDPRESS_DEBUG', value: '1' },
          ],
          secrets: [
            { name: 'WORDPRESS_DB_PASSWORD', valueFrom: dbPassword.id },
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
              'awslogs-group': logGroup.name,
              'awslogs-region': logGroup.region,
              'awslogs-stream-prefix': 'ecs',
            },
          },
        },
        volumes: [
          {
            name: 'wp-data',
            efsVolumeConfiguration: {
              rootDirectory: '/',
              fileSystemId: efs.id,
              transitEncryption: 'ENABLED',
              authorizationConfig: {
                accessPointId: fsAccessPoint.id,
              },
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
          targetGroupArn: tg.arn,
          containerName: 'wp',
          containerPort: 80,
        },
      ],
      tags: { proj },
    },
  );

  // Auto Scaling
  const autoScalingTarget = new aws.appautoscaling.Target(
    `${website.name}-autoscaling-target`,
    {
      serviceNamespace: 'ecs',
      resourceId: pulumi.interpolate`service/${wpCluster.name}/${fargateService.service.name}`,
      scalableDimension: 'ecs:service:DesiredCount',
      maxCapacity: 3,
      minCapacity: 1,
    },
  );
  new aws.appautoscaling.Policy(`${website.name}-autoscaling-policy`, {
    name: name(`${website.name}-policy`),
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
