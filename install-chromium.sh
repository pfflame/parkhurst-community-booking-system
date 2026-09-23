#!/bin/bash

# Chromium Installation Script for Qinglong (Debian)
# This script installs Chromium and dependencies for Puppeteer automation

echo "================================================"
echo "🚀 Chromium Installation for Qinglong"
echo "================================================"

# Check if Chromium is already installed
if command -v chromium &> /dev/null; then
    echo "✅ Chromium is already installed"
    chromium --version
    echo "================================================"
    exit 0
fi

echo "📦 Installing Chromium and dependencies..."
echo ""

# Update package list
echo "🔄 Updating package list..."
apt-get update -qq

# Install Chromium and all required dependencies
echo "⬇️  Installing Chromium browser..."
apt-get install -y --no-install-recommends \
    chromium \
    chromium-sandbox \
    fonts-liberation \
    fonts-noto-color-emoji \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libxss1 \
    xdg-utils \
    ca-certificates

# Clean up to save space
echo "🧹 Cleaning up..."
apt-get clean
rm -rf /var/lib/apt/lists/*

echo ""
echo "================================================"
echo "✅ Chromium installation completed successfully!"
echo "================================================"
echo ""
echo "📍 Chromium location: /usr/bin/chromium"
chromium --version
echo ""
echo "💡 Next steps:"
echo "   1. Add environment variable in Qinglong:"
echo "      PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium"
echo "   2. Your booking scripts will now work!"
echo "================================================"
