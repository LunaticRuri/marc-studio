#!/usr/bin/env python3
"""국회도서관 소장자료 KORMARC 표본 수집기.

1단계: 공공데이터포털 「국회 국회도서관_자료검색 서비스」(상세검색 목록조회)로 제어번호 목록을 모은다.
        https://www.data.go.kr/data/15098174/openapi.do  (인증키 필요, 공공누리 1유형)
2단계: 국회도서관 누리집 상세화면의 「MARC 내려받기」(dowloadMARC.do)로 건별 MARCXML을 받는다.
        (로그인 불필요, 레코드 1건당 요청 1회 — 반드시 간격을 두고 소량 표본만 수집할 것)

사용 예
  # 인증키로 목록 수집 + 표본 1,000건 MARCXML 내려받기
  python3 tools/nanet_collect.py --key "$DATA_GO_KR_KEY" --db 일반도서 --years 2015-2024 --target 1000
  # 이미 있는 제어번호 파일로 MARC만 내려받기
  python3 tools/nanet_collect.py --ids ids.txt
결과: .cache/nanet/ids.txt (제어번호\tDB\t발행년), .cache/nanet/records/<제어번호>.xml
다음 단계: python3 tools/marc_stats.py .cache/nanet/records --source nanet
"""
import argparse, os, random, sys, time, urllib.parse, urllib.request, xml.etree.ElementTree as ET

API = 'https://apis.data.go.kr/9720000/searchservice/detail'
MARC = 'https://dl.nanet.go.kr/search/dowloadMARC.do?controlNo='
UA = 'MARC-Studio sample collector (educational, low-rate; https://github.com/LunaticRuri/marc-studio)'
# 상세검색은 검색어가 필수라서 넓은 일반어를 여러 개 돌려 모은다(편의표본). 필요하면 --terms 로 바꾼다.
DEFAULT_TERMS = ['연구', '한국', '사회', '역사', '문학', '경제', '교육', '과학', '문화', '정치', '법', '예술', '환경', '기술', '건강', '철학', '종교', '지역', '세계', '이야기']


_FAILS = 0
def http_get(url, timeout=60):
    """차단·과부하 보호: 403/429/5xx·네트워크 오류는 30s→60s→120s→300s 후 재시도, 연속 실패 5회면 중단(재실행 시 이어짐)."""
    global _FAILS
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': '*/*'})
    for i, wait in enumerate([30, 60, 120, 300, None]):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                _FAILS = 0
                return r.read()
        except Exception as e:
            code = getattr(e, 'code', None)
            if code and 400 <= code < 500 and code not in (403, 408, 429):
                raise
            _FAILS += 1
            if _FAILS >= 5:
                sys.exit('!! 연속 실패 %d회(%s) — 차단/점검 가능성. 잠시 후 같은 명령으로 재실행하면 이어서 진행됩니다.' % (_FAILS, e))
            if wait is None: raise
            print('  ~ 재시도 %d (%s) %ds 대기' % (i + 1, e, wait), file=sys.stderr); time.sleep(wait)


def enc_key(key):
    return key if '%' in key else urllib.parse.quote(key, safe='')


def search_ids(key, db, term, y1, y2, pages, lines=100, delay=0.5):
    """상세검색 목록조회 → [(제어번호, 발행년)]"""
    found = []
    for page in range(1, pages + 1):
        q = {'pageno': page, 'displaylines': lines, 'dbname': db, 'search': '전체항목,' + term}
        if y1: q['option'] = '발행년도,%s|발행년도,%s' % (y1, y2 or y1)
        url = API + '?serviceKey=' + enc_key(key) + '&' + urllib.parse.urlencode(q, quote_via=urllib.parse.quote)
        try:
            raw = http_get(url)
        except Exception as e:
            print('  ! API 오류', db, term, page, e, file=sys.stderr); break
        try:
            root = ET.fromstring(raw)
        except ET.ParseError:
            print('  ! XML 파싱 실패:', raw[:200], file=sys.stderr); break
        recs = root.findall('.//record') + root.findall('.//recode')  # 실제 응답은 <recode>(원문 오타)
        for rec in recs:
            items = {i.findtext('name'): (i.findtext('value') or '').strip() for i in rec.findall('item')}
            cn = items.get('제어번호')
            if cn: found.append((cn, items.get('발행년', '')))
        total = root.findtext('.//total')
        print('  %s / %s / %s-%s p%d: %d건 (총 %s)' % (db, term, y1, y2, page, len(recs), total))
        if len(recs) < lines: break
        time.sleep(delay)
    return found


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--key', default=os.environ.get('DATA_GO_KR_KEY'), help='공공데이터포털 인증키(없으면 --ids 필요)')
    ap.add_argument('--db', action='append', help='dbname (일반도서, 학위논문, 고서 …). 반복 가능. 기본 일반도서')
    ap.add_argument('--years', default='', help='발행년도 범위 예 2015-2024 (연도별로 나눠 수집)')
    ap.add_argument('--terms', help='검색어 목록 파일(한 줄 하나). 기본 내장 20개')
    ap.add_argument('--pages', type=int, default=2, help='검색어·연도별 가져올 페이지 수(100건/페이지)')
    ap.add_argument('--target', type=int, default=500, help='MARC을 내려받을 표본 크기(무작위)')
    ap.add_argument('--ids', help='제어번호 파일(한 줄 하나 또는 탭 구분). 주면 API 생략')
    ap.add_argument('--out', default='.cache/nanet')
    ap.add_argument('--delay', type=float, default=1.0, help='MARC 요청 간격(초)')
    ap.add_argument('--seed', type=int, default=20261101)
    a = ap.parse_args()

    os.makedirs(os.path.join(a.out, 'records'), exist_ok=True)
    ids_path = os.path.join(a.out, 'ids.txt')
    ids = {}
    if os.path.exists(ids_path):
        for line in open(ids_path, encoding='utf-8'):
            p = line.rstrip('\n').split('\t')
            if p[0]: ids[p[0]] = p[1:] + [''] * (2 - len(p[1:]))

    if a.ids:
        for line in open(a.ids, encoding='utf-8'):
            p = line.strip().split('\t')
            if p[0] and not p[0].startswith('#'): ids.setdefault(p[0], (p[1:] + ['', ''])[:2])
    elif a.key:
        dbs = a.db or ['일반도서']
        terms = [t.strip() for t in open(a.terms, encoding='utf-8') if t.strip()] if a.terms else DEFAULT_TERMS
        years = [(None, None)]
        if a.years:
            y1, y2 = [int(x) for x in a.years.split('-')]
            years = [(y, y) for y in range(y1, y2 + 1)]
        for db in dbs:
            for (y1, y2) in years:
                for term in terms:
                    for cn, yr in search_ids(a.key, db, term, y1, y2, a.pages):
                        ids.setdefault(cn, [db, yr or (str(y1) if y1 else '')])
        with open(ids_path, 'w', encoding='utf-8') as f:
            for cn, (db, yr) in sorted(ids.items()): f.write('%s\t%s\t%s\n' % (cn, db, yr))
        print('제어번호 %d건 → %s' % (len(ids), ids_path))
    else:
        sys.exit('인증키(--key 또는 DATA_GO_KR_KEY) 또는 --ids 파일이 필요합니다.')

    have = {fn[:-4] for fn in os.listdir(os.path.join(a.out, 'records')) if fn.endswith('.xml')}
    todo = [cn for cn in ids if cn not in have]
    random.Random(a.seed).shuffle(todo)
    todo = todo[:max(0, a.target - len(have & set(ids)))]
    print('MARC 내려받기: 이미 %d건, 이번에 %d건 (간격 %.1f초)' % (len(have & set(ids)), len(todo), a.delay))
    ok = 0
    for i, cn in enumerate(todo, 1):
        try:
            raw = http_get(MARC + urllib.parse.quote(cn))
            if b'<record>' not in raw:
                print('  ! MARC 없음:', cn, file=sys.stderr); continue
            open(os.path.join(a.out, 'records', cn + '.xml'), 'wb').write(raw); ok += 1
        except Exception as e:
            print('  ! 실패', cn, e, file=sys.stderr)
        if i % 25 == 0: print('  …%d/%d' % (i, len(todo)))
        time.sleep(a.delay)
    print('완료: %d건 저장, 총 %d건 → %s/records' % (ok, len(have) + ok, a.out))


if __name__ == '__main__':
    main()
