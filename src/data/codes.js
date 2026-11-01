/* MARC 스튜디오 — 코드표 (리더, 008, 발행국, 언어)
 * 출처: KORMARC 통합서지용 2023 개정판(KS X 6006-0, 국립중앙도서관 공개 원문),
 *       MARC 21 Format for Bibliographic Data (Library of Congress)
 * 공백 코드는 ' ' 로 표기한다. '|' 는 채움문자(부호화하지 않음).
 */
window.MS = window.MS || {};
(function () {
  const C = {};

  /* ---------- 리더 ---------- */
  // 각 항목: {pos, len, name, codes:{code:뜻}, fixed:'고정값', auto:true(시스템 생성), desc}
  const LEADER_COMMON_HEAD = [
    { pos: 0, len: 5, name: '레코드 길이', auto: true, desc: '5자리 숫자. 저장 시 시스템이 자동 계산한다.' },
  ];
  const LEADER_COMMON_TAIL = [
    { pos: 10, len: 1, name: '지시기호 자리수', fixed: '2' },
    { pos: 11, len: 1, name: '식별기호 자리수', fixed: '2' },
    { pos: 12, len: 5, name: '데이터 기본번지', auto: true, desc: '5자리 숫자. 저장 시 시스템이 자동 계산한다.' },
  ];

  C.LEADER = {
    KORMARC: [
      ...LEADER_COMMON_HEAD,
      { pos: 5, len: 1, name: '레코드 상태', codes: {
        a: '기존 레코드의 입력수준을 완전수준으로 올린 레코드', c: '수정된 레코드', d: '삭제 레코드',
        n: '신규 레코드', p: 'CIP 레코드를 완전수준으로 올린 레코드' } },
      { pos: 6, len: 1, name: '레코드 유형', codes: {
        a: '문자자료', c: '필사악보 이외의 악보', d: '필사악보', e: '지도자료(구체 포함)', f: '필사지도',
        g: '평면영사자료', i: '녹음자료(음악 이외)', j: '녹음자료(음악)', k: '평면비영사자료', m: '전자자료',
        o: '키트', p: '복합자료', r: '입체자료(실물)', t: '필사문자자료', w: '고서' } },
      { pos: 7, len: 1, name: '서지수준', codes: {
        a: '모본에서 분리된 단행자료 성격의 구성요소', b: '모본에서 분리된 연속간행자료 성격의 구성요소',
        c: '집서(collection)', d: '집서의 하위단위', i: '갱신자료(integrating resources)', m: '단행자료/단일자료', s: '연속간행물' } },
      { pos: 8, len: 1, name: '제어유형', codes: { ' ': '특정 유형이 아님', a: '문서' } },
      { pos: 9, len: 1, name: '문자부호화체계', codes: { ' ': 'KS X 1001', a: 'UCS/Unicode', z: 'KS X 1001, UCS/Unicode 이외의 문자부호' } },
      ...LEADER_COMMON_TAIL,
      { pos: 17, len: 1, name: '입력수준', codes: {
        ' ': '완전수준', '1': '완전수준이나 기존 목록을 근거로 입력한 경우', '2': '중간수준', '3': '간략수준',
        '4': '핵심수준', '5': '예비수준', '7': '최소수준', '8': '발행전수준', u: '미상', z: '적용불가' } },
      { pos: 18, len: 1, name: '목록기술형식', codes: {
        ' ': 'ISBD 형식이 아닌 것', a: 'AACR2', c: 'KCR 3판 이상', i: 'ISBD', k: 'KORMARC 기술규칙',
        n: 'ISBD 형식이 아니며 구두점 생략 (2023 추가)', u: '미상' } },
      { pos: 19, len: 1, name: '다권본 자원의 레코드 수준', codes: {
        ' ': '세분하지 않거나 해당되지 않음', a: '세트(Set)', b: '독립표제를 지닌 부분', c: '종속표제를 지닌 부분' } },
      { pos: 20, len: 1, name: '필드길이의 자리수', fixed: '4' },
      { pos: 21, len: 1, name: '필드시작위치의 자리수', fixed: '5' },
      { pos: 22, len: 1, name: '실행위치의 자리수', fixed: '0' },
      { pos: 23, len: 1, name: '미지정 엔트리 맵', fixed: '0' },
    ],
    MARC21: [
      ...LEADER_COMMON_HEAD,
      { pos: 5, len: 1, name: 'Record status (레코드 상태)', codes: {
        a: 'Increase in encoding level (입력수준 상승)', c: 'Corrected or revised (수정)', d: 'Deleted (삭제)',
        n: 'New (신규)', p: 'Increase in encoding level from prepublication (CIP → 완전수준)' } },
      { pos: 6, len: 1, name: 'Type of record (레코드 유형)', codes: {
        a: 'Language material (문자자료)', c: 'Notated music (악보)', d: 'Manuscript notated music (필사악보)',
        e: 'Cartographic material (지도자료)', f: 'Manuscript cartographic material (필사지도)', g: 'Projected medium (영사자료)',
        i: 'Nonmusical sound recording (비음악 녹음자료)', j: 'Musical sound recording (음악 녹음자료)',
        k: 'Two-dimensional nonprojectable graphic (평면비영사자료)', m: 'Computer file (전자자료)', o: 'Kit (키트)',
        p: 'Mixed materials (복합자료)', r: 'Three-dimensional artifact or naturally occurring object (입체자료)',
        t: 'Manuscript language material (필사문자자료)' } },
      { pos: 7, len: 1, name: 'Bibliographic level (서지수준)', codes: {
        a: 'Monographic component part (단행자료 구성요소)', b: 'Serial component part (연속간행물 구성요소)',
        c: 'Collection (집서)', d: 'Subunit (집서의 하위단위)', i: 'Integrating resource (갱신자료)',
        m: 'Monograph/Item (단행자료)', s: 'Serial (연속간행물)' } },
      { pos: 8, len: 1, name: 'Type of control (제어유형)', codes: { ' ': 'No specified type', a: 'Archival (기록물)' } },
      { pos: 9, len: 1, name: 'Character coding scheme (문자부호화체계)', codes: { ' ': 'MARC-8', a: 'UCS/Unicode' } },
      ...LEADER_COMMON_TAIL,
      { pos: 17, len: 1, name: 'Encoding level (입력수준)', codes: {
        ' ': 'Full level (완전수준)', '1': 'Full level, material not examined', '2': 'Less-than-full level, material not examined',
        '3': 'Abbreviated level (간략수준)', '4': 'Core level (핵심수준)', '5': 'Partial (preliminary) level (예비수준)',
        '7': 'Minimal level (최소수준)', '8': 'Prepublication level (발행전수준, CIP)', u: 'Unknown', z: 'Not applicable' } },
      { pos: 18, len: 1, name: 'Descriptive cataloging form (목록기술형식)', codes: {
        ' ': 'Non-ISBD', a: 'AACR 2', c: 'ISBD punctuation omitted', i: 'ISBD punctuation included',
        n: 'Non-ISBD punctuation omitted', u: 'Unknown' } },
      { pos: 19, len: 1, name: 'Multipart resource record level (다권본 레코드 수준)', codes: {
        ' ': 'Not specified or not applicable', a: 'Set', b: 'Part with independent title', c: 'Part with dependent title' } },
      { pos: 20, len: 1, name: 'Length of the length-of-field portion', fixed: '4' },
      { pos: 21, len: 1, name: 'Length of the starting-character-position portion', fixed: '5' },
      { pos: 22, len: 1, name: 'Length of the implementation-defined portion', fixed: '0' },
      { pos: 23, len: 1, name: 'Undefined', fixed: '0' },
    ],
  };

  C.LEADER['KORMARC-AUTH'] = [
    ...LEADER_COMMON_HEAD,
    { pos: 5, len: 1, name: '레코드 상태', codes: { a: '기존레코드의 입력수준을 완전수준으로 올린 레코드', c: '수정 레코드', d: '삭제 레코드', n: '신규 레코드', o: '더 이상 사용하지 않는 레코드', s: '삭제(2개 이상의 표목으로 세분되어 삭제)', x: '삭제(다른 표목으로 대체되어 삭제)' } },
    { pos: 6, len: 1, name: '레코드 유형', codes: { z: '전거데이터' } },
    { pos: 7, len: 2, name: '미정의', fixed: '  ' },
    { pos: 9, len: 1, name: '문자부호화체계', codes: { ' ': 'KS X 1001', a: 'UCS/Unicode', z: 'KS X 1001, UCS/Unicode 이외의 문자부호' } },
    ...LEADER_COMMON_TAIL,
    { pos: 17, len: 1, name: '입력수준', codes: { n: '완전수준의 전거레코드', o: '불완전수준의 전거레코드' } },
    { pos: 18, len: 1, name: '구두점 정책', codes: { ' ': '제공정보 없음', c: '구두점 생략', i: '구두점 포함', u: '알 수 없음' } },
    { pos: 19, len: 1, name: '미정의', fixed: ' ' },
    { pos: 20, len: 1, name: '필드길이의 자릿수', fixed: '4' },
    { pos: 21, len: 1, name: '필드시작위치의 자릿수', fixed: '5' },
    { pos: 22, len: 1, name: '실행위치의 자릿수', fixed: '0' },
    { pos: 23, len: 1, name: '미지정 엔트리맵의 자릿수', fixed: '0' },
  ];

  /* ---------- 008 ---------- */
  // type: 'date6' | 'year' | 'country' | 'lang' | 'code' | 'multi'(len자리, 각 자리 1코드) | 'free'(검증 생략)
  const DATE_TYPE_KORMARC = {
    b: '기원전 연도', c: '계속 간행되고 있는 간행물', d: '종간된 간행물', e: '상세 발행일',
    i: '수집된 자료의 전체 포괄연도', k: '수집된 자료 중 대다수 자료의 포괄연도', m: '복수연도', n: '발행년불명',
    p: '배포연도/제작연도', q: '추정연도', r: '복제연도/원본연도', s: '단일연도', t: '발행연도/판권연도',
    u: '간행상태를 알 수 없음', '|': '부호화하지 않음' };
  const DATE_TYPE_MARC21 = {
    b: 'No dates given; B.C. date involved', c: 'Continuing resource currently published', d: 'Continuing resource ceased publication',
    e: 'Detailed date', i: 'Inclusive dates of collection', k: 'Range of years of bulk of collection', m: 'Multiple dates',
    n: 'Dates unknown', p: 'Date of distribution/release/issue and production/recording session when different',
    q: 'Questionable date', r: 'Reprint/reissue date and original date', s: 'Single known date/probable date',
    t: 'Publication date and copyright date', u: 'Continuing resource status unknown', '|': 'No attempt to code' };

  const ILLUS_KORMARC = { ' ': '해당 없음', a: '삽화', b: '지도', c: '초상화(또는 인물사진)', d: '도표', e: '설계도', f: '도판',
    g: '악보', h: '영인물', i: '문장(紋章)', j: '계보', k: '서식 및 양식', l: '견본', m: '녹음자료', o: '사진', p: '채색장식', '|': '부호화하지 않음' };
  const ILLUS_MARC21 = { ' ': 'No illustrations', a: 'Illustrations', b: 'Maps', c: 'Portraits', d: 'Charts', e: 'Plans', f: 'Plates',
    g: 'Music', h: 'Facsimiles', i: 'Coats of arms', j: 'Genealogical tables', k: 'Forms', l: 'Samples', m: 'Phonodisc, phonowire, etc.',
    o: 'Photographs', p: 'Illuminations', '|': 'No attempt to code' };

  C.F008 = {
    KORMARC: {
      BK: [
        { pos: 0, len: 6, name: '입력일자', type: 'date6', desc: 'YYMMDD. 최초 입력일. 시스템 자동 생성.' },
        { pos: 6, len: 1, name: '발행년유형', type: 'code', codes: DATE_TYPE_KORMARC },
        { pos: 7, len: 4, name: '발행년 1', type: 'year' },
        { pos: 11, len: 4, name: '발행년 2', type: 'year' },
        { pos: 15, len: 3, name: '발행국명', type: 'country', desc: '한국은 3자리 지역부호(ulk 서울 등), 그 밖의 국가는 2자리 + 빈칸.' },
        { pos: 18, len: 4, name: '삽화표시', type: 'multi', codes: ILLUS_KORMARC, desc: '왼쪽부터 채우고 남는 자리는 빈칸.' },
        { pos: 22, len: 1, name: '이용대상자 수준', type: 'code', codes: { ' ': '일반이용자용', a: '취학전 아동', b: '초등학생', c: '중학생', d: '고등학생', e: '성인용', f: '특수계층', j: '아동용', z: '미상 또는 세분하지 않는 경우', '|': '부호화하지 않음' } },
        { pos: 23, len: 1, name: '개별자료 형태', type: 'code', codes: { ' ': '기타', a: '마이크로필름', b: '마이크로피시', c: '마이크로오패크', d: '큰활자인쇄자료', f: '점자자료', o: '온라인', q: '직접 접근 전자자료', r: '인쇄물 형태로 복제된 자료', s: '전자자료', '|': '부호화하지 않음' } },
        { pos: 24, len: 2, name: '내용형식', type: 'multi', codes: { ' ': '해당 없음', a: '초록', b: '서지', c: '목록', d: '사전', e: '백과사전', f: '편람', g: '법률논문', i: '색인', j: '족보', k: '음반목록', l: '법령집', m: '학위논문', n: '조사보고', o: '평론', p: '프로그램화된 텍스트', q: '영화작품목록', r: '명감', s: '통계자료', t: '기술보고서', u: '표준/표준해설자료', v: '판례 및 판례평석', w: '판결문 및 판결요약', y: '연감', z: '조약, 협정문', '2': '별쇄본', '5': '역서', '6': '만화/그래픽 노블', '|': '부호화하지 않음' }, desc: '2자리. 셋 이상이면 중요한 둘을 알파벳순으로.' },
        { pos: 26, len: 2, name: '한국대학부호', type: 'univ', desc: '대학 간행자료(학위논문 포함)에 영문자 2자리. 해당 없으면 빈칸. (예: AK 서울대, AQ 연세대, AC 고려대)' },
        { pos: 28, len: 1, name: '수정레코드', type: 'code', codes: { ' ': '변형없음', b: '문자를 빈칸으로 입력한 경우', h: '한자를 한글로 입력한 경우', r: '로마자 이외의 문자를 로마자로 입력한 경우', s: '레코드의 단축', x: '한자 이외의 문자를 한글로 변형 입력한 경우', '|': '부호화하지 않음' } },
        { pos: 29, len: 1, name: '회의간행물', type: 'code', codes: { '0': '회의간행물이 아님', '1': '회의간행물임', '|': '부호화하지 않음' } },
        { pos: 30, len: 1, name: '기념논문집', type: 'code', codes: { '0': '기념논문집이 아님', '1': '기념논문집임', '|': '부호화하지 않음' } },
        { pos: 31, len: 1, name: '색인', type: 'code', codes: { '0': '색인이 없음', '1': '색인이 있음', '|': '부호화하지 않음' } },
        { pos: 32, len: 1, name: '목록정보원 (2014판: 목록전거)', type: 'code', codes: { ' ': '국가서지작성기관', a: '자관', c: '협력기관', d: '기타 기관', u: '미상', '|': '부호화하지 않음' } },
        { pos: 33, len: 1, name: '문학형식', type: 'code', codes: { ' ': '해당 없음', d: '희곡 및 시나리오', e: '수필', f: '소설', h: '풍자문학(만화 제외)', i: '서간문학', j: '단편소설(콩트 포함)', k: '추리소설', l: '논픽션(르포, 다큐멘터리 소설 포함)', m: '기행문, 일기문, 수기 등', p: '시', s: '연설문, 웅변관계 저작 포함', t: '논설문', u: '평론', v: '문집', w: '향가, 시조, 가사, 구비문학', '|': '부호화하지 않음' } },
        { pos: 34, len: 1, name: '전기', type: 'code', codes: { ' ': '해당 없음', a: '자서전', b: '개인전기서', c: '전기물의 합저서', d: '전기적 정보가 포함된 자료', '|': '부호화하지 않음' } },
        { pos: 35, len: 3, name: '언어', type: 'lang' },
        { pos: 38, len: 2, name: '한국정부기관부호', type: 'gov', desc: '한국정부기관 발행자료에 기술. 해당 없으면 빈칸.' },
      ],
    },
    MARC21: {
      BK: [
        { pos: 0, len: 6, name: 'Date entered on file (입력일자)', type: 'date6' },
        { pos: 6, len: 1, name: 'Type of date/Publication status (발행년유형)', type: 'code', codes: DATE_TYPE_MARC21 },
        { pos: 7, len: 4, name: 'Date 1 (발행년 1)', type: 'year' },
        { pos: 11, len: 4, name: 'Date 2 (발행년 2)', type: 'year' },
        { pos: 15, len: 3, name: 'Place of publication (발행국)', type: 'country', desc: '2자리 국가부호 + 빈칸 (ko = 대한민국), 미국·캐나다·영국·호주는 3자리 주/지역 부호.' },
        { pos: 18, len: 4, name: 'Illustrations (삽화)', type: 'multi', codes: ILLUS_MARC21 },
        { pos: 22, len: 1, name: 'Target audience (이용대상자)', type: 'code', codes: { ' ': 'Unknown or not specified', a: 'Preschool', b: 'Primary', c: 'Pre-adolescent', d: 'Adolescent', e: 'Adult', f: 'Specialized', g: 'General', j: 'Juvenile', '|': 'No attempt to code' } },
        { pos: 23, len: 1, name: 'Form of item (개별자료 형태)', type: 'code', codes: { ' ': 'None of the following', a: 'Microfilm', b: 'Microfiche', c: 'Microopaque', d: 'Large print', f: 'Braille', o: 'Online', q: 'Direct electronic', r: 'Regular print reproduction', s: 'Electronic', '|': 'No attempt to code' } },
        { pos: 24, len: 4, name: 'Nature of contents (내용형식)', type: 'multi', codes: { ' ': 'No specified nature of contents', a: 'Abstracts/summaries', b: 'Bibliographies', c: 'Catalogs', d: 'Dictionaries', e: 'Encyclopedias', f: 'Handbooks', g: 'Legal articles', i: 'Indexes', j: 'Patent document', k: 'Discographies', l: 'Legislation', m: 'Theses', n: 'Surveys of literature in a subject area', o: 'Reviews', p: 'Programmed texts', q: 'Filmographies', r: 'Directories', s: 'Statistics', t: 'Technical reports', u: 'Standards/specifications', v: 'Legal cases and case notes', w: 'Law reports and digests', y: 'Yearbooks', z: 'Treaties', '2': 'Offprints', '5': 'Calendars', '6': 'Comics/graphic novels', '|': 'No attempt to code' } },
        { pos: 28, len: 1, name: 'Government publication (정부간행물)', type: 'code', codes: { ' ': 'Not a government publication', a: 'Autonomous or semi-autonomous component', c: 'Multilocal', f: 'Federal/national', i: 'International intergovernmental', l: 'Local', m: 'Multistate', o: 'Government publication-level undetermined', s: 'State, provincial, territorial, dependent, etc.', u: 'Unknown if item is government publication', z: 'Other', '|': 'No attempt to code' } },
        { pos: 29, len: 1, name: 'Conference publication (회의간행물)', type: 'code', codes: { '0': 'Not a conference publication', '1': 'Conference publication', '|': 'No attempt to code' } },
        { pos: 30, len: 1, name: 'Festschrift (기념논문집)', type: 'code', codes: { '0': 'Not a festschrift', '1': 'Festschrift', '|': 'No attempt to code' } },
        { pos: 31, len: 1, name: 'Index (색인)', type: 'code', codes: { '0': 'No index', '1': 'Index present', '|': 'No attempt to code' } },
        { pos: 32, len: 1, name: 'Undefined (미정의)', type: 'code', codes: { ' ': 'Undefined', '|': 'No attempt to code' } },
        { pos: 33, len: 1, name: 'Literary form (문학형식)', type: 'code', codes: { '0': 'Not fiction (not further specified)', '1': 'Fiction (not further specified)', d: 'Dramas', e: 'Essays', f: 'Novels', h: 'Humor, satires, etc.', i: 'Letters', j: 'Short stories', m: 'Mixed forms', p: 'Poetry', s: 'Speeches', u: 'Unknown', '|': 'No attempt to code' } },
        { pos: 34, len: 1, name: 'Biography (전기)', type: 'code', codes: { ' ': 'No biographical material', a: 'Autobiography', b: 'Individual biography', c: 'Collective biography', d: 'Contains biographical information', '|': 'No attempt to code' } },
        { pos: 35, len: 3, name: 'Language (언어)', type: 'lang' },
        { pos: 38, len: 1, name: 'Modified record (수정레코드)', type: 'code', codes: { ' ': 'Not modified', d: 'Dashed-on information omitted', o: 'Completely romanized/printed cards romanized', r: 'Completely romanized/printed cards in script', s: 'Shortened', x: 'Missing characters', '|': 'No attempt to code' } },
        { pos: 39, len: 1, name: 'Cataloging source (목록전거)', type: 'code', codes: { ' ': 'National bibliographic agency', c: 'Cooperative cataloging program', d: 'Other', u: 'Unknown', '|': 'No attempt to code' } },
      ],
    },
  };

  const AUTH_THES = { k: '국립중앙도서관 주제명표목표(NLSH)', a: '미국의회도서관 주제명표목표(LCSH)', b: '미국의회도서관 아동문학용 주제명표목표', c: '미국의학주제명표목표(MeSH)', d: '미국국립농학도서관 주제명전거파일', z: '기타', n: '적용불가', '|': '부호화하지 않음' };
  C.F008['KORMARC-AUTH'] = { AUTH: [
    { pos: 0, len: 6, name: '입력일자', type: 'date6' },
    { pos: 6, len: 1, name: '지리구분', type: 'code', codes: { ' ': '지리구분하지 않음', d: '직접 지리구분', i: '간접 지리구분', n: '적용불가', '|': '부호화하지 않음' } },
    { pos: 7, len: 1, name: '로마자 번자체계', type: 'code', codes: { a: '국제표준', b: '국가표준', c: '도서관협회 표준', d: '국가도서관 또는 국가서지기관 표준', e: '로컬 표준', f: '알려지지 않은 표준', g: '목록작성기관의 관행', n: '적용불가', '|': '부호화하지 않음' } },
    { pos: 8, len: 1, name: '미정의', type: 'blank' },
    { pos: 9, len: 1, name: '레코드 종류', type: 'code', codes: { a: '채택표목 레코드', b: '참조표목 레코드(보라부출 없음)', c: '참조표목 레코드(보라부출 있음)', d: '주제세목 레코드', e: '노드레이블 레코드', f: '채택표목/주제세목 레코드', g: '참조표목/주제세목 레코드', '|': '부호화하지 않음' } },
    { pos: 10, len: 1, name: '목록기술규칙', type: 'code', codes: { k: 'KCR2', c: 'AACR2', z: '기타(040 ▼e에 기술)', n: '적용불가', '|': '부호화하지 않음' } },
    { pos: 11, len: 1, name: '주제명표목표/시소러스', type: 'code', codes: AUTH_THES },
    { pos: 12, len: 1, name: '총서 유형', type: 'code', codes: { a: '단행본의 총서명', b: '다권본의 종합표제', c: '유사 총서명', z: '기타', n: '적용불가', '|': '부호화하지 않음' } },
    { pos: 13, len: 1, name: '총서번호 유무', type: 'code', codes: { a: '총서번호 있음', b: '총서번호 없음', c: '총서번호 다양', n: '적용불가', '|': '부호화하지 않음' } },
    { pos: 14, len: 1, name: '표목사용—기본표목/부출표목', type: 'code', codes: { a: '사용가능', b: '사용불가', '|': '부호화하지 않음' } },
    { pos: 15, len: 1, name: '표목사용—주제명부출표목', type: 'code', codes: { a: '사용가능', b: '사용불가', '|': '부호화하지 않음' } },
    { pos: 16, len: 1, name: '표목사용—총서부출표목', type: 'code', codes: { a: '사용가능', b: '사용불가', '|': '부호화하지 않음' } },
    { pos: 17, len: 1, name: '주제세목 유형', type: 'code', codes: { a: '주제세목', b: '형식세목', c: '연대세목', d: '지리세목', e: '언어세목', n: '적용불가', '|': '부호화하지 않음' } },
    { pos: 18, len: 10, name: '미정의', type: 'blank' },
    { pos: 28, len: 1, name: '정부기관 유형', type: 'code', codes: { ' ': '정부기관 아님', a: '기초자치단체', c: '여러 기초자치단체', f: '중앙정부 및 국가', i: '국제정부', l: '광역자치단체', m: '여러 광역자치단체', o: '정부기관이지만 유형 미상', s: '도·주·준주', u: '정부기관인지 알 수 없음', z: '기타', '|': '부호화하지 않음' } },
    { pos: 29, len: 1, name: '참조평가', type: 'code', codes: { a: '부출필드가 표목과 일치함', b: '부출필드가 표목과 일치하지 않음', n: '적용불가', '|': '부호화하지 않음' } },
    { pos: 30, len: 1, name: '미정의', type: 'blank' },
    { pos: 31, len: 1, name: '레코드 갱신', type: 'code', codes: { a: '사용가능 레코드', b: '갱신 중 레코드', '|': '부호화하지 않음' } },
    { pos: 32, len: 1, name: '동명이인', type: 'code', codes: { a: '한 사람만이 사용하는 이름', b: '두 사람 이상이 사용하는 이름', n: '적용불가', '|': '부호화하지 않음' } },
    { pos: 33, len: 1, name: '채택표목 수준', type: 'code', codes: { a: '완전채택표목', b: '미래 사용', c: '미완성', d: '소급전거', n: '적용불가', '|': '부호화하지 않음' } },
    { pos: 34, len: 4, name: '미정의', type: 'blank' },
    { pos: 38, len: 1, name: '수정레코드', type: 'code', codes: { ' ': '수정되지 않은 레코드', s: '단축 레코드', x: '입력하지 못한 문자 있음', '|': '부호화하지 않음' } },
    { pos: 39, len: 1, name: '목록작성기관', type: 'code', codes: { ' ': '국가서지작성기관', c: '협력기관', d: '기타기관', u: '미상', '|': '부호화하지 않음' } },
  ] };

  /* ---------- 발행국 부호 ---------- */
  const KOREA_REGIONS = { ulk: '서울', bnk: '부산', tgk: '대구', ick: '인천', kjk: '광주', tjk: '대전', usk: '울산', sjk: '세종',
    ggk: '경기도', gak: '강원도', hbk: '충청북도', hck: '충청남도', jbk: '전라북도', jnk: '전라남도', gbk: '경상북도', gnk: '경상남도', jjk: '제주도' };
  const COUNTRIES_2 = { us: '미국', ja: '일본', cc: '중국', ch: '대만', uk: '영국', fr: '프랑스', gw: '독일', ru: '러시아', cn: '캐나다(국가 수준)',
    at: '오스트레일리아(국가 수준)', bl: '브라질', ii: '인도', io: '인도네시아', it: '이탈리아', sp: '스페인', ne: '네덜란드', gr: '그리스',
    mx: '멕시코', ag: '아르헨티나', cl: '칠레', sw: '스웨덴', sz: '스위스', au: '오스트리아', be: '벨기에', vm: '베트남', th: '태국',
    ph: '필리핀', si: '싱가포르', my: '말레이시아', nz: '뉴질랜드', dk: '덴마크', no: '노르웨이', pl: '폴란드', is: '이스라엘', ua: '이집트',
    kn: '북한', ko: '대한민국', mp: '몽골', hk: '홍콩', pt: '포르투갈', fi: '핀란드', ie: '아일랜드', tu: '터키', ir: '이란', su: '사우디아라비아',
    xx: '발행지 불명/미상', vp: '여러 곳' };
  // MARC21: 미국 주 등 3자리 부호 일부
  const MARC21_REGIONS = { nyu: 'New York (미국)', cau: 'California (미국)', ilu: 'Illinois (미국)', mau: 'Massachusetts (미국)', dcu: 'District of Columbia (미국)',
    txu: 'Texas (미국)', pau: 'Pennsylvania (미국)', nju: 'New Jersey (미국)', miu: 'Michigan (미국)', ohu: 'Ohio (미국)', wau: 'Washington (미국)',
    mnu: 'Minnesota (미국)', ctu: 'Connecticut (미국)', flu: 'Florida (미국)', mdu: 'Maryland (미국)', inu: 'Indiana (미국)', ncu: 'North Carolina (미국)',
    enk: 'England (영국)', stk: 'Scotland (영국)', wlk: 'Wales (영국)', nik: 'Northern Ireland (영국)',
    onc: 'Ontario (캐나다)', quc: 'Quebec (캐나다)', bcc: 'British Columbia (캐나다)', abc: 'Alberta (캐나다)',
    vra: 'Victoria (호주)', xna: 'New South Wales (호주)', qea: 'Queensland (호주)' };
  C.COUNTRY = {
    KORMARC: Object.assign({}, KOREA_REGIONS, COUNTRIES_2),
    MARC21: Object.assign({}, COUNTRIES_2, MARC21_REGIONS),
  };
  C.KOREA_REGIONS = KOREA_REGIONS;

  /* ---------- 언어 부호 (ISO 639-2 / MARC) ---------- */
  C.LANG = { kor: '한국어', eng: '영어', jpn: '일본어', chi: '중국어', fre: '프랑스어', ger: '독일어', spa: '스페인어', rus: '러시아어',
    ita: '이탈리아어', por: '포르투갈어', ara: '아랍어', lat: '라틴어', grc: '고대 그리스어', gre: '현대 그리스어', dut: '네덜란드어',
    swe: '스웨덴어', nor: '노르웨이어', dan: '덴마크어', fin: '핀란드어', pol: '폴란드어', cze: '체코어', hun: '헝가리어', tur: '터키어',
    heb: '히브리어', per: '페르시아어', hin: '힌디어', san: '산스크리트어', vie: '베트남어', tha: '태국어', ind: '인도네시아어', may: '말레이어',
    mon: '몽골어', tib: '티베트어', ukr: '우크라이나어', rum: '루마니아어', bul: '불가리아어', cat: '카탈루냐어', mul: '복수 언어', sgn: '수화',
    und: '미상', zxx: '언어 콘텐츠 없음', '   ': '해당정보 없음', '|||': '부호화하지 않음' };

  /* ---------- 한국대학부호 (일부) ---------- */
  C.UNIV = { AK: '서울대학교', AQ: '연세대학교', AC: '고려대학교', AL: '성균관대학교', AR: '이화여자대학교', FC: '부산대학교', SC: '경북대학교',
    AT: '중앙대학교', AX: '한양대학교', AB: '경희대학교', AJ: '서강대학교', AN: '숭실대학교', AG: '동국대학교', AA: '건국대학교', AU: '한국외국어대학교' };

  /* ---------- 역할어 (KORMARC 부록 B, 자주 쓰는 것) ---------- */
  C.RELATORS_KO = ['지음', '저', '편', '편저', '엮음', '옮김', '역', '공저', '공역', '글', '그림', '감수', '감역', '편집', '사진', '만화', '해설', '주해', '역주', '구술', '정리'];

  MS.CODES = C;
})();
