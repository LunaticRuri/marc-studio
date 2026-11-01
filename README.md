# MARC 스튜디오

KORMARC(통합서지용·전거통제용)·MARC21 레코드를 **입력·검증**하고, 서지정보를 보고 레코드를 작성하는 **연습**을 할 수 있는 단일 HTML 웹앱입니다. 설치가 필요 없고 오프라인에서 동작합니다.

## 실행
- 웹에서 바로 실행: https://lunaticruri.github.io/marc-studio/ (GitHub Pages, 데이터는 브라우저에 저장됨)
- 단일 파일: https://lunaticruri.github.io/marc-studio/dist/MARC-Studio.html 을 저장해 두면 오프라인에서도 사용 가능
- `dist/MARC-Studio.html` 파일을 브라우저(Chrome, Safari, Edge 등)로 열면 됩니다. 이 파일 하나만 있으면 됩니다.
- 데이터(레코드, 연습 진행 상태, 설정)는 브라우저의 localStorage에 자동 저장됩니다. 다른 컴퓨터로 옮기려면 「설정 → 전체 백업(JSON)」을 사용하세요.

## 기능
| 탭 | 내용 |
|---|---|
| 편집기 | 리더·008 위치별 입력(코드 선택), 가변필드 한 줄 입력(`245 10 ▼a표제 /▼d저자`), 텍스트(브레이커) 보기·붙여넣기, 실시간 검증(오류/경고/참고), 필드 도움말, 가져오기(.txt/.mrk/.mrc/.json)·내보내기(텍스트/.mrc) |
| 연습 | 표제면·판권지 정보 → 레코드 작성 → 채점(필드별 ○△×, 008 위치별, 리더) + 힌트·정답·해설. 내장 문제 KORMARC 10 + MARC21 4. 교재 예제를 직접 문제로 등록 가능 |
| 태그 사전 | 형식별 태그 정의(지시기호·식별기호·구두점), KORMARC ↔ MARC21 차이표 |
| 설정·도움말 | 텍스트 형식, 공백 표시, 검증 옵션, 문자부호, 테마, 백업/복원 |

## 기준 자료
- KORMARC: 국립중앙도서관 「한국문헌자동화목록형식—통합서지용」 2023 개정판(KS X 6006-0) 공개 원문 https://librarian.nl.go.kr/kormarc/KSX6006-0/
- MARC 21: Library of Congress, MARC 21 Format for Bibliographic Data
- 도서(단행본) 중심. 다른 자료유형은 리더·가변필드만 검증(008 위치별 검증은 도서만).

## 개발
```
src/data/   codes.js(코드표) marc21.js kormarc.js kormarc-fields2.js(원문 자동 추출) kormarc-auth.js(전거) exercises.js exercises-auth.js
tools/      gen_kormarc_fields.py(원문→kormarc-fields2.js) nanet_collect.py(국회도서관 MARC 표본 수집) marc_stats.py(→ src/data/usage.js 실무 사용률) add_riss_exercises.py
src/core/   model.js(모델·파서·ISO2709) validate.js(검증) grade.js(채점)
src/ui/     styles.css app.js
index.html  개발용 진입점(src 파일 직접 로드)
build.py    → dist/MARC-Studio.html (단일 파일)
check.sh    문법·자체테스트 (node 없이 macOS osascript 사용)
```
수정 후: `./check.sh` → `python3 build.py`. 설계는 `PLAN.md`, 진행 상황은 `PROGRESS.md`.
