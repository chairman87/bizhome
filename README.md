# 팀 업무판

노션처럼 팀원에게 업무를 배치하고, 마감·완료 현황을 한눈에 보는 웹 앱입니다.
파일 하나(`index.html`)로 동작하며, 내용은 Supabase(무료 클라우드 저장소)에 저장되어 어디서나 접속할 수 있습니다.

## 파일
| 파일 | 역할 |
|---|---|
| `index.html` | 앱 화면과 동작 전부 |
| `supabase-setup.sql` | Supabase 에 표를 만드는 명령 (한 번만 실행) |
| `preview.ps1` | 시험용 미리보기 서버 (http://localhost:37124/) |

## 화면
- **표**: 전체 업무를 표로. 제목 클릭으로 정렬, 검색·담당자·상태 필터, 완료 숨기기
- **담당자별**: 팀원 한 명씩 카드로. 남은 건수 / 지연 건수 / 완료 건수, 체크박스로 완료 처리
- **칸반**: 대기 / 진행중 / 완료 칸. 카드를 끌어다 놓거나 "→ 진행중" 버튼으로 상태 변경
- **달력**: 마감일 기준 달력. 지난 마감은 빨간색, 날짜 클릭으로 그 날짜의 새 업무 생성

접속하면 이름을 고르거나 새로 등록해서 들어갑니다(비밀번호 없음). 오른쪽 위 이름을 누르면 팀원 관리·사용자 전환.

## 처음 설정하는 순서 (사용자가 직접)
### 1. Supabase 저장소 만들기
1. https://supabase.com 에서 무료 회원가입 후 **New project** (이름: team-tasks, 지역: Northeast Asia (Seoul) 추천)
2. 왼쪽 메뉴 **SQL Editor** → **New query** → `supabase-setup.sql` 내용을 전부 붙여넣고 **Run**
3. 왼쪽 메뉴 **Project Settings → API** 에서 두 값을 복사
   - **Project URL** (예: `https://abcdefgh.supabase.co`)
   - **anon public** 키 (긴 글자)
4. `index.html` 맨 위 `CONFIG` 부분에 두 값을 넣습니다
   ```js
   const CONFIG = {
     SUPABASE_URL: "https://abcdefgh.supabase.co",
     SUPABASE_KEY: "eyJ...",
   };
   ```
   (이 키는 "공개용" 키라서 파일에 넣어도 됩니다. 단, 링크를 아는 사람은 누구나 내용을 볼 수 있으니 팀 안에서만 공유하세요.)

### 2. 인터넷에 올리기 (GitHub Pages, 무료)
1. https://github.com 에서 회원가입
2. **New repository** → 이름 `team-tasks`, **Public** → Create
3. **Add file → Upload files** 로 `index.html` 을 올리고 Commit
4. 저장소의 **Settings → Pages** → Branch 를 `main` 으로 고르고 Save
5. 1~2분 뒤 `https://<깃허브아이디>.github.io/team-tasks/` 주소로 접속 가능. 이 주소를 팀원에게 공유

이후 `index.html` 을 고치면 3번(업로드)만 다시 하면 됩니다.

## 이 컴퓨터에서 시험하기
`preview.ps1` 을 실행하고 http://localhost:37124/ 을 엽니다.
`CONFIG` 가 비어 있으면 "임시 저장(이 브라우저만)" 모드로 동작해 다른 사람과 공유되지 않습니다.
