#!/bin/bash

# CDK Deployment Verification Script
# Verifies that the JWT_SECRET_KEY configuration is properly deployed

set -e

echo "🔍 CDK JWT Configuration Verification"
echo "====================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if JWT_SECRET_KEY is set in local environment
check_local_env() {
    echo -e "${BLUE}Checking local environment configuration...${NC}"

    local issues=0

    # Check frontend .env.local
    if [ ! -f ".env.local" ]; then
        echo -e "${RED}❌ .env.local file not found${NC}"
        issues=$((issues + 1))
    else
        if grep -q "^JWT_SECRET_KEY=" .env.local; then
            local jwt_secret=$(grep "^JWT_SECRET_KEY=" .env.local | cut -d'=' -f2)
            if [ -n "$jwt_secret" ]; then
                echo -e "${GREEN}✅ JWT_SECRET_KEY found in .env.local${NC}"
            else
                echo -e "${RED}❌ JWT_SECRET_KEY is empty in .env.local${NC}"
                issues=$((issues + 1))
            fi
        else
            echo -e "${RED}❌ JWT_SECRET_KEY not found in .env.local${NC}"
            issues=$((issues + 1))
        fi
    fi

    # Check backend .env
    if [ ! -f "backend/.env" ]; then
        echo -e "${RED}❌ backend/.env file not found${NC}"
        issues=$((issues + 1))
    else
        if grep -q "^JWT_SECRET_KEY=" backend/.env; then
            local jwt_secret_backend=$(grep "^JWT_SECRET_KEY=" backend/.env | cut -d'=' -f2)
            if [ -n "$jwt_secret_backend" ]; then
                echo -e "${GREEN}✅ JWT_SECRET_KEY found in backend/.env${NC}"

                # Check if frontend and backend secrets match
                if [ -f ".env.local" ]; then
                    local jwt_secret_frontend=$(grep "^JWT_SECRET_KEY=" .env.local | cut -d'=' -f2)
                    if [ "$jwt_secret_frontend" = "$jwt_secret_backend" ]; then
                        echo -e "${GREEN}✅ JWT secrets match between frontend and backend${NC}"
                    else
                        echo -e "${RED}❌ JWT secrets don't match between frontend and backend${NC}"
                        issues=$((issues + 1))
                    fi
                fi
            else
                echo -e "${RED}❌ JWT_SECRET_KEY is empty in backend/.env${NC}"
                issues=$((issues + 1))
            fi
        else
            echo -e "${RED}❌ JWT_SECRET_KEY not found in backend/.env${NC}"
            issues=$((issues + 1))
        fi
    fi

    return $issues
}

# Test CDK compilation and validation
test_cdk_build() {
    echo -e "${BLUE}Testing CDK build with current configuration...${NC}"

    cd infrastructure

    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo "Installing CDK dependencies..."
        npm install
    fi

    # Set required environment variables for testing
    export MONGODB_URI="mongodb://test:test@localhost:27017/test"
    export JWT_SECRET_KEY="test-jwt-secret-key"
    export SECRET_KEY="test-secret-key"
    export NEXTAUTH_SECRET="test-nextauth-secret"

    # Try to synthesize the stack
    if npx cdk synth --quiet > /dev/null 2>&1; then
        echo -e "${GREEN}✅ CDK synthesis successful${NC}"
        cd ..
        return 0
    else
        echo -e "${RED}❌ CDK synthesis failed${NC}"
        echo "Running with verbose output:"
        npx cdk synth 2>&1 | head -20
        cd ..
        return 1
    fi
}

# Check GitHub Actions configuration
check_github_actions() {
    echo -e "${BLUE}Checking GitHub Actions workflow configuration...${NC}"

    local workflow_file=".github/workflows/ecs-deploy.yml"

    if [ ! -f "$workflow_file" ]; then
        echo -e "${RED}❌ GitHub Actions workflow file not found${NC}"
        return 1
    fi

    # Check if JWT_SECRET_KEY is referenced in the workflow
    if grep -q "JWT_SECRET_KEY:" "$workflow_file"; then
        echo -e "${GREEN}✅ JWT_SECRET_KEY found in GitHub Actions workflow${NC}"
    else
        echo -e "${RED}❌ JWT_SECRET_KEY not found in GitHub Actions workflow${NC}"
        return 1
    fi

    # Check if it's properly passed to environment
    if grep -A 10 -B 2 "JWT_SECRET_KEY:" "$workflow_file" | grep -q "secrets.JWT_SECRET_KEY"; then
        echo -e "${GREEN}✅ JWT_SECRET_KEY properly referenced as GitHub secret${NC}"
    else
        echo -e "${RED}❌ JWT_SECRET_KEY not properly referenced as GitHub secret${NC}"
        return 1
    fi

    return 0
}

# Check CDK stack configuration
check_cdk_stack() {
    echo -e "${BLUE}Checking CDK stack configuration...${NC}"

    local stack_file="infrastructure/lib/chat-app-stack.ts"

    if [ ! -f "$stack_file" ]; then
        echo -e "${RED}❌ CDK stack file not found${NC}"
        return 1
    fi

    # Check if JWT_SECRET_KEY is used in frontend container
    if grep -A 20 "Frontend Container" "$stack_file" | grep -q "JWT_SECRET_KEY: jwtSecretKey"; then
        echo -e "${GREEN}✅ JWT_SECRET_KEY configured in frontend container${NC}"
    else
        echo -e "${RED}❌ JWT_SECRET_KEY not found in frontend container${NC}"
        return 1
    fi

    # Check if JWT_SECRET_KEY is used in backend container
    if grep -A 20 "Backend Container" "$stack_file" | grep -q "JWT_SECRET_KEY: jwtSecretKey"; then
        echo -e "${GREEN}✅ JWT_SECRET_KEY configured in backend container${NC}"
    else
        echo -e "${RED}❌ JWT_SECRET_KEY not found in backend container${NC}"
        return 1
    fi

    # Check if jwtSecretKey variable is properly defined
    if grep -q "const jwtSecretKey = process.env.JWT_SECRET_KEY" "$stack_file"; then
        echo -e "${GREEN}✅ jwtSecretKey variable properly defined${NC}"
    else
        echo -e "${RED}❌ jwtSecretKey variable not properly defined${NC}"
        return 1
    fi

    return 0
}

# Provide deployment instructions
show_deployment_instructions() {
    echo
    echo -e "${YELLOW}🚀 Next Steps for Deployment${NC}"
    echo "============================"
    echo
    echo -e "${BLUE}1. Set GitHub Actions Secret:${NC}"
    echo "   - Go to: https://github.com/ConnectBest/chat/settings/secrets/actions"
    echo "   - Add secret: JWT_SECRET_KEY"
    echo "   - Use the value from your .env.local file"
    echo
    echo -e "${BLUE}2. Deploy to Production:${NC}"
    echo "   git add -A"
    echo "   git commit -m 'Configure JWT_SECRET_KEY for authentication'"
    echo "   git push origin main"
    echo
    echo -e "${BLUE}3. Monitor Deployment:${NC}"
    echo "   - GitHub Actions: https://github.com/ConnectBest/chat/actions"
    echo "   - CloudWatch Logs: https://console.aws.amazon.com/cloudwatch/"
    echo
    echo -e "${BLUE}4. Test Authentication:${NC}"
    echo "   - Login at: https://chat.connect-best.com"
    echo "   - Check browser Network tab for 'Authorization: Bearer' headers"
    echo "   - Verify no authentication errors in console"
    echo
}

# Run all checks
main() {
    local total_issues=0

    echo "Running comprehensive JWT configuration checks..."
    echo

    # Run checks
    check_local_env
    local_issues=$?
    total_issues=$((total_issues + local_issues))
    echo

    test_cdk_build
    cdk_issues=$?
    total_issues=$((total_issues + cdk_issues))
    echo

    check_github_actions
    github_issues=$?
    total_issues=$((total_issues + github_issues))
    echo

    check_cdk_stack
    stack_issues=$?
    total_issues=$((total_issues + stack_issues))
    echo

    # Summary
    echo -e "${BLUE}Verification Summary${NC}"
    echo "=================="

    if [ $total_issues -eq 0 ]; then
        echo -e "${GREEN}🎉 All checks passed! Configuration is ready for deployment.${NC}"
        show_deployment_instructions
    else
        echo -e "${RED}❌ Found $total_issues issue(s). Please fix them before deploying.${NC}"
        echo
        echo -e "${YELLOW}Common fixes:${NC}"
        echo "- Run: ./scripts/setup-jwt-secret.sh"
        echo "- Ensure .env.local and backend/.env have matching JWT_SECRET_KEY"
        echo "- Check CDK stack configuration"
        return 1
    fi
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi