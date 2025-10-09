import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as awsx from '@pulumi/awsx';
import * as aws_native from '@pulumi/aws-native';
import * as docker_build from '@pulumi/docker-build';

interface Website {
  name: string;
  hostedZone: string;
  domain: string;
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

const websites: Website[] = [
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
export const websiteNames = websites.map((w) => w.name);

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
const privateSubnetA = new aws.ec2.Subnet('private-subnet-a', {
  vpcId: vpc.id,
  cidrBlock: '192.168.1.0/24',
  availabilityZone: `${region}a`,
  tags: { proj, Name: name('private-a') },
});
const privateSubnetB = new aws.ec2.Subnet('private-subnet-b', {
  vpcId: vpc.id,
  cidrBlock: '192.168.2.0/24',
  availabilityZone: `${region}b`,
  tags: { proj, Name: name('private-b') },
});
const publicSubnetA = new aws.ec2.Subnet('public-subnet-a', {
  vpcId: vpc.id,
  cidrBlock: '192.168.100.0/24',
  availabilityZone: `${region}a`,
  mapPublicIpOnLaunch: true,
  tags: { proj, Name: name('public-a') },
});
const publicSubnetB = new aws.ec2.Subnet('public-subnet-b', {
  vpcId: vpc.id,
  cidrBlock: '192.168.200.0/24',
  availabilityZone: `${region}b`,
  mapPublicIpOnLaunch: true,
  tags: { proj, Name: name('public-b') },
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
new aws.ec2.RouteTableAssociation('public-route-table-association-a', {
  subnetId: publicSubnetA.id,
  routeTableId: publicRouteTable.id,
});
new aws.ec2.RouteTableAssociation('public-route-table-association-b', {
  subnetId: publicSubnetB.id,
  routeTableId: publicRouteTable.id,
});
const eip = new aws.ec2.Eip('nat-gw-eip', {
  domain: 'vpc',
  tags: { proj, Name: name('nat-gw-eip') },
});
const natgw = new aws.ec2.NatGateway('nat-gw', {
  subnetId: publicSubnetA.id,
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
new aws.ec2.RouteTableAssociation('private-route-table-association-a', {
  subnetId: privateSubnetA.id,
  routeTableId: privateRouteTable.id,
});
new aws.ec2.RouteTableAssociation('private-route-table-association-b', {
  subnetId: privateSubnetB.id,
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
  tags: { proj, Name: name('lb-sg') },
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
  tags: { proj, Name: name('wp-sg') },
});
const jumpServerSecurityGroup = new aws.ec2.SecurityGroup('jump-server-sg', {
  name: name('jump-server-sg'),
  vpcId: vpc.id,
  description: 'Security group for Jump Server EC2 instance',
  ingress: [
    {
      protocol: 'tcp',
      fromPort: 22,
      toPort: 22,
      cidrBlocks: ['0.0.0.0/0'],
      description: 'SSH access',
    },
  ],
  egress: [
    { protocol: '-1', fromPort: 0, toPort: 0, cidrBlocks: ['0.0.0.0/0'] },
  ],
  tags: { proj, Name: name('jump-server-sg') },
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
    {
      protocol: 'tcp',
      fromPort: 3306,
      toPort: 3306,
      securityGroups: [jumpServerSecurityGroup.id],
      description: 'MySQL access from Jump Server',
    },
  ],
  tags: { proj, name: name('db-sg') },
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
    {
      protocol: 'tcp',
      fromPort: 2049,
      toPort: 2049,
      securityGroups: [jumpServerSecurityGroup.id],
      description: 'NFS access from Jump Server',
    },
  ],
  tags: { proj, name: name('fs-sg') },
});

// MariaDB RDS
// TODO: figure out how to store the secret with both username and password
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
  subnetIds: [privateSubnetA.id, privateSubnetB.id],
  description: 'Subnet group for MariaDB database',
  tags: { proj },
});
const enhancedMonitoringRole = new aws.iam.Role('db-enhanced-monitoring-role', {
  name: name('db-enhanced-monitoring-role'),
  assumeRolePolicy: {
    Version: '2012-10-17',
    Statement: [
      {
        Action: 'sts:AssumeRole',
        Effect: 'Allow',
        Principal: {
          Service: 'monitoring.rds.amazonaws.com',
        },
      },
    ],
  },
});
new aws.iam.RolePolicyAttachment('rds-enhanced-monitoring-policy', {
  role: enhancedMonitoringRole.name,
  policyArn:
    'arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole',
});
const dbParameterGroup = new aws.rds.ParameterGroup('db-parameter-group', {
  name: name('db-parameter-group'),
  family: 'mariadb11.8',
  parameters: [
    // For advanced performance monitoring
    {
      name: 'performance_schema',
      value: '1',
      applyMethod: 'pending-reboot', // because static param
    },
    // Query cache for repeated reads (WordPress benefits)
    {
      name: 'query_cache_type',
      value: '1', // ON
      applyMethod: 'pending-reboot', // because static param
    },
    {
      name: 'query_cache_size',
      value: '33554432', // 32MB
      applyMethod: 'immediate',
    },
    // ssl unnecessary and not used, db is in private vpc with security groups
    {
      name: 'require_secure_transport',
      value: '0', // OFF
      applyMethod: 'immediate',
    },
  ],
  tags: { proj },
});
const dbInstance = new aws.rds.Instance('db-instance', {
  identifier: name('db'),
  engine: 'mariadb',
  engineVersion: '11.8',
  autoMinorVersionUpgrade: true,
  instanceClass: 'db.t4g.micro', // arm 2vcpu 1gb ram
  allocatedStorage: 20, // 20gb minimum
  storageType: 'gp3', // General Purpose SSD with good baseline performance for reads
  storageEncrypted: true,
  enabledCloudwatchLogsExports: ['error', 'slowquery'],
  username: 'wp',
  password: aws.secretsmanager.getSecretVersionOutput({
    secretId: dbPassword.id,
  }).secretString,
  dbSubnetGroupName: dbSubnetGroup.name,
  vpcSecurityGroupIds: [dbSecurityGroup.id],
  backupRetentionPeriod: 7,
  backupWindow: '03:00-04:00',
  maintenanceWindow: 'mon:04:00-mon:05:00',
  skipFinalSnapshot: true,
  monitoringRoleArn: enhancedMonitoringRole.arn,
  monitoringInterval: 60, // 60 seconds - free tier
  parameterGroupName: dbParameterGroup.name,
  publiclyAccessible: false,
  multiAz: false, // no need to multi-az
  tags: { proj },
});
// TODO: automatically create databases for each website (see wp/create-dbs.sql)

// EFS File System
const efs = new aws.efs.FileSystem('fs', {
  creationToken: name('fs'),
  tags: { proj, Name: name('fs') },
});
new aws.efs.MountTarget('fs-mount-target-a', {
  fileSystemId: efs.id,
  subnetId: privateSubnetA.id,
  securityGroups: [efsSecurityGroup.id],
});
new aws.efs.MountTarget('fs-mount-target-b', {
  fileSystemId: efs.id,
  subnetId: privateSubnetB.id,
  securityGroups: [efsSecurityGroup.id],
});
new aws.efs.BackupPolicy('fs-backup-policy', {
  fileSystemId: efs.id,
  backupPolicy: {
    status: 'ENABLED',
  },
});

// EC2 Jump Server for rsync and database management
const jumpServerRole = new aws.iam.Role('jump-server-role', {
  name: name('jump-server-role'),
  assumeRolePolicy: {
    Version: '2012-10-17',
    Statement: [
      {
        Action: 'sts:AssumeRole',
        Effect: 'Allow',
        Principal: {
          Service: 'ec2.amazonaws.com',
        },
      },
    ],
  },
  tags: { proj },
});
new aws.iam.RolePolicyAttachment('jump-server-ssm-policy', {
  role: jumpServerRole.name,
  policyArn: 'arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore',
});
new aws.iam.RolePolicy('jump-server-secrets-policy', {
  name: name('jump-server-secrets-policy'),
  role: jumpServerRole.id,
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
new aws.iam.RolePolicy('jump-server-efs-policy', {
  name: name('jump-server-efs-policy'),
  role: jumpServerRole.id,
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
const jumpServerInstanceProfile = new aws.iam.InstanceProfile(
  'jump-server-instance-profile',
  {
    name: name('jump-server-instance-profile'),
    role: jumpServerRole.name,
  },
);
const jumpServerEip = new aws.ec2.Eip('jump-server-eip', {
  domain: 'vpc',
  tags: { proj, Name: name('jump-server-eip') },
});
const jumpServerFsAccessPoint = new aws.efs.AccessPoint('jump-server-fs-ap', {
  fileSystemId: efs.id,
  posixUser: {
    gid: 0,
    uid: 0,
  },
  rootDirectory: {
    path: '/',
    creationInfo: {
      ownerGid: 0,
      ownerUid: 0,
      permissions: '755',
    },
  },
  tags: { proj },
});
const jumpServer = new aws.ec2.Instance('jump-server', {
  ami: aws.ec2.getAmiOutput({
    mostRecent: true,
    owners: ['amazon'],
    filters: [
      {
        name: 'name',
        values: ['al2023-ami-*-arm64'],
      },
      {
        name: 'architecture',
        values: ['arm64'],
      },
      {
        name: 'virtualization-type',
        values: ['hvm'],
      },
    ],
  }).id,
  instanceType: 't4g.nano',
  subnetId: publicSubnetA.id,
  keyName: 'jump-server',
  vpcSecurityGroupIds: [jumpServerSecurityGroup.id],
  iamInstanceProfile: jumpServerInstanceProfile.name,
  tags: { proj, Name: name('jump-server') },
  // TODO: the efs must be in a ready and mountable state before this user data script runs
  userData: pulumi.interpolate`#!/bin/bash
set -e

# Update system
dnf update -y

# Install required packages
dnf install -y \
  amazon-efs-utils \
  rsync \
  mariadb105 \
  nfs-utils \
  vim

# Mount EFS at root with all privileges
mkdir -p /mnt/efs
mount -t efs -o noresvport,iam,tls,accesspoint=${jumpServerFsAccessPoint.id} ${efs.id}:/ /mnt/efs
# Add to fstab for persistent mount
echo "${efs.id}:/ /mnt/efs efs _netdev,noresvport,iam,tls,accesspoint=${jumpServerFsAccessPoint.id} 0 0" >> /etc/fstab

# Create a helper script for mysql connection
cat > /usr/local/bin/wp-mysql << 'EOF'
#!/bin/bash
DB_PASSWORD=$(aws secretsmanager get-secret-value --secret-id ${dbPassword.id} --region ${region} --query SecretString --output text)
mysql -h ${dbInstance.address} -P ${dbInstance.port} -u ${dbInstance.username} -p"$DB_PASSWORD" "$@"
EOF
chmod +x /usr/local/bin/wp-mysql

echo "OK"
`,
});
new aws.ec2.EipAssociation('jump-server-eip-assoc', {
  instanceId: jumpServer.id,
  allocationId: jumpServerEip.id,
});
export const jumpServerUsername = 'ec2-user';
export const jumpServerEndpoint = jumpServerEip.publicDns;

// WordPress Containers Image Repository
const wpFpmRepo = new aws.ecr.Repository('wp-fpm-repo', {
  name: name('wp-fpm'),
  forceDelete: true,
  imageScanningConfiguration: {
    scanOnPush: true,
  },
  tags: { proj },
});
const wpFpmRepoAuthToken = aws.ecr.getAuthorizationTokenOutput({
  registryId: wpFpmRepo.registryId,
});
const wpNginxRepo = new aws.ecr.Repository('wp-nginx-repo', {
  name: name('wp-nginx'),
  forceDelete: true,
  imageScanningConfiguration: {
    scanOnPush: true,
  },
  tags: { proj },
});
const wpNginxRepoAuthToken = aws.ecr.getAuthorizationTokenOutput({
  registryId: wpNginxRepo.registryId,
});
const wpReposLifecyclePolicy: aws.types.input.ecr.LifecyclePolicyDocument = {
  rules: [
    {
      rulePriority: 1,
      description: 'Delete untagged images after 1 day',
      selection: {
        tagStatus: 'untagged',
        countType: 'sinceImagePushed',
        countUnit: 'days',
        countNumber: 1,
      },
      action: {
        type: 'expire',
      },
    },
  ],
};
new aws.ecr.LifecyclePolicy('wp-fpm-repo-lifecycle-policy', {
  repository: wpFpmRepo.name,
  policy: wpReposLifecyclePolicy,
});
new aws.ecr.LifecyclePolicy('wp-nginx-repo-lifecycle-policy', {
  repository: wpNginxRepo.name,
  policy: wpReposLifecyclePolicy,
});

// Build and Push Images
const wpFpmImage = new docker_build.Image('wp-fpm-image', {
  context: { location: '../wp' },
  dockerfile: { location: '../wp/fpm.Dockerfile' },
  platforms: ['linux/arm64'],
  push: true,
  cacheFrom: [
    { registry: { ref: pulumi.interpolate`${wpFpmRepo.repositoryUrl}:cache` } },
  ],
  cacheTo: [
    {
      registry: {
        imageManifest: true,
        ociMediaTypes: true,
        ref: pulumi.interpolate`${wpFpmRepo.repositoryUrl}:cache`,
      },
    },
  ],
  registries: [
    {
      address: wpFpmRepo.repositoryUrl,
      username: wpFpmRepoAuthToken.userName,
      password: wpFpmRepoAuthToken.password,
    },
  ],
  tags: [pulumi.interpolate`${wpFpmRepo.repositoryUrl}:latest`],
});
const wpNginxImage = new docker_build.Image('wp-nginx-image', {
  context: { location: '../wp' },
  dockerfile: { location: '../wp/nginx.Dockerfile' },
  platforms: ['linux/arm64'],
  push: true,
  cacheFrom: [
    {
      registry: { ref: pulumi.interpolate`${wpNginxRepo.repositoryUrl}:cache` },
    },
  ],
  cacheTo: [
    {
      registry: {
        imageManifest: true,
        ociMediaTypes: true,
        ref: pulumi.interpolate`${wpNginxRepo.repositoryUrl}:cache`,
      },
    },
  ],
  registries: [
    {
      address: wpNginxRepo.repositoryUrl,
      username: wpNginxRepoAuthToken.userName,
      password: wpNginxRepoAuthToken.password,
    },
  ],
  tags: [pulumi.interpolate`${wpNginxRepo.repositoryUrl}:latest`],
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

// Task Role for ECS Execute Command (SSM)
const taskRole = new aws.iam.Role('wp-service-task-role', {
  name: name('wp-service-task-role'),
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
new aws.iam.RolePolicyAttachment('wp-service-task-role-ssm-policy', {
  role: taskRole.name,
  policyArn: 'arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore',
});

// Application Load Balancer
const lb = new awsx.lb.ApplicationLoadBalancer('lb', {
  name: name('lb'),
  securityGroups: [lbSecurityGroup.id],
  subnets: [publicSubnetA, publicSubnetB],
  listener: {
    port: 80,
    protocol: 'HTTP',
    defaultActions: [
      {
        type: 'redirect',
        redirect: {
          port: '443',
          protocol: 'HTTPS',
          statusCode: 'HTTP_301',
        },
      },
    ],
    tags: { proj },
  },
  tags: { proj },
});

// Default SSL Certificate for the Application Load Balancer under the domain lb.bhidapa.ba
// TODO: do we need to point the lb.bhidapa.ba domain to the load balancer too?
const lbCert = new aws.acm.Certificate('lb-cert', {
  domainName: 'lb.bhidapa.ba',
  validationMethod: 'DNS',
  tags: { proj, Name: name('lb-cert') },
});
const lbCertRecord = new aws.route53.Record('lb-cert-validation-record', {
  zoneId: aws.route53.getZoneOutput({
    name: 'bhidapa.ba',
    privateZone: false,
  }).zoneId,
  name: lbCert.domainValidationOptions[0]!.resourceRecordName,
  records: [lbCert.domainValidationOptions[0]!.resourceRecordValue],
  type: lbCert.domainValidationOptions[0]!.resourceRecordType,
  ttl: 60,
});
const lbCertValidation = new aws.acm.CertificateValidation(
  'lb-cert-validation',
  {
    certificateArn: lbCert.arn,
    validationRecordFqdns: [lbCertRecord.fqdn],
  },
);
const lbHttps = new aws.lb.Listener(
  'lb-https-listener',
  {
    loadBalancerArn: lb.loadBalancer.arn,
    port: 443,
    protocol: 'HTTPS',
    certificateArn: lbCert.arn,
    defaultActions: [
      {
        type: 'fixed-response',
        fixedResponse: {
          contentType: 'text/plain',
          statusCode: '418',
          messageBody: "I'm a teapot",
        },
      },
    ],
  },
  { dependsOn: [lbCertValidation] },
);

// For Each Website
for (const website of websites) {
  // Use Application Load Balancer
  const tg = new aws.lb.TargetGroup(`${website.name}-lb-tg`, {
    name: name(`${website.name}-lb-tg`),
    vpcId: vpc.id,
    targetType: 'ip',
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
  const hostedZone = aws.route53.getZoneOutput({
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
      zoneId: hostedZone.zoneId,
      name: cert.domainValidationOptions[0]!.resourceRecordName,
      records: [cert.domainValidationOptions[0]!.resourceRecordValue],
      type: cert.domainValidationOptions[0]!.resourceRecordType,
      ttl: 60,
    },
  );
  const certValidation = new aws.acm.CertificateValidation(
    `${website.name}-cert-validation`,
    {
      certificateArn: cert.arn,
      validationRecordFqdns: [certRecord.fqdn],
    },
  );
  new aws.lb.ListenerCertificate(
    `${website.name}-lb-https-listener-cert-attachment`,
    {
      listenerArn: lbHttps.arn,
      certificateArn: cert.arn,
    },
    { dependsOn: [certValidation] },
  );

  // Point domain DNS to Load Balancer
  new aws.route53.Record(`${website.name}-dns-a`, {
    zoneId: hostedZone.zoneId,
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

  // Redirect any alternate domains to the main domain
  for (const alt of website.alternate || []) {
    const i = website.alternate!.indexOf(alt);
    // SSL Certificate
    const hostedZone = aws.route53.getZoneOutput({
      name: alt.hostedZone || website.hostedZone,
      privateZone: false,
    });
    const cert = new aws.acm.Certificate(`${alt.name}-${website.name}-cert`, {
      domainName: alt.domain,
      validationMethod: 'DNS',
      tags: { proj, Name: name(`${alt.name}-${website.name}-cert`) }, // not up
    });
    const certRecord = new aws.route53.Record(
      `${alt.name}-${website.name}-cert-validation-record`,
      {
        zoneId: hostedZone.zoneId,
        name: cert.domainValidationOptions[0]!.resourceRecordName,
        records: [cert.domainValidationOptions[0]!.resourceRecordValue],
        type: cert.domainValidationOptions[0]!.resourceRecordType,
        ttl: 60,
      },
    );
    const certValidation = new aws.acm.CertificateValidation(
      `${alt.name}-${website.name}-cert-validation`,
      {
        certificateArn: cert.arn,
        validationRecordFqdns: [certRecord.fqdn],
      },
    );
    new aws.lb.ListenerCertificate(
      `${alt.name}-${website.name}-lb-https-listener-cert-attachment`,
      {
        listenerArn: lbHttps.arn,
        certificateArn: cert.arn,
      },
      { dependsOn: [certValidation] },
    );

    // Redirect rule
    new aws.lb.ListenerRule(`${alt.name}-${website.name}-lb-redirect-rule`, {
      listenerArn: lbHttps.arn,
      priority: 50 + i,
      conditions: [
        {
          hostHeader: {
            values: [alt.domain],
          },
        },
      ],
      actions: [
        {
          type: 'redirect',
          redirect: {
            host: website.domain,
            path: '/#{path}',
            query: '#{query}',
            protocol: 'HTTPS',
            port: '443',
            statusCode: 'HTTP_301',
          },
        },
      ],
      tags: { proj },
    });

    // Point alternative domain DNS to main domain using CNAME
    const pulumiRecordName = `${alt.name}-${website.name}-dns-record`;
    switch (alt.recordType) {
      case 'A':
        new aws.route53.Record(pulumiRecordName, {
          zoneId: hostedZone.zoneId,
          name: alt.domain,
          type: 'A',
          aliases: [
            {
              name: lb.loadBalancer.dnsName,
              zoneId: lb.loadBalancer.zoneId,
              evaluateTargetHealth: true,
            },
          ],
        });
        break;
      case 'CNAME':
      default:
        new aws.route53.Record(pulumiRecordName, {
          zoneId: hostedZone.zoneId,
          name: alt.domain,
          type: 'CNAME',
          records: [website.domain],
          ttl: 300,
        });
        break;
    }
  }

  // Securely Mount EFS to Fargate Under an Isolated Path
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

  // Ready the Log Group
  const logGroup = new aws.cloudwatch.LogGroup(`${website.name}-log-group`, {
    name: `/ecs/${name('wp')}/${website.name}`,
    retentionInDays: 7,
    tags: { proj },
  });

  // Fargate Service
  // TODO: new service should be deployed after the image gets recreated
  const service = new awsx.ecs.FargateService(
    `${website.name}-service`,
    {
      name: website.name,
      cluster: wpCluster.arn,
      enableExecuteCommand: true, // allows us to "docker exec" into running containers (using aws ecs execute-command)
      taskDefinitionArgs: {
        logGroup: {
          // we already created it, see `logGroup` above
          skip: true,
        },
        family: name(website.name),
        executionRole: {
          roleArn: taskExecutionRole.arn,
        },
        taskRole: {
          roleArn: taskRole.arn,
        },
        cpu: '1024', // 1 vCPU
        memory: '2048', // 2 GB
        runtimePlatform: {
          operatingSystemFamily: 'LINUX',
          cpuArchitecture: 'ARM64',
        },
        containers: {
          fpm: {
            name: 'fpm',
            image: pulumi.interpolate`${wpFpmRepo.repositoryUrl}:latest`,
            essential: true,
            healthCheck: {
              command: [
                'CMD-SHELL',
                'SCRIPT_NAME=/index.php SCRIPT_FILENAME=/var/www/html/index.php REQUEST_METHOD=GET cgi-fcgi -bind -connect localhost:9000 | grep -q "X-Powered-By: PHP" || exit 1',
              ],
            },
            environment: [
              { name: 'INTERNAL_PROXY_HOST', value: 'localhost' },
              { name: 'INTERNAL_PROXY_PORT', value: '80' },
              { name: 'WORDPRESS_DB_HOST', value: dbInstance.endpoint },
              { name: 'WORDPRESS_DB_NAME', value: website.name },
              { name: 'WORDPRESS_DB_USER', value: dbInstance.username },
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
          nginx: {
            name: 'nginx',
            image: pulumi.interpolate`${wpNginxRepo.repositoryUrl}:latest`,
            essential: true,
            dependsOn: [
              {
                containerName: 'fpm',
                condition: 'HEALTHY',
              },
            ],
            portMappings: [{ containerPort: 80 }],
            healthCheck: {
              command: ['CMD-SHELL', 'curl -f http://localhost:80 || exit 1'],
            },
            environment: [{ name: 'FASTCGI_PASS', value: 'localhost:9000' }],
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
        subnets: [privateSubnetA.id, privateSubnetB.id],
        securityGroups: [wpSecurityGroup.id],
        assignPublicIp: false,
      },
      loadBalancers: [
        {
          targetGroupArn: tg.arn,
          containerName: 'nginx',
          containerPort: 80,
        },
      ],
      tags: { proj },
    },
    { dependsOn: [wpFpmImage, wpNginxImage] },
  );

  // Auto Scaling
  const autoScalingTarget = new aws.appautoscaling.Target(
    `${website.name}-autoscaling-target`,
    {
      serviceNamespace: 'ecs',
      resourceId: pulumi.interpolate`service/${wpCluster.name}/${service.service.name}`,
      scalableDimension: 'ecs:service:DesiredCount',
      maxCapacity: 3,
      minCapacity: 1,
      tags: { proj },
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
