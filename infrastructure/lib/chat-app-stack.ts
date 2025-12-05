import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as certificateManager from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';

export class ChatAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC with public and private subnets across 2 AZs
    const vpc = new ec2.Vpc(this, 'ChatAppVpc', {
      maxAzs: 2,
      enableDnsHostnames: true,
      enableDnsSupport: true,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'PublicSubnet',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'PrivateSubnet',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        }
      ]
    });

    // ECS Cluster
    const cluster = new ecs.Cluster(this, 'ChatAppCluster', {
      vpc,
      clusterName: 'chat-app-cluster',
      containerInsights: true
    });

    // CloudWatch Log Group
    const logGroup = new logs.LogGroup(this, 'ChatAppLogGroup', {
      logGroupName: '/ecs/chat-app',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // Task Definition for multi-container setup
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'ChatAppTaskDef', {
      memoryLimitMiB: 2048,  // Increased for two containers
      cpu: 1024,             // Increased for two containers
      family: 'chat-app'
    });

    // Add ECR permissions to execution role
    taskDefinition.executionRole?.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')
    );

    // Add additional ECR permissions
    if (taskDefinition.executionRole) {
      (taskDefinition.executionRole as iam.Role).addToPolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'ecr:GetAuthorizationToken',
          'ecr:BatchCheckLayerAvailability',
          'ecr:GetDownloadUrlForLayer',
          'ecr:BatchGetImage'
        ],
        resources: ['*']
      }));
    }

    // SECURITY: Get all sensitive values from environment variables only
    // DO NOT hardcode credentials in source code
    const mongoUri = process.env.MONGODB_URI || this.node.tryGetContext('MONGODB_URI');
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is required');
    }

    const nextAuthSecret = process.env.NEXTAUTH_SECRET || this.node.tryGetContext('NEXTAUTH_SECRET');
    if (!nextAuthSecret) {
      throw new Error('NEXTAUTH_SECRET environment variable is required');
    }

    const secretKey = process.env.SECRET_KEY || this.node.tryGetContext('SECRET_KEY');
    if (!secretKey) {
      throw new Error('SECRET_KEY environment variable is required');
    }

    const jwtSecretKey = process.env.JWT_SECRET_KEY || this.node.tryGetContext('JWT_SECRET_KEY');
    if (!jwtSecretKey) {
      throw new Error('JWT_SECRET_KEY environment variable is required');
    }

    // Frontend Container (Next.js)
    const frontendContainer = taskDefinition.addContainer('FrontendContainer', {
      image: ecs.ContainerImage.fromRegistry('839776274679.dkr.ecr.us-west-2.amazonaws.com/chat-frontend:latest'),
      memoryLimitMiB: 512,
      cpu: 256,
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'chat-frontend',
        logGroup: logGroup
      }),
      environment: {
        NODE_ENV: 'production',
        PORT: '3000',
        HOSTNAME: '0.0.0.0'
      }
    });

    // Backend Container (Flask)
    const backendContainer = taskDefinition.addContainer('BackendContainer', {
      image: ecs.ContainerImage.fromRegistry('839776274679.dkr.ecr.us-west-2.amazonaws.com/chat-backend:latest'),
      memoryLimitMiB: 1536,
      cpu: 768,
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'chat-backend',
        logGroup: logGroup
      }),
      environment: {
        // Core Flask settings
        FLASK_ENV: 'production',
        DEBUG: 'False',
        HOST: '0.0.0.0',
        PORT: '5001',
        PYTHONUNBUFFERED: '1',

        // MongoDB configuration (exact match from Lightsail)
        MONGODB_DB_NAME: 'chatapp',
        MONGODB_URI: mongoUri,

        // JWT configuration (exact match from Lightsail)
        JWT_EXPIRATION_HOURS: '168',
        JWT_SECRET_KEY: jwtSecretKey,
        SECRET_KEY: secretKey,

        // CORS and URLs - includes both production domain and ALB for testing
        CORS_ORIGINS: 'https://connect-best.com,http://chat-app-alb-2064082767.us-west-2.elb.amazonaws.com',
        FRONTEND_URL: 'http://chat-app-alb-2064082767.us-west-2.elb.amazonaws.com',
        NEXTAUTH_URL: 'http://chat-app-alb-2064082767.us-west-2.elb.amazonaws.com',
        NEXTAUTH_SECRET: nextAuthSecret,

        // Google OAuth - using environment variables for security
        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '699045979125-v1tjnfluhmobrod8hogdbktqgi2vpv3t.apps.googleusercontent.com',
        GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || 'PLACEHOLDER_SECRET',
        GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || 'https://connect-best.com/api/auth/google/callback',

        // Email configuration (exact match from Lightsail)
        EMAIL_HOST: 'smtp.gmail.com',
        EMAIL_PORT: '587',
        EMAIL_FROM: 'noreply@connectbest.com',
        EMAIL_USER: '',  // null in Lightsail
        EMAIL_PASSWORD: '',  // null in Lightsail

        // Upload configuration (exact match from Lightsail)
        MAX_CONTENT_LENGTH: '52428800',
        UPLOAD_FOLDER: 'static/uploads',

        // WebSocket URL (exact match from Lightsail)
        NEXT_PUBLIC_WEBSOCKET_URL: 'wss://v68x792yd5.execute-api.us-west-2.amazonaws.com/prod'
      }
    });

    // Port mappings
    frontendContainer.addPortMappings({
      containerPort: 3000,
      protocol: ecs.Protocol.TCP
    });

    backendContainer.addPortMappings({
      containerPort: 5001,
      protocol: ecs.Protocol.TCP
    });

    // Security Group for ALB
    const albSecurityGroup = new ec2.SecurityGroup(this, 'AlbSecurityGroup', {
      vpc,
      description: 'Security group for Chat App ALB',
      allowAllOutbound: true
    });

    // Allow inbound HTTP traffic to ALB
    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP traffic from internet'
    );

    // Allow inbound HTTPS traffic to ALB (for future use)
    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS traffic from internet'
    );

    // Application Load Balancer
    const alb = new elbv2.ApplicationLoadBalancer(this, 'ChatAppALB', {
      vpc,
      internetFacing: true,
      loadBalancerName: 'chat-app-alb',
      securityGroup: albSecurityGroup
    });

    // Frontend Target Group (Next.js on port 3000)
    const frontendTargetGroup = new elbv2.ApplicationTargetGroup(this, 'FrontendTargetGroup', {
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      vpc,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        enabled: true,
        healthyHttpCodes: '200',
        path: '/',
        protocol: elbv2.Protocol.HTTP,
        interval: cdk.Duration.seconds(60),
        timeout: cdk.Duration.seconds(30),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 5
      }
    });

    // Backend Target Group (Flask on port 5001)
    const backendTargetGroup = new elbv2.ApplicationTargetGroup(this, 'BackendTargetGroup', {
      port: 5001,
      protocol: elbv2.ApplicationProtocol.HTTP,
      vpc,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        enabled: true,
        healthyHttpCodes: '200',
        path: '/api/health',
        protocol: elbv2.Protocol.HTTP,
        interval: cdk.Duration.seconds(60),
        timeout: cdk.Duration.seconds(30),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 5
      }
    });

    // Update ALB Security Group to allow HTTPS traffic
    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS traffic'
    );

    // HTTP Listener - keep working for now, will redirect to HTTPS after certificate
    const httpListener = alb.addListener('HttpListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: elbv2.ListenerAction.forward([frontendTargetGroup])
    });

    // Add HTTP listener rule to route /api/* to backend
    httpListener.addAction('ApiRoute', {
      priority: 100,
      conditions: [
        elbv2.ListenerCondition.pathPatterns(['/api/*'])
      ],
      action: elbv2.ListenerAction.forward([backendTargetGroup])
    });

    // We'll add HTTPS listener after certificate is created manually
    // This allows the ALB to be created first, then certificate added later

    // Output the ALB DNS name for certificate creation
    new cdk.CfnOutput(this, 'ApplicationURL', {
      value: `http://${alb.loadBalancerDnsName}`,
      description: 'Application URL (HTTP - will redirect to HTTPS when certificate is added)'
    });

    new cdk.CfnOutput(this, 'ApplicationHTTPSURL', {
      value: `https://${alb.loadBalancerDnsName}`,
      description: 'Application URL (HTTPS - available after certificate is added)'
    });

    new cdk.CfnOutput(this, 'CertificateCommand', {
      value: `aws acm request-certificate --domain-name "${alb.loadBalancerDnsName}" --validation-method DNS --region ${this.region}`,
      description: 'Command to create SSL certificate'
    });

    // Security Group for ECS Tasks
    const ecsSecurityGroup = new ec2.SecurityGroup(this, 'EcsSecurityGroup', {
      vpc,
      description: 'Security group for Chat App ECS Tasks',
      allowAllOutbound: true
    });

    // Allow inbound traffic from ALB to frontend container
    ecsSecurityGroup.addIngressRule(
      albSecurityGroup,
      ec2.Port.tcp(3000),
      'Allow ALB to access frontend container'
    );

    // Allow inbound traffic from ALB to backend container
    ecsSecurityGroup.addIngressRule(
      albSecurityGroup,
      ec2.Port.tcp(5001),
      'Allow ALB to access backend container'
    );

    // ECS Service
    const service = new ecs.FargateService(this, 'ChatAppService', {
      cluster,
      taskDefinition,
      serviceName: 'chat-app-service',
      desiredCount: 1,
      assignPublicIp: true,
      healthCheckGracePeriod: cdk.Duration.minutes(5),
      enableExecuteCommand: true, // For debugging
      securityGroups: [ecsSecurityGroup]
    });

    // Attach service to both target groups
    service.attachToApplicationTargetGroup(frontendTargetGroup);
    service.attachToApplicationTargetGroup(backendTargetGroup);

    // Auto Scaling
    const scaling = service.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 3
    });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.minutes(5),
      scaleOutCooldown: cdk.Duration.minutes(5)
    });

    // Outputs
    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: alb.loadBalancerDnsName,
      description: 'DNS name of the load balancer'
    });

    new cdk.CfnOutput(this, 'ClusterName', {
      value: cluster.clusterName,
      description: 'Name of the ECS cluster'
    });

    new cdk.CfnOutput(this, 'ServiceName', {
      value: service.serviceName,
      description: 'Name of the ECS service'
    });

    new cdk.CfnOutput(this, 'HealthCheckURL', {
      value: `http://${alb.loadBalancerDnsName}/api/health`,
      description: 'Health check URL for the application'
    });
  }
}