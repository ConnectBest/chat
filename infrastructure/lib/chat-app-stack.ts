import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as certificateManager from 'aws-cdk-lib/aws-certificatemanager';
import * as ses from 'aws-cdk-lib/aws-ses';
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

    // SES Configuration for Email Verification
    const sesIdentity = new ses.EmailIdentity(this, 'ChatAppEmailIdentity', {
      identity: ses.Identity.email('noreply@connect-best.com'),
      mailFromDomain: 'mail.connect-best.com' // Optional: custom MAIL FROM domain
    });

    // SES Configuration Set for tracking
    const sesConfigurationSet = new ses.ConfigurationSet(this, 'ChatAppConfigurationSet', {
      configurationSetName: 'chat-app-emails'
    });

    // ECS Cluster
    const cluster = new ecs.Cluster(this, 'ChatAppCluster', {
      vpc,
      clusterName: 'chat-app-cluster',
      containerInsightsV2: true // Updated from deprecated containerInsights
    });

    // CloudWatch Log Group
    const logGroup = new logs.LogGroup(this, 'ChatAppLogGroup', {
      logGroupName: '/ecs/chat-app',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // Create explicit execution role with ECR permissions
    const executionRole = new iam.Role(this, 'ChatAppTaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      description: 'Execution role for Chat App ECS tasks',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')
      ]
    });

    // Add ECR permissions to execution role
    executionRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ecr:GetAuthorizationToken',
        'ecr:BatchCheckLayerAvailability',
        'ecr:GetDownloadUrlForLayer',
        'ecr:BatchGetImage'
      ],
      resources: ['*']
    }));

    // Create IAM User for SES SMTP credentials
    const sesSmtpUser = new iam.User(this, 'SesSmtpUser', {
      userName: 'connectbest-ses-smtp-user'
    });

    // Add SES send permissions to the SMTP user
    sesSmtpUser.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ses:SendEmail',
        'ses:SendRawEmail'
      ],
      resources: ['*']
    }));

    // Create access key for SMTP user (you'll need to retrieve these from AWS Console)
    const sesAccessKey = new iam.AccessKey(this, 'SesSmtpAccessKey', {
      user: sesSmtpUser
    });

    // Task Definition for multi-container setup
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'ChatAppTaskDef', {
      memoryLimitMiB: 2048,  // Increased for two containers
      cpu: 1024,             // Increased for two containers
      family: 'chat-app',
      executionRole: executionRole
    });

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

    // Create ECR repositories references
    const frontendRepo = ecr.Repository.fromRepositoryName(this, 'FrontendRepo', 'chat-frontend');
    const backendRepo = ecr.Repository.fromRepositoryName(this, 'BackendRepo', 'chat-backend');

    // Frontend Container (Next.js)
    const frontendContainer = taskDefinition.addContainer('FrontendContainer', {
      image: ecs.ContainerImage.fromEcrRepository(frontendRepo, 'latest'),
      memoryLimitMiB: 512,
      cpu: 256,
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'chat-frontend',
        logGroup: logGroup
      }),
      environment: {
        // Basic Node.js settings
        NODE_ENV: 'production',
        PORT: '3000',
        HOSTNAME: '0.0.0.0',

        // Frontend API Configuration - CRITICAL for connecting to backend
        NEXT_PUBLIC_API_URL: 'https://chat.connect-best.com/api',
        NEXT_PUBLIC_WEBSOCKET_URL: 'wss://v68x792yd5.execute-api.us-west-2.amazonaws.com/prod',

        // Google OAuth for NextAuth frontend
        NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '699045979125-v1tjnfluhmobrod8hogdbktqgi2vpv3t.apps.googleusercontent.com',

        // NextAuth Configuration for frontend
        NEXTAUTH_URL: 'https://chat.connect-best.com',
        NEXTAUTH_SECRET: nextAuthSecret
      }
    });

    // Backend Container (Flask)
    const backendContainer = taskDefinition.addContainer('BackendContainer', {
      image: ecs.ContainerImage.fromEcrRepository(backendRepo, 'latest'),
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

        // CORS and URLs - using custom domain with HTTPS
        CORS_ORIGINS: 'https://connect-best.com,https://chat.connect-best.com',
        FRONTEND_URL: 'https://chat.connect-best.com',
        NEXTAUTH_URL: 'https://chat.connect-best.com',
        NEXTAUTH_SECRET: nextAuthSecret,

        // Google OAuth - using environment variables for security
        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '699045979125-v1tjnfluhmobrod8hogdbktqgi2vpv3t.apps.googleusercontent.com',
        GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || 'PLACEHOLDER_SECRET',
        GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || 'https://connect-best.com/api/auth/google/callback',

        // Email configuration for verification emails - AWS SES
        SMTP_HOST: process.env.EMAIL_HOST || 'email-smtp.us-west-2.amazonaws.com',
        SMTP_PORT: process.env.EMAIL_PORT || '587',
        SMTP_FROM_EMAIL: process.env.EMAIL_FROM || 'noreply@connect-best.com',
        SMTP_USER: process.env.EMAIL_USER || '',
        SMTP_PASSWORD: process.env.EMAIL_PASSWORD || '',

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

    // Import existing SSL certificate for chat.connect-best.com
    const certificate = certificateManager.Certificate.fromCertificateArn(
      this,
      'ChatSSLCertificate',
      'arn:aws:acm:us-west-2:839776274679:certificate/6f595dff-f4fb-4ee7-8d60-9e78bc7dbfb7'
    );

    // HTTP Listener - redirect to HTTPS
    const httpListener = alb.addListener('HttpListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: elbv2.ListenerAction.redirect({
        protocol: 'HTTPS',
        port: '443',
        permanent: true
      })
    });

    // HTTPS Listener with SSL certificate
    const httpsListener = alb.addListener('HttpsListener', {
      port: 443,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      certificates: [certificate],
      defaultAction: elbv2.ListenerAction.forward([frontendTargetGroup])
    });

    // Add HTTPS listener rules with correct priorities
    // Priority 10: Route NextAuth routes to frontend (highest priority)
    httpsListener.addAction('NextAuthRoute', {
      priority: 10,
      conditions: [
        elbv2.ListenerCondition.pathPatterns([
          '/api/auth/*',           // All NextAuth routes
          '/api/auth/signin*',     // Sign in page
          '/api/auth/signout*',    // Sign out
          '/api/auth/session*',    // Session check
          '/api/auth/csrf*',       // CSRF token
          '/api/auth/providers*',  // Available providers
          '/api/auth/callback/*'   // OAuth callbacks
        ])
      ],
      action: elbv2.ListenerAction.forward([frontendTargetGroup])
    });

    // Priority 100: Route all other /api/* to backend (Flask)
    httpsListener.addAction('ApiRoute', {
      priority: 100,
      conditions: [
        elbv2.ListenerCondition.pathPatterns(['/api/*'])
      ],
      action: elbv2.ListenerAction.forward([backendTargetGroup])
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
      securityGroups: [ecsSecurityGroup],
      // Deployment configuration to avoid warning and ensure proper rolling updates
      deploymentConfiguration: {
        minimumHealthyPercent: 100,  // Keep all tasks running during deployment
        maximumPercent: 200          // Allow doubling during deployment for zero-downtime
      }
    });

    // Attach service containers to their respective target groups
    frontendTargetGroup.addTarget(service.loadBalancerTarget({
      containerName: 'FrontendContainer',
      containerPort: 3000
    }));

    backendTargetGroup.addTarget(service.loadBalancerTarget({
      containerName: 'BackendContainer',
      containerPort: 5001
    }));

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

    // === DEPLOYMENT OUTPUTS ===

    // Application URLs
    new cdk.CfnOutput(this, 'ApplicationURL', {
      value: 'https://chat.connect-best.com',
      description: '🌐 Main application URL'
    });

    new cdk.CfnOutput(this, 'HealthCheckURL', {
      value: 'https://chat.connect-best.com/api/health',
      description: '🏥 Application health check endpoint'
    });

    // Infrastructure Details
    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: alb.loadBalancerDnsName,
      description: '⚖️ Load balancer DNS (for CNAME setup)'
    });

    new cdk.CfnOutput(this, 'EcsCluster', {
      value: cluster.clusterName,
      description: '🚢 ECS cluster name'
    });

    new cdk.CfnOutput(this, 'EcsService', {
      value: service.serviceName,
      description: '⚙️ ECS service name'
    });

    // Email Configuration
    new cdk.CfnOutput(this, 'SesSmtpEndpoint', {
      value: `email-smtp.${this.region}.amazonaws.com`,
      description: '📧 SES SMTP server'
    });

    new cdk.CfnOutput(this, 'SesSmtpCredentials', {
      value: `EMAIL_USER="${sesAccessKey.accessKeyId}" EMAIL_PASSWORD="[Get from AWS Console]"`,
      description: '🔐 SES credentials for .env (⚠️ Password not shown for security)'
    });
  }
}