"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatAppStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const ecs = __importStar(require("aws-cdk-lib/aws-ecs"));
const ecr = __importStar(require("aws-cdk-lib/aws-ecr"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const elbv2 = __importStar(require("aws-cdk-lib/aws-elasticloadbalancingv2"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const certificateManager = __importStar(require("aws-cdk-lib/aws-certificatemanager"));
const ses = __importStar(require("aws-cdk-lib/aws-ses"));
class ChatAppStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Image tag parameters - allow dynamic image tags for deployments
        const frontendImageTag = this.node.tryGetContext('frontendImageTag') || 'latest';
        const backendImageTag = this.node.tryGetContext('backendImageTag') || 'latest';
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
                // CloudWatch metrics
                'cloudwatch:GetMetricStatistics',
                'cloudwatch:ListMetrics',
                'cloudwatch:GetMetricData',
                // ECS permissions for service status
                'ecs:DescribeServices',
                'ecs:DescribeTasks',
                'ecs:ListTasks',
                'ecs:DescribeClusters'
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
            memoryLimitMiB: 2048, // Increased for two containers
            cpu: 1024, // Increased for two containers
            family: 'chat-app',
            executionRole: executionRole,
            taskRole: taskRole
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
                // Google OAuth for NextAuth frontend
                NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '699045979125-v1tjnfluhmobrod8hogdbktqgi2vpv3t.apps.googleusercontent.com',
                GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '699045979125-v1tjnfluhmobrod8hogdbktqgi2vpv3t.apps.googleusercontent.com',
                GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || 'PLACEHOLDER_SECRET',
                // NextAuth Configuration for frontend
                NEXTAUTH_URL: 'https://chat.connect-best.com',
                NEXTAUTH_SECRET: nextAuthSecret
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
                // Upload configuration (exact match from Lightsail)
                MAX_CONTENT_LENGTH: '52428800',
                UPLOAD_FOLDER: 'static/uploads',
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
        albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow HTTP traffic from internet');
        // Allow inbound HTTPS traffic to ALB (for future use)
        albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'Allow HTTPS traffic from internet');
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
        albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'Allow HTTPS traffic');
        // Import existing SSL certificate for chat.connect-best.com
        const certificate = certificateManager.Certificate.fromCertificateArn(this, 'ChatSSLCertificate', 'arn:aws:acm:us-west-2:839776274679:certificate/6f595dff-f4fb-4ee7-8d60-9e78bc7dbfb7');
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
                    '/api/auth/signin*', // NextAuth sign in pages
                    '/api/auth/signout', // NextAuth sign out
                    '/api/auth/session', // NextAuth session check
                    '/api/auth/csrf', // NextAuth CSRF token
                    '/api/auth/providers' // NextAuth available providers
                ])
            ],
            action: elbv2.ListenerAction.forward([frontendTargetGroup])
        });
        // Priority 20: Route NextAuth callback routes to frontend
        httpsListener.addAction('NextAuthCallbackRoute', {
            priority: 20,
            conditions: [
                elbv2.ListenerCondition.pathPatterns([
                    '/api/auth/callback/*' // OAuth callbacks (Google, etc.)
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
        ecsSecurityGroup.addIngressRule(albSecurityGroup, ec2.Port.tcp(3000), 'Allow ALB to access frontend container');
        // Allow inbound traffic from ALB to backend container
        ecsSecurityGroup.addIngressRule(albSecurityGroup, ec2.Port.tcp(5001), 'Allow ALB to access backend container');
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
        const cfnService = service.node.defaultChild;
        cfnService.deploymentConfiguration = {
            minimumHealthyPercent: 100, // Keep all tasks running during deployment
            maximumPercent: 200 // Allow doubling during deployment for zero-downtime
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
        // Image tags being deployed
        new cdk.CfnOutput(this, 'DeployedImageTags', {
            value: `Frontend: ${frontendImageTag}, Backend: ${backendImageTag}`,
            description: '🏷️ Container image tags deployed in this stack'
        });
    }
}
exports.ChatAppStack = ChatAppStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdC1hcHAtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJjaGF0LWFwcC1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMseURBQTJDO0FBQzNDLHlEQUEyQztBQUMzQyx5REFBMkM7QUFDM0MseURBQTJDO0FBQzNDLDhFQUFnRTtBQUNoRSwyREFBNkM7QUFHN0MsdUZBQXlFO0FBQ3pFLHlEQUEyQztBQUczQyxNQUFhLFlBQWEsU0FBUSxHQUFHLENBQUMsS0FBSztJQUN6QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXNCO1FBQzlELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLGtFQUFrRTtRQUNsRSxNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGtCQUFrQixDQUFDLElBQUksUUFBUSxDQUFDO1FBQ2pGLE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGlCQUFpQixDQUFDLElBQUksUUFBUSxDQUFDO1FBRS9FLG1EQUFtRDtRQUNuRCxNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRTtZQUMxQyxNQUFNLEVBQUUsQ0FBQztZQUNULGtCQUFrQixFQUFFLElBQUk7WUFDeEIsZ0JBQWdCLEVBQUUsSUFBSTtZQUN0QixtQkFBbUIsRUFBRTtnQkFDbkI7b0JBQ0UsUUFBUSxFQUFFLEVBQUU7b0JBQ1osSUFBSSxFQUFFLGNBQWM7b0JBQ3BCLFVBQVUsRUFBRSxHQUFHLENBQUMsVUFBVSxDQUFDLE1BQU07aUJBQ2xDO2dCQUNEO29CQUNFLFFBQVEsRUFBRSxFQUFFO29CQUNaLElBQUksRUFBRSxlQUFlO29CQUNyQixVQUFVLEVBQUUsR0FBRyxDQUFDLFVBQVUs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WSxFQUFFO1lBQ3BDLEtBQUssRUFBRSxPQUFPLENBQUMsV0FBVztZQUMxQixXQUFXLEVBQUUscUJBQXFCO1NBQ25DLENBQUMsQ0FBQztRQUVILHNCQUFzQjtRQUN0QixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGlCQUFpQixFQUFFO1lBQ3pDLEtBQUssRUFBRSxjQUFjLElBQUksQ0FBQyxNQUFNLGdCQUFnQjtZQUNoRCxXQUFXLEVBQUUsb0JBQW9CO1NBQ2xDLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsb0JBQW9CLEVBQUU7WUFDNUMsS0FBSyxFQUFFLGVBQWUsWUFBWSxDQUFDLFdBQVcsMkNBQTJDO1lBQ3pGLFdBQVcsRUFBRSxrRUFBa0U7U0FDaEYsQ0FBQyxDQUFDO1FBRUgsNEJBQTRCO1FBQzVCLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsbUJBQW1CLEVBQUU7WUFDM0MsS0FBSyxFQUFFLGFBQWEsZ0JBQWdCLGNBQWMsZUFBZSxFQUFFO1lBQ25FLFdBQVcsRUFBRSxpREFBaUQ7U0FDL0QsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBN2VELG9DQTZlQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBlYzIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjMic7XG5pbXBvcnQgKiBhcyBlY3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjcyc7XG5pbXBvcnQgKiBhcyBlY3IgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjcic7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBlbGJ2MiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWxhc3RpY2xvYWRiYWxhbmNpbmd2Mic7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcbmltcG9ydCAqIGFzIHJvdXRlNTMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXJvdXRlNTMnO1xuaW1wb3J0ICogYXMgcm91dGU1M1RhcmdldHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXJvdXRlNTMtdGFyZ2V0cyc7XG5pbXBvcnQgKiBhcyBjZXJ0aWZpY2F0ZU1hbmFnZXIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNlcnRpZmljYXRlbWFuYWdlcic7XG5pbXBvcnQgKiBhcyBzZXMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNlcyc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGNsYXNzIENoYXRBcHBTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIEltYWdlIHRhZyBwYXJhbWV0ZXJzIC0gYWxsb3cgZHluYW1pYyBpbWFnZSB0YWdzIGZvciBkZXBsb3ltZW50c1xuICAgIGNvbnN0IGZyb250ZW5kSW1hZ2VUYWcgPSB0aGlzLm5vZGUudHJ5R2V0Q29udGV4dCgnZnJvbnRlbmRJbWFnZVRhZycpIHx8ICdsYXRlc3QnO1xuICAgIGNvbnN0IGJhY2tlbmRJbWFnZVRhZyA9IHRoaXMubm9kZS50cnlHZXRDb250ZXh0KCdiYWNrZW5kSW1hZ2VUYWcnKSB8fCAnbGF0ZXN0JztcblxuICAgIC8vIFZQQyB3aXRoIHB1YmxpYyBhbmQgcHJpdmF0ZSBzdWJuZXRzIGFjcm9zcyAyIEFac1xuICAgIGNvbnN0IHZwYyA9IG5ldyBlYzIuVnBjKHRoaXMsICdDaGF0QXBwVnBjJywge1xuICAgICAgbWF4QXpzOiAyLFxuICAgICAgZW5hYmxlRG5zSG9zdG5hbWVzOiB0cnVlLFxuICAgICAgZW5hYmxlRG5zU3VwcG9ydDogdHJ1ZSxcbiAgICAgIHN1Ym5ldENvbmZpZ3VyYXRpb246IFtcbiAgICAgICAge1xuICAgICAgICAgIGNpZHJNYXNrOiAyNCxcbiAgICAgICAgICBuYW1lOiAnUHVibGljU3VibmV0JyxcbiAgICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QVUJMSUMsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBjaWRyTWFzazogMjQsXG4gICAgICAgICAgbmFtZTogJ1ByaXZhdGVTdWJuZXQnLFxuICAgICAgICAgIHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MsXG4gICAgICAgIH1cbiAgICAgIF1cbiAgICB9KTtcblxuICAgIC8vIFNFUyBDb25maWd1cmF0aW9uIGZvciBFbWFpbCBWZXJpZmljYXRpb25cbiAgICBjb25zdCBzZXNJZGVudGl0eSA9IG5ldyBzZXMuRW1haWxJZGVudGl0eSh0aGlzLCAnQ2hhdEFwcEVtYWlsSWRlbnRpdHknLCB7XG4gICAgICBpZGVudGl0eTogc2VzLklkZW50aXR5LmVtYWlsKCdub3JlcGx5QGNvbm5lY3QtYmVzdC5jb20nKSxcbiAgICAgIG1haWxGcm9tRG9tYWluOiAnbWFpbC5jb25uZWN0LWJlc3QuY29tJyAvLyBPcHRpb25hbDogY3VzdG9tIE1BSUwgRlJPTSBkb21haW5cbiAgICB9KTtcblxuICAgIC8vIFNFUyBDb25maWd1cmF0aW9uIFNldCBmb3IgdHJhY2tpbmdcbiAgICBjb25zdCBzZXNDb25maWd1cmF0aW9uU2V0ID0gbmV3IHNlcy5Db25maWd1cmF0aW9uU2V0KHRoaXMsICdDaGF0QXBwQ29uZmlndXJhdGlvblNldCcsIHtcbiAgICAgIGNvbmZpZ3VyYXRpb25TZXROYW1lOiAnY2hhdC1hcHAtZW1haWxzJ1xuICAgIH0pO1xuXG4gICAgLy8gRUNTIENsdXN0ZXJcbiAgICBjb25zdCBjbHVzdGVyID0gbmV3IGVjcy5DbHVzdGVyKHRoaXMsICdDaGF0QXBwQ2x1c3RlcicsIHtcbiAgICAgIHZwYyxcbiAgICAgIGNsdXN0ZXJOYW1lOiAnY2hhdC1hcHAtY2x1c3RlcicsXG4gICAgICBjb250YWluZXJJbnNpZ2h0czogdHJ1ZSAvLyBFbmFibGUgQ29udGFpbmVyIEluc2lnaHRzIGZvciBtb25pdG9yaW5nXG4gICAgfSk7XG5cbiAgICAvLyBDbG91ZFdhdGNoIExvZyBHcm91cFxuICAgIGNvbnN0IGxvZ0dyb3VwID0gbmV3IGxvZ3MuTG9nR3JvdXAodGhpcywgJ0NoYXRBcHBMb2dHcm91cCcsIHtcbiAgICAgIGxvZ0dyb3VwTmFtZTogJy9lY3MvY2hhdC1hcHAnLFxuICAgICAgcmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUssXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgZXhwbGljaXQgZXhlY3V0aW9uIHJvbGUgd2l0aCBFQ1IgcGVybWlzc2lvbnNcbiAgICBjb25zdCBleGVjdXRpb25Sb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdDaGF0QXBwVGFza0V4ZWN1dGlvblJvbGUnLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnZWNzLXRhc2tzLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRXhlY3V0aW9uIHJvbGUgZm9yIENoYXQgQXBwIEVDUyB0YXNrcycsXG4gICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdzZXJ2aWNlLXJvbGUvQW1hem9uRUNTVGFza0V4ZWN1dGlvblJvbGVQb2xpY3knKVxuICAgICAgXVxuICAgIH0pO1xuXG4gICAgLy8gQWRkIEVDUiBwZXJtaXNzaW9ucyB0byBleGVjdXRpb24gcm9sZVxuICAgIGV4ZWN1dGlvblJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnZWNyOkdldEF1dGhvcml6YXRpb25Ub2tlbicsXG4gICAgICAgICdlY3I6QmF0Y2hDaGVja0xheWVyQXZhaWxhYmlsaXR5JyxcbiAgICAgICAgJ2VjcjpHZXREb3dubG9hZFVybEZvckxheWVyJyxcbiAgICAgICAgJ2VjcjpCYXRjaEdldEltYWdlJ1xuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogWycqJ11cbiAgICB9KSk7XG5cbiAgICAvLyBDcmVhdGUgdGFzayByb2xlIHdpdGggQ2xvdWRXYXRjaCBwZXJtaXNzaW9ucyBmb3IgbWV0cmljcyBjb2xsZWN0aW9uXG4gICAgY29uc3QgdGFza1JvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0NoYXRBcHBUYXNrUm9sZScsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdlY3MtdGFza3MuYW1hem9uYXdzLmNvbScpLFxuICAgICAgZGVzY3JpcHRpb246ICdUYXNrIHJvbGUgZm9yIENoYXQgQXBwIEVDUyBjb250YWluZXJzJyxcbiAgICB9KTtcblxuICAgIC8vIEFkZCBDbG91ZFdhdGNoIHBlcm1pc3Npb25zIGZvciBtZXRyaWNzIGFuZCBFQ1MgcGVybWlzc2lvbnMgZm9yIHNlcnZpY2UgZGlzY292ZXJ5XG4gICAgdGFza1JvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAvLyBDbG91ZFdhdGNoIG1ldHJpY3NcbiAgICAgICAgJ2Nsb3Vkd2F0Y2g6R2V0TWV0cmljU3RhdGlzdGljcycsXG4gICAgICAgICdjbG91ZHdhdGNoOkxpc3RNZXRyaWNzJyxcbiAgICAgICAgJ2Nsb3Vkd2F0Y2g6R2V0TWV0cmljRGF0YScsXG4gICAgICAgIC8vIEVDUyBwZXJtaXNzaW9ucyBmb3Igc2VydmljZSBzdGF0dXNcbiAgICAgICAgJ2VjczpEZXNjcmliZVNlcnZpY2VzJyxcbiAgICAgICAgJ2VjczpEZXNjcmliZVRhc2tzJyxcbiAgICAgICAgJ2VjczpMaXN0VGFza3MnLFxuICAgICAgICAnZWNzOkRlc2NyaWJlQ2x1c3RlcnMnXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbJyonXVxuICAgIH0pKTtcblxuICAgIC8vIENyZWF0ZSBJQU0gVXNlciBmb3IgU0VTIFNNVFAgY3JlZGVudGlhbHNcbiAgICBjb25zdCBzZXNTbXRwVXNlciA9IG5ldyBpYW0uVXNlcih0aGlzLCAnU2VzU210cFVzZXInLCB7XG4gICAgICB1c2VyTmFtZTogJ2Nvbm5lY3RiZXN0LXNlcy1zbXRwLXVzZXInXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgU0VTIHNlbmQgcGVybWlzc2lvbnMgdG8gdGhlIFNNVFAgdXNlclxuICAgIHNlc1NtdHBVc2VyLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ3NlczpTZW5kRW1haWwnLFxuICAgICAgICAnc2VzOlNlbmRSYXdFbWFpbCdcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFsnKiddXG4gICAgfSkpO1xuXG4gICAgLy8gQ3JlYXRlIGFjY2VzcyBrZXkgZm9yIFNNVFAgdXNlciAoeW91J2xsIG5lZWQgdG8gcmV0cmlldmUgdGhlc2UgZnJvbSBBV1MgQ29uc29sZSlcbiAgICBjb25zdCBzZXNBY2Nlc3NLZXkgPSBuZXcgaWFtLkFjY2Vzc0tleSh0aGlzLCAnU2VzU210cEFjY2Vzc0tleScsIHtcbiAgICAgIHVzZXI6IHNlc1NtdHBVc2VyXG4gICAgfSk7XG5cbiAgICAvLyBUYXNrIERlZmluaXRpb24gZm9yIG11bHRpLWNvbnRhaW5lciBzZXR1cFxuICAgIGNvbnN0IHRhc2tEZWZpbml0aW9uID0gbmV3IGVjcy5GYXJnYXRlVGFza0RlZmluaXRpb24odGhpcywgJ0NoYXRBcHBUYXNrRGVmJywge1xuICAgICAgbWVtb3J5TGltaXRNaUI6IDIwNDgsICAvLyBJbmNyZWFzZWQgZm9yIHR3byBjb250YWluZXJzXG4gICAgICBjcHU6IDEwMjQsICAgICAgICAgICAgIC8vIEluY3JlYXNlZCBmb3IgdHdvIGNvbnRhaW5lcnNcbiAgICAgIGZhbWlseTogJ2NoYXQtYXBwJyxcbiAgICAgIGV4ZWN1dGlvblJvbGU6IGV4ZWN1dGlvblJvbGUsXG4gICAgICB0YXNrUm9sZTogdGFza1JvbGVcbiAgICB9KTtcblxuICAgIC8vIFNFQ1VSSVRZOiBHZXQgYWxsIHNlbnNpdGl2ZSB2YWx1ZXMgZnJvbSBlbnZpcm9ubWVudCB2YXJpYWJsZXMgb25seVxuICAgIC8vIERPIE5PVCBoYXJkY29kZSBjcmVkZW50aWFscyBpbiBzb3VyY2UgY29kZVxuICAgIGNvbnN0IG1vbmdvVXJpID0gcHJvY2Vzcy5lbnYuTU9OR09EQl9VUkkgfHwgdGhpcy5ub2RlLnRyeUdldENvbnRleHQoJ01PTkdPREJfVVJJJyk7XG4gICAgaWYgKCFtb25nb1VyaSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdNT05HT0RCX1VSSSBlbnZpcm9ubWVudCB2YXJpYWJsZSBpcyByZXF1aXJlZCcpO1xuICAgIH1cblxuICAgIGNvbnN0IG5leHRBdXRoU2VjcmV0ID0gcHJvY2Vzcy5lbnYuTkVYVEFVVEhfU0VDUkVUIHx8IHRoaXMubm9kZS50cnlHZXRDb250ZXh0KCdORVhUQVVUSF9TRUNSRVQnKTtcbiAgICBpZiAoIW5leHRBdXRoU2VjcmV0KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ05FWFRBVVRIX1NFQ1JFVCBlbnZpcm9ubWVudCB2YXJpYWJsZSBpcyByZXF1aXJlZCcpO1xuICAgIH1cblxuICAgIGNvbnN0IHNlY3JldEtleSA9IHByb2Nlc3MuZW52LlNFQ1JFVF9LRVkgfHwgdGhpcy5ub2RlLnRyeUdldENvbnRleHQoJ1NFQ1JFVF9LRVknKTtcbiAgICBpZiAoIXNlY3JldEtleSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdTRUNSRVRfS0VZIGVudmlyb25tZW50IHZhcmlhYmxlIGlzIHJlcXVpcmVkJyk7XG4gICAgfVxuXG4gICAgY29uc3Qgand0U2VjcmV0S2V5ID0gcHJvY2Vzcy5lbnYuSldUX1NFQ1JFVF9LRVkgfHwgdGhpcy5ub2RlLnRyeUdldENvbnRleHQoJ0pXVF9TRUNSRVRfS0VZJyk7XG4gICAgaWYgKCFqd3RTZWNyZXRLZXkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSldUX1NFQ1JFVF9LRVkgZW52aXJvbm1lbnQgdmFyaWFibGUgaXMgcmVxdWlyZWQnKTtcbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgRUNSIHJlcG9zaXRvcmllcyByZWZlcmVuY2VzXG4gICAgY29uc3QgZnJvbnRlbmRSZXBvID0gZWNyLlJlcG9zaXRvcnkuZnJvbVJlcG9zaXRvcnlOYW1lKHRoaXMsICdGcm9udGVuZFJlcG8nLCAnY2hhdC1mcm9udGVuZCcpO1xuICAgIGNvbnN0IGJhY2tlbmRSZXBvID0gZWNyLlJlcG9zaXRvcnkuZnJvbVJlcG9zaXRvcnlOYW1lKHRoaXMsICdCYWNrZW5kUmVwbycsICdjaGF0LWJhY2tlbmQnKTtcblxuICAgIC8vIEZyb250ZW5kIENvbnRhaW5lciAoTmV4dC5qcylcbiAgICBjb25zdCBmcm9udGVuZENvbnRhaW5lciA9IHRhc2tEZWZpbml0aW9uLmFkZENvbnRhaW5lcignRnJvbnRlbmRDb250YWluZXInLCB7XG4gICAgICBpbWFnZTogZWNzLkNvbnRhaW5lckltYWdlLmZyb21FY3JSZXBvc2l0b3J5KGZyb250ZW5kUmVwbywgZnJvbnRlbmRJbWFnZVRhZyksXG4gICAgICBtZW1vcnlMaW1pdE1pQjogNTEyLFxuICAgICAgY3B1OiAyNTYsXG4gICAgICBsb2dnaW5nOiBlY3MuTG9nRHJpdmVycy5hd3NMb2dzKHtcbiAgICAgICAgc3RyZWFtUHJlZml4OiAnY2hhdC1mcm9udGVuZCcsXG4gICAgICAgIGxvZ0dyb3VwOiBsb2dHcm91cFxuICAgICAgfSksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAvLyBCYXNpYyBOb2RlLmpzIHNldHRpbmdzXG4gICAgICAgIE5PREVfRU5WOiAncHJvZHVjdGlvbicsXG4gICAgICAgIFBPUlQ6ICczMDAwJyxcbiAgICAgICAgSE9TVE5BTUU6ICcwLjAuMC4wJyxcblxuICAgICAgICAvLyBGcm9udGVuZCBBUEkgQ29uZmlndXJhdGlvbiAtIENSSVRJQ0FMIGZvciBjb25uZWN0aW5nIHRvIGJhY2tlbmRcbiAgICAgICAgTkVYVF9QVUJMSUNfQVBJX1VSTDogJ2h0dHBzOi8vY2hhdC5jb25uZWN0LWJlc3QuY29tL2FwaScsXG4gICAgICAgIE5FWFRfUFVCTElDX1dFQlNPQ0tFVF9VUkw6ICd3c3M6Ly92Njh4NzkyeWQ1LmV4ZWN1dGUtYXBpLnVzLXdlc3QtMi5hbWF6b25hd3MuY29tL3Byb2QnLFxuXG4gICAgICAgIC8vIEdvb2dsZSBPQXV0aCBmb3IgTmV4dEF1dGggZnJvbnRlbmRcbiAgICAgICAgTkVYVF9QVUJMSUNfR09PR0xFX0NMSUVOVF9JRDogcHJvY2Vzcy5lbnYuR09PR0xFX0NMSUVOVF9JRCB8fCAnNjk5MDQ1OTc5MTI1LXYxdGpuZmx1aG1vYnJvZDhob2dkYmt0cWdpMnZwdjN0LmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tJyxcbiAgICAgICAgR09PR0xFX0NMSUVOVF9JRDogcHJvY2Vzcy5lbnYuR09PR0xFX0NMSUVOVF9JRCB8fCAnNjk5MDQ1OTc5MTI1LXYxdGpuZmx1aG1vYnJvZDhob2dkYmt0cWdpMnZwdjN0LmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tJyxcbiAgICAgICAgR09PR0xFX0NMSUVOVF9TRUNSRVQ6IHByb2Nlc3MuZW52LkdPT0dMRV9DTElFTlRfU0VDUkVUIHx8ICdQTEFDRUhPTERFUl9TRUNSRVQnLFxuXG4gICAgICAgIC8vIE5leHRBdXRoIENvbmZpZ3VyYXRpb24gZm9yIGZyb250ZW5kXG4gICAgICAgIE5FWFRBVVRIX1VSTDogJ2h0dHBzOi8vY2hhdC5jb25uZWN0LWJlc3QuY29tJyxcbiAgICAgICAgTkVYVEFVVEhfU0VDUkVUOiBuZXh0QXV0aFNlY3JldFxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gQmFja2VuZCBDb250YWluZXIgKEZsYXNrKVxuICAgIGNvbnN0IGJhY2tlbmRDb250YWluZXIgPSB0YXNrRGVmaW5pdGlvbi5hZGRDb250YWluZXIoJ0JhY2tlbmRDb250YWluZXInLCB7XG4gICAgICBpbWFnZTogZWNzLkNvbnRhaW5lckltYWdlLmZyb21FY3JSZXBvc2l0b3J5KGJhY2tlbmRSZXBvLCBiYWNrZW5kSW1hZ2VUYWcpLFxuICAgICAgbWVtb3J5TGltaXRNaUI6IDE1MzYsXG4gICAgICBjcHU6IDc2OCxcbiAgICAgIGxvZ2dpbmc6IGVjcy5Mb2dEcml2ZXJzLmF3c0xvZ3Moe1xuICAgICAgICBzdHJlYW1QcmVmaXg6ICdjaGF0LWJhY2tlbmQnLFxuICAgICAgICBsb2dHcm91cDogbG9nR3JvdXBcbiAgICAgIH0pLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgLy8gQ29yZSBGbGFzayBzZXR0aW5nc1xuICAgICAgICBGTEFTS19FTlY6ICdwcm9kdWN0aW9uJyxcbiAgICAgICAgREVCVUc6ICdGYWxzZScsXG4gICAgICAgIEhPU1Q6ICcwLjAuMC4wJyxcbiAgICAgICAgUE9SVDogJzUwMDEnLFxuICAgICAgICBQWVRIT05VTkJVRkZFUkVEOiAnMScsXG5cbiAgICAgICAgLy8gTW9uZ29EQiBjb25maWd1cmF0aW9uIChleGFjdCBtYXRjaCBmcm9tIExpZ2h0c2FpbClcbiAgICAgICAgTU9OR09EQl9EQl9OQU1FOiAnY2hhdGFwcCcsXG4gICAgICAgIE1PTkdPREJfVVJJOiBtb25nb1VyaSxcblxuICAgICAgICAvLyBKV1QgY29uZmlndXJhdGlvbiAoZXhhY3QgbWF0Y2ggZnJvbSBMaWdodHNhaWwpXG4gICAgICAgIEpXVF9FWFBJUkFUSU9OX0hPVVJTOiAnMTY4JyxcbiAgICAgICAgSldUX1NFQ1JFVF9LRVk6IGp3dFNlY3JldEtleSxcbiAgICAgICAgU0VDUkVUX0tFWTogc2VjcmV0S2V5LFxuXG4gICAgICAgIC8vIENPUlMgYW5kIFVSTHMgLSB1c2luZyBjdXN0b20gZG9tYWluIHdpdGggSFRUUFNcbiAgICAgICAgQ09SU19PUklHSU5TOiAnaHR0cHM6Ly9jb25uZWN0LWJlc3QuY29tLGh0dHBzOi8vY2hhdC5jb25uZWN0LWJlc3QuY29tJyxcbiAgICAgICAgRlJPTlRFTkRfVVJMOiAnaHR0cHM6Ly9jaGF0LmNvbm5lY3QtYmVzdC5jb20nLFxuICAgICAgICBORVhUQVVUSF9VUkw6ICdodHRwczovL2NoYXQuY29ubmVjdC1iZXN0LmNvbScsXG4gICAgICAgIE5FWFRBVVRIX1NFQ1JFVDogbmV4dEF1dGhTZWNyZXQsXG5cbiAgICAgICAgLy8gR29vZ2xlIE9BdXRoIC0gdXNpbmcgZW52aXJvbm1lbnQgdmFyaWFibGVzIGZvciBzZWN1cml0eVxuICAgICAgICBHT09HTEVfQ0xJRU5UX0lEOiBwcm9jZXNzLmVudi5HT09HTEVfQ0xJRU5UX0lEIHx8ICc2OTkwNDU5NzkxMjUtdjF0am5mbHVobW9icm9kOGhvZ2Ria3RxZ2kydnB2M3QuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20nLFxuICAgICAgICBHT09HTEVfQ0xJRU5UX1NFQ1JFVDogcHJvY2Vzcy5lbnYuR09PR0xFX0NMSUVOVF9TRUNSRVQgfHwgJ1BMQUNFSE9MREVSX1NFQ1JFVCcsXG4gICAgICAgIEdPT0dMRV9SRURJUkVDVF9VUkk6IHByb2Nlc3MuZW52LkdPT0dMRV9SRURJUkVDVF9VUkkgfHwgJ2h0dHBzOi8vY2hhdC5jb25uZWN0LWJlc3QuY29tL2FwaS9hdXRoL2NhbGxiYWNrL2dvb2dsZScsXG5cbiAgICAgICAgLy8gRW1haWwgY29uZmlndXJhdGlvbiBmb3IgdmVyaWZpY2F0aW9uIGVtYWlscyAtIEFXUyBTRVNcbiAgICAgICAgU01UUF9IT1NUOiBwcm9jZXNzLmVudi5FTUFJTF9IT1NUIHx8ICdlbWFpbC1zbXRwLnVzLXdlc3QtMi5hbWF6b25hd3MuY29tJyxcbiAgICAgICAgU01UUF9QT1JUOiBwcm9jZXNzLmVudi5FTUFJTF9QT1JUIHx8ICc1ODcnLFxuICAgICAgICBTTVRQX0ZST01fRU1BSUw6IHByb2Nlc3MuZW52LkVNQUlMX0ZST00gfHwgJ25vcmVwbHlAY29ubmVjdC1iZXN0LmNvbScsXG4gICAgICAgIFNNVFBfVVNFUjogcHJvY2Vzcy5lbnYuRU1BSUxfVVNFUiB8fCAnJyxcbiAgICAgICAgU01UUF9QQVNTV09SRDogcHJvY2Vzcy5lbnYuRU1BSUxfUEFTU1dPUkQgfHwgJycsXG5cbiAgICAgICAgLy8gVXBsb2FkIGNvbmZpZ3VyYXRpb24gKGV4YWN0IG1hdGNoIGZyb20gTGlnaHRzYWlsKVxuICAgICAgICBNQVhfQ09OVEVOVF9MRU5HVEg6ICc1MjQyODgwMCcsXG4gICAgICAgIFVQTE9BRF9GT0xERVI6ICdzdGF0aWMvdXBsb2FkcycsXG5cbiAgICAgICAgLy8gV2ViU29ja2V0IFVSTCAoZXhhY3QgbWF0Y2ggZnJvbSBMaWdodHNhaWwpXG4gICAgICAgIE5FWFRfUFVCTElDX1dFQlNPQ0tFVF9VUkw6ICd3c3M6Ly92Njh4NzkyeWQ1LmV4ZWN1dGUtYXBpLnVzLXdlc3QtMi5hbWF6b25hd3MuY29tL3Byb2QnLFxuXG4gICAgICAgIC8vIEFXUyBDb25maWd1cmF0aW9uIGZvciBDbG91ZFdhdGNoIG1ldHJpY3NcbiAgICAgICAgQVdTX1JFR0lPTjogcHJvY2Vzcy5lbnYuQVdTX1JFR0lPTiB8fCAndXMtd2VzdC0yJyxcbiAgICAgICAgRUNTX0NMVVNURVJfTkFNRTogcHJvY2Vzcy5lbnYuRUNTX0NMVVNURVJfTkFNRSB8fCAnY2hhdC1hcHAtY2x1c3RlcicsXG4gICAgICAgIEVDU19TRVJWSUNFX05BTUU6IHByb2Nlc3MuZW52LkVDU19TRVJWSUNFX05BTUUgfHwgJ2NoYXQtYXBwLXNlcnZpY2UnXG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBQb3J0IG1hcHBpbmdzXG4gICAgZnJvbnRlbmRDb250YWluZXIuYWRkUG9ydE1hcHBpbmdzKHtcbiAgICAgIGNvbnRhaW5lclBvcnQ6IDMwMDAsXG4gICAgICBwcm90b2NvbDogZWNzLlByb3RvY29sLlRDUFxuICAgIH0pO1xuXG4gICAgYmFja2VuZENvbnRhaW5lci5hZGRQb3J0TWFwcGluZ3Moe1xuICAgICAgY29udGFpbmVyUG9ydDogNTAwMSxcbiAgICAgIHByb3RvY29sOiBlY3MuUHJvdG9jb2wuVENQXG4gICAgfSk7XG5cbiAgICAvLyBTZWN1cml0eSBHcm91cCBmb3IgQUxCXG4gICAgY29uc3QgYWxiU2VjdXJpdHlHcm91cCA9IG5ldyBlYzIuU2VjdXJpdHlHcm91cCh0aGlzLCAnQWxiU2VjdXJpdHlHcm91cCcsIHtcbiAgICAgIHZwYyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2VjdXJpdHkgZ3JvdXAgZm9yIENoYXQgQXBwIEFMQicsXG4gICAgICBhbGxvd0FsbE91dGJvdW5kOiB0cnVlXG4gICAgfSk7XG5cbiAgICAvLyBBbGxvdyBpbmJvdW5kIEhUVFAgdHJhZmZpYyB0byBBTEJcbiAgICBhbGJTZWN1cml0eUdyb3VwLmFkZEluZ3Jlc3NSdWxlKFxuICAgICAgZWMyLlBlZXIuYW55SXB2NCgpLFxuICAgICAgZWMyLlBvcnQudGNwKDgwKSxcbiAgICAgICdBbGxvdyBIVFRQIHRyYWZmaWMgZnJvbSBpbnRlcm5ldCdcbiAgICApO1xuXG4gICAgLy8gQWxsb3cgaW5ib3VuZCBIVFRQUyB0cmFmZmljIHRvIEFMQiAoZm9yIGZ1dHVyZSB1c2UpXG4gICAgYWxiU2VjdXJpdHlHcm91cC5hZGRJbmdyZXNzUnVsZShcbiAgICAgIGVjMi5QZWVyLmFueUlwdjQoKSxcbiAgICAgIGVjMi5Qb3J0LnRjcCg0NDMpLFxuICAgICAgJ0FsbG93IEhUVFBTIHRyYWZmaWMgZnJvbSBpbnRlcm5ldCdcbiAgICApO1xuXG4gICAgLy8gQXBwbGljYXRpb24gTG9hZCBCYWxhbmNlclxuICAgIGNvbnN0IGFsYiA9IG5ldyBlbGJ2Mi5BcHBsaWNhdGlvbkxvYWRCYWxhbmNlcih0aGlzLCAnQ2hhdEFwcEFMQicsIHtcbiAgICAgIHZwYyxcbiAgICAgIGludGVybmV0RmFjaW5nOiB0cnVlLFxuICAgICAgbG9hZEJhbGFuY2VyTmFtZTogJ2NoYXQtYXBwLWFsYicsXG4gICAgICBzZWN1cml0eUdyb3VwOiBhbGJTZWN1cml0eUdyb3VwXG4gICAgfSk7XG5cbiAgICAvLyBGcm9udGVuZCBUYXJnZXQgR3JvdXAgKE5leHQuanMgb24gcG9ydCAzMDAwKVxuICAgIGNvbnN0IGZyb250ZW5kVGFyZ2V0R3JvdXAgPSBuZXcgZWxidjIuQXBwbGljYXRpb25UYXJnZXRHcm91cCh0aGlzLCAnRnJvbnRlbmRUYXJnZXRHcm91cCcsIHtcbiAgICAgIHBvcnQ6IDMwMDAsXG4gICAgICBwcm90b2NvbDogZWxidjIuQXBwbGljYXRpb25Qcm90b2NvbC5IVFRQLFxuICAgICAgdnBjLFxuICAgICAgdGFyZ2V0VHlwZTogZWxidjIuVGFyZ2V0VHlwZS5JUCxcbiAgICAgIGhlYWx0aENoZWNrOiB7XG4gICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgIGhlYWx0aHlIdHRwQ29kZXM6ICcyMDAnLFxuICAgICAgICBwYXRoOiAnLycsXG4gICAgICAgIHByb3RvY29sOiBlbGJ2Mi5Qcm90b2NvbC5IVFRQLFxuICAgICAgICBpbnRlcnZhbDogY2RrLkR1cmF0aW9uLnNlY29uZHMoNjApLFxuICAgICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICAgIGhlYWx0aHlUaHJlc2hvbGRDb3VudDogMixcbiAgICAgICAgdW5oZWFsdGh5VGhyZXNob2xkQ291bnQ6IDVcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIEJhY2tlbmQgVGFyZ2V0IEdyb3VwIChGbGFzayBvbiBwb3J0IDUwMDEpXG4gICAgY29uc3QgYmFja2VuZFRhcmdldEdyb3VwID0gbmV3IGVsYnYyLkFwcGxpY2F0aW9uVGFyZ2V0R3JvdXAodGhpcywgJ0JhY2tlbmRUYXJnZXRHcm91cCcsIHtcbiAgICAgIHBvcnQ6IDUwMDEsXG4gICAgICBwcm90b2NvbDogZWxidjIuQXBwbGljYXRpb25Qcm90b2NvbC5IVFRQLFxuICAgICAgdnBjLFxuICAgICAgdGFyZ2V0VHlwZTogZWxidjIuVGFyZ2V0VHlwZS5JUCxcbiAgICAgIGhlYWx0aENoZWNrOiB7XG4gICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgIGhlYWx0aHlIdHRwQ29kZXM6ICcyMDAnLFxuICAgICAgICBwYXRoOiAnL2FwaS9oZWFsdGgnLFxuICAgICAgICBwcm90b2NvbDogZWxidjIuUHJvdG9jb2wuSFRUUCxcbiAgICAgICAgaW50ZXJ2YWw6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDYwKSxcbiAgICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgICBoZWFsdGh5VGhyZXNob2xkQ291bnQ6IDIsXG4gICAgICAgIHVuaGVhbHRoeVRocmVzaG9sZENvdW50OiA1XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBVcGRhdGUgQUxCIFNlY3VyaXR5IEdyb3VwIHRvIGFsbG93IEhUVFBTIHRyYWZmaWNcbiAgICBhbGJTZWN1cml0eUdyb3VwLmFkZEluZ3Jlc3NSdWxlKFxuICAgICAgZWMyLlBlZXIuYW55SXB2NCgpLFxuICAgICAgZWMyLlBvcnQudGNwKDQ0MyksXG4gICAgICAnQWxsb3cgSFRUUFMgdHJhZmZpYydcbiAgICApO1xuXG4gICAgLy8gSW1wb3J0IGV4aXN0aW5nIFNTTCBjZXJ0aWZpY2F0ZSBmb3IgY2hhdC5jb25uZWN0LWJlc3QuY29tXG4gICAgY29uc3QgY2VydGlmaWNhdGUgPSBjZXJ0aWZpY2F0ZU1hbmFnZXIuQ2VydGlmaWNhdGUuZnJvbUNlcnRpZmljYXRlQXJuKFxuICAgICAgdGhpcyxcbiAgICAgICdDaGF0U1NMQ2VydGlmaWNhdGUnLFxuICAgICAgJ2Fybjphd3M6YWNtOnVzLXdlc3QtMjo4Mzk3NzYyNzQ2Nzk6Y2VydGlmaWNhdGUvNmY1OTVkZmYtZjRmYi00ZWU3LThkNjAtOWU3OGJjN2RiZmI3J1xuICAgICk7XG5cbiAgICAvLyBIVFRQIExpc3RlbmVyIC0gcmVkaXJlY3QgdG8gSFRUUFNcbiAgICBjb25zdCBodHRwTGlzdGVuZXIgPSBhbGIuYWRkTGlzdGVuZXIoJ0h0dHBMaXN0ZW5lcicsIHtcbiAgICAgIHBvcnQ6IDgwLFxuICAgICAgcHJvdG9jb2w6IGVsYnYyLkFwcGxpY2F0aW9uUHJvdG9jb2wuSFRUUCxcbiAgICAgIGRlZmF1bHRBY3Rpb246IGVsYnYyLkxpc3RlbmVyQWN0aW9uLnJlZGlyZWN0KHtcbiAgICAgICAgcHJvdG9jb2w6ICdIVFRQUycsXG4gICAgICAgIHBvcnQ6ICc0NDMnLFxuICAgICAgICBwZXJtYW5lbnQ6IHRydWVcbiAgICAgIH0pXG4gICAgfSk7XG5cbiAgICAvLyBIVFRQUyBMaXN0ZW5lciB3aXRoIFNTTCBjZXJ0aWZpY2F0ZVxuICAgIGNvbnN0IGh0dHBzTGlzdGVuZXIgPSBhbGIuYWRkTGlzdGVuZXIoJ0h0dHBzTGlzdGVuZXInLCB7XG4gICAgICBwb3J0OiA0NDMsXG4gICAgICBwcm90b2NvbDogZWxidjIuQXBwbGljYXRpb25Qcm90b2NvbC5IVFRQUyxcbiAgICAgIGNlcnRpZmljYXRlczogW2NlcnRpZmljYXRlXSxcbiAgICAgIGRlZmF1bHRBY3Rpb246IGVsYnYyLkxpc3RlbmVyQWN0aW9uLmZvcndhcmQoW2Zyb250ZW5kVGFyZ2V0R3JvdXBdKVxuICAgIH0pO1xuXG4gICAgLy8gQWRkIEhUVFBTIGxpc3RlbmVyIHJ1bGVzIHdpdGggY29ycmVjdCBwcmlvcml0aWVzXG4gICAgLy8gUHJpb3JpdHkgMTA6IFJvdXRlIHNwZWNpZmljIE5leHRBdXRoLmpzIHJvdXRlcyB0byBmcm9udGVuZCAoaGlnaGVzdCBwcmlvcml0eSlcbiAgICBodHRwc0xpc3RlbmVyLmFkZEFjdGlvbignTmV4dEF1dGhSb3V0ZScsIHtcbiAgICAgIHByaW9yaXR5OiAxMCxcbiAgICAgIGNvbmRpdGlvbnM6IFtcbiAgICAgICAgZWxidjIuTGlzdGVuZXJDb25kaXRpb24ucGF0aFBhdHRlcm5zKFtcbiAgICAgICAgICAnL2FwaS9hdXRoL3NpZ25pbionLCAgICAgLy8gTmV4dEF1dGggc2lnbiBpbiBwYWdlc1xuICAgICAgICAgICcvYXBpL2F1dGgvc2lnbm91dCcsICAgICAvLyBOZXh0QXV0aCBzaWduIG91dFxuICAgICAgICAgICcvYXBpL2F1dGgvc2Vzc2lvbicsICAgICAvLyBOZXh0QXV0aCBzZXNzaW9uIGNoZWNrXG4gICAgICAgICAgJy9hcGkvYXV0aC9jc3JmJywgICAgICAgIC8vIE5leHRBdXRoIENTUkYgdG9rZW5cbiAgICAgICAgICAnL2FwaS9hdXRoL3Byb3ZpZGVycycgICAgLy8gTmV4dEF1dGggYXZhaWxhYmxlIHByb3ZpZGVyc1xuICAgICAgICBdKVxuICAgICAgXSxcbiAgICAgIGFjdGlvbjogZWxidjIuTGlzdGVuZXJBY3Rpb24uZm9yd2FyZChbZnJvbnRlbmRUYXJnZXRHcm91cF0pXG4gICAgfSk7XG5cbiAgICAvLyBQcmlvcml0eSAyMDogUm91dGUgTmV4dEF1dGggY2FsbGJhY2sgcm91dGVzIHRvIGZyb250ZW5kXG4gICAgaHR0cHNMaXN0ZW5lci5hZGRBY3Rpb24oJ05leHRBdXRoQ2FsbGJhY2tSb3V0ZScsIHtcbiAgICAgIHByaW9yaXR5OiAyMCxcbiAgICAgIGNvbmRpdGlvbnM6IFtcbiAgICAgICAgZWxidjIuTGlzdGVuZXJDb25kaXRpb24ucGF0aFBhdHRlcm5zKFtcbiAgICAgICAgICAnL2FwaS9hdXRoL2NhbGxiYWNrLyonICAgLy8gT0F1dGggY2FsbGJhY2tzIChHb29nbGUsIGV0Yy4pXG4gICAgICAgIF0pXG4gICAgICBdLFxuICAgICAgYWN0aW9uOiBlbGJ2Mi5MaXN0ZW5lckFjdGlvbi5mb3J3YXJkKFtmcm9udGVuZFRhcmdldEdyb3VwXSlcbiAgICB9KTtcblxuICAgIC8vIFByaW9yaXR5IDEwMDogUm91dGUgYWxsIG90aGVyIC9hcGkvKiB0byBiYWNrZW5kIChGbGFzaylcbiAgICBodHRwc0xpc3RlbmVyLmFkZEFjdGlvbignQXBpUm91dGUnLCB7XG4gICAgICBwcmlvcml0eTogMTAwLFxuICAgICAgY29uZGl0aW9uczogW1xuICAgICAgICBlbGJ2Mi5MaXN0ZW5lckNvbmRpdGlvbi5wYXRoUGF0dGVybnMoWycvYXBpLyonXSlcbiAgICAgIF0sXG4gICAgICBhY3Rpb246IGVsYnYyLkxpc3RlbmVyQWN0aW9uLmZvcndhcmQoW2JhY2tlbmRUYXJnZXRHcm91cF0pXG4gICAgfSk7XG5cbiAgICAvLyBTZWN1cml0eSBHcm91cCBmb3IgRUNTIFRhc2tzXG4gICAgY29uc3QgZWNzU2VjdXJpdHlHcm91cCA9IG5ldyBlYzIuU2VjdXJpdHlHcm91cCh0aGlzLCAnRWNzU2VjdXJpdHlHcm91cCcsIHtcbiAgICAgIHZwYyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2VjdXJpdHkgZ3JvdXAgZm9yIENoYXQgQXBwIEVDUyBUYXNrcycsXG4gICAgICBhbGxvd0FsbE91dGJvdW5kOiB0cnVlXG4gICAgfSk7XG5cbiAgICAvLyBBbGxvdyBpbmJvdW5kIHRyYWZmaWMgZnJvbSBBTEIgdG8gZnJvbnRlbmQgY29udGFpbmVyXG4gICAgZWNzU2VjdXJpdHlHcm91cC5hZGRJbmdyZXNzUnVsZShcbiAgICAgIGFsYlNlY3VyaXR5R3JvdXAsXG4gICAgICBlYzIuUG9ydC50Y3AoMzAwMCksXG4gICAgICAnQWxsb3cgQUxCIHRvIGFjY2VzcyBmcm9udGVuZCBjb250YWluZXInXG4gICAgKTtcblxuICAgIC8vIEFsbG93IGluYm91bmQgdHJhZmZpYyBmcm9tIEFMQiB0byBiYWNrZW5kIGNvbnRhaW5lclxuICAgIGVjc1NlY3VyaXR5R3JvdXAuYWRkSW5ncmVzc1J1bGUoXG4gICAgICBhbGJTZWN1cml0eUdyb3VwLFxuICAgICAgZWMyLlBvcnQudGNwKDUwMDEpLFxuICAgICAgJ0FsbG93IEFMQiB0byBhY2Nlc3MgYmFja2VuZCBjb250YWluZXInXG4gICAgKTtcblxuICAgIC8vIEVDUyBTZXJ2aWNlXG4gICAgY29uc3Qgc2VydmljZSA9IG5ldyBlY3MuRmFyZ2F0ZVNlcnZpY2UodGhpcywgJ0NoYXRBcHBTZXJ2aWNlJywge1xuICAgICAgY2x1c3RlcixcbiAgICAgIHRhc2tEZWZpbml0aW9uLFxuICAgICAgc2VydmljZU5hbWU6ICdjaGF0LWFwcC1zZXJ2aWNlJyxcbiAgICAgIGRlc2lyZWRDb3VudDogMSxcbiAgICAgIGFzc2lnblB1YmxpY0lwOiB0cnVlLFxuICAgICAgaGVhbHRoQ2hlY2tHcmFjZVBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICBlbmFibGVFeGVjdXRlQ29tbWFuZDogdHJ1ZSwgLy8gRm9yIGRlYnVnZ2luZ1xuICAgICAgc2VjdXJpdHlHcm91cHM6IFtlY3NTZWN1cml0eUdyb3VwXVxuICAgIH0pO1xuXG4gICAgLy8gQ29uZmlndXJlIGRlcGxveW1lbnQgZm9yIHplcm8tZG93bnRpbWUgcm9sbGluZyB1cGRhdGVzXG4gICAgY29uc3QgY2ZuU2VydmljZSA9IHNlcnZpY2Uubm9kZS5kZWZhdWx0Q2hpbGQgYXMgZWNzLkNmblNlcnZpY2U7XG4gICAgY2ZuU2VydmljZS5kZXBsb3ltZW50Q29uZmlndXJhdGlvbiA9IHtcbiAgICAgIG1pbmltdW1IZWFsdGh5UGVyY2VudDogMTAwLCAgLy8gS2VlcCBhbGwgdGFza3MgcnVubmluZyBkdXJpbmcgZGVwbG95bWVudFxuICAgICAgbWF4aW11bVBlcmNlbnQ6IDIwMCAgICAgICAgICAvLyBBbGxvdyBkb3VibGluZyBkdXJpbmcgZGVwbG95bWVudCBmb3IgemVyby1kb3dudGltZVxuICAgIH07XG5cbiAgICAvLyBBdHRhY2ggc2VydmljZSBjb250YWluZXJzIHRvIHRoZWlyIHJlc3BlY3RpdmUgdGFyZ2V0IGdyb3Vwc1xuICAgIGZyb250ZW5kVGFyZ2V0R3JvdXAuYWRkVGFyZ2V0KHNlcnZpY2UubG9hZEJhbGFuY2VyVGFyZ2V0KHtcbiAgICAgIGNvbnRhaW5lck5hbWU6ICdGcm9udGVuZENvbnRhaW5lcicsXG4gICAgICBjb250YWluZXJQb3J0OiAzMDAwXG4gICAgfSkpO1xuXG4gICAgYmFja2VuZFRhcmdldEdyb3VwLmFkZFRhcmdldChzZXJ2aWNlLmxvYWRCYWxhbmNlclRhcmdldCh7XG4gICAgICBjb250YWluZXJOYW1lOiAnQmFja2VuZENvbnRhaW5lcicsXG4gICAgICBjb250YWluZXJQb3J0OiA1MDAxXG4gICAgfSkpO1xuXG4gICAgLy8gQXV0byBTY2FsaW5nXG4gICAgY29uc3Qgc2NhbGluZyA9IHNlcnZpY2UuYXV0b1NjYWxlVGFza0NvdW50KHtcbiAgICAgIG1pbkNhcGFjaXR5OiAxLFxuICAgICAgbWF4Q2FwYWNpdHk6IDNcbiAgICB9KTtcblxuICAgIHNjYWxpbmcuc2NhbGVPbkNwdVV0aWxpemF0aW9uKCdDcHVTY2FsaW5nJywge1xuICAgICAgdGFyZ2V0VXRpbGl6YXRpb25QZXJjZW50OiA3MCxcbiAgICAgIHNjYWxlSW5Db29sZG93bjogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICBzY2FsZU91dENvb2xkb3duOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KVxuICAgIH0pO1xuXG4gICAgLy8gPT09IERFUExPWU1FTlQgT1VUUFVUUyA9PT1cblxuICAgIC8vIEFwcGxpY2F0aW9uIFVSTHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXBwbGljYXRpb25VUkwnLCB7XG4gICAgICB2YWx1ZTogJ2h0dHBzOi8vY2hhdC5jb25uZWN0LWJlc3QuY29tJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAn8J+MkCBNYWluIGFwcGxpY2F0aW9uIFVSTCdcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdIZWFsdGhDaGVja1VSTCcsIHtcbiAgICAgIHZhbHVlOiAnaHR0cHM6Ly9jaGF0LmNvbm5lY3QtYmVzdC5jb20vYXBpL2hlYWx0aCcsXG4gICAgICBkZXNjcmlwdGlvbjogJ/Cfj6UgQXBwbGljYXRpb24gaGVhbHRoIGNoZWNrIGVuZHBvaW50J1xuICAgIH0pO1xuXG4gICAgLy8gSW5mcmFzdHJ1Y3R1cmUgRGV0YWlsc1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdMb2FkQmFsYW5jZXJETlMnLCB7XG4gICAgICB2YWx1ZTogYWxiLmxvYWRCYWxhbmNlckRuc05hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ+Kalu+4jyBMb2FkIGJhbGFuY2VyIEROUyAoZm9yIENOQU1FIHNldHVwKSdcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdFY3NDbHVzdGVyJywge1xuICAgICAgdmFsdWU6IGNsdXN0ZXIuY2x1c3Rlck5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ/CfmqIgRUNTIGNsdXN0ZXIgbmFtZSdcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdFY3NTZXJ2aWNlJywge1xuICAgICAgdmFsdWU6IHNlcnZpY2Uuc2VydmljZU5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ+Kame+4jyBFQ1Mgc2VydmljZSBuYW1lJ1xuICAgIH0pO1xuXG4gICAgLy8gRW1haWwgQ29uZmlndXJhdGlvblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTZXNTbXRwRW5kcG9pbnQnLCB7XG4gICAgICB2YWx1ZTogYGVtYWlsLXNtdHAuJHt0aGlzLnJlZ2lvbn0uYW1hem9uYXdzLmNvbWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ/Cfk6cgU0VTIFNNVFAgc2VydmVyJ1xuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1Nlc1NtdHBDcmVkZW50aWFscycsIHtcbiAgICAgIHZhbHVlOiBgRU1BSUxfVVNFUj1cIiR7c2VzQWNjZXNzS2V5LmFjY2Vzc0tleUlkfVwiIEVNQUlMX1BBU1NXT1JEPVwiW0dldCBmcm9tIEFXUyBDb25zb2xlXVwiYCxcbiAgICAgIGRlc2NyaXB0aW9uOiAn8J+UkCBTRVMgY3JlZGVudGlhbHMgZm9yIC5lbnYgKOKaoO+4jyBQYXNzd29yZCBub3Qgc2hvd24gZm9yIHNlY3VyaXR5KSdcbiAgICB9KTtcblxuICAgIC8vIEltYWdlIHRhZ3MgYmVpbmcgZGVwbG95ZWRcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRGVwbG95ZWRJbWFnZVRhZ3MnLCB7XG4gICAgICB2YWx1ZTogYEZyb250ZW5kOiAke2Zyb250ZW5kSW1hZ2VUYWd9LCBCYWNrZW5kOiAke2JhY2tlbmRJbWFnZVRhZ31gLFxuICAgICAgZGVzY3JpcHRpb246ICfwn4+377iPIENvbnRhaW5lciBpbWFnZSB0YWdzIGRlcGxveWVkIGluIHRoaXMgc3RhY2snXG4gICAgfSk7XG4gIH1cbn0iXX0=