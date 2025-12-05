#!/bin/bash
set -e

echo "🚀 Deploying ConnectBest Chat App to ECS..."

# Set AWS region
export AWS_DEFAULT_REGION=us-west-2
export CDK_DEFAULT_REGION=us-west-2

# Check if AWS CDK is installed
if ! command -v cdk &> /dev/null; then
    echo "AWS CDK CLI not found. Installing..."
    npm install -g aws-cdk
fi

# Navigate to infrastructure directory
cd "$(dirname "$0")"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing CDK dependencies..."
    npm install
fi

# Create AWS Systems Manager parameters for secrets (if they don't exist)
echo "🔐 Setting up secrets in AWS Systems Manager..."

# Function to create parameter if it doesn't exist
create_parameter_if_not_exists() {
    local name=$1
    local value=$2
    local type=${3:-"SecureString"}

    # Skip if value is empty
    if [ -z "$value" ]; then
        echo "Skipping parameter $name (empty value)"
        return
    fi

    if ! aws ssm get-parameter --name "$name" --region us-west-2 &>/dev/null; then
        echo "Creating parameter: $name"
        aws ssm put-parameter --name "$name" --value "$value" --type "$type" --region us-west-2 --overwrite
    else
        echo "Parameter $name already exists, skipping..."
    fi
}

# Generate secrets using the values from Lightsail deployment
SECRET_KEY=${SECRET_KEY:-"8CtviajCigJVPSNFUzJVP9y6uelEMujmQfy0qsfw2sI="}
JWT_SECRET_KEY=${JWT_SECRET_KEY:-"bVnLcSNvdEghq9qpgWfaEmGkhFYpAhmII4A2jQJdSmU="}

# Create parameters (only if they have values)
create_parameter_if_not_exists "SECRET_KEY" "$SECRET_KEY"
create_parameter_if_not_exists "JWT_SECRET_KEY" "$JWT_SECRET_KEY"

# Only create email parameters if they're provided
if [ -n "$EMAIL_USER" ]; then
    create_parameter_if_not_exists "EMAIL_USER" "$EMAIL_USER"
else
    echo "EMAIL_USER not set, will use empty string in container"
fi

if [ -n "$EMAIL_PASSWORD" ]; then
    create_parameter_if_not_exists "EMAIL_PASSWORD" "$EMAIL_PASSWORD"
else
    echo "EMAIL_PASSWORD not set, will use empty string in container"
fi

echo "🏗️ Synthesizing CloudFormation template..."
cdk synth

echo "🚀 Deploying to AWS..."
cdk deploy --require-approval never

echo "✅ Deployment complete!"
echo ""
echo "🔍 To check the deployment status:"
echo "aws ecs describe-services --cluster chat-app-cluster --services chat-app-service --region us-west-2"
echo ""
echo "📊 To view logs:"
echo "aws logs tail /ecs/chat-app --follow --region us-west-2"
echo ""
echo "🌐 Load balancer URL will be displayed in the CDK outputs above."