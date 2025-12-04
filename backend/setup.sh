#!/bin/bash

# Quick Setup Script for Chat Backend
# This script automates the initial setup process

echo "🚀 Chat Application Backend - Quick Setup"
echo "========================================"
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi

echo "✅ Python found: $(python3 --version)"
echo ""

# Create virtual environment
echo "📦 Creating virtual environment..."
python3 -m venv venv

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "📥 Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Check if MongoDB is running
echo ""
echo "🔍 Checking MongoDB connection..."
if ! command -v mongosh &> /dev/null; then
    echo "⚠️  MongoDB shell (mongosh) not found."
    echo "   Please install MongoDB:"
    echo "   brew install mongodb-community  # macOS"
    echo ""
else
    if mongosh --eval "db.adminCommand('ping')" --quiet &> /dev/null; then
        echo "✅ MongoDB is running"
    else
        echo "⚠️  MongoDB is not running. Starting it..."
        brew services start mongodb-community
        sleep 3
    fi
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo ""
    echo "📝 Creating .env file..."
    cp .env.example .env
    
    # Generate secret keys
    SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
    JWT_SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
    
    # Update .env with generated keys
    sed -i '' "s/your-secret-key-change-this-in-production/$SECRET_KEY/" .env
    sed -i '' "s/your-jwt-secret-key-change-this/$JWT_SECRET_KEY/" .env
    
    echo "✅ .env file created with secure keys"
else
    echo "✅ .env file already exists"
fi

# Initialize database
echo ""
echo "🗄️  Initializing database..."
python3 init_db.py

echo ""
echo "✨ Setup complete!"
echo ""
echo "📚 Next steps:"
echo "   1. Review .env file and adjust settings if needed"
echo "   2. Start the server: python app.py"
echo "   3. Open Swagger UI: http://localhost:5000/docs"
echo "   4. Read LEARNING_GUIDE.md for detailed explanations"
echo ""
echo "🎉 Happy coding!"
