-- 0003_seed.sql — 실습용 시드 상품 (판매자 3명 / 상품 14개). 여러 번 실행해도 중복되지 않는다.

-- ══════════════════════════════════════════════════════════════
-- ★ 사람이 직접 해야 하는 일 (이 파일을 실행하기 전에)
--
--   1. 앱(/signup)에서 "판매자로 가입"으로 계정 3개를 만든다.
--        seller-a@example.com  스토어명: 하루상점
--        seller-b@example.com  스토어명: 목요일공방
--        seller-c@example.com  스토어명: 늘펴는책상
--   2. Supabase 대시보드 → SQL Editor 에서 uuid 를 확인한다.
--        select id, email from auth.users order by created_at;
--   3. 아래 seller_a / seller_b / seller_c 의 '00000000-...' 자리에 그 uuid 를 붙여넣는다.
--   4. 이 파일 전체를 SQL Editor 에 붙여넣고 실행한다.
--
--   uuid 를 채우지 않은 상태로 실행해도 문법 오류는 나지 않는다.
--   "계정이 없다"는 안내(NOTICE)만 남기고 아무것도 넣지 않는다.
-- ══════════════════════════════════════════════════════════════

do $$
declare
  -- ↓↓↓ 여기 세 줄만 고친다 ↓↓↓
  seller_a uuid := '00000000-0000-0000-0000-000000000000';  -- 하루상점
  seller_b uuid := '00000000-0000-0000-0000-000000000000';  -- 목요일공방
  seller_c uuid := '00000000-0000-0000-0000-000000000000';  -- 늘펴는책상
  -- ↑↑↑ 여기 세 줄만 고친다 ↑↑↑
begin
  if not exists (select 1 from auth.users u where u.id = seller_a)
     or not exists (select 1 from auth.users u where u.id = seller_b)
     or not exists (select 1 from auth.users u where u.id = seller_c)
  then
    raise notice '[시드 건너뜀] 판매자 계정 uuid 가 채워지지 않았거나 auth.users 에 없다.';
    raise notice '  → 앱에서 판매자 3명을 가입시키고, 이 파일 상단 안내대로 uuid 를 채운 뒤 다시 실행하라.';
    return;
  end if;

  -- 스토어명 보강: 가입 시 store_name 을 넣지 않았다면 여기서 채워진다.
  -- 이미 있으면 건드리지 않는다 (판매자가 직접 정한 이름이 우선).
  insert into public.seller_profiles (id, store_name) values
    (seller_a, '하루상점'),
    (seller_b, '목요일공방'),
    (seller_c, '늘펴는책상')
  on conflict (id) do nothing;

  -- 상품 14개 / 카테고리 4종(의류·주방·문구·가전)
  -- 일부는 stock = 0 (품절 표시 확인용), 일부는 배송비 무료 임계값 50,000원 근처 가격이다.
  insert into public.products (id, seller_id, name, description, price, image_url, category, stock) values
    -- 하루상점 — 의류
    ('11111111-1111-4111-8111-000000000001', seller_a, '무지 반팔 티셔츠',
     '두껍게 짠 면 원단. 세탁 후에도 목이 늘어나지 않는다.',
     18000, 'https://picsum.photos/seed/shopmate-a1/600/600', '의류', 24),
    ('11111111-1111-4111-8111-000000000002', seller_a, '워시드 데님 팬츠',
     '한 번 물세탁한 원단이라 처음부터 뻣뻣하지 않다.',
     49000, 'https://picsum.photos/seed/shopmate-a2/600/600', '의류', 8),
    ('11111111-1111-4111-8111-000000000003', seller_a, '오버핏 셔츠 자켓',
     '봄가을 겉옷 한 벌. 셔츠처럼 입고 자켓처럼 걸친다.',
     52000, 'https://picsum.photos/seed/shopmate-a3/600/600', '의류', 5),
    ('11111111-1111-4111-8111-000000000004', seller_a, '리브 니트 가디건',
     '단추 다섯 개. 소매 끝단을 두 번 접어 입도록 넉넉하게 뺐다.',
     46000, 'https://picsum.photos/seed/shopmate-a4/600/600', '의류', 0),
    ('11111111-1111-4111-8111-000000000005', seller_a, '코튼 발목 양말 5팩',
     '색이 다른 다섯 켤레. 발목 밴드가 조이지 않는다.',
     12000, 'https://picsum.photos/seed/shopmate-a5/600/600', '의류', 60),

    -- 목요일공방 — 주방
    ('22222222-2222-4222-8222-000000000001', seller_b, '무쇠 미니 팬 18cm',
     '1인분 요리에 맞춘 크기. 길들일수록 검게 잡힌다.',
     38000, 'https://picsum.photos/seed/shopmate-b1/600/600', '주방', 12),
    ('22222222-2222-4222-8222-000000000002', seller_b, '유리 보관용기 3종 세트',
     '전자레인지·오븐 모두 사용 가능. 뚜껑만 따로 살 수 있다.',
     29000, 'https://picsum.photos/seed/shopmate-b2/600/600', '주방', 18),
    ('22222222-2222-4222-8222-000000000003', seller_b, '원목 도마 대형',
     '너도밤나무 한 판. 칼자국이 나도 사포로 정리하면 다시 쓴다.',
     48000, 'https://picsum.photos/seed/shopmate-b3/600/600', '주방', 4),
    ('22222222-2222-4222-8222-000000000004', seller_b, '핸드드립 세트',
     '드리퍼·서버·계량스푼. 필터는 포함되지 않는다.',
     54000, 'https://picsum.photos/seed/shopmate-b4/600/600', '주방', 7),
    ('22222222-2222-4222-8222-000000000005', seller_b, '스테인리스 계량컵',
     '눈금이 새겨져 있어 지워지지 않는다.',
     9500, 'https://picsum.photos/seed/shopmate-b5/600/600', '주방', 0),

    -- 늘펴는책상 — 문구 · 가전
    ('33333333-3333-4333-8333-000000000001', seller_c, '양장 노트 A5 무지',
     '180도로 펴진다. 만년필 잉크가 뒷장에 비치지 않는다.',
     14000, 'https://picsum.photos/seed/shopmate-c1/600/600', '문구', 40),
    ('33333333-3333-4333-8333-000000000002', seller_c, '블랙 젤펜 0.5 10자루',
     '리필심 호환. 필기 중 끊김이 적은 심을 골랐다.',
     11000, 'https://picsum.photos/seed/shopmate-c2/600/600', '문구', 100),
    ('33333333-3333-4333-8333-000000000003', seller_c, '원목 데스크 오거나이저',
     '펜·메모지·케이블을 한 자리에. 서랍 한 칸이 있다.',
     47000, 'https://picsum.photos/seed/shopmate-c3/600/600', '문구', 6),
    ('33333333-3333-4333-8333-000000000004', seller_c, '무소음 탁상 스탠드',
     '3단계 밝기. 팬이 없어 소리가 나지 않는다.',
     51000, 'https://picsum.photos/seed/shopmate-c4/600/600', '가전', 9)
  on conflict (id) do nothing;

  raise notice '[시드 완료] 판매자 3명 / 상품 14개를 넣었다 (이미 있으면 건너뛴다).';
end;
$$;
