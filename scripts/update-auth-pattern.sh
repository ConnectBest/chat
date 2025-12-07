#!/bin/bash
# Script to help update remaining API routes to use JWT authentication
# Run this from the project root directory

echo "🔍 Finding API routes that still use old authentication pattern..."
echo ""

# Find routes using direct auth import
OLD_PATTERN_FILES=$(find app/api -name "route.ts" -type f -exec grep -l "auth from '@/lib/auth'" {} \; 2>/dev/null)

if [ -z "$OLD_PATTERN_FILES" ]; then
  echo "✅ All routes already updated!"
  exit 0
fi

echo "📋 Routes that need updating:"
echo "$OLD_PATTERN_FILES" | while read file; do
  echo "  - $file"
done

echo ""
echo "🔧 Update pattern:"
echo ""
echo "OLD CODE:"
cat << 'EOF'
import { auth } from '@/lib/auth';

const session = await auth(request as any, {} as any);

if (!session?.user) {
  return NextResponse.json(
    { error: 'Authentication required' },
    { status: 401 }
  );
}

const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  'X-User-ID': (session.user as any).id,
  'X-User-Email': session.user.email || '',
  'X-User-Role': (session.user as any).role || 'user'
};

const response = await fetch(url, { headers });
EOF

echo ""
echo "NEW CODE:"
cat << 'EOF'
import { getUserHeaders } from '@/lib/apiUtils';

const authData = await getUserHeaders(request);

if (!authData) {
  return NextResponse.json(
    { error: 'Authentication required' },
    { status: 401 }
  );
}

const response = await fetch(url, { headers: authData.headers });
EOF

echo ""
echo "📝 Manual update steps:"
echo "1. Replace import statement: auth → getUserHeaders"
echo "2. Replace session check with authData check"
echo "3. Replace headers creation with authData.headers"
echo "4. Remove session logging code"
echo ""
echo "⚠️  Note: Each route needs manual review for context-specific logic"
