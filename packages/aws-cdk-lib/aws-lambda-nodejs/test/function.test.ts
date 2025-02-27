import * as fs from 'fs';
import * as path from 'path';
import { Template, Match } from '../../assertions';
import { Vpc } from '../../aws-ec2';
import { CodeConfig, Runtime } from '../../aws-lambda';
import { Stack } from '../../core';
import { NodejsFunction } from '../lib';
import { Bundling } from '../lib/bundling';

jest.mock('../lib/bundling', () => {
  return {
    Bundling: {
      bundle: jest.fn().mockReturnValue({
        bind: (): CodeConfig => {
          return {
            s3Location: {
              bucketName: 'my-bucket',
              objectKey: 'my-key',
            },
          };
        },
        bindToResource: () => { return; },
      }),
    },
  };
});

let stack: Stack;
beforeEach(() => {
  stack = new Stack();
  jest.clearAllMocks();
});

test.skip('NodejsFunction with .ts handler', () => {
  // WHEN
  new NodejsFunction(stack, 'handler1');

  expect(Bundling.bundle).toHaveBeenCalledWith(expect.objectContaining({
    entry: expect.stringContaining('function.test.handler1.ts'), // Automatically finds .ts handler file
  }));

  Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
    Handler: 'index.handler',
    Runtime: 'nodejs14.x',
  });
});

test.skip('NodejsFunction with overridden handler - no dots', () => {
  // WHEN
  new NodejsFunction(stack, 'handler1', {
    handler: 'myHandler',
  });

  expect(Bundling.bundle).toHaveBeenCalledWith(expect.objectContaining({
    entry: expect.stringContaining('function.test.handler1.ts'), // Automatically finds .ts handler file
  }));

  Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
    Handler: 'index.myHandler', // automatic index. prefix
    Runtime: 'nodejs14.x',
  });
});

test.skip('NodejsFunction with overridden handler - with dots', () => {
  // WHEN
  new NodejsFunction(stack, 'handler1', {
    handler: 'run.sh',
  });

  expect(Bundling.bundle).toHaveBeenCalledWith(expect.objectContaining({
    entry: expect.stringContaining('function.test.handler1.ts'), // Automatically finds .ts handler file
  }));

  Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
    Handler: 'run.sh', // No index. prefix
    Runtime: 'nodejs14.x',
  });
});

test.skip('NodejsFunction with .js handler', () => {
  // WHEN
  new NodejsFunction(stack, 'handler2');

  // THEN
  expect(Bundling.bundle).toHaveBeenCalledWith(expect.objectContaining({
    entry: expect.stringContaining('function.test.handler2.js'), // Automatically finds .ts handler file
  }));
});

test.skip('NodejsFunction with .mjs handler', () => {
  // WHEN
  new NodejsFunction(stack, 'handler3');


  // THEN
  expect(Bundling.bundle).toHaveBeenCalledWith(expect.objectContaining({
    entry: expect.stringContaining('function.test.handler3.mjs'), // Automatically finds .mjs handler file
  }));
});

test.skip('NodejsFunction with container env vars', () => {
  // WHEN
  new NodejsFunction(stack, 'handler1', {
    bundling: {
      environment: {
        KEY: 'VALUE',
      },
    },
  });

  expect(Bundling.bundle).toHaveBeenCalledWith(expect.objectContaining({
    environment: {
      KEY: 'VALUE',
    },
  }));
});

test.skip('throws when entry is not js/ts', () => {
  expect(() => new NodejsFunction(stack, 'Fn', {
    entry: 'handler.py',
  })).toThrow(/Only JavaScript or TypeScript entry files are supported/);
});

test.skip('accepts tsx', () => {
  const entry = path.join(__dirname, 'handler.tsx');

  fs.symlinkSync(path.join(__dirname, 'function.test.handler1.ts'), entry);

  expect(() => new NodejsFunction(stack, 'Fn', {
    entry,
  })).not.toThrow();

  fs.unlinkSync(entry);
});

test.skip('throws when entry does not exist', () => {
  expect(() => new NodejsFunction(stack, 'Fn', {
    entry: 'notfound.ts',
  })).toThrow(/Cannot find entry file at/);
});

test.skip('throws when entry cannot be automatically found', () => {
  expect(() => new NodejsFunction(stack, 'Fn')).toThrow(/Cannot find handler file .*function.test.Fn.ts, .*function.test.Fn.js or .*function.test.Fn.mjs/);
});

test.skip('throws with the wrong runtime family', () => {
  expect(() => new NodejsFunction(stack, 'handler1', {
    runtime: Runtime.PYTHON_3_8,
  })).toThrow(/Only `NODEJS` runtimes are supported/);
});

test.skip('throws with non existing lock file', () => {
  expect(() => new NodejsFunction(stack, 'handler1', {
    depsLockFilePath: '/does/not/exist.lock',
  })).toThrow(/Lock file at \/does\/not\/exist.lock doesn't exist/);
});

test.skip('throws when depsLockFilePath is not a file', () => {
  expect(() => new NodejsFunction(stack, 'handler1', {
    depsLockFilePath: __dirname,
  })).toThrow(/\`depsLockFilePath\` should point to a file/);
});

test.skip('resolves depsLockFilePath to an absolute path', () => {
  new NodejsFunction(stack, 'handler1', {
    depsLockFilePath: './package.json',
  });

  expect(Bundling.bundle).toHaveBeenCalledWith(expect.objectContaining({
    depsLockFilePath: expect.stringMatching(/aws-cdk-lib\/package.json$/),
  }));
});

test.skip('resolves entry to an absolute path', () => {
  // WHEN
  new NodejsFunction(stack, 'fn', {
    entry: 'aws-lambda-nodejs/lib/index.ts',
  });

  expect(Bundling.bundle).toHaveBeenCalledWith(expect.objectContaining({
    entry: expect.stringMatching(/aws-cdk-lib\/aws-lambda-nodejs\/lib\/index.ts$/),
  }));
});

test.skip('configures connection reuse for aws sdk', () => {
  // WHEN
  new NodejsFunction(stack, 'handler1');

  Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
    Environment: {
      Variables: {
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      },
    },
  });
});

test.skip('can opt-out of connection reuse for aws sdk', () => {
  // WHEN
  new NodejsFunction(stack, 'handler1', {
    awsSdkConnectionReuse: false,
  });

  Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
    Environment: Match.absent(),
  });
});

test.skip('NodejsFunction in a VPC', () => {
  // GIVEN
  const vpc = new Vpc(stack, 'Vpc');

  // WHEN
  new NodejsFunction(stack, 'handler1', { vpc });

  // THEN
  Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
    VpcConfig: {
      SecurityGroupIds: [
        {
          'Fn::GetAtt': [
            'handler1SecurityGroup30688A62',
            'GroupId',
          ],
        },
      ],
      SubnetIds: [
        {
          Ref: 'VpcPrivateSubnet1Subnet536B997A',
        },
        {
          Ref: 'VpcPrivateSubnet2Subnet3788AAA1',
        },
      ],
    },
  });
});
