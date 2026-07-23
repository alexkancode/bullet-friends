export function inviteCodeFromSearch(search: string): string | undefined {
  const code = new URLSearchParams(search).get('invite')
  return code ? code : undefined
}

export function inviteUrl(pageUrl: string, code: string): string {
  const url = new URL(pageUrl)
  url.searchParams.set('invite', code)
  return url.toString()
}
