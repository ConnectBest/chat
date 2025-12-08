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
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';

// Declare process for TypeScript compatibility
declare const process: {
  env: {
    [key: string]: string | undefined;
  };
};

export class ChatAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Image tag parameters - allow dynamic image tags for deployments
    const frontendImageTag = cdk.App.of(this)!.node.tryGetContext('frontendImageTag') || 'latest';
    const backendImageTag = cdk.App.of(this)!.node.tryGetContext('backendImageTag') || 'latest';

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

    // S3 Bucket for file storage (avatars, message attachments)
    const fileStorageBucket = new s3.Bucket(this, 'ChatAppFileStorage', {
      bucketName: 'connectbest-chat-files',
      publicReadAccess: true, // Allow public read access for file sharing
      blockPublicAccess: {
        blockPublicAcls: false,
        ignorePublicAcls: false,
        blockPublicPolicy: false,
        restrictPublicBuckets: false
      },
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST, s3.HttpMethods.DELETE],
          allowedOrigins: ['*'], // In production, restrict to your domain
          allowedHeaders: ['*'],
          exposedHeaders: ['ETag']
        }
      ],
      lifecycleRules: [
        {
          // Clean up multipart uploads after 7 days
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7)
        }
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN // Keep files when stack is deleted
    });

    // ECS Cluster
    const cluster = new ecs.Cluster(this, 'ChatAppCluster', {
      vpc,
      clusterName: 'chat-app-cluster',
      containerInsights: true // Enable Container Insights for monitoring
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

    // Create task role with CloudWatch permissions for metrics collection
    const taskRole = new iam.Role(this, 'ChatAppTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      description: 'Task role for Chat App ECS containers',
    });

    // Add CloudWatch permissions for metrics and ECS permissions for service discovery
    taskRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        // CloudWatch metrics - comprehensive permissions
        'cloudwatch:GetMetricStatistics',
        'cloudwatch:GetMetricData',
        'cloudwatch:ListMetrics',
        'cloudwatch:PutMetricData',
        'cloudwatch:GetMetricWidgetImage',
        // CloudWatch Logs for application logs
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
        'logs:DescribeLogStreams',
        'logs:DescribeLogGroups',
        // ECS permissions for service status and health checks
        'ecs:DescribeServices',
        'ecs:DescribeTasks',
        'ecs:ListTasks',
        'ecs:DescribeClusters',
        'ecs:DescribeTaskDefinition',
        // Application Load Balancer metrics
        'elasticloadbalancing:DescribeLoadBalancers',
        'elasticloadbalancing:DescribeTargetGroups',
        'elasticloadbalancing:DescribeTargetHealth'
      ],
      resources: ['*']
    }));

    // Add S3 permissions for file storage
    taskRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:GetObject',
        's3:PutObject',
        's3:PutObjectAcl',
        's3:DeleteObject',
        's3:ListBucket'
      ],
      resources: [
        fileStorageBucket.bucketArn,
        `${fileStorageBucket.bucketArn}/*`
      ]
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
      executionRole: executionRole,
      taskRole: taskRole
    });

    // SECURITY: Get all sensitive values from environment variables only
    // DO NOT hardcode credentials in source code
    const mongoUri = process.env.MONGODB_URI || cdk.App.of(this)!.node.tryGetContext('MONGODB_URI');
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is required');
    }

    const nextAuthSecret = process.env.NEXTAUTH_SECRET || cdk.App.of(this)!.node.tryGetContext('NEXTAUTH_SECRET');
    if (!nextAuthSecret) {
      throw new Error('NEXTAUTH_SECRET environment variable is required');
    }

    const secretKey = process.env.SECRET_KEY || cdk.App.of(this)!.node.tryGetContext('SECRET_KEY');
    if (!secretKey) {
      throw new Error('SECRET_KEY environment variable is required');
    }

    const jwtSecretKey = process.env.JWT_SECRET_KEY || cdk.App.of(this)!.node.tryGetContext('JWT_SECRET_KEY');
    if (!jwtSecretKey) {
      throw new Error('JWT_SECRET_KEY environment variable is required');
    }

    // Create ECR repositories references
    const frontendRepo = ecr.Repository.fromRepositoryName(this, 'FrontendRepo', 'chat-frontend');
    const backendRepo = ecr.Repository.fromRepositoryName(this, 'BackendRepo', 'chat-backend');

    // Frontend Container (Next.js)
    const frontendContainer = taskDefinition.addContainer('FrontendContainer', {
      image: ecs.ContainerImage.fromEcrRepository(frontendRepo, frontendImageTag),
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

        // Internal container-to-container communication
        BACKEND_URL: 'http://127.0.0.1:5001', // Frontend calls backend via shared network interface

        // MongoDB configuration for NextAuth direct connection
        MONGODB_URI: mongoUri,
        MONGODB_DB_NAME: 'chatapp',

        // Google OAuth for NextAuth frontend
        NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '699045979125-v1tjnfluhmobrod8hogdbktqgi2vpv3t.apps.googleusercontent.com',
        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '699045979125-v1tjnfluhmobrod8hogdbktqgi2vpv3t.apps.googleusercontent.com',
        GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || 'PLACEHOLDER_SECRET',
        GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || 'https://chat.connect-best.com/api/auth/callback/google',

        // NextAuth Configuration for frontend
        NEXTAUTH_URL: 'https://chat.connect-best.com',
        NEXTAUTH_SECRET: nextAuthSecret,
        NEXTAUTH_DEBUG: 'false', // Disable NextAuth debug logging (production ready)

        // JWT Configuration for Flask backend compatibility - CRITICAL
        JWT_SECRET_KEY: jwtSecretKey,
        JWT_EXPIRATION_HOURS: '168'
      }
    });

    // Backend Container (Flask)
    const backendContainer = taskDefinition.addContainer('BackendContainer', {
      image: ecs.ContainerImage.fromEcrRepository(backendRepo, backendImageTag),
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
        LOG_LEVEL: 'INFO', // Production info-level logging (was DEBUG)
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
        GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || 'https://chat.connect-best.com/api/auth/callback/google',

        // Email configuration for verification emails - AWS SES
        SMTP_HOST: process.env.EMAIL_HOST || 'email-smtp.us-west-2.amazonaws.com',
        SMTP_PORT: process.env.EMAIL_PORT || '587',
        SMTP_FROM_EMAIL: process.env.EMAIL_FROM || 'noreply@connect-best.com',
        SMTP_USER: process.env.EMAIL_USER || '',
        SMTP_PASSWORD: process.env.EMAIL_PASSWORD || '',

        // Upload configuration - S3 for production (replaces local storage)
        S3_BUCKET_NAME: fileStorageBucket.bucketName,
        MAX_CONTENT_LENGTH: '52428800',

        // WebSocket URL (exact match from Lightsail)
        NEXT_PUBLIC_WEBSOCKET_URL: 'wss://v68x792yd5.execute-api.us-west-2.amazonaws.com/prod',

        // AWS Configuration for CloudWatch metrics
        AWS_REGION: process.env.AWS_REGION || 'us-west-2',
        ECS_CLUSTER_NAME: process.env.ECS_CLUSTER_NAME || 'chat-app-cluster',
        ECS_SERVICE_NAME: process.env.ECS_SERVICE_NAME || 'chat-app-service'
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

    // S3 Bucket for ALB Access Logs
    const albLogsBucket = new s3.Bucket(this, 'AlbAccessLogsBucket', {
      bucketName: `chat-app-alb-logs-${cdk.Stack.of(this).region}-${cdk.Stack.of(this).account}`,
      lifecycleRules: [
        {
          id: 'DeleteOldLogs',
          expiration: cdk.Duration.days(30), // Keep logs for 30 days
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(1)
        }
      ],
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY // For development - change to RETAIN in production
    });

    // Application Load Balancer
    const alb = new elbv2.ApplicationLoadBalancer(this, 'ChatAppALB', {
      vpc,
      internetFacing: true,
      loadBalancerName: 'chat-app-alb',
      securityGroup: albSecurityGroup
    });

    // Enable ALB Access Logs
    alb.logAccessLogs(albLogsBucket, 'access-logs');

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
    // Priority 10: Route specific NextAuth.js routes to frontend (highest priority)
    httpsListener.addAction('NextAuthRoute', {
      priority: 10,
      conditions: [
        elbv2.ListenerCondition.pathPatterns([
          '/api/auth/signin*',     // NextAuth sign in pages
          '/api/auth/signout',     // NextAuth sign out
          '/api/auth/session',     // NextAuth session check
          '/api/auth/csrf',        // NextAuth CSRF token
          '/api/auth/providers'    // NextAuth available providers
        ])
      ],
      action: elbv2.ListenerAction.forward([frontendTargetGroup])
    });

    // Priority 20: Route NextAuth callback routes to frontend
    httpsListener.addAction('NextAuthCallbackRoute', {
      priority: 20,
      conditions: [
        elbv2.ListenerCondition.pathPatterns([
          '/api/auth/callback/*'   // OAuth callbacks (Google, etc.)
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
      securityGroups: [ecsSecurityGroup]
    });

    // Configure deployment for zero-downtime rolling updates
    const cfnService = service.node.defaultChild as ecs.CfnService;
    cfnService.deploymentConfiguration = {
      minimumHealthyPercent: 100,  // Keep all tasks running during deployment
      maximumPercent: 200          // Allow doubling during deployment for zero-downtime
    };

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

    // === OBSERVABILITY: CLOUDWATCH DASHBOARD ===

    const dashboard = new cloudwatch.Dashboard(this, 'ChatAppDashboard', {
      dashboardName: 'chat-app-observability',
      defaultInterval: cdk.Duration.hours(1)
    });

    // ALB Metrics - HTTP Response Codes and Performance
    const albHttpMetrics = new cloudwatch.GraphWidget({
      title: 'ALB HTTP Response Status Codes',
      width: 12,
      height: 6,
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/ApplicationELB',
          metricName: 'HTTPCode_Target_2XX_Count',
          dimensionsMap: {
            LoadBalancer: alb.loadBalancerFullName
          },
          statistic: 'Sum',
          label: '2xx Success'
        }),
        new cloudwatch.Metric({
          namespace: 'AWS/ApplicationELB',
          metricName: 'HTTPCode_Target_4XX_Count',
          dimensionsMap: {
            LoadBalancer: alb.loadBalancerFullName
          },
          statistic: 'Sum',
          label: '4xx Client Error'
        }),
        new cloudwatch.Metric({
          namespace: 'AWS/ApplicationELB',
          metricName: 'HTTPCode_Target_5XX_Count',
          dimensionsMap: {
            LoadBalancer: alb.loadBalancerFullName
          },
          statistic: 'Sum',
          label: '5xx Server Error'
        })
      ]
    });

    // ALB Performance Metrics
    const albPerformanceMetrics = new cloudwatch.GraphWidget({
      title: 'ALB Performance',
      width: 12,
      height: 6,
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/ApplicationELB',
          metricName: 'RequestCount',
          dimensionsMap: {
            LoadBalancer: alb.loadBalancerFullName
          },
          statistic: 'Sum',
          label: 'Request Count'
        })
      ],
      right: [
        new cloudwatch.Metric({
          namespace: 'AWS/ApplicationELB',
          metricName: 'TargetResponseTime',
          dimensionsMap: {
            LoadBalancer: alb.loadBalancerFullName
          },
          statistic: 'Average',
          label: 'Response Time (avg)'
        })
      ]
    });

    // Target Group Health
    const targetGroupHealth = new cloudwatch.GraphWidget({
      title: 'Target Group Health',
      width: 12,
      height: 6,
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/ApplicationELB',
          metricName: 'HealthyHostCount',
          dimensionsMap: {
            TargetGroup: frontendTargetGroup.targetGroupFullName
          },
          statistic: 'Average',
          label: 'Frontend Healthy Hosts'
        }),
        new cloudwatch.Metric({
          namespace: 'AWS/ApplicationELB',
          metricName: 'HealthyHostCount',
          dimensionsMap: {
            TargetGroup: backendTargetGroup.targetGroupFullName
          },
          statistic: 'Average',
          label: 'Backend Healthy Hosts'
        })
      ]
    });

    // ECS Service Metrics
    const ecsMetrics = new cloudwatch.GraphWidget({
      title: 'ECS Service Performance',
      width: 12,
      height: 6,
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/ECS',
          metricName: 'CPUUtilization',
          dimensionsMap: {
            ServiceName: service.serviceName,
            ClusterName: cluster.clusterName
          },
          statistic: 'Average',
          label: 'CPU Utilization %'
        }),
        new cloudwatch.Metric({
          namespace: 'AWS/ECS',
          metricName: 'MemoryUtilization',
          dimensionsMap: {
            ServiceName: service.serviceName,
            ClusterName: cluster.clusterName
          },
          statistic: 'Average',
          label: 'Memory Utilization %'
        })
      ]
    });

    // Add widgets to dashboard
    dashboard.addWidgets(
      albHttpMetrics,
      albPerformanceMetrics,
      targetGroupHealth,
      ecsMetrics
    );

    // Add second row of widgets for detailed monitoring
    const albDetailedMetrics = new cloudwatch.GraphWidget({
      title: 'ALB Detailed Performance',
      width: 8,
      height: 6,
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/ApplicationELB',
          metricName: 'NewConnectionCount',
          dimensionsMap: {
            LoadBalancer: alb.loadBalancerFullName
          },
          statistic: 'Sum',
          label: 'New Connections'
        })
      ],
      right: [
        new cloudwatch.Metric({
          namespace: 'AWS/ApplicationELB',
          metricName: 'ActiveConnectionCount',
          dimensionsMap: {
            LoadBalancer: alb.loadBalancerFullName
          },
          statistic: 'Average',
          label: 'Active Connections'
        })
      ]
    });

    // Target Response Time by Target Group
    const targetResponseTime = new cloudwatch.GraphWidget({
      title: 'Target Response Time by Service',
      width: 8,
      height: 6,
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/ApplicationELB',
          metricName: 'TargetResponseTime',
          dimensionsMap: {
            LoadBalancer: alb.loadBalancerFullName,
            TargetGroup: frontendTargetGroup.targetGroupFullName
          },
          statistic: 'Average',
          label: 'Frontend Response Time'
        }),
        new cloudwatch.Metric({
          namespace: 'AWS/ApplicationELB',
          metricName: 'TargetResponseTime',
          dimensionsMap: {
            LoadBalancer: alb.loadBalancerFullName,
            TargetGroup: backendTargetGroup.targetGroupFullName
          },
          statistic: 'Average',
          label: 'Backend Response Time'
        })
      ]
    });

    // ECS Task Count and Health
    const ecsTaskMetrics = new cloudwatch.GraphWidget({
      title: 'ECS Task Health',
      width: 8,
      height: 6,
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/ECS',
          metricName: 'RunningTaskCount',
          dimensionsMap: {
            ServiceName: service.serviceName,
            ClusterName: cluster.clusterName
          },
          statistic: 'Average',
          label: 'Running Tasks'
        })
      ]
    });

    // Add the second row
    dashboard.addWidgets(
      albDetailedMetrics,
      targetResponseTime,
      ecsTaskMetrics
    );

    // Create CloudWatch Alarms for critical metrics
    const highErrorRateAlarm = new cloudwatch.Alarm(this, 'HighErrorRateAlarm', {
      alarmName: 'chat-app-high-error-rate',
      alarmDescription: 'High 5xx error rate detected',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApplicationELB',
        metricName: 'HTTPCode_Target_5XX_Count',
        dimensionsMap: {
          LoadBalancer: alb.loadBalancerFullName
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5)
      }),
      threshold: 10, // More than 10 errors in 5 minutes
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD
    });

    const highLatencyAlarm = new cloudwatch.Alarm(this, 'HighLatencyAlarm', {
      alarmName: 'chat-app-high-latency',
      alarmDescription: 'High response latency detected',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApplicationELB',
        metricName: 'TargetResponseTime',
        dimensionsMap: {
          LoadBalancer: alb.loadBalancerFullName
        },
        statistic: 'Average',
        period: cdk.Duration.minutes(5)
      }),
      threshold: 2, // 2 seconds
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD
    });

    const lowHealthyHostsAlarm = new cloudwatch.Alarm(this, 'LowHealthyHostsAlarm', {
      alarmName: 'chat-app-low-healthy-hosts',
      alarmDescription: 'Low number of healthy hosts',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApplicationELB',
        metricName: 'HealthyHostCount',
        dimensionsMap: {
          LoadBalancer: alb.loadBalancerFullName
        },
        statistic: 'Average',
        period: cdk.Duration.minutes(1)
      }),
      threshold: 1, // Less than 1 healthy host
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD
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

    // Observability Resources
    new cdk.CfnOutput(this, 'CloudWatchDashboard', {
      value: `https://${cdk.Stack.of(this).region}.console.aws.amazon.com/cloudwatch/home?region=${cdk.Stack.of(this).region}#dashboards:name=${dashboard.dashboardName}`,
      description: '📊 CloudWatch Dashboard for HTTP metrics and performance'
    });

    new cdk.CfnOutput(this, 'ALBAccessLogsBucket', {
      value: albLogsBucket.bucketName,
      description: '📝 S3 bucket containing ALB access logs with HTTP status codes'
    });

    new cdk.CfnOutput(this, 'CloudWatchAlarms', {
      value: `High Error Rate: ${highErrorRateAlarm.alarmName}, High Latency: ${highLatencyAlarm.alarmName}, Low Healthy Hosts: ${lowHealthyHostsAlarm.alarmName}`,
      description: '🚨 CloudWatch alarms for proactive monitoring'
    });

    // Email Configuration
    new cdk.CfnOutput(this, 'SesSmtpEndpoint', {
      value: `email-smtp.${cdk.Stack.of(this).region}.amazonaws.com`,
      description: '📧 SES SMTP server'
    });

    new cdk.CfnOutput(this, 'SesSmtpCredentials', {
      value: `EMAIL_USER="${sesAccessKey.accessKeyId}" EMAIL_PASSWORD="[Get from AWS Console]"`,
      description: '🔐 SES credentials for .env (⚠️ Password not shown for security)'
    });

    // Image tags being deployed
    new cdk.CfnOutput(this, 'DeployedImageTags', {
      value: `Frontend: ${frontendImageTag}, Backend: ${backendImageTag}`,
      description: '🏷️ Container image tags deployed in this stack'
    });

    // S3 File Storage Information
    new cdk.CfnOutput(this, 'FileStorageBucket', {
      value: fileStorageBucket.bucketName,
      description: '📁 S3 bucket for file attachments and avatars'
    });

    new cdk.CfnOutput(this, 'FileStorageUrl', {
      value: `https://${fileStorageBucket.bucketName}.s3.${cdk.Stack.of(this).region}.amazonaws.com/`,
      description: '🔗 S3 bucket URL for file access'
    });
  }
}