import * as c from '@aws-accelerator/common-config/src';
import { AccountStacks } from '../../common/account-stacks';
import { FMSNotificationChannel } from '@aws-accelerator/custom-resource-fms-notification-channel';
import { Account, getAccountId } from '../../utils/accounts';
import * as cdk from '@aws-cdk/core';
import { createSnsTopicName } from '@aws-accelerator/cdk-accelerator/src/core/accelerator-name-generator';
import { StackOutput } from '@aws-accelerator/common-outputs/src/stack-output';
import { IamRoleOutputFinder } from '@aws-accelerator/common-outputs/src/iam-role';

export interface PutNotificationChannelProps {
  accountStacks: AccountStacks;
  config: c.AcceleratorConfig;
  accounts: Account[];
  assumeRole: string;
  outputs: StackOutput[];
}

/**
 *
 *  Set/Update the IAM account password policy
 *
 */
export async function putNotificationChannel(props: PutNotificationChannelProps) {
  const { accountStacks, config, accounts, assumeRole, outputs } = props;
  const centralSecurityConfig = config['global-options']['central-security-services'];
  const centralLogConfig = config['global-options']['central-log-services'];
  const fmsNotificationAlertLevel = centralSecurityConfig['fw-mgr-alert-level'];
  const centralLogAccountId = getAccountId(accounts, centralLogConfig.account);
  const supportedRegions = config['global-options']['supported-regions'];
  const excludeRegions = centralLogConfig['sns-excl-regions'];
  const fmsRoleOutput = IamRoleOutputFinder.tryFindOneByName({
    outputs,
    accountKey: centralSecurityConfig.account,
    roleKey: 'FmsCustomResourceRole',
  });
  if (!fmsRoleOutput) {
    console.warn("Didn't find FmsCustomResourceRole in outputs");
    return;
  }
  const regions = supportedRegions.filter(r => !excludeRegions?.includes(r));
  regions.map(region => {
    const accountStack = accountStacks.tryGetOrCreateAccountStack(centralSecurityConfig.account, region);
    if (!accountStack) {
      console.warn(`Cannot find account stack ${accountStack} in region ${region}`);
      return;
    }
    new FMSNotificationChannel(accountStack, `FMSNotificationChannel-Security`, {
      roleArn: fmsRoleOutput.roleArn,
      snsRoleArn: `arn:aws:iam::${cdk.Aws.ACCOUNT_ID}:role/${assumeRole}`,
      topicArn: `arn:aws:sns:${cdk.Aws.REGION}:${centralLogAccountId}:${createSnsTopicName(fmsNotificationAlertLevel)}`,
    });
  });
}
