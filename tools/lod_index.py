#!/usr/bin/env python3
"""국립중앙도서관 국가서지 LOD JSON-LD 덤프(lod_data/)에서 서지 식별자 목록을 뽑는다 (스트리밍, 메모리 적게).
출력 TSV: 제어번호(@id 끝)\t발행년\tISBN(첫 번째)\t자료유형(dt_*)\t국회도서관 sameAs(NANET_BOK_*)
사용: python3 tools/lod_index.py lod_data/book_json_20261008 > .cache/lod_index.tsv
"""
import os, re, sys
R_ID = re.compile(r'"@id"\s*:\s*"http://lod\.nl\.go\.kr/resource/([A-Z]{3}\d+)"')
R_YEAR = re.compile(r'"issuedYear"\s*:\s*"(\d{4})')
R_ISBN = re.compile(r'"isbn"\s*:\s*\[?\s*"([0-9Xx-]+)')
R_TYPE = re.compile(r'"typeOfData"\s*:\s*"http://lod\.nl\.go\.kr/resource/(dt_\w+)"')
R_NANET = re.compile(r'data\.nanet\.go\.kr/resource/(NANET_BOK_\d+)')
def main():
    root = sys.argv[1]
    files = sorted(os.path.join(root, f) for f in os.listdir(root) if f.endswith('.json'))
    out = sys.stdout
    for path in files:
        cur = None; info = {}
        n = 0
        with open(path, encoding='utf-8', errors='replace') as fh:
            for line in fh:
                m = R_ID.search(line)
                if m and line.lstrip().startswith('"@id"'):
                    if cur: out.write('%s\t%s\t%s\t%s\t%s\n' % (cur, info.get('y',''), info.get('i',''), info.get('t',''), info.get('n',''))); n += 1
                    cur = m.group(1); info = {}; continue
                if not cur: continue
                m = R_YEAR.search(line)
                if m: info['y'] = m.group(1); continue
                m = R_ISBN.search(line)
                if m and line.lstrip().startswith('"isbn"'): info['i'] = m.group(1); continue
                m = R_TYPE.search(line)
                if m: info['t'] = m.group(1); continue
                m = R_NANET.search(line)
                if m: info['n'] = m.group(1)
        if cur: out.write('%s\t%s\t%s\t%s\t%s\n' % (cur, info.get('y',''), info.get('i',''), info.get('t',''), info.get('n',''))); n += 1
        print('%s: %d' % (os.path.basename(path), n), file=sys.stderr)
if __name__ == '__main__': main()
