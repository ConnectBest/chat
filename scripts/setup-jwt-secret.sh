#!/bin/bash

# JWT Secret Key Setup Script for GitHub Actions and Local Development
# This script helps generate and configure the JWT_SECRET_KEY for your chat application

set -e

echo "🔐 JWT Secret Key Setup for ConnectBest Chat Application"
echo "========================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Generate a secure JWT secret key
generate_jwt_secret() {
    echo -e "${BLUE}Generating secure JWT secret key...${NC}"

    # Generate 32 random bytes and base64 encode them
    if command -v openssl &> /dev/null; then
        JWT_SECRET=$(openssl rand -base64 32)
    elif command -v python3 &> /dev/null; then
        JWT_SECRET=$(python3 -c "import secrets; import base64; print(base64.b64encode(secrets.token_bytes(32)).decode())")
    else
        echo -e "${RED}❌ Error: Neither openssl nor python3 found. Please install one of them.${NC}"
        exit 1
    fi

    echo -e "${GREEN}✅ Generated JWT secret key: ${JWT_SECRET}${NC}"
    echo
}

# Update local environment files
update_local_env() {
    echo -e "${BLUE}Updating local environment files...${NC}"

    # Frontend .env.local
    if [ ! -f ".env.local" ]; then
        cp .env.example .env.local
    fi

    # Check if JWT_SECRET_KEY exists and update or add it
    if grep -q "JWT_SECRET_KEY=" .env.local; then
        # Update existing line
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s|^JWT_SECRET_KEY=.*|JWT_SECRET_KEY=${JWT_SECRET}|" .env.local
        else
            # Linux
            sed -i "s|^JWT_SECRET_KEY=.*|JWT_SECRET_KEY=${JWT_SECRET}|" .env.local
        fi
        echo -e "${GREEN}✅ Updated JWT_SECRET_KEY in .env.local${NC}"
    else
        # Add new line
        echo "" >> .env.local
        echo "# JWT Configuration - CRITICAL: Must match backend" >> .env.local
        echo "JWT_SECRET_KEY=${JWT_SECRET}" >> .env.local
        echo "JWT_EXPIRATION_HOURS=168" >> .env.local
        echo -e "${GREEN}✅ Added JWT_SECRET_KEY to .env.local${NC}"
    fi

    # Backend .env
    if [ ! -f "backend/.env" ]; then
        cp backend/.env.example backend/.env
    fi

    # Check if JWT_SECRET_KEY exists and update or add it
    if grep -q "JWT_SECRET_KEY=" backend/.env; then
        # Update existing line
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s|^JWT_SECRET_KEY=.*|JWT_SECRET_KEY=${JWT_SECRET}|" backend/.env
        else
            # Linux
            sed -i "s|^JWT_SECRET_KEY=.*|JWT_SECRET_KEY=${JWT_SECRET}|" backend/.env
        fi
        echo -e "${GREEN}✅ Updated JWT_SECRET_KEY in backend/.env${NC}"
    else
        # Add new line
        echo "" >> backend/.env
        echo "# JWT Configuration - CRITICAL: Must match frontend" >> backend/.env
        echo "JWT_SECRET_KEY=${JWT_SECRET}" >> backend/.env
        echo "JWT_EXPIRATION_HOURS=168" >> backend/.env
        echo -e "${GREEN}✅ Added JWT_SECRET_KEY to backend/.env${NC}"
    fi
}

# Display GitHub Actions setup instructions
show_github_instructions() {
    echo
    echo -e "${YELLOW}🚀 GitHub Actions Setup Instructions${NC}"
    echo "====================================="
    echo
    echo -e "${BLUE}1. Go to your GitHub repository: https://github.com/ConnectBest/chat${NC}"
    echo -e "${BLUE}2. Click on Settings → Secrets and variables → Actions${NC}"
    echo -e "${BLUE}3. Click 'New repository secret'${NC}"
    echo -e "${BLUE}4. Set the following secret:${NC}"
    echo
    echo -e "${GREEN}   Name: JWT_SECRET_KEY${NC}"
    echo -e "${GREEN}   Value: ${JWT_SECRET}${NC}"
    echo
    echo -e "${YELLOW}⚠️  IMPORTANT: Copy the secret value exactly as shown above!${NC}"
    echo
    echo -e "${BLUE}5. Click 'Add secret'${NC}"
    echo
    echo -e "${BLUE}6. Verify these secrets exist (should already be set):${NC}"
    echo "   - MONGODB_URI"
    echo "   - NEXTAUTH_SECRET"
    echo "   - SECRET_KEY"
    echo "   - GOOGLE_CLIENT_ID"
    echo "   - GOOGLE_CLIENT_SECRET"
    echo
}

# Verification instructions
show_verification() {
    echo -e "${YELLOW}🔍 Verification Steps${NC}"
    echo "===================="
    echo
    echo -e "${BLUE}After setting the GitHub secret:${NC}"
    echo "1. Make a small commit to trigger deployment:"
    echo "   git add -A && git commit -m 'Configure JWT_SECRET_KEY' && git push"
    echo
    echo "2. Watch the GitHub Actions deployment:"
    echo "   https://github.com/ConnectBest/chat/actions"
    echo
    echo "3. Check CloudWatch logs after deployment:"
    echo "   - Frontend logs should show JWT token generation"
    echo "   - Backend logs should show JWT validation success"
    echo
    echo "4. Test login at: https://chat.connect-best.com"
    echo "   - Check Network tab for Authorization: Bearer headers"
    echo "   - Verify no authentication errors in browser console"
    echo
}

# Main execution
main() {
    echo -e "${BLUE}This script will:${NC}"
    echo "1. Generate a secure JWT secret key"
    echo "2. Update your local .env files"
    echo "3. Provide GitHub Actions setup instructions"
    echo

    read -p "Continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled."
        exit 0
    fi

    generate_jwt_secret
    update_local_env
    show_github_instructions
    show_verification

    echo -e "${GREEN}🎉 Setup complete!${NC}"
    echo -e "${YELLOW}Next steps: Set the JWT_SECRET_KEY secret in GitHub Actions and deploy.${NC}"
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi