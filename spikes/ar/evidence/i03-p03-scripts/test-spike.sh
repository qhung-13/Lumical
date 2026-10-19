#!/usr/bin/env bash
# ============================================================
#  I03-P03 — Test harness của MEMBER_3 trước khi test điện thoại
#
#  Chạy: server spike phải đang mở ở terminal khác
#        ./start-spike.sh
# ============================================================

TA="devtokenA123456789"
TB="devtokenB123456789"
U="http://127.0.0.1:8787"

# I03-P04 đổi identity sang FULL SHA-256 → lấy artifactId ĐỘNG từ session API
# (tránh hard-code ID như trước, dẫn đến 3 fail giả khi contract đổi)
sess() { curl -s -H "Authorization: Bearer $1" $U/api/spike/session; }
ART_A=$(sess "$TA" | jq -r '.version.artifactId')
ART_B=$(sess "$TB" | jq -r '.version.artifactId')
ART_C=$(sess "$TA" | jq -r '.combined.artifactId')
if [ -z "$ART_A" ] || [ "$ART_A" = "null" ]; then
  echo "❌ Không lấy được artifactId — server spike có đang chạy ở $U không?"; exit 1
fi
echo "  artifactId A : $ART_A"
echo "  artifactId B : $ART_B"
echo "  combined     : $ART_C"

PASS=0; FAIL=0
chk() { # chk "mô tả" "kết quả" "kỳ vọng"
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); printf "  \033[32m✅\033[0m %-52s %s\n" "$1" "$2"
  else FAIL=$((FAIL+1)); printf "  \033[31m❌\033[0m %-52s %s (cần %s)\n" "$1" "$2" "$3"; fi
}
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
postcode() { curl -s -o /dev/null -w '%{http_code}' -X POST -H "Authorization: Bearer $1" -H 'Content-Type: application/json' -d "$2" "$U/api/spike/reveal"; }

echo "════════════════════════════════════════════════════════"
echo " I03-P02/P03 — HARNESS SELF-TEST"
echo "════════════════════════════════════════════════════════"

echo
echo "── A. Server có sống không ──"
chk "GET /healthz"                        "$(code $U/healthz)"                                   "200"
chk "GET / (trang index)"                 "$(code $U/)"                                          "200"
chk "GET /fallback (không camera)"        "$(code $U/fallback)"                                  "200"

echo
echo "── B. Session: mỗi token thấy đúng phiên của mình ──"
chk "Session A (token A)"                 "$(code -H "Authorization: Bearer $TA" $U/api/spike/session)" "200"
chk "Session B (token B)"                 "$(code -H "Authorization: Bearer $TB" $U/api/spike/session)" "200"
chk "Session KHÔNG token → 404"           "$(code $U/api/spike/session)"                          "404"
chk "Session token SAI → 404"             "$(code -H "Authorization: Bearer WRONGTOKEN0000" $U/api/spike/session)" "404"

echo
echo "── C. ⭐ REVEAL: nhận diện ≠ cho phép ──"
chk "[1] A + artifactA + idx0 (ĐÚNG)"     "$(postcode $TA "{\"artifactId\":\"$ART_A\",\"targetIndex\":0}")" "200"
chk "[2] A + artifactB (SAI PHIÊN)"       "$(postcode $TA "{\"artifactId\":\"$ART_B\",\"targetIndex\":0}")" "404"
chk "[3] ⭐A + combined + idx1 (B)"       "$(postcode $TA "{\"artifactId\":\"$ART_C\",\"targetIndex\":1}")" "404"
chk "[4] A + combined + idx0 (A)"         "$(postcode $TA "{\"artifactId\":\"$ART_C\",\"targetIndex\":0}")" "200"
chk "[5] A + artifactA + idx1 (SAI IDX)"  "$(postcode $TA "{\"artifactId\":\"$ART_A\",\"targetIndex\":1}")" "404"
chk "[6] A + KHÔNG token"                 "$(postcode "" "{\"artifactId\":\"$ART_A\",\"targetIndex\":0}")" "404"
chk "[7] A + idx là string (sai kiểu)"    "$(postcode $TA "{\"artifactId\":\"$ART_A\",\"targetIndex\":\"0\"}")" "404"
chk "[8] A + null body"                   "$(postcode $TA "null")"                                "404"

echo
echo "── D. Artifact download bị chặn theo phiên ──"
chk "A token + artifactA"                 "$(code -H "Authorization: Bearer $TA" $U/api/spike/artifacts/$ART_A)" "200"
chk "❌ B token + artifactA"              "$(code -H "Authorization: Bearer $TB" $U/api/spike/artifacts/$ART_A)" "404"
chk "❌ A token + artifactB"              "$(code -H "Authorization: Bearer $TA" $U/api/spike/artifacts/$ART_B)" "404"
chk "NO token + artifactA"                "$(code $U/api/spike/artifacts/$ART_A)"                  "404"

echo
echo "── E. File private KHÔNG lộ ra static ──"
chk "❌ /artifacts/<file>.mind static"    "$(code $U/artifacts/$ART_A.mind)"                      "404"
chk "❌ /fixtures/.../version-a.png"      "$(code $U/fixtures/targets/version-a.png)"             "404"
chk "❌ /src/server.mjs"                  "$(code $U/src/server.mjs)"                             "404"
chk "❌ /package.json"                    "$(code $U/package.json)"                               "404"
chk "❌ vendor/../../../src/server.mjs"   "$(code "$U/vendor/../../../src/server.mjs")"           "404"

echo
echo "── F. Security headers (camera chỉ self, không gọi ngoài) ──"
CSP=$(curl -s -D - -o /dev/null "$U/" | grep -i '^content-security-policy')
case "$CSP" in
  *"connect-src 'self' blob:"*) PASS=$((PASS+1)); printf "  \033[32m✅\033[0m %-52s có\n" "CSP connect-src chỉ self+blob" ;;
  *)                            FAIL=$((FAIL+1)); printf "  \033[31m❌\033[0m %-52s thiếu\n" "CSP connect-src chỉ self+blob" ;;
esac
case "$CSP" in
  *"frame-ancestors 'none'"*)  PASS=$((PASS+1)); printf "  \033[32m✅\033[0m %-52s có\n" "CSP frame-ancestors none" ;;
  *)                           FAIL=$((FAIL+1)); printf "  \033[31m❌\033[0m %-52s thiếu\n" "CSP frame-ancestors none" ;;
esac
CORS=$(curl -s -D - -o /dev/null -H "Origin: https://evil.example" "$U/api/spike/session" | grep -ci '^access-control-allow-origin')
chk "KHÔNG có CORS header (0)"           "$CORS"                                                 "0"

echo
echo "════════════════════════════════════════════════════════"
printf "  KẾT QUẢ: \033[32m%d pass\033[0m · \033[31m%d fail\033[0m / %d test\n" "$PASS" "$FAIL" "$((PASS+FAIL))"
echo "════════════════════════════════════════════════════════"
echo
echo "📌 Test tự động CHỨNG MINH ĐƯỢC (server-side, fail-closed)."
echo "   KHÔNG phải AR evidence — phần đó phải test trên ĐIỆN THOẠI."
