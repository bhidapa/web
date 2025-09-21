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
const publicSubnet = new aws.ec2.Subnet('public-subnet', {
  vpcId: vpc.id,
  cidrBlock: '123.4.2.0/24',
  availabilityZone: `${region}a`,
  mapPublicIpOnLaunch: true,
  tags: { proj, Name: name('public') },
});

const igw = new aws.ec2.InternetGateway('igw', {
  vpcId: vpc.id,
  tags: { proj, Name: name('igw') },
});
const publicRouteTable = new aws.ec2.RouteTable('public-route-table', {
  vpcId: vpc.id,
  tags: { proj, Name: name('public-route-table') },
});
// @ts-expect-error
const publicRoute = new aws.ec2.Route('public-route', {
  routeTableId: publicRouteTable.id,
  destinationCidrBlock: '0.0.0.0/0',
  gatewayId: igw.id,
});
// @ts-expect-error
const publicRouteTableAssociation = new aws.ec2.RouteTableAssociation(
  'public-route-table-association',
  {
    subnetId: publicSubnet.id,
    routeTableId: publicRouteTable.id,
  },
);

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

// @ts-expect-error
const privateRoute = new aws.ec2.Route('private-route', {
  routeTableId: privateRouteTable.id,
  destinationCidrBlock: '0.0.0.0/0',
  natGatewayId: natgw.id,
});
// @ts-expect-error
const privateRouteTableAssociation = new aws.ec2.RouteTableAssociation(
  'private-route-table-association',
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
