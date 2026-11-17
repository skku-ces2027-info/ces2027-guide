#!/usr/bin/env python3
"""data/items.csv · data/updates.csv 검사 + 마지막 커밋 대비 변경 요약.

공개 사이트에 올라가는 파일이라, 푸시 전에 이 검사가 통과해야 한다(오류 0).
  python3 tools/check_data.py            # 검사 + 변경 요약(HEAD 대비)
  python3 tools/check_data.py --quiet    # 오류·경고만

종료 코드: 0 = 통과(경고는 있을 수 있음), 1 = 오류 있음.
사이트의 값 목록은 app.js 맨 위 상수와 같다. 한쪽을 바꾸면 다른 쪽도 바꾼다.
"""
from __future__ import annotations

import csv
import io
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HEAD = ["id", "분류", "제목", "원제목", "날짜", "시작", "끝", "건물", "방", "우리트랙", "CES트랙",
        "패스", "상태", "요약", "할일", "원문링크", "근거", "확인일", "변경일"]
CATS = {"세션", "키노트", "무대·행사", "입장 규칙", "기한", "부스 정보"}
TRACKS = {"AI", "모빌리티·로보틱스", "헬스·바이오", "에너지·지속가능", "공통", "그 밖"}
PASSES = {"", "Standard", "유료 트랙", "별도 티켓"}
STATES = {"공개", "작년 기준 예상", "미정"}
BASIS = {"공식-직접확인", "공식-요약", "2차", "추정", "미기재"}
DAYS = {"2027-01-06", "2027-01-07", "2027-01-08"}
ISO = re.compile(r"^\d{4}-\d{2}-\d{2}$")
HM = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
# 공개 원칙(README): 개인 이름·연락처·조 명단·숙소는 넣지 않는다
PII = [(re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+"), "이메일 주소"),
       (re.compile(r"\b0\d{1,2}-\d{3,4}-\d{4}\b|\+?\d{1,2}[ -]\d{3}[ -]\d{3}[ -]\d{4}"), "전화번호"),
       (re.compile(r"룩소|Luxor|[1-5]조\b|조 명단|연수단 명단"), "숙소·조 명단")]

errors: list[str] = []
warns: list[str] = []


def err(m: str) -> None:
    errors.append(m)


def warn(m: str) -> None:
    warns.append(m)


def read_csv(text: str) -> tuple[list[str], list[dict]]:
    rd = csv.DictReader(io.StringIO(text.lstrip("﻿"), newline=""))
    return rd.fieldnames or [], list(rd)


def app_en() -> set[str]:
    """app.js의 EN 표 키(= 영어 표기가 있는 CSV 값)."""
    js = (ROOT / "app.js").read_text(encoding="utf-8")
    m = re.search(r"var EN=\{(.*?)\};", js, re.S)
    return set(re.findall(r"'([^']+)':", m.group(1))) if m else set()


def check_items(rows: list[dict], fields: list[str]) -> None:
    if fields != HEAD:
        err(f"items.csv 머리줄이 다르다: {fields}")
        return
    seen_id, seen_key = set(), {}
    en = app_en()
    for n, r in enumerate(rows, start=2):
        i = r["id"]
        where = f"items.csv {n}행 {i or '(id 없음)'}"
        if not i:
            err(f"{where}: id가 비었다")
        elif i in seen_id:
            err(f"{where}: id 중복")
        seen_id.add(i)
        if r["분류"] not in CATS:
            err(f"{where}: 분류 '{r['분류']}'")
        for t in filter(None, r["우리트랙"].split(";")):
            if t not in TRACKS:
                err(f"{where}: 우리트랙 '{t}'")
        if r["분류"] in {"세션", "키노트", "무대·행사"} and not r["우리트랙"]:
            warn(f"{where}: 우리트랙이 비었다")
        if r["패스"] not in PASSES:
            err(f"{where}: 패스 '{r['패스']}'")
        if r["상태"] not in STATES:
            err(f"{where}: 상태 '{r['상태']}'")
        if r["근거"] not in BASIS:
            err(f"{where}: 근거 '{r['근거']}'")
        for col in ("날짜", "확인일", "변경일"):
            if r[col] and not ISO.match(r[col]):
                err(f"{where}: {col} 형식 '{r[col]}'")
        for col in ("시작", "끝"):
            if r[col] and not HM.match(r[col]):
                err(f"{where}: {col} 형식 '{r[col]}'")
        if r["시작"] and r["끝"] and r["끝"] <= r["시작"]:
            err(f"{where}: 끝({r['끝']})이 시작({r['시작']})보다 이르다")
        if r["원문링크"] and not r["원문링크"].startswith("https://"):
            err(f"{where}: 원문링크가 https:// 로 시작하지 않는다")
        if r["분류"] == "세션":
            for col in ("제목", "원제목", "날짜", "시작", "원문링크", "건물"):
                if not r[col]:
                    err(f"{where}: 세션인데 {col}이 비었다")
            if r["날짜"] and r["날짜"] not in DAYS:
                err(f"{where}: 세션 날짜 {r['날짜']}가 1/6~8이 아니다")
            key = (r["원문링크"], r["날짜"], r["시작"], r["방"])
            if key in seen_key:
                err(f"{where}: {seen_key[key]}와 같은 세션(주소·날짜·시각·방)")
            seen_key[key] = i
        if not r["제목"]:
            err(f"{where}: 제목이 비었다")
        if r["제목"] and re.search(r"[A-Za-z]{4,}", r["제목"]) and r["분류"] == "세션":
            if not re.search(r"[가-힣]", r["제목"]):
                warn(f"{where}: 제목에 한국어가 없다(영어 원제목 그대로?)")
        for col, v in r.items():
            if not v:
                continue
            for pat, what in PII:
                if pat.search(v):
                    err(f"{where}: {col}에 {what}로 보이는 것: '{pat.search(v).group(0)}'")
        for col in ("우리트랙", "패스", "상태", "근거", "분류"):
            for v in filter(None, r[col].split(";")):
                if en and v not in en and v != "Standard" and v not in {"AI"}:
                    warn(f"{where}: {col} '{v}'의 영어 표기가 app.js EN에 없다(한국어 그대로 나온다)")


def check_updates(rows: list[dict], fields: list[str]) -> None:
    if fields != ["날짜", "내용"]:
        err(f"updates.csv 머리줄이 다르다: {fields}")
        return
    for n, r in enumerate(rows, start=2):
        if not ISO.match(r["날짜"] or ""):
            err(f"updates.csv {n}행: 날짜 형식 '{r['날짜']}'")
        if not (r["내용"] or "").strip():
            err(f"updates.csv {n}행: 내용이 비었다")
        elif len(r["내용"]) > 200:
            warn(f"updates.csv {n}행: 내용이 200자를 넘는다")
        for pat, what in PII:
            if pat.search(r["내용"] or ""):
                err(f"updates.csv {n}행: {what}로 보이는 것")


def git_show(path: str) -> str | None:
    o = subprocess.run(["git", "-C", str(ROOT), "show", f"HEAD:{path}"], capture_output=True, text=True)
    return o.stdout if o.returncode == 0 else None


def summarize_change(new_rows: list[dict]) -> None:
    old = git_show("data/items.csv")
    if old is None:
        print("(HEAD에 items.csv가 없어 변경 요약을 건너뜀)")
        return
    _, old_rows = read_csv(old)
    o = {r["id"]: r for r in old_rows}
    n = {r["id"]: r for r in new_rows}
    added = [i for i in n if i not in o]
    removed = [i for i in o if i not in n]
    changed = [i for i in n if i in o and n[i] != o[i]]
    print(f"HEAD 대비 항목 변경: 추가 {len(added)} · 수정 {len(changed)} · 삭제 {len(removed)}")
    for i in added:
        print(f"  + {i} {n[i]['날짜'][5:]} {n[i]['시작']} {n[i]['제목'][:50]}")
    for i in changed:
        cols = [c for c in HEAD if n[i][c] != o[i][c]]
        print(f"  ~ {i} {n[i]['제목'][:40]} ← {','.join(cols)}")
    for i in removed:
        print(f"  - {i} {o[i]['제목'][:50]}")
    ou = git_show("data/updates.csv")
    if ou is not None:
        _, orows = read_csv(ou)
        _, nrows = read_csv((ROOT / "data" / "updates.csv").read_text(encoding="utf-8"))
        oset = {(r["날짜"], r["내용"]) for r in orows}
        new_u = [r for r in nrows if (r["날짜"], r["내용"]) not in oset]
        print(f"업데이트 기록 추가 {len(new_u)}줄")
        for r in new_u:
            print(f"  + {r['날짜']} {r['내용'][:80]}")
        if (added or changed or removed) and not new_u:
            warn("항목이 바뀌었는데 updates.csv에 새 줄이 없다(사이트 '업데이트' 창에 안 보인다)")


def main() -> int:
    quiet = "--quiet" in sys.argv
    raw = (ROOT / "data" / "items.csv").read_bytes()
    if not raw.startswith(b"\xef\xbb\xbf"):
        warn("items.csv에 BOM이 없다(엑셀에서 한글이 깨질 수 있다)")
    f1, items = read_csv(raw.decode("utf-8"))
    f2, ups = read_csv((ROOT / "data" / "updates.csv").read_text(encoding="utf-8"))
    check_items(items, f1)
    check_updates(ups, f2)
    for w in warns:
        print("경고:", w)
    for e in errors:
        print("오류:", e)
    print(f"항목 {len(items)}개 · 업데이트 {len(ups)}줄 · 오류 {len(errors)} · 경고 {len(warns)}")
    if not quiet and not errors:
        summarize_change(items)
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
