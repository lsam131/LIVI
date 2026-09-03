#!/usr/bin/env bash
# 驗證所有上游掛鉤點都還在。
#
# 用途：每次合併上游新版之後執行。上游若把某個檔案重構掉，我們的掛鉤會被靜默
# 移除，程式仍然編譯得過但客製化功能整個消失。這支腳本讓那種情況直接變成錯誤。
#
# 用法：bash custom/scripts/check-touchpoints.sh
set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../.." || exit 1

fail=0
pass=0

# 檢查某檔案是否含有指定的固定字串
need() {
  local id="$1" file="$2" pattern="$3"
  if [ ! -f "$file" ]; then
    printf '  \033[31mFAIL\033[0m  %-4s 檔案不存在: %s\n' "$id" "$file"
    fail=$((fail + 1))
    return
  fi
  local n
  n=$(grep -cF -- "$pattern" "$file" || true)
  if [ "$n" -lt 1 ]; then
    printf '  \033[31mFAIL\033[0m  %-4s %s 裡找不到 %s\n' "$id" "$file" "$pattern"
    fail=$((fail + 1))
  else
    printf '  \033[32mOK\033[0m    %-4s %s\n' "$id" "$file"
    pass=$((pass + 1))
  fi
}

echo "上游掛鉤點："
need T1 src/main/index.ts                                        'registerCustomMain()'
need T2 src/preload/index.ts                                     'exposeCustomApi()'
need T3 src/renderer/src/main.tsx                                'initCustomRenderer()'
need T4 src/renderer/src/routes/appRoutes.tsx                    '.concat(customRoutes)'
need T5 src/renderer/src/components/navigation/useTabsConfig.tsx 'applyCustomTabs('
need T6 src/renderer/src/routes/schemas/schema.ts                '...customSettingsSchemas'
need T7 src/renderer/src/routes/schemas/generalSchema.ts         'applyCustomLanguages('
need T8 src/renderer/src/routes/schemas/__tests__/generalSchema.test.ts 'expect.arrayContaining(['

echo ""
echo "客製化模組："
for f in \
  src/main/custom/index.ts \
  src/main/custom/config/customConfig.ts \
  src/main/custom/ipc/contract.ts \
  src/preload/custom.ts \
  src/types/custom.d.ts \
  src/renderer/src/custom/index.ts \
  src/renderer/src/custom/routes.tsx \
  src/renderer/src/custom/tabs.ts \
  src/renderer/src/custom/settingsSchema.ts \
  src/renderer/src/custom/languages.ts \
  src/renderer/src/custom/theme/overrides.css
do
  if [ -f "$f" ]; then
    printf '  \033[32mOK\033[0m    %s\n' "$f"
    pass=$((pass + 1))
  else
    printf '  \033[31mFAIL\033[0m  缺少 %s\n' "$f"
    fail=$((fail + 1))
  fi
done

echo ""
if [ "$fail" -gt 0 ]; then
  printf '\033[31m%d 項失敗\033[0m，%d 項通過。請對照 custom/UPSTREAM_TOUCHPOINTS.md 修復後再繼續。\n' "$fail" "$pass"
  exit 1
fi
printf '\033[32m全部 %d 項通過。\033[0m\n' "$pass"
