// 로그인 후 돌아갈 경로(`next`) 검증.
//
// 검증 없이 redirect 에 넘기면 오픈 리다이렉트가 된다 —
// `?next=https://evil.com` 을 붙인 링크로 사용자를 로그인시킨 뒤 외부로 튕겨낼 수 있다.
// 그래서 "우리 사이트 안의 경로"만 통과시킨다.

/**
 * 내부 경로면 그대로, 아니면 '/' 를 돌려준다.
 * 통과 조건: '/' 로 시작 + '//' 나 '/\' 로 시작하지 않음 + 제어문자 없음.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next) return '/'

  const value = next.trim()
  if (!value.startsWith('/')) return '/'

  // '//host' 와 '/\host' 는 프로토콜 상대 URL 로 해석되어 외부로 나간다.
  if (value.startsWith('//') || value.startsWith('/\\')) return '/'

  // 개행·제어문자는 정상적인 경로에 들어갈 이유가 없다.
  if (/[\x00-\x1f\x7f]/.test(value)) return '/'

  return value
}
