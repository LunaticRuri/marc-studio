#!/usr/bin/env python3
"""index.html 의 <link>/<script src> 를 인라인하여 dist/MARC-Studio.html 단일 파일을 만든다.
사용: python3 build.py
"""
import re, pathlib, datetime
root = pathlib.Path(__file__).resolve().parent
html = (root / 'index.html').read_text(encoding='utf-8')
def inline_css(m):
    p = root / m.group(1)
    return '<style>\n' + p.read_text(encoding='utf-8') + '\n</style>'
def inline_js(m):
    p = root / m.group(1)
    src = p.read_text(encoding='utf-8').replace('</script', '<\\/script')
    return '<script>\n/* ' + m.group(1) + ' */\n' + src + '\n</script>'
html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', inline_css, html)
html = re.sub(r'<script src="([^"]+)"></script>', inline_js, html)
html = html.replace('<!-- 개발용 진입점: 배포는 build.py 로 dist/MARC-Studio.html 단일 파일 생성 -->', f'<!-- MARC 스튜디오 단일 파일 빌드 {datetime.date.today().isoformat()} -->')
out = root / 'dist' / 'MARC-Studio.html'
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding='utf-8')
print(f'built {out} ({out.stat().st_size:,} bytes)')
