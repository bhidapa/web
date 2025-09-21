import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as awsx from '@pulumi/awsx';

const region = aws.config.region!;
const proj = pulumi.getProject();
const stack = pulumi.getStack();
function name(suffix?: string) {
  if (!suffix) {
    return `${proj}-${stack}`;
  }
  return `${proj}-${stack}-${suffix}`;
}

const vpc = new aws.ec2.Vpc('vpc', {
  cidrBlock: '123.4.0.0/16',
  tags: { proj, Name: name() },
});

const privateSubnet = new aws.ec2.Subnet('private-subnet', {
  vpcId: vpc.id,
  cidrBlock: '123.4.1.0/24',
  availabilityZone: `${region}a`,
  tags: { proj, Name: name('private') },
});
const privateSubnet2 = new aws.ec2.Subnet('private-subnet-2', {
  vpcId: vpc.id,
  cidrBlock: '123.4.2.0/24',
  availabilityZone: `${region}b`,
  tags: { proj, Name: name('private-2') },
});
const publicSubnet = new aws.ec2.Subnet('public-subnet', {
  vpcId: vpc.id,
  cidrBlock: '123.4.9.0/24',
  availabilityZone: `${region}a`,
  mapPublicIpOnLaunch: true,
  tags: { proj, Name: name('public') },
});
const publicSubnet2 = new aws.ec2.Subnet('public-subnet-2', {
  vpcId: vpc.id,
  cidrBlock: '123.4.8.0/24',
  availabilityZone: `${region}b`,
  mapPublicIpOnLaunch: true,
  tags: { proj, Name: name('public-2') },
});

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
new aws.ec2.RouteTableAssociation('public-route-table-association', {
  subnetId: publicSubnet.id,
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
  subnetId: publicSubnet.id,
  allocationId: eip.id,
  tags: { proj, Name: name('nat-gw') },
});

const privateRouteTable = new aws.ec2.RouteTable('private-route-table', {
  vpcId: vpc.id,
  tags: { proj, Name: name('private-route-table') },
});

new aws.ec2.Route('private-route', {
  routeTableId: privateRouteTable.id,
  destinationCidrBlock: '0.0.0.0/0',
  natGatewayId: natgw.id,
});
new aws.ec2.RouteTableAssociation('private-route-table-association', {
  subnetId: privateSubnet.id,
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
const lbSecurityGroup = new aws.ec2.SecurityGroup('alb-sg', {
  name: name('alb-sg'),
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
const ecsSecurityGroup = new aws.ec2.SecurityGroup('ecs-sg', {
  name: name('ecs-sg'),
  vpcId: vpc.id,
  description: 'Security group for ECS WordPress tasks',
  ingress: [
    {
      protocol: 'tcp',
      fromPort: 80,
      toPort: 80,
      securityGroups: [lbSecurityGroup.id],
    },
    {
      protocol: 'tcp',
      fromPort: 443,
      toPort: 443,
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
      securityGroups: [ecsSecurityGroup.id],
    },
  ],
  tags: { proj },
});
const efsSecurityGroup = new aws.ec2.SecurityGroup('efs-sg', {
  name: name('efs-sg'),
  vpcId: vpc.id,
  description: 'Security group for EFS',
  ingress: [
    {
      protocol: 'tcp',
      fromPort: 2049,
      toPort: 2049,
      securityGroups: [ecsSecurityGroup.id],
    },
  ],
  tags: { proj },
});

// Aurora Serverless v2 MySQL
const dbPassword = new aws.kms.Key('wp-db-password', {
  tags: { proj },
});
const dbSubnetGroup = new aws.rds.SubnetGroup('wp-db-subnet-group', {
  name: name('wp-db-subnet-group'),
  subnetIds: [privateSubnet.id, privateSubnet2.id],
  description: 'Subnet group for Aurora database',
  tags: { proj },
});
const dbCluster = new aws.rds.Cluster('db-cluster', {
  clusterIdentifier: name('wp-db'),
  engine: aws.rds.EngineType.AuroraMysql,
  engineVersion: '8.0.mysql_aurora.3.10.0',
  serverlessv2ScalingConfiguration: {
    maxCapacity: 3,
    minCapacity: 0,
  },
  manageMasterUserPassword: true,
  masterUsername: 'wp',
  masterUserSecretKmsKeyId: dbPassword.keyId,
  dbSubnetGroupName: dbSubnetGroup.name,
  vpcSecurityGroupIds: [dbSecurityGroup.id],
  backupRetentionPeriod: 7,
  preferredBackupWindow: '03:00-04:00',
  preferredMaintenanceWindow: 'mon:04:00-mon:05:00',
  storageEncrypted: true,
  tags: { proj },
});
const dbMain = new aws.rds.ClusterInstance('aurora-main-instance', {
  clusterIdentifier: dbCluster.id,
  instanceClass: 'db.serverless',
  engine: dbCluster.engine.apply(
    (x) =>
      // @ts-expect-error
      aws.rds.EngineType[x],
  ),
  engineVersion: dbCluster.engineVersion,
  tags: { proj },
});

// EFS File System
const efs = new aws.efs.FileSystem('wp-efs', {
  creationToken: name('wp-efs'),
  performanceMode: 'generalPurpose',
  throughputMode: 'provisioned',
  provisionedThroughputInMibps: 100,
  encrypted: true,
  tags: { proj },
});
new aws.efs.MountTarget('efs-mount-target-1', {
  fileSystemId: efs.id,
  subnetId: privateSubnet.id,
  securityGroups: [efsSecurityGroup.id],
});
new aws.efs.MountTarget('efs-mount-target-2', {
  fileSystemId: efs.id,
  subnetId: privateSubnet2.id,
  securityGroups: [efsSecurityGroup.id],
});
new aws.efs.BackupPolicy('efs-backup-policy', {
  fileSystemId: efs.id,
  backupPolicy: {
    status: 'ENABLED',
  },
});

// Application Load Balancer
const lb = new awsx.lb.ApplicationLoadBalancer('wp-lb', {
  name: name('wp-lb'),
  securityGroups: [lbSecurityGroup.id],
  subnets: [publicSubnet, publicSubnet2],
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
      protocol: 'TCP', // not HTTPS because the container will set up the certificats
    },
  ],
  tags: { proj },
});
const targetGroup = new aws.lb.TargetGroup('wp-tg', {
  name: name('wp-tg'),
  vpcId: vpc.id,
  port: 80,
  protocol: 'TCP',
  tags: { proj },
  // TODO: healthCheck
});
const targetGroupTls = new aws.lb.TargetGroup('wp-tg-tls', {
  name: name('wp-tg-tls'),
  vpcId: vpc.id,
  port: 443,
  protocol: 'TCP',
  tags: { proj },
  // TODO: healthCheck
});

// WordPress on Fargate
const ecrRepo = new aws.ecr.Repository('ecr-repo', {
  name: name('repo'),
  imageScanningConfiguration: {
    scanOnPush: true,
  },
  tags: { proj },
});
const image = new awsx.ecr.Image('ecr-image', {
  repositoryUrl: ecrRepo.repositoryUrl,
  context: '../wp',
  platform: 'linux/amd64',
});
const ecsCluster = new aws.ecs.Cluster('cluster', {
  name: name('cluster'),
});
const fargateService = new awsx.ecs.FargateService('wp-service', {
  name: name('wp-service'),
  cluster: ecsCluster.arn,
  taskDefinitionArgs: {
    family: name('wp'),
    containers: {
      akp: {
        name: 'akp',
        image: image.imageUri,
        cpu: 256,
        memory: 512,
        essential: true,
        portMappings: [
          {
            containerPort: 80,
          },
          {
            containerPort: 443,
          },
        ],
        environment: [
          // { name: 'SERVICE_NAME', value: '' },
          { name: 'WORDPRESS_DB_HOST', value: dbCluster.endpoint },
          { name: 'WORDPRESS_DB_NAME', value: 'akp' },
        ],
        secrets: [
          {
            name: 'WORDPRESS_DB_USER',
            valueFrom: dbCluster.masterUserSecretKmsKeyId,
          },
          {
            name: 'WORDPRESS_DB_PASSWORD',
            valueFrom: dbPassword.keyId,
          },
        ],
        mountPoints: [
          {
            sourceVolume: 'akp-data',
            containerPath: '/var/www/html',
            readOnly: false,
          },
        ],
        logConfiguration: {
          logDriver: 'awslogs',
          options: {
            'awslogs-create-group': 'true',
            'awslogs-group': `/ecs/${name('wp')}/akp`,
            'awslogs-region': region,
            'awslogs-stream-prefix': 'akp',
          },
        },
      },
    },
    volumes: [
      {
        name: 'akp-data',
        efsVolumeConfiguration: {
          rootDirectory: '/akp',
          fileSystemId: efs.id,
          transitEncryption: 'ENABLED',
        },
      },
    ],
  },
  desiredCount: 1,
  networkConfiguration: {
    subnets: [privateSubnet.id, privateSubnet2.id],
    securityGroups: [ecsSecurityGroup.id],
    assignPublicIp: false,
  },
  loadBalancers: [
    {
      targetGroupArn: targetGroup.arn,
      containerName: 'wp',
      containerPort: 80,
    },
    {
      targetGroupArn: targetGroupTls.arn,
      containerName: 'wp',
      containerPort: 443,
    },
  ],
  tags: { proj },
});

// Auto Scaling
const autoScalingTarget = new aws.appautoscaling.Target(
  'ecs-autoscaling-target',
  {
    maxCapacity: 3,
    minCapacity: 1,
    resourceId: pulumi.interpolate`service/${ecsCluster.name}/${fargateService.service.name}`,
    scalableDimension: 'ecs:service:DesiredCount',
    serviceNamespace: 'ecs',
  },
);
new aws.appautoscaling.Policy('ecs-autoscaling-policy', {
  name: name('wp-autoscaling-policy'),
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

export const dbClusterEndpoint = dbCluster.endpoint;
export const dbMainEndpoint = dbMain.endpoint;
export const lbDnsName = lb.loadBalancer.dnsName;
