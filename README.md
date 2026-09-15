# 비즈홈 (팀 업무 시스템)

노션 대신 쓰는 우리 회사 업무 시스템입니다. 대문(비즈홈)에서 부서별 메뉴를 고르면 각 관리 화면이 열립니다.
파일 몇 개로 동작하며, 내용은 Supabase(무료 클라우드 저장소)에 저장되어 어디서나 접속할 수 있습니다.

## 파일
| 파일 | 역할 |
|---|---|
| `index.html` | 비즈홈 (부서별 메뉴 대문) |
| `tasks.html` | 내 업무함 (업무 요청·회신·완료) |
| `sales.html` | 영업 미팅 현황 (들어온 DB·영업 진행 관리) |
| `common.js` | 공통 동작: **Supabase 연결 설정(CONFIG)**, 저장소, 로그인, 팀원 관리 |
| `common.css` | 공통 디자인 |
| `supabase-setup.sql` | Supabase 에 표를 만드는 명령 (한 번만 실행) |
| `preview.ps1` | 시험용 미리보기 서버 (http://localhost:37124/) |

## 화면
### 비즈홈 (`index.html`)
- 인사 / 총무 / 업무지원 / 마케팅 / 사업관리 부서별 메뉴 카드
- 위쪽 빠른 메뉴: 내 업무함(내 업무·지연·받은업무 건수), 영업 미팅 현황(진행중·대기중 건수)
- "준비 중" 카드는 아직 화면이 없는 메뉴. 메뉴 목록은 `index.html` 의 `HOME` 부분에서 고칩니다.

### 내 업무함 (`tasks.html`)
- 항목: 업무내용 · 상태 · 시작일자 · 마감기한 · 담당자 · 수신자 · 비고 · 댓글
- 상태 흐름: `내 업무` → **요청하기** → `회신대기` → 수신자가 **회신하기** → `회신완료` → 담당자가 **완료처리** → `완료`(보관함)
- 탭: 내 업무(내가 담당자) / 받은업무(나에게 요청됨, 빨간 숫자) / 전체 / 보관함(완료) / 담당자별 / 칸반 / 달력

### 영업 미팅 현황 (`sales.html`)
- 항목: 회사명 · 상대 담당자/연락처 · 관심도(🟢🟠⚪) · 상태 · 우리 담당자 · 예산 · 미팅 일자 · 웹사이트 · 유입 경로 · 비고 · 댓글
- 상태: 대기중 / 미팅·협의중 / 계약 / 보류 / 거절
- 탭: 전체(표) / 영업 퍼널 Board(상태별 칸, 예산 합계) / 담당자별 / 미팅 달력
- 위쪽 요약: 이번 달 들어온 DB, 대기중, 협의중 예산 합계, 계약 성사율

### 공통
- 접속하면 이름을 고르거나 새로 등록해서 들어갑니다(비밀번호 없음). 오른쪽 위 이름을 누르면 팀원 관리·사용자 전환.
- 팀원 목록은 모든 화면이 함께 씁니다.

## 처음 설정하는 순서 (사용자가 직접)
### 1. Supabase 저장소 만들기
1. https://supabase.com 에서 무료 회원가입 후 **New project** (이름: bizhome, 지역: Northeast Asia (Seoul) 추천)
2. 왼쪽 메뉴 **SQL Editor** → **New query** → `supabase-setup.sql` 내용을 전부 붙여넣고 **Run**
3. 왼쪽 메뉴 **Project Settings → API** 에서 두 값을 복사
   - **Project URL** (예: `https://abcdefgh.supabase.co`)
   - **anon public** 키 (긴 글자)
4. `common.js` 맨 위 `CONFIG` 부분에 두 값을 넣습니다
   ```js
   const CONFIG = {
     SUPABASE_URL: "https://abcdefgh.supabase.co",
     SUPABASE_KEY: "eyJ...",
   };
   ```
   (이 키는 "공개용" 키라서 파일에 넣어도 됩니다. 단, 링크를 아는 사람은 누구나 내용을 볼 수 있으니 팀 안에서만 공유하세요.)

### 2. 인터넷에 올리기 (GitHub Pages, 무료)
1. https://github.com 에서 회원가입
2. **New repository** → 이름 `bizhome`, **Public** → Create
3. **Add file → Upload files** 로 `index.html`, `tasks.html`, `sales.html`, `common.js`, `common.css` 를 올리고 Commit
4. 저장소의 **Settings → Pages** → Branch 를 `main` 으로 고르고 Save
5. 1~2분 뒤 `https://<깃허브아이디>.github.io/bizhome/` 주소로 접속 가능. 이 주소를 팀원에게 공유

이후 파일을 고치면 3번(업로드)만 다시 하면 됩니다.

## 이 컴퓨터에서 시험하기
`preview.ps1` 을 실행하고 http://localhost:37124/ 을 엽니다.
`CONFIG` 가 비어 있으면 "임시 저장(이 브라우저만)" 모드로 동작해 다른 사람과 공유되지 않습니다.
