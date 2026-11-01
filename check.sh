#!/bin/zsh
# 문법·로딩·자체테스트 검사 (node 없는 환경용: macOS 내장 JavaScriptCore = osascript -l JavaScript)
# 사용: ./check.sh
cd "$(dirname "$0")"
TMP=$(mktemp /tmp/ms_check_XXXX.js)
{
  printf '%s\n' 'var window = this; var console = { log: function(){}, warn: function(){}, error: function(){} };'
  printf '%s\n' 'var localStorage = { _d:{}, getItem:function(k){return this._d[k]||null;}, setItem:function(k,v){this._d[k]=String(v);}, removeItem:function(k){delete this._d[k];} };'
  for f in src/data/codes.js src/data/marc21.js src/data/kormarc.js src/data/kormarc-fields2.js src/data/kormarc-auth.js src/data/exercises.js src/data/exercises-auth.js src/data/usage.js src/core/model.js src/core/validate.js src/core/grade.js src/core/describe.js; do
    [ -f "$f" ] && printf '/* ==== %s ==== */\n' "$f" && cat "$f"
  done
  printf '%s\n' 'var out = [];'
  printf '%s\n' 'out.push("MARC21 fields: " + Object.keys(MS.FIELDS.MARC21).length + ", KORMARC fields: " + Object.keys(MS.FIELDS.KORMARC).length + ", exercises: " + MS.EXERCISES.length);'
  printf '%s\n' 'if (MS.TESTS) out.push(MS.TESTS.run());'
  if [ -f src/ui/app.js ]; then
    printf 'var __src = '; python3 -c 'import json,sys; print(json.dumps(open(sys.argv[1], encoding="utf-8").read()))' src/ui/app.js
    printf '%s\n' ';try { new Function(__src); out.push("app.js syntax OK"); } catch (e) { out.push("app.js SYNTAX ERROR: " + e.message); }'
  fi
  printf '%s\n' 'out.join(String.fromCharCode(10));'
} > "$TMP"
osascript -l JavaScript "$TMP" 2>&1 | sed 's/^/  /'
rc=${pipestatus[1]}
rm -f "$TMP"
exit $rc
