import * as aws from '@pulumi/aws';
import * as aws_native from '@pulumi/aws-native';
import * as awsx from '@pulumi/awsx';
import * as pulumi from '@pulumi/pulumi';
import * as fs from 'fs';
import { name, portOf, proj, region, websites } from './defs.ts';
import { newImage } from './image.ts';

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

// Security Group for NAT Instance
const natSecurityGroup = new aws.ec2.SecurityGroup('nat-instance-sg', {
  name: name('nat-instance-sg'),
  vpcId: vpc.id,
  description: 'Security group for NAT instance',
  ingress: [
    { protocol: '-1', fromPort: 0, toPort: 0, cidrBlocks: [vpc.cidrBlock] },
  ],
  egress: [
    { protocol: '-1', fromPort: 0, toPort: 0, cidrBlocks: ['0.0.0.0/0'] },
  ],
  tags: { proj, Name: name('nat-instance-sg') },
});

// Elastic IP for NAT Instance
const eip = new aws.ec2.Eip('nat-instance-eip', {
  domain: 'vpc',
  tags: { proj, Name: name('nat-instance-eip') },
});

// NAT Instance
const natInstance = new aws.ec2.Instance(
  'nat-instance',
  {
    // NAT Instance (fck-nat)
    // https://fck-nat.dev/
    ami: aws.ec2.getAmiOutput({
      mostRecent: true,
      owners: ['568608671756'],
      filters: [
        {
          name: 'name',
          values: ['fck-nat-al2023-*-arm64-ebs'],
        },
        {
          name: 'architecture',
          values: ['arm64'],
        },
      ],
    }).id,
    instanceType: 't4g.nano',
    subnetId: publicSubnetA.id,
    vpcSecurityGroupIds: [natSecurityGroup.id],
    sourceDestCheck: false,
    tags: { proj, Name: name('nat-instance') },
  },
  { ignoreChanges: ['ami'] },
);

// Associate EIP with NAT Instance
new aws.ec2.EipAssociation('nat-instance-eip-assoc', {
  instanceId: natInstance.id,
  allocationId: eip.id,
});

// Private Subnet
const privateRouteTable = new aws.ec2.RouteTable('private-route-table', {
  vpcId: vpc.id,
  tags: { proj, Name: name('private-route-table') },
});
new aws.ec2.Route('private-route', {
  routeTableId: privateRouteTable.id,
  destinationCidrBlock: '0.0.0.0/0',
  networkInterfaceId: natInstance.primaryNetworkInterfaceId,
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

// Jump Server static public IP
const jumpServerEip = new aws.ec2.Eip('jump-server-eip', {
  domain: 'vpc',
  tags: { proj, Name: name('jump-server-eip') },
});

// Security Groups
const cfPrefixList = aws.ec2.getManagedPrefixListOutput({
  filters: [
    {
      // CloudFront managed prefix list for allowed IPs
      name: 'prefix-list-name',
      values: ['com.amazonaws.global.cloudfront.origin-facing'],
    },
  ],
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
const lbSecurityGroup = new aws.ec2.SecurityGroup('lb-sg', {
  name: name('lb-sg'),
  vpcId: vpc.id,
  description: 'Security group for Application Load Balancer',
  ingress: [
    {
      protocol: 'tcp',
      fromPort: 80,
      toPort: 80,
      prefixListIds: [cfPrefixList.id],
      description: 'Decrypted HTTP from CloudFront',
    },
    {
      protocol: 'tcp',
      fromPort: 80,
      toPort: 80,
      cidrBlocks: [pulumi.interpolate`${jumpServerEip.publicIp}/32`],
      description: 'Direct HTTP access from Jump Server from the outside',
    },
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
const monitoringRole = new aws.iam.Role('db-monitoring-role', {
  name: name('db-monitoring-role'),
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
new aws.iam.RolePolicyAttachment('rds-monitoring-policy', {
  role: monitoringRole.name,
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
    // fpm needs more connections when stuff is slow
    {
      name: 'max_connections',
      value: '100',
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
  monitoringRoleArn: monitoringRole.arn,
  monitoringInterval: 60, // 60 seconds - free tier
  parameterGroupName: dbParameterGroup.name,
  publiclyAccessible: false,
  multiAz: false, // no need to multi-az
  tags: { proj },
});
// TODO: automatically create databases for each website (see create-dbs.sql)

// EFS File System
const efs = new aws.efs.FileSystem('fs', {
  creationToken: name('fs'),
  throughputMode: 'elastic',
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
const jumpServer = new aws.ec2.Instance(
  'jump-server',
  {
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
    instanceType: 't4g.small', // t4g.nano is just too slow
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

# Ready the wp-cli helper container script
cat > /usr/local/bin/wp-cli << 'EOF'
#!/bin/bash
if [ -z "$WEBSITE" ]; then
  echo "WEBSITE environment variable is not set" >&2
  exit 1
fi
if [ ! -d "/mnt/efs/$WEBSITE" ]; then
  echo "Directory /mnt/efs/$WEBSITE does not exist" >&2
  exit 1
fi
DB_PASSWORD=$(aws secretsmanager get-secret-value --secret-id ${dbPassword.id} --region ${region} --query SecretString --output text)
docker run -it --rm \
  -v /mnt/efs/$WEBSITE:/var/www/html \
  -e WORDPRESS_DB_HOST=${dbInstance.endpoint} \
  -e WORDPRESS_DB_USER=${dbInstance.username} \
  -e WORDPRESS_DB_NAME=$WEBSITE \
  -e WORDPRESS_DB_PASSWORD="$DB_PASSWORD" \
  --entrypoint bash \
  wordpress:cli
EOF
chmod +x /usr/local/bin/wp-cli

echo "OK"
`,
  },
  { ignoreChanges: ['ami'] },
);
new aws.ec2.EipAssociation('jump-server-eip-assoc', {
  instanceId: jumpServer.id,
  allocationId: jumpServerEip.id,
});
export const jumpServerUsername = 'ec2-user';
export const jumpServerEndpoint = jumpServerEip.publicDns;

// WordPress Containers inside the ECR Repository
const fpmImage = newImage({ name: 'fpm' });
const nginxImage = newImage({ name: 'nginx' });
// all images have the same repositoryUrl
const ecrRepositoryUrl = fpmImage.repositoryUrl;

// ECS Cluster and Roles
const wpCluster = new aws.ecs.Cluster('wp-cluster', {
  name: name('wp'),
  settings: [
    {
      name: 'containerInsights',
      value: 'enabled',
    },
  ],
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

// Application Load Balancer (HTTP only - CloudFront handles SSL)
const lb = new awsx.lb.ApplicationLoadBalancer('lb', {
  name: name('lb'),
  securityGroups: [lbSecurityGroup.id],
  subnets: [publicSubnetA, publicSubnetB],
  listener: {
    port: 80,
    protocol: 'HTTP',
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
    tags: { proj },
  },
  tags: { proj },
});
const lbHttp = lb.listeners.apply((l) => l![0]!);

// CloudFront Provider for us-east-1 (required for CloudFront certificates)
const usEast1Provider = new aws.Provider('us-east-1-provider', {
  region: 'us-east-1',
});

// WAF Web ACL for rate limiting wp-login.php POST requests (must be in us-east-1 for CloudFront)
const wafWebAcl = new aws.wafv2.WebAcl(
  'cf-waf-webacl',
  {
    name: name('cf-waf'),
    scope: 'CLOUDFRONT', // CLOUDFRONT scope requires us-east-1
    defaultAction: {
      allow: {},
    },
    rules: [
      {
        name: 'RateLimitWpLogin',
        priority: 1,
        statement: {
          rateBasedStatement: {
            limit: 10, // Allow 10 requests per 5 minutes per IP
            aggregateKeyType: 'IP',
            scopeDownStatement: {
              andStatement: {
                statements: [
                  // Match POST requests
                  {
                    byteMatchStatement: {
                      searchString: 'POST',
                      fieldToMatch: {
                        method: {},
                      },
                      textTransformations: [
                        {
                          priority: 0,
                          type: 'NONE',
                        },
                      ],
                      positionalConstraint: 'EXACTLY',
                    },
                  },
                  // Match wp-login.php path
                  {
                    byteMatchStatement: {
                      searchString: 'wp-login.php',
                      fieldToMatch: {
                        uriPath: {},
                      },
                      textTransformations: [
                        {
                          priority: 0,
                          type: 'NONE',
                        },
                      ],
                      // we use ENDS_WITH because there can be multiple slashes in front of the path
                      positionalConstraint: 'ENDS_WITH',
                    },
                  },
                ],
              },
            },
          },
        },
        action: {
          block: {},
        },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudwatchMetricsEnabled: true,
          metricName: name('rate-limit-wp-login'),
        },
      },
    ],
    visibilityConfig: {
      sampledRequestsEnabled: true,
      cloudwatchMetricsEnabled: true,
      metricName: name('cf-waf'),
    },
    tags: { proj },
  },
  { provider: usEast1Provider },
);

// Export website names
export const websiteNames = websites.map((w) => w.name);

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
  const lbRulePriority = 100 * (websites.indexOf(website) + 1);
  new aws.lb.ListenerRule(`${website.name}-lb-rule`, {
    listenerArn: lbHttp.apply((l) => l.arn),
    priority: lbRulePriority,
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

  // Hosted Zone for DNS
  const hostedZone = aws.route53.getZoneOutput({
    name: website.hostedZone,
    privateZone: false,
  });

  // CloudFront SSL Certificate with all domains as SANs (must be in us-east-1)
  const cfCert = new aws.acm.Certificate(
    `${website.name}-cf-cert`,
    {
      domainName: website.domain,
      ...(website.alternate
        ? { subjectAlternativeNames: website.alternate!.map((w) => w.domain) }
        : {}),
      validationMethod: 'DNS',
      tags: { proj, Name: name(`${website.name}-cf-cert`) },
    },
    { provider: usEast1Provider },
  );

  // Collect all websites (main + alternates) for CloudFront aliases
  const allWebsites = [website, ...(website.alternate || [])];

  // DNS validation records for CloudFront certificate
  // Note: domainValidationOptions contains one entry per unique domain in the certificate
  const cfCertRecords = cfCert.domainValidationOptions.apply((options) =>
    options.map((option) => {
      // Find which website this validation option corresponds to
      const domain = option.domainName;
      const matchingWebsite = allWebsites.find((w) => w.domain === domain)!;

      // Determine the correct hosted zone for this domain
      const targetHostedZone = aws.route53.getZoneOutput({
        name: matchingWebsite.hostedZone || website.hostedZone,
        privateZone: false,
      });

      return new aws.route53.Record(
        `${website.name}-cf-cert-${matchingWebsite.name}-record`,
        {
          zoneId: targetHostedZone.zoneId,
          name: option.resourceRecordName,
          records: [option.resourceRecordValue],
          type: option.resourceRecordType,
          ttl: 60,
        },
      );
    }),
  );
  const cfCertsValidation = new aws.acm.CertificateValidation(
    `${website.name}-cf-certs-validation`,
    {
      certificateArn: cfCert.arn,
      validationRecordFqdns: cfCertRecords.apply((records) =>
        records.map((r) => r.fqdn),
      ),
    },
    { provider: usEast1Provider },
  );

  // CloudFront Cache Policies for WordPress Best Practices
  // as per https://docs.aws.amazon.com/whitepapers/latest/best-practices-wordpress/cloudfront-distribution-creation.html

  // NOTE: we want to manually invalidate the cache and therefore can set high TTLs

  // Static Assets Cache Policy (wp-content/*, wp-includes/*)
  const cfStaticCachePolicy = new aws.cloudfront.CachePolicy(
    `${website.name}-cf-static-cache-policy`,
    {
      name: name(`${website.name}-static-cache`),
      comment: 'Cache policy for WordPress static content',
      defaultTtl: 604800, // 1 week
      minTtl: 0,
      maxTtl: 31536000, // 1 year
      parametersInCacheKeyAndForwardedToOrigin: {
        enableAcceptEncodingGzip: true,
        enableAcceptEncodingBrotli: true,
        queryStringsConfig: { queryStringBehavior: 'all' },
        headersConfig: { headerBehavior: 'none' },
        cookiesConfig: { cookieBehavior: 'none' },
      },
    },
  );
  const cfStaticOriginRequestPolicy = new aws.cloudfront.OriginRequestPolicy(
    `${website.name}-cf-static-origin-request-policy`,
    {
      name: name(`${website.name}-static-origin`),
      comment: 'Origin request policy for WordPress static content',
      queryStringsConfig: { queryStringBehavior: 'all' },
      headersConfig: {
        // we need the host header for the alb rules
        headerBehavior: 'whitelist',
        headers: { items: ['Host', 'CloudFront-Forwarded-Proto'] },
      },
      cookiesConfig: { cookieBehavior: 'none' },
    },
  );

  // Dynamic Pages Cache Policy (default behavior)
  const cfDynamicCachePolicy = new aws.cloudfront.CachePolicy(
    `${website.name}-cf-dynamic-cache-policy`,
    {
      name: name(`${website.name}-dynamic-cache`),
      comment: 'Cache policy for WordPress dynamic front-end with invalidation',
      defaultTtl: 604800, // 1 week
      minTtl: 0,
      maxTtl: 31536000, // 1 year
      parametersInCacheKeyAndForwardedToOrigin: {
        enableAcceptEncodingGzip: true,
        enableAcceptEncodingBrotli: true,
        queryStringsConfig: { queryStringBehavior: 'all' },
        headersConfig: {
          headerBehavior: 'whitelist',
          headers: { items: ['Host', 'CloudFront-Forwarded-Proto'] },
        },
        cookiesConfig: {
          cookieBehavior: 'whitelist',
          cookies: {
            // because of the cookies in cache key, no logged-in user content (like the e-library) is cached
            items: ['comment_*', 'wordpress_*', 'wp-settings-*'],
          },
        },
      },
    },
  );
  const cfDynamicOriginRequestPolicy = new aws.cloudfront.OriginRequestPolicy(
    `${website.name}-cf-dynamic-origin-request-policy`,
    {
      name: name(`${website.name}-dynamic-origin`),
      comment: 'Origin request policy for WordPress dynamic front-end',
      queryStringsConfig: { queryStringBehavior: 'all' },
      headersConfig: {
        headerBehavior: 'whitelist',
        headers: { items: ['Host', 'CloudFront-Forwarded-Proto'] },
      },
      cookiesConfig: {
        cookieBehavior: 'whitelist',
        cookies: {
          // because of the cookies forwarding, no logged-in user content (like the e-library) is cached
          items: ['comment_*', 'wordpress_*', 'wp-settings-*'],
        },
      },
    },
  );

  // AWS Managed Policies
  const cfCacheDisabledPolicy = aws.cloudfront.getCachePolicyOutput({
    name: 'Managed-CachingDisabled',
  });
  const cfForwardAllRequestPolicy = aws.cloudfront.getOriginRequestPolicyOutput(
    {
      name: 'Managed-AllViewerAndCloudFrontHeaders-2022-06',
    },
  );

  // The only valid CloudFront Distribution behavior method combinations.
  const cfCacheBehaviorMethods = {
    all: {
      allowedMethods: [
        'GET',
        'HEAD',
        'OPTIONS',
        'PUT',
        'POST',
        'PATCH',
        'DELETE',
      ],
      cachedMethods: ['GET', 'HEAD', 'OPTIONS'],
    },
    onlyGet: {
      allowedMethods: ['GET', 'HEAD'],
      cachedMethods: ['GET', 'HEAD'],
    },
    getAndOpts: {
      allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
      cachedMethods: ['GET', 'HEAD', 'OPTIONS'],
    },
  };

  // CloudFront Distribution
  const cfDistribution = new aws.cloudfront.Distribution(
    `${website.name}-cf-distribution`,
    {
      enabled: true,
      isIpv6Enabled: true,
      httpVersion: 'http2',
      priceClass: 'PriceClass_100', // Use only North America and Europe
      aliases: allWebsites.map((w) => w.domain),
      comment: `CloudFront distribution for ${website.name}`,
      webAclId: wafWebAcl.arn,
      origins: [
        {
          domainName: lb.loadBalancer.dnsName,
          originId: 'alb',
          customOriginConfig: {
            httpPort: 80,
            originProtocolPolicy: 'http-only',
            originReadTimeout: 60,
            originKeepaliveTimeout: 5,
            // not used but required
            httpsPort: 443,
            originSslProtocols: ['TLSv1.2'],
          },
        },
      ],
      // Default behavior: Dynamic front-end content
      defaultCacheBehavior: {
        targetOriginId: 'alb',
        viewerProtocolPolicy: 'redirect-to-https',
        ...cfCacheBehaviorMethods.all,
        cachePolicyId: website.noCache
          ? cfCacheDisabledPolicy.apply((p) => p.id!)
          : cfDynamicCachePolicy.id,
        originRequestPolicyId: cfDynamicOriginRequestPolicy.id,
        compress: true,
      },
      // Ordered cache behaviors (evaluated in order, first match wins)
      orderedCacheBehaviors: [
        // WordPress Admin Dashboard - HTTPS only, pass everything
        {
          pathPattern: 'wp-admin/*',
          targetOriginId: 'alb',
          viewerProtocolPolicy: 'https-only',
          ...cfCacheBehaviorMethods.all,
          cachePolicyId: cfCacheDisabledPolicy.apply((p) => p.id!),
          originRequestPolicyId: cfForwardAllRequestPolicy.apply((p) => p.id!),
        },
        // WordPress Login Page - HTTPS only, pass everything
        {
          pathPattern: 'wp-login.php',
          targetOriginId: 'alb',
          viewerProtocolPolicy: 'https-only',
          ...cfCacheBehaviorMethods.all,
          cachePolicyId: cfCacheDisabledPolicy.apply((p) => p.id!),
          originRequestPolicyId: cfForwardAllRequestPolicy.apply((p) => p.id!),
        },
        // WordPress API - HTTPS only, pass everything
        {
          pathPattern: 'wp-json/*',
          targetOriginId: 'alb',
          viewerProtocolPolicy: 'https-only',
          ...cfCacheBehaviorMethods.all,
          cachePolicyId: cfCacheDisabledPolicy.apply((p) => p.id!),
          originRequestPolicyId: cfForwardAllRequestPolicy.apply((p) => p.id!),
        },
        {
          pathPattern: 'xmlrpc.php',
          targetOriginId: 'alb',
          viewerProtocolPolicy: 'https-only',
          ...cfCacheBehaviorMethods.all,
          cachePolicyId: cfCacheDisabledPolicy.apply((p) => p.id!),
          originRequestPolicyId: cfForwardAllRequestPolicy.apply((p) => p.id!),
        },
        {
          pathPattern: 'wp-cron.php',
          targetOriginId: 'alb',
          viewerProtocolPolicy: 'https-only',
          ...cfCacheBehaviorMethods.all, // we need both GET and POST because of loopback requests
          cachePolicyId: cfCacheDisabledPolicy.apply((p) => p.id!),
          originRequestPolicyId: cfForwardAllRequestPolicy.apply((p) => p.id!),
        },
        // Static Content (core WordPress static files, uploads, themes, plugins)
        {
          pathPattern: 'wp-content/*',
          targetOriginId: 'alb',
          viewerProtocolPolicy: 'redirect-to-https',
          ...cfCacheBehaviorMethods.getAndOpts,
          cachePolicyId: website.noCache
            ? cfCacheDisabledPolicy.apply((p) => p.id!)
            : cfStaticCachePolicy.id,
          originRequestPolicyId: cfStaticOriginRequestPolicy.id,
          compress: true,
        },
        {
          pathPattern: 'wp-includes/*',
          targetOriginId: 'alb',
          viewerProtocolPolicy: 'redirect-to-https',
          ...cfCacheBehaviorMethods.getAndOpts,
          cachePolicyId: website.noCache
            ? cfCacheDisabledPolicy.apply((p) => p.id!)
            : cfStaticCachePolicy.id,
          originRequestPolicyId: cfStaticOriginRequestPolicy.id,
          compress: true,
        },
      ],
      restrictions: {
        geoRestriction: {
          restrictionType: 'none',
        },
      },
      viewerCertificate: {
        acmCertificateArn: cfCert.arn,
        sslSupportMethod: 'sni-only',
        minimumProtocolVersion: 'TLSv1.2_2021',
      },
      tags: { proj, Name: website.name },
    },
    { dependsOn: [cfCertsValidation] },
  );

  // Point domain DNS to CloudFront
  new aws.route53.Record(`${website.name}-dns-a`, {
    zoneId: hostedZone.zoneId,
    name: website.domain,
    type: 'A',
    aliases: [
      {
        name: cfDistribution.domainName,
        zoneId: cfDistribution.hostedZoneId,
        evaluateTargetHealth: false,
      },
    ],
  });

  // DNS for alternate domains pointing to main
  for (const alt of website.alternate || []) {
    const hostedZone = aws.route53.getZoneOutput({
      name: alt.hostedZone || website.hostedZone,
      privateZone: false,
    });
    const pulumiRecordName = `${website.name}-to-${alt.name}-dns-record`;
    switch (alt.recordType) {
      case 'A':
        new aws.route53.Record(pulumiRecordName, {
          zoneId: hostedZone.zoneId,
          name: alt.domain,
          type: 'A',
          aliases: [
            {
              name: cfDistribution.domainName,
              zoneId: cfDistribution.hostedZoneId,
              evaluateTargetHealth: false,
            },
          ],
        });
        break;
      case 'CNAME':
        new aws.route53.Record(pulumiRecordName, {
          zoneId: hostedZone.zoneId,
          name: alt.domain,
          type: 'CNAME',
          records: [website.domain],
          ttl: 300,
        });
        break;
      default:
        throw new Error(
          `Unsupported record type ${alt.recordType} for alternate domain ${alt.domain}`,
        );
    }
  }

  // ALB redirect rules for alternate domains
  for (const alt of website.alternate || []) {
    new aws.lb.ListenerRule(`${website.name}-to-${alt.name}-redirect-lb-rule`, {
      listenerArn: lbHttp.arn,
      priority: lbRulePriority + 10 + website.alternate!.indexOf(alt),
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

  const logGroup = new aws.cloudwatch.LogGroup(`${website.name}-log-group`, {
    name: `/ecs/${name('wp')}/${website.name}`,
    retentionInDays: 7,
    tags: { proj },
  });

  new awsx.ecs.FargateService(`${website.name}-service`, {
    name: website.name,
    cluster: wpCluster.arn,
    taskDefinitionArgs: {
      logGroup: {
        // we already created it, see `logGroup` above
        skip: true,
      },
      family: name(website.name),
      executionRole: {
        roleArn: taskExecutionRole.arn,
      },
      cpu: '2048', // 2 vCPU
      memory: '4096', // 4 GB
      runtimePlatform: {
        operatingSystemFamily: 'LINUX',
        cpuArchitecture: 'ARM64',
      },
      containers: {
        fpm: {
          name: 'fpm',
          image: fpmImage.imageUri,
          linuxParameters: {
            capabilities: {
              add: ['SYS_PTRACE'],
            },
          },
          essential: true,
          healthCheck: {
            // also change the healthcheck in compose.yml
            command: [
              'CMD-SHELL',
              'SCRIPT_NAME=/healthcheck.php SCRIPT_FILENAME=/opt/healthcheck.php cgi-fcgi -bind -connect localhost:9000 | grep -q "X-Powered-By: PHP" || exit 1',
            ],
          },
          environment: [
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
          image: nginxImage.imageUri,
          essential: true,
          dependsOn: [
            {
              containerName: 'fpm',
              condition: 'HEALTHY',
            },
          ],
          portMappings: [{ containerPort: 80 }],
          healthCheck: {
            // also change the healthcheck in compose.yml
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
  });
}

const websiteComposeParam = new aws.ssm.Parameter('website-compose-param', {
  name: name('compose.website.yml'),
  type: 'String',
  description: `Docker Compose configuration for each of the websites running on EC2`,
  value: fs.readFileSync('compose.website.yml', 'utf8'),
  tags: { proj },
});

const websitesServerRole = new aws.iam.Role('websites-server-role', {
  name: name('websites-server-role'),
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

new aws.iam.RolePolicyAttachment('websites-server-role-ssm-policy', {
  role: websitesServerRole.name,
  policyArn: 'arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore',
});

new aws.iam.RolePolicy('websites-server-role-param-policy', {
  name: name('websites-server-role-param-policy'),
  role: websitesServerRole.id,
  policy: {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: ['ssm:GetParameter', 'ssm:GetParameters'],
        Resource: '*',
      },
      {
        Effect: 'Allow',
        Action: ['secretsmanager:GetSecretValue'],
        Resource: dbPassword.id,
      },
      {
        Effect: 'Allow',
        Action: ['ecr:GetAuthorizationToken'],
        Resource: '*',
      },
      {
        Effect: 'Allow',
        Action: [
          'ecr:BatchCheckLayerAvailability',
          'ecr:GetDownloadUrlForLayer',
          'ecr:BatchGetImage',
        ],
        Resource: '*',
      },
    ],
  },
});

const websitesServerProfile = new aws.iam.InstanceProfile(
  'websites-server-profile',
  {
    name: name('websites-server-profile'),
    role: websitesServerRole.name,
  },
);

// Security group for EC2 deployment instance
const websitesServerSecurityGroup = new aws.ec2.SecurityGroup(
  'websites-server-sg',
  {
    name: name('websites-server-sg'),
    vpcId: vpc.id,
    description: 'Security group for EC2 websites server instance',
    ingress: [
      {
        protocol: 'tcp',
        fromPort: 22,
        toPort: 22,
        cidrBlocks: ['0.0.0.0/0'],
        description: 'SSH access',
      },
      ...websites.map((website) => ({
        fromPort: portOf(website),
        toPort: portOf(website),
        protocol: 'tcp',
        securityGroups: [lbSecurityGroup.id],
        description: `HTTP from ALB on port ${portOf(website)}`,
      })),
    ],
    egress: [
      { protocol: '-1', fromPort: 0, toPort: 0, cidrBlocks: ['0.0.0.0/0'] },
    ],
    tags: { proj, Name: name('websites-sg') },
  },
);

// Allow EC2 instance to access database
new aws.ec2.SecurityGroupRule('websites-server-to-db', {
  type: 'ingress',
  fromPort: 3306,
  toPort: 3306,
  protocol: 'tcp',
  securityGroupId: dbSecurityGroup.id,
  sourceSecurityGroupId: websitesServerSecurityGroup.id,
  description: 'Database access from EC2 websites instance',
});

const websitesServer = new aws.ec2.Instance(
  'websites-server',
  {
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
    instanceType: 't4g.medium',
    subnetId: publicSubnetA.id,
    keyName: 'websites-server',
    vpcSecurityGroupIds: [websitesServerSecurityGroup.id],
    iamInstanceProfile: websitesServerProfile.name,
    rootBlockDevice: {
      // TODO: back up the EBS volume with AWS Backup
      volumeSize: 50, // GB
    },
    tags: { proj, Name: name('websites-server') },
    userData: `#!/bin/bash
set -eux

# Update system
dnf update -y

# Install required packages
dnf install -y \
  amazon-efs-utils \
  rsync \
  mariadb105 \
  nfs-utils \
  vim

# Install Docker Compose
sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-aarch64 -o /usr/libexec/docker/cli-plugins/docker-compose
sudo chmod +x /usr/libexec/docker/cli-plugins/docker-compose
`,
  },
  {
    ignoreChanges: ['ami'],
    replaceOnChanges: ['*'], // TODO: remove when we're good
  },
);

// Jump Server static public IP
const websitesServerEip = new aws.ec2.Eip('websites-server-eip', {
  domain: 'vpc',
  tags: { proj, Name: name('websites-server-eip') },
});
new aws.ec2.EipAssociation('websites-server-eip-assoc', {
  instanceId: websitesServer.id,
  allocationId: websitesServerEip.id,
});

const websitesServerDeployDocument = new aws.ssm.Document(
  'websites-server-deploy-document',
  {
    name: name('websites-server-deploy'),
    documentType: 'Command',
    documentFormat: 'YAML',
    content: pulumi
      .all([
        ecrRepositoryUrl,
        websiteComposeParam.name,
        fpmImage.imageUri,
        nginxImage.imageUri,
        dbInstance.endpoint,
        dbInstance.username,
        dbPassword.id,
      ])
      .apply(
        ([
          ecrRepositoryUrl,
          websiteComposeParamName,
          fpmImageUri,
          nginxImageUri,
          dbHost,
          dbUser,
          dbPasswordSecretId,
        ]) =>
          pulumi.jsonStringify(
            {
              schemaVersion: '2.2',
              description: 'Deploy all WordPress websites using docker compose',
              mainSteps: [
                {
                  action: 'aws:runShellScript',
                  name: 'deployWebsites',
                  inputs: {
                    runCommand: [
                      ...`
set -eux

aws ecr get-login-password --region ${region} | docker login --username AWS --password-stdin ${ecrRepositoryUrl}

${websites
  .map(
    (website) => `
mkdir -p /var/www/${website.name}
cd /var/www/${website.name}

aws ssm get-parameter --name '${websiteComposeParamName}' --region ${region} --query 'Parameter.Value' --output text > compose.yml

cat << EOF > .env
FPM_IMAGE=${fpmImageUri}
NGINX_IMAGE=${nginxImageUri}
WORDPRESS_DB_HOST=${dbHost}
WORDPRESS_DB_USER=${dbUser}
WORDPRESS_DB_NAME=${website.name}
WORDPRESS_DB_PASSWORD=$(aws secretsmanager get-secret-value --secret-id ${dbPasswordSecretId} --region ${region} --query SecretString --output text)
WEBSITE_PORT=${portOf(website)}
EOF

docker compose pull

docker compose up -d --remove-orphans --wait
`,
  )
  .join('\n')}
`
                        .split('\n')
                        .map((line) => line.trim())
                        .filter(Boolean)
                        .filter((line) => !line.startsWith('#')),
                    ],
                  },
                },
              ],
            },
            undefined,
            2,
          ),
      ),
    tags: { proj },
  },
);
new aws.ssm.Association('websites-server-deploy-association', {
  name: websitesServerDeployDocument.name,
  targets: [
    {
      key: 'InstanceIds',
      values: [websitesServer.id],
    },
  ],
});

const websitesServerWpCliDocument = new aws.ssm.Document(
  'websites-server-wp-cli-document',
  {
    name: name('websites-server-wp-cli'),
    documentType: 'Command',
    documentFormat: 'YAML',
    content: pulumi
      .all([dbInstance.endpoint, dbInstance.username, dbPassword.id])
      .apply(([dbHost, dbUser, dbPasswordSecretId]) =>
        pulumi.jsonStringify(
          {
            schemaVersion: '2.2',
            description: 'Install WP CLI for WordPress websites',
            mainSteps: [
              {
                action: 'aws:runShellScript',
                name: 'deployWebsites',
                inputs: {
                  runCommand: [
                    ...`
set -eux

cat > /usr/local/bin/wp-cli << 'EOF'
#!/bin/bash
WEBSITE="$1"
if [ -z "$WEBSITE" ]; then
  echo "Website argument not provided. Possible values are: ${websiteNames.join(', ')}." >&2
  exit 1
fi
if [ ! -d "/var/www/$WEBSITE/wp-data" ]; then
  echo "Directory /var/www/$WEBSITE/wp-data does not exist" >&2
  exit 1
fi
DB_PASSWORD=$(aws secretsmanager get-secret-value --secret-id ${dbPasswordSecretId} --region ${region} --query SecretString --output text)
docker run -it --rm \
  -v /var/www/$WEBSITE/wp-data:/var/www/html \
  -e WORDPRESS_DB_HOST=${dbHost} \
  -e WORDPRESS_DB_USER=${dbUser} \
  -e WORDPRESS_DB_NAME=$WEBSITE \
  -e WORDPRESS_DB_PASSWORD="$DB_PASSWORD" \
  --entrypoint bash \
  wordpress:cli
EOF
chmod +x /usr/local/bin/wp-cli
`
                      .split('\n')
                      .map((line) => line.trim())
                      .filter(Boolean)
                      .filter((line) => !line.startsWith('#')),
                  ],
                },
              },
            ],
          },
          undefined,
          2,
        ),
      ),
    tags: { proj },
  },
);
new aws.ssm.Association('websites-server-wp-cli-association', {
  name: websitesServerWpCliDocument.name,
  targets: [
    {
      key: 'InstanceIds',
      values: [websitesServer.id],
    },
  ],
});

export const wbsitesServerUsername = 'ec2-user';
export const wbsitesServerEndpoint = websitesServerEip.publicDns;

// Wordpress Cloudfront Invalidation plugin, and other needs for an installation
// https://wordpress.org/plugins/c3-cloudfront-clear-cache/

const wpUserPolicy = new aws.iam.Policy('wp-user-policy', {
  name: name('wp-user-policy'),
  description:
    'Policy for WordPress installations. CloudFront invalidation and SES mail sending.',
  policy: {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: [
          'cloudfront:GetDistribution',
          'cloudfront:ListInvalidations',
          'cloudfront:GetStreamingDistribution',
          'cloudfront:GetDistributionConfig',
          'cloudfront:GetInvalidation',
          'cloudfront:CreateInvalidation',
          'ses:SendRawEmail',
        ],
        Resource: '*',
      },
    ],
  },
  tags: { proj },
});

const wpUser = new aws.iam.User('wp-user', {
  name: name('wp-user'),
  tags: { proj },
});

new aws.iam.UserPolicyAttachment('wp-user-policy-attachment', {
  user: wpUser.name,
  policyArn: wpUserPolicy.arn,
});

const mediaAndCfAccessKey = new aws.iam.AccessKey(
  'wp-user-access-key',
  {
    user: wpUser.name,
  },
  {
    // because SES is only in eu-west-1
    provider: new aws.Provider('eu-west-1-provider', {
      region: 'eu-west-1',
    }),
  },
);

export const wpUserAccessKeyId = mediaAndCfAccessKey.id;
export const wpUserSecretAccessKey = mediaAndCfAccessKey.secret;
export const wpUserSmtpPassword = mediaAndCfAccessKey.sesSmtpPasswordV4;
