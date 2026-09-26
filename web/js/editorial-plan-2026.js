(()=>{'use strict';
const W=window.Woonbi=window.Woonbi||{};

const sources=[
{id:'s01',date:'2026-01-15',outlet:'세계일보',type:'news',event:'동문·학교사',title:'포항고등학교 총동창회관 재개관식 및 2026 정기총회 성료',url:'https://www.segye.com/newsView/20260115516512',facts:['총동창회관 재개관식과 2026 정기총회','동문 100여 명 참석 보도','류성연 당시 교장 명예졸업장 수여'],photo:'원문 사진 있음 · 사용권 별도 확인'},
{id:'s02',date:'2026-02-04',outlet:'위키트리',type:'news',event:'국제교류',title:'포항고, 미국 투산 마그넷 고등학교와 상호방문형 국제교류',url:'https://www.wikitree.co.kr/articles/1115584',facts:['1월 9~23일 미국 현지 방문','1학년 8명·2학년 1명 등 9명 참여 보도','현지 수업·공동학습 중심'],photo:'포항교육지원청 제공 사진 있음'},
{id:'s03',date:'2026-02-04',outlet:'스포츠동아',type:'news',event:'국제교류',title:'포항고, 미국 투산 마그넷고와 상호방문형 국제교류 성공적 마무리',url:'https://sports.donga.com/region/article/all/20260204/133296073/1',facts:['12박 15일 국제교류','현지 정규수업 참여','한국 문화 소개 및 홈스테이'],photo:'포항교육지원청 제공 사진 있음'},
{id:'s04',date:'2026-02-04',outlet:'다음/지역언론',type:'news',event:'국제교류',title:'포항고, 미국 투산 마그넷 고등학교와 상호방문형 국제교류 실시',url:'https://v.daum.net/v/20260204154359352',facts:['교육과정 연계 공동학습','약 5개월 사전 어학·문화 준비','과학·예술 중심 수업 체험'],photo:'포항교육지원청 제공 사진 있음'},
{id:'s05',date:'2026-02-09',outlet:'한국기록원',type:'official',event:'라솔라',title:'포항고등학교 라솔라 국내 최고(最古) 고등학교 동아리 기록',url:'https://www.korearecords.co.kr/m/kri.php?ht_id=kri_01',facts:['라솔라 기록 인증 항목 확인','1955년 창립 자료 검증 기반'],photo:'공식 기록 페이지 · 이용조건 확인'},
{id:'s06',date:'2026-03-09',outlet:'다음/경북매일',type:'news',event:'라솔라',title:'포항고등학교 동아리 라솔라, 대한민국 최고 고등학교 동아리로 공식 인증',url:'https://v.daum.net/v/XxgvnnIkIv',facts:['한국기록원 공식 등재 보도','동아리의 역사적 가치 조명'],photo:'라솔라 제공 사진 있음'},
{id:'s07',date:'2026-03-10',outlet:'경북매일',type:'news',event:'라솔라',title:'포항고등학교 동아리 라솔라, 대한민국 최고(最古) 고등학교 동아리로 공식 인증',url:'https://kbmaeil.com/article/20260309500640',facts:['창립 71년 만의 기록 인증','학교 동아리사를 지역 교육사와 연결'],photo:'라솔라 제공 사진 있음'},
{id:'s08',date:'2026-03-13',outlet:'뉴스와이어',type:'news',event:'라솔라',title:'71년 이어온 학생 공동체… 포항고 학술동아리 라솔라 대한민국 최고 기록 인증',url:'https://www.newswire.co.kr/newsRead.php?no=1030280',facts:['1955년 재학생 9명 창립 소개','창립 자료·정관·회원명부 검증 과정','세대 간 동문 공동체 소개'],photo:'보도자료 사진 있음 · 재사용 조건 확인'},
{id:'s09',date:'2026-03-20',outlet:'스타인뉴스',type:'news',event:'라솔라',title:'71년 이어온 학생 공동체… 포항고 학술동아리 라솔라 대한민국 최고 기록 인증',url:'https://www.starinnews.com/news/articleView.html?idxno=349817',facts:['라솔라 기록 인증 후속 보도','동아리의 지속성과 공동체성 조명'],photo:'원문 사진 있음'},
{id:'s10',date:'2026-03-29',outlet:'다음/경북매일',type:'news',event:'급식로봇',title:'익힘 정도가 완벽합니다… 포항고 급식실에 나타난 강철 요리사',url:'https://v.daum.net/v/20260329135500237',facts:['포항고 급식실 조리로봇 현장 취재','560명 석식 조리 장면 보도','대형 조리 공정 자동화 소개'],photo:'현장사진 다수 · 언론사 사진 사용권 확인'},
{id:'s11',date:'2026-03-30',outlet:'경북매일',type:'news',event:'급식로봇',title:'익힘 정도가 완벽합니다… 포항고 급식실에 나타난 강철 요리사',url:'https://kbmaeil.com/article/20260329500406',facts:['조리로봇과 교반기 운영 현장','급식 노동·안전·푸드테크 기사 재료'],photo:'경북매일 현장사진 있음'},
{id:'s12',date:'2026-04-20',outlet:'경북신문',type:'news',event:'요트',title:'포항고 요트부, 전국대회서 금·은 쾌거…해양스포츠 명문 입증',url:'https://www.kbsm.net/news/view.php?idx=516696',facts:['대통령기 전국시도대항 요트대회','ILCA7 남고부 1위','420 혼성중고부 2위'],photo:'포항고 제공 사진 있음'},
{id:'s13',date:'2026-04-20',outlet:'스포츠동아',type:'news',event:'요트',title:'파도 위 전략 레이스…포항고 요트부, 전국대회 금빛 항해 성공',url:'https://sports.donga.com/region/article/all/20260420/133774287/1',facts:['4월 11~15일 부안 변산 앞바다 대회','기상·전략 요소를 함께 다룰 수 있는 보도'],photo:'포항교육지원청 제공 사진 있음'},
{id:'s14',date:'2026-04-20',outlet:'네이트/스포츠동아',type:'news',event:'요트',title:'파도 위 전략 레이스…포항고 요트부 전국대회 금빛 항해 성공',url:'https://news.nate.com/view/20260420n24990',facts:['요트부 전국대회 성과 재전송 보도','학생선수 인터뷰 취재의 배경자료'],photo:'원문 전송 사진 있음'},
{id:'s15',date:'2026-05-04',outlet:'경북신문',type:'news',event:'사격',title:'포항고 사격부, 전국대회 초대 챔피언…대회신기록으로 정상 등극',url:'https://www.kbsm.net/news/view.php?idx=518293',facts:['제1회 NH농협은행배 10m 공기권총 남고부 단체 우승','총점 1705점 대회신기록','전국 54개교 200여 명 참가 보도'],photo:'포항고 제공 사진 있음'},
{id:'s16',date:'2026-05-06',outlet:'스포츠동아',type:'news',event:'사격',title:'포항고 사격부, 전국 최강 입증… 창원서 금빛 쾌거',url:'https://sports.donga.com/region/article/all/20260506/133868548/1',facts:['단체전 우승·대회신기록 후속 보도','선수별 점수와 대회 현장 정보'],photo:'포항교육지원청 제공 사진 있음'},
{id:'s17',date:'2026-05-06',outlet:'다음/지역언론',type:'news',event:'사격',title:'포항고 사격부, 전국 최강 입증… 창원서 금빛 쾌거',url:'https://v.daum.net/v/tbHxJaGhpQ',facts:['사격부 우승 후속 보도','교육지원청 제공 사진 포함'],photo:'교육지원청 제공 사진 있음'},
{id:'s18',date:'2026-05-06',outlet:'네이트/스포츠동아',type:'news',event:'사격',title:'포항고 사격부, 전국 최강 입증…창원서 금빛 쾌거',url:'https://m.news.nate.com/view/20260506n11775',facts:['사격부 우승 기사 재전송','선수·지도자 인터뷰 취재의 참고자료'],photo:'원문 전송 사진 있음'},
{id:'s19',date:'2026-05-16',outlet:'경북신문',type:'news',event:'역사골든벨',title:'포항고, 나라사랑 역사골든벨 개최',url:'https://www.kbsm.net/news/view.php?idx=519684',facts:['1·2학년 174명 참여','2학년 차민혁 학생 최종 우승','교내 17개 동아리 학생 운영 지원'],photo:'포항고 제공 행사사진 있음'},
{id:'s20',date:'2026-05-17',outlet:'다음/지역언론',type:'news',event:'역사골든벨',title:'포항고, 경북 독립운동사 되새기는 나라사랑 역사골든벨 운영',url:'https://v.daum.net/v/20260517150155547?f=p',facts:['5월 13일 개최','경북 독립운동사·호국보훈 주제','1·2학년 174명 참여'],photo:'포항교육지원청 제공 사진 있음'},
{id:'s21',date:'2026-06-02',outlet:'다음/지역언론',type:'news',event:'국제교류',title:'포항고, 미 투산고 국제교류 방문단과 연합 금연 캠페인 운영',url:'https://v.daum.net/v/0y0Qtb8BCT?f=p',facts:['미국 투산고 방문단의 포항 방문','포항고 학생 앰버서더 중심 상호교류','등굣길 연합 금연 캠페인'],photo:'포항교육지원청 제공 사진 있음'},
{id:'s22',date:'2026-07-01',outlet:'경북교육 연구학교 자료',type:'official',event:'자공고2.0',title:'2026학년도 자율형 공립고 2.0 연구학교 운영계획서 수정(포항고)',url:'https://www.gyo6.net/po/main/eduListNew.do',facts:['2026 포항고 자율형 공립고 2.0 연구학교 운영자료 확인','학교 교육과정·지역 연계 기사 배경자료'],photo:'공식 문서 중심'},
{id:'s23',date:'2026-07-24',outlet:'대한민국 정책브리핑',type:'public-media',event:'급식로봇',title:'튀김부터 스프까지 알아서 척척! 요즘 고등학교 급식 클라스',url:'https://www.korea.kr/multi/mediaNewsView.do?newsId=148968725&pWise=main&pWiseMain=L3',facts:['포항고 급식실 현장 영상','조리로봇·교반기 소개','학생·교사 반응 포함'],photo:'정부 영상자료 · 공공누리 여부 개별 확인'},
{id:'s24',date:'2026-08-30',outlet:'경북매일',type:'opinion',event:'학교이전',title:'포항고 흥해(달전) 이전을 제안하며',url:'https://kbmaeil.com/article/20260830500475',facts:['이전 찬성 관점의 외부 기고','흥해 신도시 교육 인프라 논거 제시'],photo:'기고자 사진 있음'},
{id:'s25',date:'2026-09-06',outlet:'경북매일',type:'news',event:'학교이전',title:'개교 75주년 포항고 이전이냐 재건축이냐…공론화 급물살',url:'https://kbmaeil.com/article/20260903500671',facts:['개교 75주년과 학교 공간 논의','이전·재건축 두 선택지 공론화','구성원 의견수렴 절차 보도'],photo:'학교·이전후보지 사진 있음'},
{id:'s26',date:'2026-09-06',outlet:'경북매일',type:'analysis',event:'학교이전',title:'40년 된 분필 칠판 포항고의 결단… 도시재편과 학습권 사이 백년대계',url:'https://www.kbmaeil.com/article/20260903500667',facts:['현 교사 노후화와 교육환경 문제','이전·재건축 장단점 분석','도시재편·학습권 관점 기사'],photo:'학교·후보지 현장사진 있음'},
{id:'s27',date:'2026-09-07',outlet:'경북매일',type:'editorial',event:'학교이전',title:'포항고 이전 공론화, 명문 전통 살릴 기회되길',url:'https://kbmaeil.com/article/20260907500064',facts:['사설/논평 성격','원도심·동문·신도심 쟁점 제시'],photo:'의견 기사'},
{id:'s28',date:'2026-09-14',outlet:'경북매일',type:'interview',event:'학교이전',title:'포항고 이전, 지역 교육 생태계 회복과 균형발전의 핵심 열쇠',url:'https://kbmaeil.com/article/20260914500147',facts:['교육전문가 인터뷰','이전 찬성 논거와 지역 균형발전 관점','학생 기사에서는 반대·유보 의견도 별도 취재 필요'],photo:'인터뷰 인물·학교 사진 있음'},
{id:'s29',date:'2026-09-22',outlet:'경북매일',type:'news',event:'학교이전',title:'포항고 이전 동력 움찔…공간재구조화 동의율 미달로 안개속',url:'https://www.kbmaeil.com/article/20260922500759',facts:['재학생·학부모 동의율 기준 미달 보도','2026년 내 결론 사실상 무산','학교 측 다음 해 재투표 방침 보도'],photo:'학교 전경 사진 있음'},
{id:'s30',date:'2026-03-01',outlet:'경북교육 인사 보도',type:'news',event:'교장인사',title:'경북교육청 2026년 3월 1일자 교육공무원 관리자 인사',url:'https://v.daum.net/v/7NDS0F2urb',facts:['포항고 진재서 교장 전직 발령 확인','신임 교장 인터뷰 기획의 기초자료'],photo:'인사 기사'}
];

const plans=[
{id:'p01',section:'여는 글',month:'연중',title:'교장 선생님 인사말 — 2026, 다시 웅비하는 학교',category:'편집실',planKind:'school',minPhotos:1,angle:'2026년 학교가 중요하게 생각하는 교육 방향과 학생들에게 전하고 싶은 말을 담는다.',sourceIds:['s30','s22'],questions:['올해 포항고가 가장 중요하게 생각하는 변화는 무엇인가요?','학생들에게 가장 기대하는 한 가지는 무엇인가요?','자율형 공립고 2.0을 학생들은 어떻게 체감하게 될까요?','75주년을 맞는 학교의 다음 10년을 어떻게 그리고 있나요?']},
{id:'p02',section:'여는 글',month:'연중',title:'교감 선생님 인사말 — 학교의 하루를 지키는 사람',category:'편집실',planKind:'school',minPhotos:1,angle:'학교생활의 변화와 학생·교사가 함께 만드는 일상을 교감의 시선으로 기록한다.',sourceIds:[],questions:['2026년 학교생활에서 가장 달라진 점은 무엇인가요?','학생들이 놓치지 않았으면 하는 학교생활의 가치는 무엇인가요?','교사와 학생이 더 잘 소통하려면 무엇이 필요할까요?']},
{id:'p03',section:'여는 글',month:'연중',title:'편집장 인사말 — 우리가 2026년을 기록하는 이유',category:'편집실',planKind:'school',minPhotos:1,angle:'교지가 결과 모음이 아니라 한 해의 질문과 장면을 남기는 공동 기록이라는 편집 방향을 밝힌다.',sourceIds:[],questions:['올해 교지에서 꼭 남기고 싶은 장면은 무엇인가요?','작년 교지와 다르게 해보고 싶은 것은 무엇인가요?','독자가 이 책을 덮을 때 어떤 기분이면 좋겠나요?']},

{id:'p04',section:'2026 학교의 한 해',month:'3월',title:'새 학교의 시작 — 2026 입학과 첫 한 달',category:'학교 이야기',planKind:'school',minPhotos:4,angle:'입학·첫 수업·새 반 적응을 신입생의 목소리와 사진으로 기록한다.',sourceIds:[],questions:['입학 첫날 가장 기억나는 장면은?','중학교와 가장 달라진 점은?','한 달 뒤 달라진 생각은?']},
{id:'p05',section:'2026 학교의 한 해',month:'1월',title:'교실 밖 세계수업 — 포항고 학생들의 미국 투산 교류',category:'특집',planKind:'school',minPhotos:6,angle:'미국 현지 수업과 홈스테이, 공동학습을 학생의 경험 중심으로 재구성한다.',sourceIds:['s02','s03','s04'],questions:['현지 수업에서 가장 낯설었던 점은?','한국 학교와 비교해 배우고 싶은 점은?','홈스테이에서 가장 기억나는 대화는?','출발 전 기대와 귀국 후 생각은 어떻게 달라졌나?']},
{id:'p06',section:'2026 학교의 한 해',month:'3월',title:'71년의 약속 — 라솔라가 세대를 잇는 법',category:'학교 이야기',planKind:'school',minPhotos:5,angle:'최고(最古) 동아리 기록 인증을 계기로 학생·동문이 기억하는 라솔라의 문화를 구술사로 남긴다.',sourceIds:['s05','s06','s07','s08','s09'],questions:['라솔라에서 세대가 달라도 이어지는 규칙과 문화는?','현재 학생에게 71년 전통은 부담인가 자부심인가?','기록원 인증을 준비하며 새로 발견한 자료는?','100년을 이어가려면 무엇이 달라져야 하나?']},
{id:'p07',section:'2026 학교의 한 해',month:'봄',title:'벚꽃 아래 함께 달린 봄 — 2026 벚꽃마라톤',category:'사진과 기록',planKind:'school',minPhotos:8,angle:'기록보다 표정과 응원, 출발 전후의 장면을 중심으로 사진 에세이처럼 구성한다.',sourceIds:[],questions:['달리기 전과 후 가장 달라진 감정은?','친구 응원이 기억난 순간은?','순위보다 오래 남은 장면은?']},
{id:'p08',section:'2026 학교의 한 해',month:'3월',title:'급식실의 강철 요리사 — 조리로봇과 560명의 저녁',category:'특집',planKind:'school',minPhotos:6,angle:'조리로봇 도입을 기술 자랑이 아니라 급식 노동·안전·맛·학생 경험의 변화로 취재한다.',sourceIds:['s10','s11','s23'],questions:['조리 종사자가 체감한 가장 큰 변화는?','학생들은 맛이나 메뉴 변화를 느끼는가?','로봇이 잘하는 일과 사람이 계속 해야 하는 일은?','안전과 노동강도는 어떻게 달라졌나?']},
{id:'p09',section:'2026 학교의 한 해',month:'4월',title:'바람을 읽는 경기 — 포항고 요트부의 금빛 항해',category:'학교 이야기',planKind:'school',minPhotos:5,angle:'대회 결과보다 바람·파도·판단·훈련을 중심으로 학생선수의 하루를 기록한다.',sourceIds:['s12','s13','s14'],questions:['레이스 중 가장 중요한 판단은 무엇인가?','거친 날씨에서 두려움을 어떻게 관리하나?','훈련과 수업을 어떻게 병행하나?']},
{id:'p10',section:'2026 학교의 한 해',month:'5월',title:'0.1초의 호흡 — 포항고 사격부 전국대회 우승',category:'학교 이야기',planKind:'school',minPhotos:5,angle:'대회신기록을 만든 집중력·루틴·팀워크를 학생선수 인터뷰로 풀어낸다.',sourceIds:['s15','s16','s17','s18'],questions:['격발 직전 어떤 생각을 하나?','대회신기록을 알았을 때 첫 반응은?','개인 종목처럼 보이는 사격에서 팀워크는 무엇인가?','긴장을 관리하는 자신만의 루틴은?']},
{id:'p11',section:'2026 학교의 한 해',month:'5월',title:'174명이 함께 푼 지역의 역사 — 나라사랑 역사골든벨',category:'학교 이야기',planKind:'school',minPhotos:6,angle:'퀴즈 결과보다 경북 독립운동사를 학생이 어떻게 만나고 기억했는지에 초점을 둔다.',sourceIds:['s19','s20'],questions:['문제 중 가장 인상 깊었던 지역 인물은?','행사 전후 지역사에 대한 생각이 달라졌나?','운영을 도운 동아리 학생들은 무엇을 배웠나?']},
{id:'p12',section:'2026 학교의 한 해',month:'5~6월',title:'다시 만난 투산 친구들 — 포항에서 이어진 국제교류',category:'특집',planKind:'school',minPhotos:6,angle:'미국 방문 이후 투산고 학생들의 포항 방문과 공동 활동을 상호교류의 두 번째 장으로 기록한다.',sourceIds:['s21'],questions:['미국에서 만난 친구를 포항에서 다시 만난 느낌은?','포항고 학생이 소개하고 싶었던 학교문화는?','언어가 잘 통하지 않을 때 어떻게 소통했나?']},
{id:'p13',section:'2026 학교의 한 해',month:'6월',title:'같이 만드는 건강한 학교 — 투산고와 연합 금연 캠페인',category:'학교 이야기',planKind:'school',minPhotos:4,angle:'국제교류 학생들이 공동 캠페인을 기획하며 건강 메시지를 어떻게 전달했는지 취재한다.',sourceIds:['s21'],questions:['왜 국제교류 활동으로 금연 캠페인을 선택했나?','직접 만든 피켓에서 가장 전달하고 싶었던 문장은?','캠페인 뒤 학생 반응은 어땠나?']},
{id:'p14',section:'2026 학교의 한 해',month:'봄',title:'운동장 위 가장 뜨거웠던 하루 — 2026 체육대회',category:'사진과 기록',planKind:'school',minPhotos:10,angle:'종목 결과보다 반별 응원·팀워크·실패와 재도전의 장면을 큰 화보와 짧은 인터뷰로 엮는다.',sourceIds:[],questions:['가장 기억나는 경기 장면은?','경기에 뛰지 않은 학생은 어떤 역할을 했나?','승패 뒤에 남은 것은 무엇인가?']},
{id:'p15',section:'2026 학교의 한 해',month:'봄',title:'1학년, 학교 밖 첫걸음 — 현장체험학습',category:'사진과 기록',planKind:'school',minPhotos:8,angle:'장소 소개가 아니라 새 친구와 관계가 만들어진 순간을 중심으로 구성한다.',sourceIds:[],questions:['친해진 계기가 된 장면은?','교실에서는 몰랐던 친구의 모습은?','가장 오래 기억할 사진 한 장은?']},
{id:'p16',section:'2026 학교의 한 해',month:'봄',title:'2학년 수학여행 — 이동하며 배운 것들',category:'사진과 기록',planKind:'school',minPhotos:10,angle:'관광지 나열 대신 이동·숙소·조별활동·친구관계의 변화를 사진과 기록으로 남긴다.',sourceIds:[],questions:['계획과 실제 여행이 가장 달랐던 순간은?','친구에게 새롭게 알게 된 점은?','여행 뒤 학교생활이 달라진 게 있나?']},
{id:'p17',section:'2026 학교의 한 해',month:'봄',title:'3학년의 하루 밖으로 — 소풍과 진로 사이',category:'사진과 기록',planKind:'school',minPhotos:6,angle:'입시 준비 한가운데의 짧은 외출이 3학년에게 어떤 의미였는지 기록한다.',sourceIds:[],questions:['잠시 학교를 벗어난 하루가 왜 필요했나?','진로·입시 이야기를 친구들과 나눈 순간은?']},
{id:'p18',section:'2026 학교의 한 해',month:'1학기',title:'내가 고르는 수업 — 교육과정·진로 박람회',category:'학교 이야기',planKind:'school',minPhotos:5,angle:'과목 선택을 진로 설계의 과정으로 보고 학생들이 실제로 고민한 기준을 묻는다.',sourceIds:['s22'],questions:['과목을 고를 때 가장 어려운 점은?','선배 조언과 교사 상담 중 무엇이 도움이 됐나?','희망 전공과 과목 선택이 어떻게 연결되나?']},
{id:'p19',section:'2026 학교의 한 해',month:'1학기',title:'동아리에게 묻다 — 우리가 방과후에도 모이는 이유',category:'학교 사람들',planKind:'school',minPhotos:8,angle:'동아리별 한 줄 소개가 아니라 각 동아리의 핵심 질문·대표 활동·실패 경험을 짧게 인터뷰한다.',sourceIds:['s19','s05'],questions:['올해 동아리가 가장 궁금해하는 질문은?','실패했지만 기억에 남는 활동은?','후배에게 한 가지만 물려준다면?']},
{id:'p20',section:'2026 학교의 한 해',month:'연중',title:'학생회 일상 — 회의실 밖에서 학교를 움직이는 방법',category:'학교 사람들',planKind:'school',minPhotos:5,angle:'행사 사진만이 아니라 회의·민원·조율·실패를 포함한 학생자치의 실제 과정을 따라간다.',sourceIds:[],questions:['가장 오래 걸린 결정은?','학생 의견이 실제로 바뀐 사례는?','학생회가 해결하지 못한 문제는?']},
{id:'p21',section:'2026 학교의 한 해',month:'연중',title:'돌아온 포항고 — 김덕수 부장 인터뷰',category:'학교 사람들',planKind:'school',minPhotos:3,angle:'포항고에서 근무했다가 다시 돌아온 교사의 시선으로 학교의 변화와 변하지 않은 문화를 듣는다.',sourceIds:[],questions:['예전 포항고와 지금 가장 달라진 것은?','반대로 변하지 않은 포항고다움은?','학생들에게 다시 만나고 싶은 학교로 남으려면?']},
{id:'p22',section:'2026 학교의 한 해',month:'연중',title:'진로를 설계하는 학교 — 김동규 진로부장 인터뷰',category:'학교 사람들',planKind:'school',minPhotos:3,angle:'입시 정보가 아니라 학생이 자기 선택을 만드는 과정에서 학교 진로교육이 무엇을 할 수 있는지 묻는다.',sourceIds:[],questions:['학생들이 진로를 정할 때 가장 많이 하는 오해는?','1·2·3학년이 지금 해야 할 질문은 각각 무엇인가?','좋은 생기부보다 먼저 필요한 경험은?']},
{id:'p23',section:'2026 학교의 한 해',month:'연중',title:'새 교장에게 묻다 — 진재서 교장 인터뷰',category:'학교 사람들',planKind:'school',minPhotos:4,angle:'2026년 부임한 교장의 교육 철학과 포항고의 미래상을 학생 기자의 질문으로 듣는다.',sourceIds:['s30','s25'],questions:['포항고에 처음 와서 가장 먼저 본 것은?','75년 전통과 미래교육을 어떻게 연결할 것인가?','학교 이전·공간 문제에서 학생 목소리는 어떻게 반영돼야 하나?']},
{id:'p24',section:'2026 학교의 한 해',month:'연중',title:'새 교감에게 묻다 — 학교의 변화를 조율하는 자리',category:'학교 사람들',planKind:'school',minPhotos:3,angle:'새 교감의 역할과 학생생활·수업·학교문화의 변화를 학생 눈높이에서 묻는다.',sourceIds:[],questions:['교감으로서 가장 먼저 바꾸고 싶은 작은 것은?','학생들이 학교에 의견을 내는 가장 좋은 방법은?','교사 간 협업이 학생에게 어떻게 보이나?']},
{id:'p25',section:'2026 학교의 한 해',month:'여름',title:'독도에서 돌아온 학생들 — 사진 밖에서 남은 것',category:'학교 사람들',planKind:'school',minPhotos:6,angle:'독도 방문 학생의 감정만이 아니라 준비과정·현장 관찰·귀환 후 질문을 인터뷰한다.',sourceIds:[],questions:['사진으로 예상했던 독도와 실제가 달랐나?','현장에서 가장 구체적으로 관찰한 것은?','다녀온 뒤 새로 생긴 질문은?']},
{id:'p26',section:'2026 학교의 한 해',month:'1~2학기',title:'인문사회 R&E — 학생이 질문을 연구로 바꾸는 과정',category:'특집',planKind:'research',minPhotos:5,angle:'수상 결과보다 주제 선정·자료수집·실패·수정의 연구과정을 중심으로 팀들을 소개한다.',sourceIds:[],questions:['처음 질문은 연구하면서 어떻게 바뀌었나?','자료를 모으며 가장 막힌 지점은?','결론보다 중요한 실패는?']},
{id:'p27',section:'2026 학교의 한 해',month:'1~2학기',title:'과학 R&E — 실험실에서 답보다 좋은 질문 찾기',category:'특집',planKind:'research',minPhotos:5,angle:'과학중점·R&E 팀의 가설, 실험 수정, 데이터 해석을 학생 연구노트처럼 구성한다.',sourceIds:[],questions:['가설이 틀렸을 때 무엇을 바꿨나?','오차를 줄이기 위해 가장 많이 반복한 것은?','다시 한다면 연구설계를 어떻게 바꿀까?']},
{id:'p28',section:'2026 학교의 한 해',month:'연중',title:'자율형 공립고 2.0, 학생에게 실제로 달라진 것은?',category:'특집',planKind:'research',minPhotos:4,angle:'제도 소개보다 학생이 체감한 선택과목·대학·지역 연계 프로그램의 실제 변화를 확인한다.',sourceIds:['s22'],questions:['작년과 비교해 학생이 체감한 새 프로그램은?','선택권이 실제로 넓어졌나?','좋았던 점과 복잡해진 점은?']},
{id:'p29',section:'2026 학교의 한 해',month:'9월',title:'75년 학교, 어디에서 다음 25년을 보낼까 — 이전과 재건축',category:'특집',planKind:'research',minPhotos:6,angle:'이전 찬성·재건축/잔류·유보 등 서로 다른 입장을 학생·학부모·교사·동문 자료와 함께 균형 있게 정리한다.',sourceIds:['s24','s25','s26','s27','s28','s29'],questions:['학생이 중요하게 보는 기준은 통학·시설·전통 중 무엇인가?','원도심과 신도심 관점은 왜 다른가?','수업 중 공사가 학습권에 미치는 영향은?','어떤 절차가 공정한 결정이라고 생각하나?']},
{id:'p30',section:'2026 학교의 한 해',month:'가을',title:'수능을 앞둔 교실 — 응원보다 먼저 듣고 싶은 말',category:'사진과 기록',planKind:'school',minPhotos:6,angle:'응원 행사 자체보다 수험생의 루틴·불안·친구와 교사의 지원을 짧은 목소리로 모은다.',sourceIds:[],questions:['시험을 앞두고 듣기 싫은 말과 듣고 싶은 말은?','마지막 한 달의 루틴은?','후배에게 남기고 싶은 현실적인 조언은?']},

{id:'p31',section:'학생 특집 — 전공과 질문',month:'특집',title:'질서는 왜 지켜지는가 — 규칙·감시·신뢰의 사회과학',category:'학생 글',planKind:'research',minPhotos:2,angle:'학교 규칙을 사례로 법·사회학·심리학의 질서 형성 원리를 비교한다.',sourceIds:[],studentRecord:'사회·법·행정·경찰·심리 진로 연계',questions:['규칙은 처벌이 강해서 지켜지는가, 정당해서 지켜지는가?','학생이 납득하지 못하는 규칙은 어떤 특징이 있나?','신뢰가 높은 집단과 낮은 집단의 차이는?']},
{id:'p32',section:'학생 특집 — 전공과 질문',month:'특집',title:'호르무즈 해협이 멈추면 우리의 하루는 어떻게 바뀔까',category:'학생 글',planKind:'research',minPhotos:2,angle:'해상 물류·에너지·국제정세가 한국 경제와 생활물가로 이어지는 경로를 지도와 데이터로 분석한다.',sourceIds:[],studentRecord:'국제관계·경제·지리·무역 진로 연계',questions:['한국 에너지 수입에서 해상 통로가 갖는 의미는?','원유 가격 변화가 생활물가에 전달되는 과정은?','한 지역 분쟁을 설명할 때 어떤 자료를 교차검증해야 하나?']},
{id:'p33',section:'학생 특집 — 전공과 질문',month:'특집',title:'AI가 만든 답을 역사 사료처럼 읽을 수 있을까',category:'학생 글',planKind:'research',minPhotos:2,angle:'생성형 AI의 문장을 출처·편향·검증이라는 역사학의 사료비판 방법으로 분석한다.',sourceIds:[],studentRecord:'역사·정보·미디어 진로 연계',questions:['AI 답변에는 누가 만든 관점이 들어가는가?','출처가 없는 문장을 어떻게 검증할까?','사료비판의 외적·내적 비판을 AI에 적용하면?']},
{id:'p34',section:'학생 특집 — 전공과 질문',month:'특집',title:'학교 이전은 건물 문제일까 도시 문제일까',category:'학생 글',planKind:'research',minPhotos:3,angle:'포항고 이전 논의를 도시계획·교육격차·통학·원도심 재생 관점으로 나눠 분석한다.',sourceIds:['s24','s25','s26','s27','s28','s29'],studentRecord:'도시공학·행정·교육학 진로 연계',questions:['학교 한 곳의 이동이 주변 상권·교통에 미치는 영향은?','학령인구 분포를 어떤 데이터로 확인할 수 있나?','서로 다른 이해관계를 공정하게 비교하는 기준은?']},
{id:'p35',section:'학생 특집 — 전공과 질문',month:'특집',title:'학생 수가 줄어드는 도시에서 좋은 고등학교는 무엇을 해야 할까',category:'학생 글',planKind:'research',minPhotos:2,angle:'학령인구 감소와 지역 고교의 교육과정·진학·지역 정주 문제를 데이터로 본다.',sourceIds:['s22'],studentRecord:'교육·인구·행정·통계 진로 연계',questions:['포항 학령인구는 어디에서 늘고 줄고 있나?','학교 선택은 주거 이동에 영향을 주나?','지역 고교가 대학·기업과 연결되는 이유는?']},
{id:'p36',section:'학생 특집 — 전공과 질문',month:'특집',title:'급식로봇은 누구의 일을 바꾸는가',category:'학생 글',planKind:'research',minPhotos:3,angle:'조리로봇 사례로 자동화가 노동을 없애는지, 위험하고 반복적인 일을 재배치하는지 분석한다.',sourceIds:['s10','s11','s23'],studentRecord:'로봇·기계·산업공학·노동경제 진로 연계',questions:['자동화 전후 사람이 맡는 일이 어떻게 달라졌나?','안전·생산성·맛을 동시에 측정할 방법은?','학교 급식에 적합한 자동화와 부적합한 자동화는?']},
{id:'p37',section:'학생 특집 — 전공과 질문',month:'특집',title:'사격의 0.1점 — 집중력은 훈련될 수 있을까',category:'학생 글',planKind:'research',minPhotos:3,angle:'사격부 사례와 스포츠심리 자료를 연결해 호흡·루틴·압박 상황의 수행을 탐구한다.',sourceIds:['s15','s16'],studentRecord:'체육·심리·의생명 진로 연계',questions:['심박·호흡 변화와 수행을 측정할 수 있나?','루틴은 불안을 줄이는가?','개인 종목의 팀훈련은 어떤 효과가 있나?']},
{id:'p38',section:'학생 특집 — 전공과 질문',month:'특집',title:'바람을 읽는 수학 — 요트는 어떻게 앞으로 가는가',category:'학생 글',planKind:'research',minPhotos:3,angle:'요트부 사례로 벡터·양력·저항·최적 경로의 물리와 수학을 설명한다.',sourceIds:['s12','s13'],studentRecord:'물리·수학·해양공학 진로 연계',questions:['맞바람에서도 배가 앞으로 갈 수 있는 이유는?','풍향 변화에 따라 최적 항로는 어떻게 달라지나?','실제 경기 데이터를 그래프로 표현할 수 있나?']},
{id:'p39',section:'학생 특집 — 전공과 질문',month:'특집',title:'독도를 말할 때 지도·사료·국제법은 어떻게 다르게 쓰이는가',category:'학생 글',planKind:'research',minPhotos:3,angle:'영토 문제를 감정적 구호가 아니라 역사사료·지리자료·국제법 문서의 성격 차이를 구분해 읽는다.',sourceIds:[],studentRecord:'역사·법·국제관계·지리 진로 연계',questions:['역사적 근거와 국제법적 주장은 같은 종류의 증거인가?','지도는 누가 언제 만들었는지 왜 중요할까?','상반된 자료를 비교할 때 지켜야 할 원칙은?']},
{id:'p40',section:'학생 특집 — 전공과 질문',month:'특집',title:'지역 독립운동은 왜 학교에서 다시 기억되어야 할까',category:'학생 글',planKind:'research',minPhotos:3,angle:'역사골든벨에서 출발해 경북 독립운동사를 기억문화·지역사 교육 관점에서 확장한다.',sourceIds:['s19','s20'],studentRecord:'역사·교육·문화콘텐츠 진로 연계',questions:['전국사와 지역사는 무엇이 다른가?','기념 방식은 세대마다 어떻게 달라졌나?','학교가 지역 기억을 보존할 수 있는 방법은?']},
{id:'p41',section:'학생 특집 — 전공과 질문',month:'특집',title:'71년 동아리는 어떻게 살아남았나 — 라솔라 구술사 프로젝트',category:'학생 글',planKind:'research',minPhotos:4,angle:'라솔라의 공식 기록과 동문 인터뷰를 비교해 조직문화·세대전승·기록보존을 탐구한다.',sourceIds:['s05','s07','s08'],studentRecord:'역사·사회학·기록학·경영 진로 연계',questions:['세대를 넘어 유지된 핵심 규칙은?','기억과 문서가 다를 때 무엇을 더 신뢰할까?','조직이 오래 살아남기 위해 무엇을 바꿔야 하나?']},
{id:'p42',section:'학생 특집 — 학교의 이야기',month:'특집',title:'미탑에 얽힌 이야기 — 학교 민담을 사실과 기억으로 나누어 읽기',category:'학생 글',planKind:'research',minPhotos:4,angle:'교내에서 전해지는 미탑·상징물 관련 이야기를 수집하고 문서기록과 구전을 구분해 학교 민속지처럼 정리한다.',sourceIds:[],studentRecord:'역사·민속·국어·문화인류학 진로 연계',questions:['같은 이야기가 학년·세대마다 어떻게 달라지는가?','문서로 확인되는 사실과 구전은 어디서 갈리는가?','민담이 학교 공동체에 하는 역할은?']},
{id:'p43',section:'학생 특집 — 학교의 이야기',month:'특집',title:'학교 괴담도 사료가 될까 — 포항고 구전 이야기 채록',category:'학생 글',planKind:'research',minPhotos:3,angle:'괴담을 사실로 단정하지 않고 누가 언제 어떤 맥락에서 전했는지 기록하는 구술사 방법을 실험한다.',sourceIds:[],studentRecord:'국어·역사·심리·문화콘텐츠 진로 연계',questions:['가장 오래된 증언은 어디까지 거슬러 올라가나?','이야기가 바뀌는 지점은 무엇인가?','사실 여부와 별개로 왜 계속 전해질까?']},
{id:'p44',section:'학생 특집 — 전공과 질문',month:'특집',title:'산업도시 포항에서 고등학생의 진로는 어떻게 바뀌고 있을까',category:'학생 글',planKind:'research',minPhotos:3,angle:'철강·이차전지·로봇·AI 등 지역 산업 변화가 학생의 전공 선택과 지역 정주 인식에 미치는 영향을 조사한다.',sourceIds:[],studentRecord:'경제·공학·진로교육·지역학 연계',questions:['학생들이 생각하는 포항의 미래 산업은?','지역 기업·대학 정보가 진로 선택에 영향을 주나?','포항에 남고 싶은 조건은 무엇인가?']},
{id:'p45',section:'학생 특집 — 전공과 질문',month:'특집',title:'추천 알고리즘은 내 취향을 발견할까 만들까',category:'학생 글',planKind:'research',minPhotos:2,angle:'영상·음악·쇼핑 추천을 사례로 개인화 알고리즘과 필터버블, 선택의 자유를 탐구한다.',sourceIds:[],studentRecord:'컴퓨터·수학·미디어·심리 진로 연계',questions:['추천 전후 선택이 어떻게 달라지는지 기록할 수 있나?','정확한 추천과 다양한 추천 중 무엇이 좋은가?','알고리즘 편향을 학생 수준에서 어떻게 실험할까?']},
{id:'p46',section:'학생 특집 — 전공과 질문',month:'특집',title:'교실의 빛과 공기는 집중력에 닿을까',category:'학생 글',planKind:'research',minPhotos:3,angle:'조도·온도·이산화탄소·소음 같은 교실환경 데이터를 수집해 학습집중도와의 관계를 탐구한다.',sourceIds:[],studentRecord:'건축·환경·의학·통계·교육 진로 연계',questions:['측정 가능한 환경변수는 무엇인가?','주관적 집중도를 어떻게 기록할까?','상관관계를 인과관계로 오해하지 않으려면?']}
];

const verifiedSourceIds=new Set(["s01","s02","s03","s04","s10","s11","s15","s16","s17","s19","s20","s21","s22","s24","s25","s26","s28","s29"]);
for(const x of sources){
 x.year=Number(String(x.date||'').slice(0,4));
 x.yearVerified=x.year===2026;
 x.webVerified=verifiedSourceIds.has(x.id);
 x.verification=x.webVerified?'발행일 확인됨':x.yearVerified?'2026 표기 · 원문 추가 확인':'제외 대상';
}
const sources2026=sources.filter(x=>x.yearVerified);
function sourceById(id){return sources.find(x=>x.id===id)||null;}
function draft(plan){
 const src=plan.sourceIds.map(sourceById).filter(Boolean);
 const sourceText=src.length?src.map(x=>`- ${x.date} · ${x.outlet} · ${x.title}`).join('\n'):'- 외부 보도자료 없음 · 교내 취재와 학교 자료로 사실 확인 필요';
 const qs=(plan.questions||[]).map((q,i)=>`${i+1}. ${q}`).join('\n');
 return `※ 편집용 초안입니다. 확인하지 않은 사실·발언·행사 결과를 완성 기사처럼 쓰지 마세요. 학생 취재 뒤 대괄호 안내와 이 문장을 지우고 자기 글로 완성합니다.

## 이 기사가 묻는 것

${plan.angle}

이 기사는 먼저 한 장면에서 시작합니다. [학생 기자가 실제 현장에서 본 장면을 2~4문장으로 적기]. 날짜·장소·참여자를 확인하고, 사진에 보이는 것과 직접 들은 말을 구분합니다.

## 취재로 채울 핵심

${qs}

인터뷰를 했다면 말의 의미를 바꾸지 않는 범위에서 짧게 인용하고, 누가 언제 말했는지 기록합니다. 서로 다른 의견이 있는 주제는 한쪽만 싣지 말고 왜 관점이 다른지도 확인합니다.

## 2026 자료함에서 먼저 확인할 것

${sourceText}

외부 기사는 사실관계를 확인하는 출발점입니다. 문장을 베끼지 않고 학생이 직접 취재한 내용과 학교 자료를 중심으로 새로 씁니다. 언론사 사진은 원문에 사진이 있어도 사용권을 확인하기 전에는 교지에 복사해 넣지 않습니다.

## 기사 마무리

[취재 전과 후에 생각이 어떻게 달라졌는지, 아직 답하지 못한 질문이 무엇인지 학생 기자의 문장으로 마무리].`;
}
function planById(id){return plans.find(x=>x.id===id)||null;}
function sectionCounts(){const m=new Map();for(const p of plans)m.set(p.section,(m.get(p.section)||0)+1);return [...m].map(([section,count])=>({section,count}));}
function articleSlots(){
 return plans.map((p,i)=>({
  id:'plan-'+p.id,
  editorialPlanId:p.id,
  title:p.title,
  sourceTitle:p.title,
  deck:p.angle,
  category:p.category,
  planKind:p.planKind,
  planOrder:i+1,
  section:p.section,
  month:p.month,
  byline:'미배정',
  body:draft(p),
  assigneeIds:[],
  assigneeNames:[],
  dueDate:'',
  minPhotos:Number(p.minPhotos||0),
  photos:[],
  status:'draft',
  revision:0,
  createdAt:'2026-09-26T00:00:00Z',
  updatedAt:'2026-09-26T00:00:00Z',
  updatedBy:'editorial-plan',
  feedback:'',
  webConsent:false,
  printConsent:false,
  contentOrigin:'2026-editorial-plan',
  reportingQuestions:[...(p.questions||[])],
  requiredPhotos:[...(p.requiredPhotos||[])],
  sourceIds:[...(p.sourceIds||[])],
  studentRecord:p.studentRecord||'',
  notes:['2026 교지 기획 슬롯 · 실제 취재 후 완성']
 }));
}
W.editorial2026={year:2026,version:'2026-09-26',sources:sources2026,allSources:sources,plans,sourceById,planById,draft,articleSlots,sectionCounts,verifiedSourceIds};
})();
