const GONE = new Set(['REMOVED', 'FAILED', 'CRASHED', 'SKIPPED'])

export function rolloutSettled(deployments) {
  const [newest, ...older] = deployments
  if (!newest || newest.status !== 'SUCCESS') return false
  return older.every(deployment => GONE.has(deployment.status))
}
