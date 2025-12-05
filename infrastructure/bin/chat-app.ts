#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ChatAppStack } from '../lib/chat-app-stack';

const app = new cdk.App();

new ChatAppStack(app, 'ChatAppStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-west-2',
  },
  description: 'ConnectBest Chat Application on ECS Fargate'
});