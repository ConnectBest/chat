#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
  // Get git commit hash
  const gitCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  const gitShort = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();

  // Get git branch
  const gitBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();

  // Get build timestamp
  const buildTime = new Date().toISOString();

  // Get version from package.json
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const version = packageJson.version;

  const buildInfo = {
    version,
    gitCommit,
    gitShort,
    gitBranch,
    buildTime,
    nodeVersion: process.version
  };

  // Write to public directory so it's accessible at runtime
  const outputPath = path.join(__dirname, '..', 'public', 'build-info.json');
  fs.writeFileSync(outputPath, JSON.stringify(buildInfo, null, 2));

  console.log('✅ Build info generated:', buildInfo);
  console.log('📝 Written to:', outputPath);
} catch (error) {
  console.warn('⚠️  Failed to generate build info:', error.message);

  // Fallback build info
  const fallbackInfo = {
    version: '0.1.0',
    gitCommit: 'unknown',
    gitShort: 'unknown',
    gitBranch: 'unknown',
    buildTime: new Date().toISOString(),
    nodeVersion: process.version
  };

  const outputPath = path.join(__dirname, '..', 'public', 'build-info.json');
  fs.writeFileSync(outputPath, JSON.stringify(fallbackInfo, null, 2));
}