import { execFileSync } from 'node:child_process';

export function buildRevision() {
  if (process.env.AF_REVISION) return process.env.AF_REVISION;
  const git = (args: string[]) => execFileSync('git', args, {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true,
  }).trim();
  try {
    const revision = git(['rev-parse', '--verify', 'HEAD']);
    return git(['status', '--porcelain', '--untracked-files=normal'])
      ? revision + '-dirty'
      : revision;
  } catch {
    return 'local';
  }
}
