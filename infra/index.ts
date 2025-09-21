import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';

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

// ECR Repository for WordPress Docker image
const ecrRepository = new aws.ecr.Repository('wp', {
  name: name('wp'),
  imageScanningConfiguration: {
    scanOnPush: true,
  },
  tags: { proj, Name: name('wp-ecr') },
});

// Security Groups
const albSecurityGroup = new aws.ec2.SecurityGroup('alb-sg', {
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
  tags: { proj, Name: name('alb-sg') },
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
      securityGroups: [albSecurityGroup.id],
    },
    {
      protocol: 'tcp',
      fromPort: 443,
      toPort: 443,
      securityGroups: [albSecurityGroup.id],
    },
  ],
  egress: [
    { protocol: '-1', fromPort: 0, toPort: 0, cidrBlocks: ['0.0.0.0/0'] },
  ],
  tags: { proj, Name: name('ecs-sg') },
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
  tags: { proj, Name: name('wp-db-sg') },
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
  tags: { proj, Name: name('efs-sg') },
});

// Database Secrets
const dbPassword = new aws.kms.Key('wp-db-password', {
  description: 'WordPress database password',
  // generateSecretString: {
  //   secretStringTemplate: JSON.stringify({ username: 'wp' }),
  //   generateStringKey: 'password',
  //   excludeCharacters: '"@/\\',
  //   passwordLength: 32,
  // },
  tags: { proj, Name: name('wp-db-password') },
});

// Aurora Serverless v2 Database
const dbSubnetGroup = new aws.rds.SubnetGroup('wp-db-subnet-group', {
  name: name('wp-db-subnet-group'),
  subnetIds: [privateSubnet.id, privateSubnet2.id],
  description: 'Subnet group for Aurora database',
  tags: { proj, Name: name('wp-db-subnet-group') },
});

const auroraCluster = new aws.rds.Cluster('db-cluster', {
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
  tags: { proj, Name: name('wp-db') },
});
new aws.rds.ClusterInstance('aurora-main-instance', {
  clusterIdentifier: auroraCluster.id,
  instanceClass: 'db.serverless',
  engine: auroraCluster.engine.apply(
    (x) =>
      // @ts-expect-error
      aws.rds.EngineType[x],
  ),
  engineVersion: auroraCluster.engineVersion,
  tags: { proj, Name: name('wp-db-main-instance') },
});

// EFS File System
const efsFileSystem = new aws.efs.FileSystem('wp-efs', {
  creationToken: name('wp-efs'),
  performanceMode: 'generalPurpose',
  throughputMode: 'provisioned',
  provisionedThroughputInMibps: 100,
  encrypted: true,
  tags: { proj, Name: name('wp-efs') },
});
new aws.efs.MountTarget('efs-mount-target-1', {
  fileSystemId: efsFileSystem.id,
  subnetId: privateSubnet.id,
  securityGroups: [efsSecurityGroup.id],
});
new aws.efs.MountTarget('efs-mount-target-2', {
  fileSystemId: efsFileSystem.id,
  subnetId: privateSubnet2.id,
  securityGroups: [efsSecurityGroup.id],
});
new aws.efs.BackupPolicy('efs-backup-policy', {
  fileSystemId: efsFileSystem.id,
  backupPolicy: {
    status: 'ENABLED',
  },
});
  {
    subnetId: privateSubnet.id,
    routeTableId: privateRouteTable.id,
  },
);
// @ts-expect-error
const mainRouteTableAssociation = new aws.ec2.MainRouteTableAssociation(
  'main-route-table-association',
  {
    vpcId: vpc.id,
    routeTableId: privateRouteTable.id,
  },
);
