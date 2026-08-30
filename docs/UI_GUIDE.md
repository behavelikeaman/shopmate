# UI 디자인 가이드

## 디자인 원칙
1. **상품이 주인공이다.** UI는 상품 사진과 가격을 위해 물러선다. 장식적인 배경·테두리·그림자를 더하지 않는다.
2. **가격과 재고는 항상 명확하다.** 최종 결제 금액이 어디서 왔는지 화면에서 셀 수 있어야 한다. 배송비·수량·소계를 숨기지 않는다.
3. **세일 배너로 도배된 쇼핑몰이 아니라 정돈된 카탈로그.** 긴급함을 연출하는 빨간 카운트다운, 흔들리는 뱃지 금지.

## AI 슬롭 안티패턴 — 하지 마라
| 금지 사항 | 이유 |
|-----------|------|
| backdrop-filter: blur() | glass morphism은 AI 템플릿의 가장 흔한 징후 |
| gradient-text (배경 그라데이션 텍스트) | AI가 만든 SaaS 랜딩의 1번 특징 |
| "Powered by AI" 배지 | 기능이 아니라 장식. 사용자에게 가치 없음 |
| box-shadow 글로우 애니메이션 | 네온 글로우 = AI 슬롭 |
| 보라/인디고 브랜드 색상 | "AI = 보라색" 클리셰 |
| 모든 카드에 동일한 rounded-2xl | 균일한 둥근 모서리는 템플릿 느낌 |
| 배경 gradient orb (blur-3xl 원형) | 모든 AI 랜딩 페이지에 있는 장식 |
| 이모지 아이콘 (🛒 💳 ✨) | 커머스 UI에서 싸구려로 보인다. SVG를 쓴다 |

## 색상
라이트 모드 고정. 포인트 색은 **딱 하나** — 구매 행동(장바구니 담기, 주문하기)에만 쓴다.

### 배경
| 용도 | 값 |
|------|------|
| 페이지 | `#ffffff` |
| 카드 / 섹션 | `#fafafa` (`bg-neutral-50`) |
| 이미지 플레이스홀더 | `#f5f5f5` (`bg-neutral-100`) |

### 텍스트
| 용도 | 값 |
|------|------|
| 제목 | `text-neutral-900` |
| 본문 | `text-neutral-700` |
| 보조 (카테고리, 메타) | `text-neutral-500` |
| 비활성 / 품절 | `text-neutral-400` |

### 테두리
| 용도 | 값 |
|------|------|
| 기본 | `border-neutral-200` |
| 강조 (선택된 항목) | `border-neutral-900` |

### 포인트 · 시맨틱
| 용도 | 값 |
|------|------|
| 포인트 (구매 CTA) | `#0f766e` (teal-700) |
| 성공 / 주문 완료 | `#15803d` (green-700) |
| 에러 / 재고 부족 | `#b91c1c` (red-700) |
| 품절 뱃지 | `bg-neutral-200 text-neutral-500` |

## 컴포넌트
### 상품 카드
```
group rounded-md border border-neutral-200 bg-white overflow-hidden hover:border-neutral-400 transition-colors
이미지: aspect-square object-cover bg-neutral-100
본문: p-3 space-y-1
```

### 버튼
```
Primary:   rounded-md bg-[#0f766e] text-white px-4 py-2.5 text-sm font-medium hover:bg-[#115e59] disabled:bg-neutral-300
Secondary: rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm hover:bg-neutral-50
Text:      text-sm text-neutral-500 hover:text-neutral-900 underline-offset-4 hover:underline
Danger:    text-sm text-[#b91c1c] hover:underline
```

### 입력 필드
```
rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none
```

### 수량 스테퍼
```
inline-flex items-center rounded-md border border-neutral-300
버튼: w-8 h-8 text-neutral-600 hover:bg-neutral-50 disabled:text-neutral-300
숫자: w-10 text-center text-sm tabular-nums
```

### 가격 표기
```
현재가:   text-neutral-900 font-medium tabular-nums
합계:     text-lg font-semibold tabular-nums
소계/배송: text-sm text-neutral-500 tabular-nums
```
숫자는 항상 `tabular-nums`. 자릿수가 흔들리면 합계가 못 미더워 보인다.

## 레이아웃
- 전체 너비: `max-w-6xl mx-auto px-4` (상품 목록), `max-w-3xl` (장바구니·체크아웃·주문내역)
- 상품 그리드: `grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4`
- 정렬: 좌측 정렬 기본. 중앙 정렬은 빈 상태(장바구니 비었음) 화면에만.
- 간격: 섹션 간 `space-y-8`, 폼 필드 간 `space-y-4`

## 타이포그래피
| 용도 | 스타일 |
|------|--------|
| 페이지 제목 | `text-2xl font-semibold text-neutral-900` |
| 섹션 제목 | `text-sm font-medium text-neutral-500 uppercase tracking-wide` |
| 상품명 (카드) | `text-sm text-neutral-900 line-clamp-2` |
| 상품명 (상세) | `text-xl font-semibold text-neutral-900` |
| 본문 | `text-sm text-neutral-700 leading-relaxed` |

## 애니메이션
- `transition-colors` (150ms) — 호버 상태 변화에만.
- 그 외 모든 애니메이션 금지. 특히 페이지 진입 시 요소가 순차적으로 나타나는 stagger 효과 금지.

## 아이콘
- SVG 인라인, `strokeWidth 1.5`, `w-4 h-4` 또는 `w-5 h-5`.
- 아이콘 컨테이너(둥근 배경 박스)로 감싸지 않는다.
- 아이콘 라이브러리를 새로 설치하지 않는다. 필요한 3~4개(장바구니, 검색, 닫기, 체크)만 직접 그린다.

## 빈 상태 / 에러
- 빈 장바구니: 중앙 정렬, 한 줄 설명 + "쇼핑 계속하기" Secondary 버튼. 일러스트 금지.
- 에러: 빨간 배경 박스가 아니라 `text-[#b91c1c]` 한 줄 + 재시도 수단.
- 로딩: 스켈레톤(`bg-neutral-100` 블록)만. 스피너 금지.
