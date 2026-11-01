/* MARC 스튜디오 — MARC 21 Bibliographic 필드 정의
 * 출처: MARC 21 Format for Bibliographic Data (LC). 이름은 영문 + (한국어).
 * 표기: rep = 필드 반복 가능. ind = null 이면 미정의(공백이어야 함). sub 의 rep = 식별기호 반복 가능.
 */
window.MS = window.MS || {};
(function () {
  const H = MS.FIELD_HELPERS = {};
  // 'a=Name*|b=Name' → {a:{name,rep:true}, b:{name,rep:false}}
  H.parseSubs = function (spec) {
    const out = {};
    if (!spec) return out;
    spec.split('|').forEach(part => {
      part = part.trim(); if (!part) return;
      const eq = part.indexOf('=');
      const code = part.slice(0, eq).trim();
      let name = part.slice(eq + 1).trim();
      let rep = false;
      if (name.endsWith('*')) { rep = true; name = name.slice(0, -1).trim(); }
      out[code] = { name, rep };
    });
    return out;
  };
  H.CTRL_SUBS = '6=Linkage (대체문자 연결)|8=Field link and sequence number (필드 링크와 일련번호)*';
  // 필드 정의 생성. extra: {punct, required, mandatorySubs:['a'], note, src, obsolete, since, local}
  H.def = function (name, rep, ind1, ind2, subs, extra) {
    const d = Object.assign({ name, rep: !!rep, ind1: ind1 || null, ind2: ind2 || null, sub: H.parseSubs(subs) }, extra || {});
    if (!d.noCtrl) Object.assign(d.sub, H.parseSubs(d.ctrlSubs || H.CTRL_SUBS));
    return d;
  };
  // 이름만 알고 있는 필드(지시기호·식별기호 상세 검증 생략)
  H.nameOnly = function (name, rep, extra) {
    return Object.assign({ name, rep: !!rep, ind1: undefined, ind2: undefined, sub: null, nameOnly: true }, extra || {});
  };
  H.control = function (name, extra) {
    return Object.assign({ name, rep: false, control: true, ind1: null, ind2: null, sub: {} }, extra || {});
  };
  H.clone = function (o) { return JSON.parse(JSON.stringify(o)); };

  const def = H.def, N = H.nameOnly;
  const IND_UNDEF = null;
  const NAME_TYPE = { n: 'Type of personal name entry element (개인명 유형)', c: { '0': 'Forename (성으로 시작하지 않는 이름)', '1': 'Surname (성으로 시작하는 이름)', '3': 'Family name (가계명)' } };
  const CORP_TYPE = { n: 'Type of corporate name entry element (단체명 유형)', c: { '0': 'Inverted name', '1': 'Jurisdiction name (지명으로 시작)', '2': 'Name in direct order (단체명 그대로)' } };
  const NONFILING = { n: 'Nonfiling characters (비배열문자수)', c: { '0': '0', '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9' } };
  const THESAURUS = { n: 'Thesaurus (주제명표/시소러스)', c: { '0': 'Library of Congress Subject Headings (LCSH)', '1': "LC subject headings for children's literature", '2': 'Medical Subject Headings (MeSH)', '3': 'National Agricultural Library subject authority file', '4': 'Source not specified', '5': 'Canadian Subject Headings', '6': 'Répertoire de vedettes-matière', '7': 'Source specified in subfield $2' } };
  const SUBJ_LEVEL = { n: 'Level of subject (주제 수준)', c: { ' ': 'No information provided', '0': 'No level specified', '1': 'Primary', '2': 'Secondary' } };
  const ADDED_TYPE = { n: 'Type of added entry (부출표목 유형)', c: { ' ': 'No information provided', '2': 'Analytical entry (분출표목)' } };
  const PERSON_SUBS = 'a=Personal name (개인명)|b=Numeration (세계)|c=Titles and other words associated with a name (칭호 등)*|d=Dates associated with a name (생몰년)|e=Relator term (역할어)*|f=Date of a work (저작 연도)|g=Miscellaneous information (기타 정보)*|j=Attribution qualifier (속성 한정어)*|k=Form subheading (형식부표목)*|l=Language of a work (저작의 언어)|n=Number of part/section of a work (권차/편차)*|p=Name of part/section of a work (권제/편제)*|q=Fuller form of name (이름의 완전형)|t=Title of a work (저작의 표제)|u=Affiliation (소속)|0=Authority record control number or standard number (전거레코드 제어번호)*|1=Real World Object URI*|2=Source of heading or term (표목의 정보원)|4=Relationship (관계/역할어 부호)*';
  const CORP_SUBS = 'a=Corporate name or jurisdiction name (단체명)|b=Subordinate unit (하위기관)*|c=Location of meeting (회의 장소)*|d=Date of meeting or treaty signing (회의 일자)*|e=Relator term (역할어)*|f=Date of a work|g=Miscellaneous information*|k=Form subheading*|l=Language of a work|n=Number of part/section/meeting*|p=Name of part/section of a work*|t=Title of a work|u=Affiliation|0=Authority record control number*|1=Real World Object URI*|2=Source of heading or term|4=Relationship*';
  const MEET_SUBS = 'a=Meeting name or jurisdiction name (회의명)|c=Location of meeting (회의 장소)*|d=Date of meeting (회의 일자)*|e=Subordinate unit (하위기관)*|f=Date of a work|g=Miscellaneous information*|j=Relator term (역할어)*|k=Form subheading*|l=Language of a work|n=Number of part/section/meeting*|p=Name of part/section of a work*|q=Name of meeting following jurisdiction name|t=Title of a work|u=Affiliation|0=Authority record control number*|1=Real World Object URI*|2=Source of heading or term|4=Relationship*';
  const UT_SUBS = 'a=Uniform title (통일표제)|d=Date of treaty signing*|f=Date of a work|g=Miscellaneous information*|h=Medium (자료유형표시)|k=Form subheading*|l=Language of a work|m=Medium of performance for music*|n=Number of part/section of a work*|o=Arranged statement for music|p=Name of part/section of a work*|r=Key for music|s=Version*|t=Title of a work|0=Authority record control number*|1=Real World Object URI*|2=Source of heading or term';
  const SUBJ_SUBDIV = '|v=Form subdivision (형식세목)*|x=General subdivision (일반세목)*|y=Chronological subdivision (시대세목)*|z=Geographic subdivision (지리세목)*|2=Source of heading or term (주제명표)|3=Materials specified';
  const LINK_SUBS = 'a=Main entry heading (기본표목)|b=Edition (판사항)|c=Qualifying information|d=Place, publisher, and date of publication (발행사항)|g=Related parts*|h=Physical description|i=Relationship information (관계정보)*|k=Series data for related item*|l=Data provenance*|m=Material-specific details|n=Note*|o=Other item identifier*|r=Report number*|s=Uniform title|t=Title (표제)|u=Standard Technical Report Number|w=Record control number (서지레코드 제어번호)*|x=International Standard Serial Number|y=CODEN designation|z=International Standard Book Number*|4=Relationship*|7=Control subfield';
  const LINK_IND1 = { n: 'Note controller (주기 제어)', c: { '0': 'Display note (주기함)', '1': 'Do not display note (주기하지 않음)' } };
  const LINK_IND2 = { n: 'Display constant controller (표출어 제어)', c: { ' ': 'Default display constant', '8': 'No display constant generated' } };
  const LINK_DC = (label) => ({ n: 'Display constant controller (표출어 제어)', c: { ' ': label, '8': 'No display constant generated' } });
  const LINK_SUBS_SERIES = 'a=Main entry heading|b=Edition|c=Qualifying information|d=Place, publisher, and date of publication|g=Related parts*|h=Physical description|i=Relationship information*|l=Data provenance*|m=Material-specific details|n=Note*|o=Other item identifier*|s=Uniform title|t=Title|w=Record control number*|x=International Standard Serial Number|y=CODEN designation|4=Relationship*|7=Control subfield';
  const MUSIC_SUBS = '|h=Medium|m=Medium of performance for music*|o=Arranged statement for music|r=Key for music|s=Version*';
  const SERIES_TAIL = '|v=Volume/sequential designation (권차/순차표시)|w=Bibliographic record control number*|x=ISSN|y=Data provenance*|3=Materials specified|5=Institution to which field applies*|7=Control subfield';
  const SERIES_PERSON = PERSON_SUBS + MUSIC_SUBS + SERIES_TAIL;

  const F = {};
  // ---- 00X 제어필드 ----
  F['001'] = H.control('Control Number (제어번호)');
  F['003'] = H.control('Control Number Identifier (제어번호 식별기호)');
  F['005'] = H.control('Date and Time of Latest Transaction (최종 처리일시)', { pattern: /^\d{14}\.\d$/, patternDesc: 'YYYYMMDDHHMMSS.F (16자)' });
  F['006'] = H.control('Fixed-Length Data Elements—Additional Material Characteristics (부가적 자료특성)', { rep: true, length: 18 });
  F['007'] = H.control('Physical Description Fixed Field (형태기술필드)', { rep: true });
  F['008'] = H.control('Fixed-Length Data Elements (부호화정보필드)', { length: 40, required: true });
  // ---- 01X-09X ----
  F['010'] = def('Library of Congress Control Number (미국의회도서관 제어번호)', false, IND_UNDEF, IND_UNDEF, 'a=LC control number|b=NUCMC control number*|z=Canceled/invalid LC control number*', { ctrlSubs: '8=Field link and sequence number*' });
  F['013'] = N('Patent Control Information (특허제어정보)', true);
  F['015'] = def('National Bibliography Number (국가서지번호)', true, IND_UNDEF, IND_UNDEF, 'a=National bibliography number*|q=Qualifying information*|z=Canceled/invalid number*|2=Source');
  F['016'] = def('National Bibliographic Agency Control Number (국가서지기관 제어번호)', true, { n: 'National bibliographic agency', c: { ' ': 'Library and Archives Canada', '7': 'Source specified in subfield $2' } }, IND_UNDEF, 'a=Record control number|z=Canceled/invalid control number*|2=Source', { ctrlSubs: '8=Field link and sequence number*' });
  F['017'] = N('Copyright or Legal Deposit Number (저작권 등록번호)', true);
  F['018'] = N('Copyright Article-Fee Code (저작권료부호)', false);
  F['020'] = def('International Standard Book Number (국제표준도서번호, ISBN)', true, IND_UNDEF, IND_UNDEF, 'a=International Standard Book Number (ISBN)|c=Terms of availability (입수조건)|q=Qualifying information (부가적 식별정보)*|z=Canceled/invalid ISBN*', { isbn: true, recommended: true });
  F['022'] = def('International Standard Serial Number (국제표준연속간행물번호, ISSN)', true, { n: 'Level of international interest', c: { ' ': 'No level specified', '0': 'Continuing resource of international interest', '1': 'Continuing resource not of international interest' } }, IND_UNDEF, 'a=ISSN|y=Incorrect ISSN*|z=Canceled ISSN*|0=Authority record control number or standard number|1=Real World Object URI*|2=Source', { issn: true, obsoleteSubs: { l: 'ISSN-L (폐기, 023 필드로 이동)', m: 'Canceled ISSN-L (폐기, 023 필드로 이동)' } });
  F['024'] = def('Other Standard Identifier (기타 표준부호)', true, { n: 'Type of standard number or code', c: { '0': 'ISRC', '1': 'UPC', '2': 'ISMN', '3': 'International Article Number (EAN)', '4': 'Serial Item and Contribution Identifier', '7': 'Source specified in subfield $2', '8': 'Unspecified type of standard number or code' } }, { n: 'Difference indicator', c: { ' ': 'No information provided', '0': 'No difference', '1': 'Difference' } }, 'a=Standard number or code|c=Terms of availability|d=Additional codes following the standard number or code|q=Qualifying information*|z=Canceled/invalid standard number or code*|2=Source of number or code');
  F['027'] = N('Standard Technical Report Number (표준기술보고서번호)', true);
  F['028'] = N('Publisher or Distributor Number (발행처번호)', true);
  F['030'] = N('CODEN Designation (코덴부호)', true);
  F['033'] = N('Date/Time and Place of an Event (사건 일시와 장소)', true);
  F['034'] = N('Coded Cartographic Mathematical Data (지도제작의 수치데이터 부호)', true);
  F['035'] = def('System Control Number (협력기관 제어번호)', true, IND_UNDEF, IND_UNDEF, 'a=System control number|z=Canceled/invalid control number*');
  F['037'] = N('Source of Acquisition (입수처)', true);
  F['040'] = def('Cataloging Source (목록작성기관)', false, IND_UNDEF, IND_UNDEF, 'a=Original cataloging agency (최초 목록작성기관)|b=Language of cataloging (목록언어)|c=Transcribing agency (입력기관)|d=Modifying agency (수정기관)*|e=Description conventions (기술규칙)*', { recommended: true });
  F['041'] = def('Language Code (언어부호)', true, { n: 'Translation indication (번역물 표시)', c: { ' ': 'No information provided', '0': 'Item not a translation/does not include a translation (번역물 아님)', '1': 'Item is or includes a translation (번역물)' } }, { n: 'Source of code (부호의 정보원)', c: { ' ': 'MARC language code', '7': 'Source specified in subfield $2' } }, 'a=Language code of text/sound track or separate title (본문언어)*|b=Language code of summary or abstract (요약문 언어)*|d=Language code of sung or spoken text*|e=Language code of librettos*|f=Language code of table of contents*|g=Language code of accompanying material other than librettos*|h=Language code of original (원저작의 언어)*|i=Language code of intertitles*|j=Language code of subtitles*|k=Language code of intermediate translations (중역의 언어)*|m=Language code of original accompanying materials*|n=Language code of original libretto*|p=Language code of captions*|q=Language code of accessible audio*|r=Language code of accessible visual language*|t=Language code of accompanying transcripts*|2=Source of code|3=Materials specified');
  F['042'] = N('Authentication Code (검증부호)', false);
  F['043'] = def('Geographic Area Code (지역부호)', false, IND_UNDEF, IND_UNDEF, 'a=Geographic area code*|b=Local GAC code*|c=ISO code*|0=Authority record control number*|1=Real World Object URI*|2=Source of local code*');
  F['044'] = def('Country of Publishing/Producing Entity Code (발행/제작국명 부호)', false, IND_UNDEF, IND_UNDEF, 'a=MARC country code*|b=Local subentity code*|c=ISO country code*|2=Source of local subentity code*');
  F['045'] = N('Time Period of Content (연대부호)', false);
  F['046'] = N('Special Coded Dates (특별한 연도 부호)', true);
  F['047'] = N('Form of Musical Composition Code (작곡형식부호)', true);
  F['048'] = N('Number of Musical Instruments or Voices Code (악기나 성악부호)', true);
  F['049'] = N('Local Holdings (OCLC 로컬 소장사항)', true, { local: true });
  F['050'] = def('Library of Congress Call Number (미국의회도서관 청구기호)', true, { n: 'Existence in LC collection', c: { ' ': 'No information provided', '0': 'Item is in LC', '1': 'Item is not in LC' } }, { n: 'Source of call number', c: { '0': 'Assigned by LC', '4': 'Assigned by agency other than LC' } }, 'a=Classification number (분류기호)*|b=Item number (도서기호)|0=Authority record control number*|1=Real World Object URI*|3=Materials specified');
  F['052'] = def('Geographic Classification (지리분류기호)', true, { n: 'Code source', c: { ' ': 'Library of Congress Classification', '1': 'U.S. Dept. of Defense Classification', '7': 'Source specified in subfield $2' } }, IND_UNDEF, 'a=Geographic classification area code|b=Geographic classification subarea code*|d=Populated place name*|0=Authority record control number*|1=Real World Object URI*|2=Code source');
  F['055'] = N('Classification Numbers Assigned in Canada (캐나다 분류기호)', true);
  F['060'] = def('National Library of Medicine Call Number (미국국립의학도서관 청구기호)', true, { n: 'Existence in NLM collection', c: { ' ': 'No information provided', '0': 'Item is in NLM', '1': 'Item is not in NLM' } }, { n: 'Source of call number', c: { '0': 'Assigned by NLM', '4': 'Assigned by agency other than NLM' } }, 'a=Classification number*|b=Item number|0=Authority record control number*|1=Real World Object URI*');
  F['066'] = N('Character Sets Present (사용문자세트)', false);
  F['070'] = N('National Agricultural Library Call Number (미국국립농학도서관 청구기호)', true);
  F['072'] = N('Subject Category Code (주제범주부호)', true);
  F['074'] = N('GPO Item Number (정부간행물번호)', true);
  F['080'] = def('Universal Decimal Classification Number (국제십진분류기호, UDC)', true, { n: 'Type of edition', c: { ' ': 'No information provided', '0': 'Full', '1': 'Abridged' } }, IND_UNDEF, 'a=Universal Decimal Classification number|b=Item number|x=Common auxiliary subdivision*|0=Authority record control number*|1=Real World Object URI*|2=Edition identifier');
  F['082'] = def('Dewey Decimal Classification Number (듀이십진분류기호, DDC)', true, { n: 'Type of edition (판의 유형)', c: { '0': 'Full edition (완전판)', '1': 'Abridged edition (간략판)', '7': 'Other edition specified in subfield $2' } }, { n: 'Source of classification number (분류기호 출처)', c: { ' ': 'No information provided', '0': 'Assigned by LC', '4': 'Assigned by agency other than LC' } }, 'a=Classification number (분류기호)*|b=Item number (도서기호)|m=Standard or optional designation (표준규정/임의규정 표시)|q=Assigning agency (부여기관)|0=Authority record control number or standard number*|1=Real World Object URI*|2=Edition information (판표시)');
  F['084'] = def('Other Classification Number (기타 분류기호)', true, IND_UNDEF, IND_UNDEF, 'a=Classification number*|b=Item number|q=Assigning agency|0=Authority record control number*|1=Real World Object URI*|2=Number source');
  F['085'] = N('Synthesized Classification Number Components (합성 분류기호 구성요소)', true);
  F['086'] = N('Government Document Classification Number (정부문서분류기호)', true);
  F['088'] = N('Report Number (보고서번호)', true);
  F['090'] = def('Local Call Number (자관 청구기호, 로컬)', true, undefined, undefined, '', { local: true, anySubs: true, note: 'MARC 21은 090-099를 로컬 정의용으로 비워 둔다. 관행적으로 $a 분류기호, $b 도서기호를 쓴다.' });
  // ---- 1XX ----
  F['100'] = def('Main Entry—Personal Name (기본표목—개인명)', false, NAME_TYPE, IND_UNDEF, PERSON_SUBS, { mainEntry: true });
  F['110'] = def('Main Entry—Corporate Name (기본표목—단체명)', false, CORP_TYPE, IND_UNDEF, CORP_SUBS, { mainEntry: true });
  F['111'] = def('Main Entry—Meeting Name (기본표목—회의명)', false, CORP_TYPE, IND_UNDEF, MEET_SUBS, { mainEntry: true });
  F['130'] = def('Main Entry—Uniform Title (기본표목—통일표제)', false, NONFILING, IND_UNDEF, UT_SUBS, { mainEntry: true });
  // ---- 20X-24X ----
  F['210'] = N('Abbreviated Title (축약표제)', true);
  F['222'] = N('Key Title (등록표제)', true);
  F['240'] = def('Uniform Title (통일표제)', false, { n: 'Uniform title printed or displayed', c: { '0': 'Not printed or displayed', '1': 'Printed or displayed' } }, NONFILING, UT_SUBS.replace('|t=Title of a work', ''));
  F['242'] = N('Translation of Title by Cataloging Agency (목록작성기관에서 번역한 표제)', true);
  F['243'] = N('Collective Uniform Title (종합통일표제)', false);
  F['245'] = def('Title Statement (표제와 책임표시사항)', false,
    { n: 'Title added entry (표제 부출)', c: { '0': 'No added entry (표제 부출 안함)', '1': 'Added entry (표제 부출)' } },
    NONFILING,
    'a=Title (본표제)|b=Remainder of title (표제 관련 정보)|c=Statement of responsibility, etc. (책임표시)|f=Inclusive dates|g=Bulk dates|h=Medium (자료유형표시)|k=Form*|n=Number of part/section of a work (권차/편차)*|p=Name of part/section of a work (권제/편제)*|s=Version|z=Title statement context note',
    { required: true, mandatorySubs: ['a'], punct: { b: [' :', ' ='], c: [' /'], n: ['.'], p: ['.', ','], h: [] }, obsoleteSubs: { d: 'Designation of section (폐기, 1979)', e: 'Name of part/section (폐기, 1979)' } });
  F['246'] = def('Varying Form of Title (여러 형태의 표제)', true,
    { n: 'Note/added entry controller (주기 제어/표제 부출)', c: { '0': 'Note, no added entry (주기함, 부출 안함)', '1': 'Note, added entry (주기함, 부출함)', '2': 'No note, no added entry', '3': 'No note, added entry (주기 안함, 부출함)' } },
    { n: 'Type of title (표제 유형)', c: { ' ': 'No type specified', '0': 'Portion of title (부분표제)', '1': 'Parallel title (대등표제)', '2': 'Distinctive title (식별표제)', '3': 'Other title (기타표제)', '4': 'Cover title (표지표제)', '5': 'Added title page title (부표제지표제)', '6': 'Caption title (권두표제)', '7': 'Running title (난외표제)', '8': 'Spine title (책등표제)' } },
    'a=Title proper/short title (본표제/간략표제)|b=Remainder of title (표제 관련 정보)|f=Date or sequential designation (권·연차표시)|g=Miscellaneous information (기타정보)*|h=Medium (자료유형표시)|i=Display text (설명어구 표시)|n=Number of part/section of a work*|p=Name of part/section of a work*|5=Institution to which field applies');
  F['247'] = N('Former Title (변경전 표제나 표제변동)', true);
  // ---- 250-28X ----
  F['250'] = def('Edition Statement (판사항)', true, IND_UNDEF, IND_UNDEF, 'a=Edition statement (판 표시)|b=Remainder of edition statement (판의 책임표시)|3=Materials specified', { punct: { b: [' /'] } });
  F['254'] = N('Musical Presentation Statement (악보의 표현형식)', false);
  F['255'] = N('Cartographic Mathematical Data (지도제작의 수치데이터)', true);
  F['256'] = N('Computer File Characteristics (컴퓨터파일특성)', false);
  F['257'] = N('Country of Producing Entity (제작국명)', true);
  F['260'] = def('Publication, Distribution, etc. (Imprint) (발행, 배포, 간사사항)', true,
    { n: 'Sequence of publishing statements (발행사항의 순차)', c: { ' ': 'Not applicable/No information provided/Earliest available publisher (최초 발행처)', '2': 'Intervening publisher (중간발행처)', '3': 'Current/latest publisher (현행/최근 발행처)' } },
    IND_UNDEF,
    'a=Place of publication, distribution, etc. (발행지)*|b=Name of publisher, distributor, etc. (발행처)*|c=Date of publication, distribution, etc. (발행년)*|e=Place of manufacture (제작지)*|f=Manufacturer (제작처)*|g=Date of manufacture (제작년)*|3=Materials specified',
    { punct: { b: [' :'], c: [','], f: [' :'], g: [','] }, pubField: true });
  F['263'] = N('Projected Publication Date (발행예정일자)', false);
  F['264'] = def('Production, Publication, Distribution, Manufacture, and Copyright Notice (생산, 발행, 배포, 제작, 저작권표시)', true,
    { n: 'Sequence of statements (순차)', c: { ' ': 'Not applicable/No information provided/Earliest', '2': 'Intervening', '3': 'Current/latest' } },
    { n: 'Function of entity (기능)', c: { '0': 'Production (생산)', '1': 'Publication (발행)', '2': 'Distribution (배포)', '3': 'Manufacture (제작)', '4': 'Copyright notice date (저작권표시연도)' } },
    'a=Place of production, publication, distribution, manufacture (장소)*|b=Name of producer, publisher, distributor, manufacturer (명칭)*|c=Date of production, publication, distribution, manufacture, or copyright notice (연도)*|3=Materials specified',
    { punct: { b: [' :'], c: [','] }, pubField: true });
  F['270'] = N('Address (자료관련주소)', true);
  // ---- 3XX ----
  F['300'] = def('Physical Description (형태사항)', true, IND_UNDEF, IND_UNDEF,
    'a=Extent (특정자료종별과 수량)*|b=Other physical details (기타 물리적 특성)|c=Dimensions (크기)*|e=Accompanying material (딸림자료)|f=Type of unit (단위의 유형)*|g=Size of unit (단위의 크기)*|3=Materials specified',
    { punct: { b: [' :'], c: [' ;'], e: [' +'] }, recommended: true });
  F['306'] = N('Playing Time (재생/연주 시간)', false);
  F['310'] = def('Current Publication Frequency (현재 간행빈도)', true, IND_UNDEF, IND_UNDEF, 'a=Current publication frequency|b=Date of current publication frequency|0=Authority record control number or standard number|1=Real World Object URI*|2=Source');
  F['321'] = N('Former Publication Frequency (이전 간행빈도)', true);
  F['336'] = def('Content Type (내용유형)', true, IND_UNDEF, IND_UNDEF, 'a=Content type term*|b=Content type code*|0=Authority record control number*|1=Real World Object URI*|2=Source|3=Materials specified');
  F['337'] = def('Media Type (매체유형)', true, IND_UNDEF, IND_UNDEF, 'a=Media type term*|b=Media type code*|0=Authority record control number*|1=Real World Object URI*|2=Source|3=Materials specified');
  F['338'] = def('Carrier Type (수록매체 유형)', true, IND_UNDEF, IND_UNDEF, 'a=Carrier type term*|b=Carrier type code*|0=Authority record control number*|1=Real World Object URI*|2=Source|3=Materials specified');
  F['340'] = N('Physical Medium (물리적 매체)', true);
  F['362'] = N('Dates of Publication and/or Sequential Designation (권·연차, 연월차 사항)', true);
  F['365'] = N('Trade Price (판매 가격)', true);
  F['380'] = N('Form of Work (저작의 형식)', true);
  F['385'] = N('Audience Characteristics (이용대상자 특성)', true);
  F['386'] = N('Creator/Contributor Characteristics (창작자/기여자 특성)', true);
  // ---- 4XX ----
  F['440'] = def('Series Statement/Added Entry—Title (총서사항/부출표목—표제) [폐기, 2008]', true, IND_UNDEF, NONFILING, 'a=Title|n=Number of part/section of a work*|p=Name of part/section of a work*|v=Volume/sequential designation|w=Bibliographic record control number*|x=ISSN|0=Authority record control number*', { obsolete: '2008년 폐기. 490 + 8XX(830 등)를 사용한다.' });
  F['490'] = def('Series Statement (총서사항)', true,
    { n: 'Series tracing policy (총서 부출)', c: { '0': 'Series not traced (총서 부출 안함)', '1': 'Series traced differently (8XX로 부출)' } },
    IND_UNDEF,
    'a=Series statement (총서사항)*|l=Library of Congress call number of series|v=Volume/sequential designation (총서번호)*|x=ISSN*|y=Incorrect ISSN*|z=Canceled ISSN*|3=Materials specified',
    { punct: { v: [' ;'], x: [','] } });
  // ---- 5XX ----
  const NOTE_A = (nm) => `a=${nm}|3=Materials specified|5=Institution to which field applies`;
  F['500'] = def('General Note (일반주기)', true, IND_UNDEF, IND_UNDEF, NOTE_A('General note (일반주기)'));
  F['501'] = def('With Note (합철주기)', true, IND_UNDEF, IND_UNDEF, 'a=With note|5=Institution to which field applies');
  F['502'] = def('Dissertation Note (학위논문주기)', true, IND_UNDEF, IND_UNDEF, 'a=Dissertation note|b=Degree type (학위종류)|c=Name of granting institution (수여기관)|d=Year degree granted (학위년도)|g=Miscellaneous information*|o=Dissertation identifier*');
  F['504'] = def('Bibliography, Etc. Note (서지 등 주기)', true, IND_UNDEF, IND_UNDEF, 'a=Bibliography, etc. note|b=Number of references');
  F['505'] = def('Formatted Contents Note (내용주기)', true,
    { n: 'Display constant controller (표출어 제어)', c: { '0': 'Contents (완전한 내용주기)', '1': 'Incomplete contents (불완전한 내용주기)', '2': 'Partial contents (부분 내용주기)', '8': 'No display constant generated' } },
    { n: 'Level of content designation (내용표시의 수준)', c: { ' ': 'Basic (기본형)', '0': 'Enhanced (확장형)' } },
    'a=Formatted contents note (형식화된 내용주기)|g=Miscellaneous information (기타 정보)*|r=Statement of responsibility (책임표시)*|t=Title (표제)*|u=URI*');
  F['506'] = def('Restrictions on Access Note (이용제한주기)', true, { n: 'Restriction', c: { ' ': 'No information provided', '0': 'No restrictions', '1': 'Restrictions apply' } }, IND_UNDEF, 'a=Terms governing access|b=Jurisdiction*|c=Physical access provisions*|d=Authorized users*|e=Authorization*|f=Standardized terminology for access restriction*|g=Availability date*|q=Supplying agency|u=URI*|0=Authority record control number or standard number*|1=Real World Object URI*|2=Source of term|3=Materials specified|5=Institution to which field applies');
  F['508'] = N('Creation/Production Credits Note (제작진 주기)', true);
  F['510'] = N('Citation/References Note (인용/참고 주기)', true);
  F['511'] = N('Participant or Performer Note (연주자와 배역진 주기)', true);
  F['515'] = N('Numbering Peculiarities Note (특수한 권차 표시 주기)', true);
  F['516'] = N('Type of Computer File or Data Note (컴퓨터파일과 데이터유형 주기)', true);
  F['518'] = N('Date/Time and Place of an Event Note (사건 일시 및 장소 주기)', true);
  F['520'] = def('Summary, Etc. (요약 등 주기)', true, { n: 'Display constant controller', c: { ' ': 'Summary (요약)', '0': 'Subject (주제)', '1': 'Review (서평)', '2': 'Scope and content (범위와 내용)', '3': 'Abstract (초록)', '4': 'Content advice (내용 권고)', '8': 'No display constant generated' } }, IND_UNDEF, 'a=Summary, etc.|b=Expansion of summary note|c=Assigning source|u=URI*|2=Source|3=Materials specified');
  F['521'] = def('Target Audience Note (이용대상자주기)', true, { n: 'Display constant controller', c: { ' ': 'Audience', '0': 'Reading grade level', '1': 'Interest age level', '2': 'Interest grade level', '3': 'Special audience characteristics', '4': 'Motivation/interest level', '8': 'No display constant generated' } }, IND_UNDEF, 'a=Target audience note*|b=Source|3=Materials specified');
  F['522'] = N('Geographic Coverage Note (지리적 범위주기)', true);
  F['524'] = N('Preferred Citation of Described Materials Note (인용한 자료에 관한 주기)', true);
  F['525'] = def('Supplement Note (부록주기)', true, IND_UNDEF, IND_UNDEF, 'a=Supplement note', { obsoleteSubs: { z: 'Source of note information (폐기, 1990)' } });
  F['526'] = N('Study Program Information Note (학습프로그램주기)', true);
  F['530'] = def('Additional Physical Form Available Note (이용가능한 다른 형태자료 주기)', true, IND_UNDEF, IND_UNDEF, 'a=Additional physical form available note|b=Availability source|c=Availability conditions|d=Order number|u=URI*|3=Materials specified');
  F['533'] = def('Reproduction Note (복제본 주기)', true, IND_UNDEF, IND_UNDEF, 'a=Type of reproduction|b=Place of reproduction*|c=Agency responsible for reproduction*|d=Date of reproduction|e=Physical description of reproduction|f=Series statement of reproduction*|m=Dates and/or sequential designation of issues reproduced*|n=Note about reproduction*|y=Data provenance*|3=Materials specified|5=Institution to which field applies|7=Fixed-length data elements of reproduction');
  F['534'] = def('Original Version Note (원본주기)', true, IND_UNDEF, IND_UNDEF, 'p=Introductory phrase|a=Main entry of original|b=Edition statement of original|c=Publication, distribution, etc. of original|e=Physical description, etc. of original|f=Series statement of original*|k=Key title of original*|l=Location of original|m=Material specific details|n=Note about original*|o=Other resource identifier*|t=Title statement of original|x=ISSN*|z=ISBN*|3=Materials specified');
  F['536'] = N('Funding Information Note (기금정보 주기)', true);
  F['538'] = def('System Details Note (시스템 사항에 관한 주기)', true, IND_UNDEF, IND_UNDEF, 'a=System details note|i=Display text|u=URI*|3=Materials specified|5=Institution to which field applies*');
  F['540'] = N('Terms Governing Use and Reproduction Note (이용과 복제 제한에 관한 주기)', true);
  F['541'] = N('Immediate Source of Acquisition Note (입수처 주기)', true);
  F['542'] = N('Information Relating to Copyright Status (저작권 관련 정보)', true);
  F['545'] = N('Biographical or Historical Data (전기적 또는 역사적 데이터)', true);
  F['546'] = def('Language Note (언어주기)', true, IND_UNDEF, IND_UNDEF, 'a=Language note|b=Information code or alphabet*|3=Materials specified');
  F['547'] = N('Former Title Complexity Note (변경전 표제 설명 주기)', true);
  F['550'] = N('Issuing Body Note (발행처주기)', true);
  F['555'] = N('Cumulative Index/Finding Aids Note (누적색인/검색도구주기)', true);
  F['561'] = def('Ownership and Custodial History (소유권 및 소장내력 주기)', true, { n: 'Privacy', c: { ' ': 'No information provided', '0': 'Private', '1': 'Not private' } }, IND_UNDEF, 'a=History|u=URI*|3=Materials specified|5=Institution to which field applies');
  F['562'] = N('Copy and Version Identification Note (사본/판본식별 주기)', true);
  F['563'] = N('Binding Information (제본정보 주기)', true);
  F['580'] = def('Linking Entry Complexity Note (연관저록 설명 주기)', true, IND_UNDEF, IND_UNDEF, 'a=Linking entry complexity note|5=Institution to which field applies');
  F['581'] = N('Publications About Described Materials Note (참조정보원 주기)', true);
  F['583'] = N('Action Note (보존처리 주기)', true);
  F['585'] = N('Exhibitions Note (전시 주기)', true);
  F['586'] = def('Awards Note (수상 주기)', true, { n: 'Display constant controller', c: { ' ': 'Awards', '8': 'No display constant generated' } }, IND_UNDEF, 'a=Awards note|3=Materials specified');
  F['588'] = def('Source of Description Note (기술의 정보원 주기)', true, { n: 'Display constant controller', c: { ' ': 'No information provided', '0': 'Source of description', '1': 'Latest issue consulted' } }, IND_UNDEF, 'a=Source of description note|5=Institution to which field applies');
  F['590'] = def('Local Note (로컬 주기)', true, undefined, undefined, '', { local: true, anySubs: true, note: 'MARC 21은 590-599를 로컬 정의용으로 비워 둔다(식별기호 미정의).' });
  // ---- 6XX ----
  F['600'] = def('Subject Added Entry—Personal Name (주제명부출표목—개인명)', true, NAME_TYPE, THESAURUS, PERSON_SUBS + MUSIC_SUBS + SUBJ_SUBDIV);
  F['610'] = def('Subject Added Entry—Corporate Name (주제명부출표목—단체명)', true, CORP_TYPE, THESAURUS, CORP_SUBS + MUSIC_SUBS + SUBJ_SUBDIV);
  F['611'] = def('Subject Added Entry—Meeting Name (주제명부출표목—회의명)', true, CORP_TYPE, THESAURUS, MEET_SUBS + '|h=Medium|s=Version*' + SUBJ_SUBDIV);
  F['630'] = def('Subject Added Entry—Uniform Title (주제명부출표목—통일표제)', true, NONFILING, THESAURUS, UT_SUBS + '|e=Relator term*|4=Relationship*' + SUBJ_SUBDIV);
  F['647'] = N('Subject Added Entry—Named Event (주제명부출표목—사건명)', true);
  F['648'] = def('Subject Added Entry—Chronological Term (주제명부출표목—연대용어)', true, IND_UNDEF, THESAURUS, 'a=Chronological term|e=Relator term*|4=Relationship*|0=Authority record control number*|1=Real World Object URI*' + SUBJ_SUBDIV);
  F['650'] = def('Subject Added Entry—Topical Term (주제명부출표목—일반주제명)', true, SUBJ_LEVEL, THESAURUS,
    'a=Topical term or geographic name entry element (일반주제명)|b=Topical term following geographic name entry element|c=Location of event (사건발생지)|d=Active dates (발생일자)|e=Relator term (역할어)*|g=Miscellaneous information*|0=Authority record control number*|1=Real World Object URI*|4=Relationship*' + SUBJ_SUBDIV);
  F['651'] = def('Subject Added Entry—Geographic Name (주제명부출표목—지명)', true, IND_UNDEF, THESAURUS, 'a=Geographic name (지명)|e=Relator term*|g=Miscellaneous information*|0=Authority record control number*|1=Real World Object URI*|4=Relationship*' + SUBJ_SUBDIV);
  F['653'] = def('Index Term—Uncontrolled (비통제 색인어)', true, SUBJ_LEVEL, { n: 'Type of term or name', c: { ' ': 'No information provided', '0': 'Topical term', '1': 'Personal name', '2': 'Corporate name', '3': 'Meeting name', '4': 'Chronological term', '5': 'Geographic name', '6': 'Genre/form term' } }, 'a=Uncontrolled term (비통제 색인어)*|0=Authority record control number or standard number*|1=Real World Object URI*|5=Institution to which field applies');
  F['654'] = N('Subject Added Entry—Faceted Topical Terms (패싯주제어)', true);
  F['655'] = def('Index Term—Genre/Form (색인어—장르/형식)', true, { n: 'Type of heading', c: { ' ': 'Basic', '0': 'Faceted' } }, THESAURUS, 'a=Genre/form data or focus term (장르/형식)|b=Non-focus term*|c=Facet/hierarchy designation*|0=Authority record control number*|1=Real World Object URI*|5=Institution to which field applies' + SUBJ_SUBDIV);
  F['656'] = N('Index Term—Occupation (색인어—직업)', true);
  F['657'] = N('Index Term—Function (색인어—기능)', true);
  F['658'] = N('Index Term—Curriculum Objective (색인어—교과과정 목표)', true);
  F['662'] = N('Subject Added Entry—Hierarchical Place Name (계층적 지명)', true);
  F['688'] = N('Subject Added Entry—Type of Entity Unspecified (구체화되지 않은 개체의 유형)', true);
  // ---- 70X-75X ----
  F['700'] = def('Added Entry—Personal Name (부출표목—개인명)', true, NAME_TYPE, ADDED_TYPE, PERSON_SUBS + '|h=Medium (자료유형표시)|i=Relationship information (관계정보)*|m=Medium of performance for music*|o=Arranged statement for music|r=Key for music|s=Version*|x=ISSN|3=Materials specified|5=Institution to which field applies');
  F['710'] = def('Added Entry—Corporate Name (부출표목—단체명)', true, CORP_TYPE, ADDED_TYPE, CORP_SUBS + '|h=Medium|i=Relationship information*|m=Medium of performance for music*|o=Arranged statement for music|r=Key for music|s=Version*|x=ISSN|3=Materials specified|5=Institution to which field applies');
  F['711'] = def('Added Entry—Meeting Name (부출표목—회의명)', true, CORP_TYPE, ADDED_TYPE, MEET_SUBS + '|h=Medium|i=Relationship information*|s=Version*|x=ISSN|3=Materials specified|5=Institution to which field applies');
  F['720'] = N('Added Entry—Uncontrolled Name (부출표목—통제되지 않은 이름)', true);
  F['730'] = def('Added Entry—Uniform Title (부출표목—통일표제)', true, NONFILING, ADDED_TYPE, UT_SUBS + '|i=Relationship information*|x=ISSN|3=Materials specified|5=Institution to which field applies');
  F['740'] = def('Added Entry—Uncontrolled Related/Analytical Title (부출표목—비통제 관련/분출 표제)', true, NONFILING, ADDED_TYPE, 'a=Uncontrolled related/analytical title|h=Medium|n=Number of part/section of a work*|p=Name of part/section of a work*|5=Institution to which field applies');
  F['751'] = N('Added Entry—Geographic Name (부출표목—지명)', true);
  F['752'] = N('Added Entry—Hierarchical Place Name (부출표목—계층적 지명)', true);
  F['753'] = N('System Details Access to Computer Files (컴퓨터파일로 접근하는 시스템 세목)', true);
  F['754'] = N('Added Entry—Taxonomic Identification (부출표목—분류학명)', true);
  F['758'] = N('Resource Identifier (자원식별자)', true);
  // ---- 76X-78X ----
  const LINK = (nm) => def(nm, true, LINK_IND1, LINK_IND2, LINK_SUBS);
  F['760'] = def('Main Series Entry (상위총서저록)', true, LINK_IND1, LINK_DC('Main series'), LINK_SUBS_SERIES);
  F['762'] = def('Subseries Entry (하위총서저록)', true, LINK_IND1, LINK_DC('Has subseries'), LINK_SUBS_SERIES);
  F['765'] = def('Original Language Entry (원저저록)', true, LINK_IND1, LINK_DC('Translation of'), LINK_SUBS);
  F['767'] = def('Translation Entry (번역저록)', true, LINK_IND1, LINK_DC('Translated as'), LINK_SUBS);
  F['770'] = def('Supplement/Special Issue Entry (보유판 및 특별호저록)', true, LINK_IND1, LINK_DC('Has supplement'), LINK_SUBS);
  F['772'] = def('Supplement Parent Entry (모체레코드저록)', true, LINK_IND1, { n: 'Display constant controller (표출어 제어)', c: { ' ': 'Supplement to', '0': 'Parent', '8': 'No display constant generated' } }, LINK_SUBS);
  F['773'] = def('Host Item Entry (기본자료저록)', true, LINK_IND1, LINK_DC('In'), LINK_SUBS + '|p=Abbreviated title|q=Enumeration and first page|3=Materials specified|5=Institution to which field applies');
  F['774'] = def('Constituent Unit Entry (구성단위저록)', true, LINK_IND1, LINK_DC('Constituent unit'), LINK_SUBS + '|5=Institution to which field applies');
  F['775'] = def('Other Edition Entry (이판저록)', true, LINK_IND1, LINK_DC('Other edition available'), LINK_SUBS + '|e=Language code|f=Country code');
  F['776'] = def('Additional Physical Form Entry (기타형태저록)', true, LINK_IND1, LINK_DC('Available in another form'), LINK_SUBS);
  F['777'] = def('Issued With Entry (동시발간저록)', true, LINK_IND1, LINK_DC('Issued with'), LINK_SUBS);
  F['780'] = def('Preceding Entry (선행저록)', true, LINK_IND1, { n: 'Type of relationship (관계 유형)', c: { '0': 'Continues (계속)', '1': 'Continues in part (일부 계속)', '2': 'Supersedes (대체)', '3': 'Supersedes in part (일부 대체)', '4': 'Formed by the union of ... and ... (합병)', '5': 'Absorbed (흡수)', '6': 'Absorbed in part (일부 흡수)', '7': 'Separated from (분리)' } }, LINK_SUBS);
  F['785'] = def('Succeeding Entry (후속저록)', true, LINK_IND1, { n: 'Type of relationship (관계 유형)', c: { '0': 'Continued by', '1': 'Continued in part by', '2': 'Superseded by', '3': 'Superseded in part by', '4': 'Absorbed by', '5': 'Absorbed in part by', '6': 'Split into ... and ...', '7': 'Merged with ... to form ...', '8': 'Changed back to' } }, LINK_SUBS);
  F['786'] = def('Data Source Entry (데이터 정보원저록)', true, LINK_IND1, LINK_DC('Data source'), LINK_SUBS + '|j=Period of content|p=Abbreviated title|v=Source Contribution');
  F['787'] = def('Other Relationship Entry (기타관계저록)', true, LINK_IND1, LINK_DC('Related item'), LINK_SUBS + '|5=Institution to which field applies');
  // ---- 80X-830 ----
  F['800'] = def('Series Added Entry—Personal Name (총서부출표목—개인명)', true, NAME_TYPE, IND_UNDEF, SERIES_PERSON);
  F['810'] = def('Series Added Entry—Corporate Name (총서부출표목—단체명)', true, CORP_TYPE, IND_UNDEF, CORP_SUBS + MUSIC_SUBS + SERIES_TAIL);
  F['811'] = def('Series Added Entry—Meeting Name (총서부출표목—회의명)', true, CORP_TYPE, IND_UNDEF, MEET_SUBS + '|h=Medium|s=Version*' + SERIES_TAIL);
  F['830'] = def('Series Added Entry—Uniform Title (총서부출표목—통일표제)', true, IND_UNDEF, NONFILING, UT_SUBS + SERIES_TAIL.replace('|7=Control subfield', '') + '|7=Control subfield', { punct: { v: [' ;'] } });
  // ---- 841-89X ----
  F['850'] = N('Holding Institution (소장기관)', true);
  F['852'] = N('Location (소장위치)', true);
  F['856'] = def('Electronic Location and Access (전자적 위치 및 접속)', true,
    { n: 'Access method (접속방법)', c: { ' ': 'No information provided', '0': 'Email', '1': 'FTP', '2': 'Remote login (Telnet)', '3': 'Dial-up', '4': 'HTTP', '7': 'Method specified in subfield $2' } },
    { n: 'Relationship (관계)', c: { ' ': 'No information provided', '0': 'Resource (자료 자체)', '1': 'Version of resource (자료의 전자적 버전)', '2': 'Related resource (관련 자료)', '3': 'Component part(s) of resource', '4': 'Version of component part(s) of resource', '8': 'No display constant generated' } },
    'a=Host name*|c=Compression information*|d=Path*|e=Data provenance*|f=Electronic name*|g=Persistent identifier*|h=Non-functioning URI*|l=Standardized information governing access*|m=Contact for access assistance*|n=Terms governing access*|o=Operating system|p=Port|q=Electronic format type*|r=Standardized information governing use and reproduction*|s=File size*|t=Terms governing use and reproduction*|u=Uniform Resource Identifier (URI)*|v=Hours access method available*|w=Record control number*|x=Nonpublic note*|y=Link text (링크 텍스트)*|z=Public note (공공주기)*|2=Access method|3=Materials specified|7=Access status');
  F['880'] = def('Alternate Graphic Representation (변형문자표시)', true, undefined, undefined, '', { anySubs: true, note: '연결된 필드(▼6)의 지시기호·식별기호 정의를 따른다.' });
  F['882'] = N('Replacement Record Information (대체 레코드 정보)', false);
  F['883'] = N('Metadata Provenance (메타데이터 출처)', true);
  F['884'] = N('Description Conversion Information (변환 정보)', true);
  F['886'] = N('Foreign MARC Information Field (외국 MARC 정보)', true);
  F['887'] = N('Non-MARC Information Field (MARC 형태가 아닌 정보)', true);
  F['9XX'] = N('Local field (로컬 필드, 자관 정의)', true, { local: true, pattern9: true });

  // $7 Data provenance (R): 2023년 추가. LC 원문에서 확인된 필드에만 둔다.
  ['245', '100', '110', '111', '130', '240', '246', '250', '264', '300', '490', '041', '082', '500', '505', '520', '600', '610', '611', '630', '650', '651', '653', '655', '700', '710', '711', '336', '501', '502', '546', '648', '084'].forEach(t => { if (F[t] && F[t].sub) F[t].sub['7'] = { name: 'Data provenance', rep: true }; });
  // LC MARC 21 Bibliographic 원문 대조 완료 (2026-11-01): 리더, 008(BK), 아래 필드
  ['001', '003', '005', '008', '020', '022', '040', '041', '050', '082', '100', '110', '111', '130', '240', '245', '246', '250', '260', '264', '300', '336', '337', '338', '490', '500', '504', '505', '520', '600', '610', '611', '630', '650', '651', '653', '655', '700', '710', '711', '730', '740', '800', '810', '811', '830', '856', '310', '501', '502', '506', '521', '525', '530', '533', '534', '538', '546', '561', '580', '586', '588', '590', '648', '880', '010', '015', '016', '024', '035', '043', '044', '052', '060', '080', '084', '090', '760', '762', '765', '767', '770', '772', '773', '774', '775', '776', '777', '786', '787', '780', '785'].forEach(t => { if (F[t]) F[t].src = '확인'; });
  MS.FIELDS = MS.FIELDS || {};
  MS.FIELDS.MARC21 = F;
})();
