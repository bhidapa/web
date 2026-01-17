import * as pulumi from '@pulumi/pulumi';
import * as command from '@pulumi/command';
import * as path from 'path';
import * as fs from 'fs';
import { name, region } from './defs.ts';

// Use FileAsset to track Packer file changes
const packerFilePath = path.join(__dirname, 'ami', 'ec2-deploy.pkr.hcl');
const packerAsset = new pulumi.asset.FileAsset(packerFilePath);

// Build AMI with Packer (only when Packer file changes)
// The asset hash ensures this only runs when the Packer file content changes
const buildAmi = new command.local.Command(
  'build-ami',
  {
    create: pulumi.interpolate`
set -eux
cd ${__dirname}/ami
echo "Initializing Packer..."
packer init ec2-deploy.pkr.hcl
echo "Building AMI..."
packer build -var "region=${region}" -var "ami_name=${name('ec2-deploy')}" -machine-readable ec2-deploy.pkr.hcl | tee packer-build.log
`,
    triggers: [packerAsset],
  },
  {
    // Custom timeout for Packer build (can take 5-10 minutes)
    customTimeouts: {
      create: '20m',
    },
  },
);

// Extract AMI ID from Packer output
const amiId = buildAmi.stdout.apply((stdout) => {
  // Parse machine-readable output for AMI ID
  // Format: timestamp,target,type,data...
  // We're looking for: timestamp,,ui,say-n,    artifact 0: ami-xxxxx
  const lines = stdout.split('\n');

  for (const line of lines) {
    // Look for artifact line in machine-readable format
    if (line.includes('artifact,0,id')) {
      const parts = line.split(',');
      if (parts.length > 5) {
        const idPart = parts[5]; // Format: region:ami-xxxxx
        if (idPart.includes(':')) {
          const ami = idPart.split(':')[1];
          if (ami && ami.startsWith('ami-')) {
            return ami;
          }
        }
      }
    }
  }

  // Fallback: try to parse from the log file
  const logFile = '/tmp/packer-build.log';
  if (fs.existsSync(logFile)) {
    const log = fs.readFileSync(logFile, 'utf-8');
    const lines = log.split('\n');
    for (const line of lines) {
      if (line.includes('artifact,0,id')) {
        const match = line.match(/ami-[a-z0-9]+/);
        if (match) {
          return match[0];
        }
      }
    }
  }

  throw new Error(
    'Failed to extract AMI ID from Packer output. Check /tmp/packer-build.log for details.',
  );
});

export { amiId };
