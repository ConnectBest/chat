#!/usr/bin/env python3

import subprocess
import json
import os
import sys
from datetime import datetime

def run_cmd(cmd):
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10)
        return result.stdout.strip() if result.returncode == 0 else 'unknown'
    except Exception:
        return 'unknown'

def main():
    try:
        # Get git information
        git_commit = run_cmd('git rev-parse HEAD')
        git_short = run_cmd('git rev-parse --short HEAD')
        git_branch = run_cmd('git rev-parse --abbrev-ref HEAD')

        # Get build timestamp
        build_time = datetime.utcnow().isoformat() + 'Z'

        # Get Python version
        python_version = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"

        build_info = {
            'version': '1.0.0',
            'gitCommit': git_commit,
            'gitShort': git_short,
            'gitBranch': git_branch,
            'buildTime': build_time,
            'pythonVersion': python_version
        }

        # Write to current directory so it's accessible at runtime
        output_path = 'build-info.json'
        with open(output_path, 'w') as f:
            json.dump(build_info, f, indent=2)

        print(f'✅ Backend build info generated: {build_info}')
        print(f'📝 Written to: {output_path}')

    except Exception as error:
        print(f'⚠️ Failed to generate backend build info: {error}')

        # Fallback build info
        fallback_info = {
            'version': '1.0.0',
            'gitCommit': os.environ.get('GIT_COMMIT', 'unknown'),
            'gitShort': os.environ.get('GIT_COMMIT_SHORT', 'unknown'),
            'gitBranch': os.environ.get('GIT_BRANCH', 'unknown'),
            'buildTime': datetime.utcnow().isoformat() + 'Z',
            'pythonVersion': f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
        }

        with open('build-info.json', 'w') as f:
            json.dump(fallback_info, f, indent=2)

if __name__ == '__main__':
    main()