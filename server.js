const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// public 폴더 경로 (Render 등 환경에서도 안정적으로 찾기)
const PUBLIC_DIR = path.join(__dirname, 'public');
if (!fs.existsSync(PUBLIC_DIR)) {
  console.error('ERROR: public folder not found at', PUBLIC_DIR);
  console.error('__dirname =', __dirname);
  console.error('Files in __dirname:', fs.readdirSync(__dirname));
}

app.use(cors());
app.use(express.static(PUBLIC_DIR));
app.use(express.json());

// ==================== GAME CONSTANTS ====================
const MAX_PLAYERS = 30;
const START_CASH = 10000000;
const TURN_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const TOTAL_TURNS = 12;
const ADMIN_CODE = '0403';

const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

const COUNTRIES = {
  KR: { name: '대한민국', stocks: ['K-CHIP', 'K-MOTOR', 'K-FOOD', 'K-BATTERY', 'K-CONTENT'] },
  JP: { name: '일본', stocks: ['J-AUTO', 'J-ELEC', 'J-GAME', 'J-PRECISE', 'J-FOOD'] },
  US: { name: '미국', stocks: ['US-IT', 'US-BIO', 'US-FIN', 'US-CONTENT', 'US-AUTO'] },
  CN: { name: '중국', stocks: ['CN-ELEC', 'CN-BATTERY', 'CN-MANU', 'CN-PLATFORM', 'CN-FOOD'] },
  DE: { name: '독일', stocks: ['DE-AUTO', 'DE-CHEM', 'DE-MACH', 'DE-GREEN', 'DE-FOOD'] },
  FR: { name: '프랑스', stocks: ['FR-LUX', 'FR-COSME', 'FR-FOOD', 'FR-TOUR', 'FR-AIR'] },
  IN: { name: '인도', stocks: ['IN-IT', 'IN-PHARMA', 'IN-AUTO', 'IN-FOOD', 'IN-ENERGY'] },
  SA: { name: '사우디아라비아', stocks: ['SA-OIL', 'SA-PETRO', 'SA-ENERGY', 'SA-CONST', 'SA-TOUR'] },
  AE: { name: '아랍에미리트', stocks: ['AE-OIL', 'AE-LOGIS', 'AE-FIN', 'AE-TOUR', 'AE-CONST'] },
  BR: { name: '브라질', stocks: ['BR-AGRI', 'BR-FOOD', 'BR-MINING', 'BR-ENERGY', 'BR-AIR'] }
};

const ALL_STOCKS = [];
Object.keys(COUNTRIES).forEach(code => {
  COUNTRIES[code].stocks.forEach(s => {
    ALL_STOCKS.push({ code, name: s, country: COUNTRIES[code].name });
  });
});
ALL_STOCKS.push({ code: 'BTC', name: 'BITCOIN', country: '글로벌' });

// Initial prices (virtual)
const INITIAL_PRICES = {};
ALL_STOCKS.forEach(s => {
  if (s.name === 'BITCOIN') INITIAL_PRICES[s.name] = 50000000;
  else INITIAL_PRICES[s.name] = 100000 + Math.floor(Math.random() * 900000);
});

// ==================== QUIZ POOL (60+ questions) ====================
const QUIZ_POOL = [
  // Stock basics
  { q: 'PER(주가수익비율)이란 무엇인가요?', options: ['주가를 주당순이익으로 나눈 값', '주가를 순자산으로 나눈 값', '시가총액', '배당수익률'], answer: 0, type: 'mc' },
  { q: 'PBR(주가순자산비율)이란?', options: ['주가 / 주당순자산', '주가 / 주당순이익', '배당금 / 주가', '시가총액 / 매출'], answer: 0, type: 'mc' },
  { q: '시가총액이란?', options: ['주가 × 발행주식수', '순이익 × PER', '자산 - 부채', '배당금 총액'], answer: 0, type: 'mc' },
  { q: '배당금이란?', options: ['기업이 이익을 주주에게 나눠주는 돈', '주식 매수 수수료', '세금', '대출이자'], answer: 0, type: 'mc' },
  { q: '분산투자란?', options: ['여러 자산에 나눠 투자해 위험을 줄이는 것', '한 종목에만 집중 투자', '단기 매매', '레버리지 사용'], answer: 0, type: 'mc' },
  { q: '주가가 100원에서 150원이 되면 몇 % 상승인가?', options: ['50%', '150%', '30%', '100%'], answer: 0, type: 'mc' },
  { q: '주가가 100원에서 50원이 되면 몇 % 하락인가?', options: ['50%', '100%', '25%', '200%'], answer: 0, type: 'mc' },
  { q: '금리가 오르면 기업의 차입 비용은 어떻게 되는가?', options: ['증가한다', '감소한다', '변하지 않는다', '무조건 이익이 난다'], answer: 0, type: 'mc' },
  { q: '환율이 상승(원화 가치 하락)하면 수출기업에 어떤 영향이 생길 수 있는가?', options: ['수출 경쟁력이 높아질 수 있다', '수입 비용이 줄어든다', '무조건 손해', '영향 없다'], answer: 0, type: 'mc' },
  { q: '원유 가격이 오르면 항공산업에는 어떤 영향이 생길 수 있는가?', options: ['연료비 증가로 비용 부담', '무조건 이익 증가', '영향 없음', '승객이 늘어난다'], answer: 0, type: 'mc' },
  { q: 'ROE(자기자본이익률)가 높다는 것은?', options: ['자본을 효율적으로 사용해 이익을 낸다는 의미', '부채가 많다는 의미', '주가가 낮다는 의미', '배당을 안 준다는 의미'], answer: 0, type: 'mc' },
  { q: '인플레이션이 발생하면 일반적으로?', options: ['화폐 가치가 하락하고 물가가 상승한다', '물가가 하락한다', '금리가 무조건 내린다', '주식시장이 항상 좋다'], answer: 0, type: 'mc' },
  { q: '공급이 수요보다 많아지면 가격은?', options: ['하락 압력이 생긴다', '상승한다', '변하지 않는다', '무조건 폭등한다'], answer: 0, type: 'mc' },
  { q: '수요가 공급보다 많아지면 가격은?', options: ['상승 압력이 생긴다', '하락한다', '변하지 않는다', '무조건 폭락한다'], answer: 0, type: 'mc' },
  { q: '포트폴리오란?', options: ['여러 투자 자산의 조합', '한 종목만 보유', '현금만 보유', '부채 목록'], answer: 0, type: 'mc' },
  // Climate O/X
  { q: '폭염이 심해지면 냉방용 전력 수요가 증가할 수 있다.', options: ['O', 'X'], answer: 0, type: 'ox' },
  { q: '가뭄은 농업 생산량에 영향을 줄 수 있다.', options: ['O', 'X'], answer: 0, type: 'ox' },
  { q: '홍수로 항구가 폐쇄되면 물류에 차질이 생길 수 있다.', options: ['O', 'X'], answer: 0, type: 'ox' },
  { q: '산불은 관광산업에 영향을 줄 수 있다.', options: ['O', 'X'], answer: 0, type: 'ox' },
  { q: '기후변화는 농업에만 영향을 준다.', options: ['O', 'X'], answer: 1, type: 'ox' },
  { q: '태풍으로 항만이 폐쇄되면 수출입이 지연될 수 있다.', options: ['O', 'X'], answer: 0, type: 'ox' },
  { q: '해수면 상승은 해안 지역에 장기적인 위험이 될 수 있다.', options: ['O', 'X'], answer: 0, type: 'ox' },
  { q: '한파는 에너지 수요를 증가시킬 수 있다.', options: ['O', 'X'], answer: 0, type: 'ox' },
  { q: '가뭄이 심하면 수력발전량도 감소할 수 있다.', options: ['O', 'X'], answer: 0, type: 'ox' },
  { q: '화산 폭발은 항공 노선에 영향을 줄 수 있다.', options: ['O', 'X'], answer: 0, type: 'ox' },
  { q: '쓰나미는 해안 산업시설에 큰 피해를 줄 수 있다.', options: ['O', 'X'], answer: 0, type: 'ox' },
  { q: '기후변화는 식량 안보에도 영향을 미친다.', options: ['O', 'X'], answer: 0, type: 'ox' },
  // International / Geography
  { q: '산유국의 자연재해로 석유 수출이 막히면 국제 유가는 어떻게 될 가능성이 높은가?', options: ['상승할 수 있다', '하락한다', '변하지 않는다', '항상 안정된다'], answer: 0, type: 'mc' },
  { q: '주요 무역항이 전쟁으로 폐쇄되면 공급망에는 어떤 변화가 생길 수 있는가?', options: ['물류 지연과 비용 상승', '무조건 원활해진다', '영향 없다', '가격이 하락한다'], answer: 0, type: 'mc' },
  { q: '가뭄으로 농산물 생산량이 감소하면 식량 가격에는 어떤 영향이 생길 수 있는가?', options: ['상승 압력', '하락', '변화 없음', '항상 안정'], answer: 0, type: 'mc' },
  { q: '특정 국가와의 외교 관계 악화로 무역이 제한되면 수출기업에는 어떤 영향이 생길 수 있는가?', options: ['수출 감소 위험', '무조건 증가', '영향 없음', '비용이 줄어든다'], answer: 0, type: 'mc' },
  { q: '운하나 항로가 막히면 국제 운송비에 어떤 변화가 생길 수 있는가?', options: ['상승할 수 있다', '하락한다', '변하지 않는다', '항상 감소'], answer: 0, type: 'mc' },
  { q: '식량 부족이 심해지면 국제 원조의 중요성은 어떻게 변할 수 있는가?', options: ['커질 수 있다', '줄어든다', '변하지 않는다', '무관해진다'], answer: 0, type: 'mc' },
  { q: '종교·문화 행사가 특정 지역의 소비 패턴에 영향을 줄 수 있는가?', options: ['O', 'X'], answer: 0, type: 'ox' },
  { q: '전쟁이 원자재 공급에 영향을 미칠 수 있는가?', options: ['O', 'X'], answer: 0, type: 'ox' },
  { q: '공급망의 한 국가에서 문제가 발생하면 다른 국가 산업에도 영향을 줄 수 있는가?', options: ['O', 'X'], answer: 0, type: 'ox' },
  { q: '반도체 공급망이 차질을 빚으면 IT·자동차 산업에 영향이 갈 수 있는가?', options: ['O', 'X'], answer: 0, type: 'ox' },
  { q: '국제 금리가 상승하면 신흥국 자본 유출 압력이 커질 수 있는가?', options: ['O', 'X'], answer: 0, type: 'ox' },
  { q: '원유 가격 상승은 석유화학 산업 원가에 영향을 줄 수 있는가?', options: ['O', 'X'], answer: 0, type: 'ox' },
  { q: '관광 수요 증가는 관련 국가의 서비스·소비 산업에 긍정적일 수 있는가?', options: ['O', 'X'], answer: 0, type: 'ox' },
  { q: '배터리 원자재 가격 상승은 전기차 산업에 부담이 될 수 있는가?', options: ['O', 'X'], answer: 0, type: 'ox' },
  { q: '항만 물류 차질은 수출 중심 국가에 특히 큰 영향을 줄 수 있는가?', options: ['O', 'X'], answer: 0, type: 'ox' },
  { q: '지진·쓰나미는 일본의 제조·물류 산업에 영향을 줄 수 있는가?', options: ['O', 'X'], answer: 0, type: 'ox' },
  { q: '아마존 지역 가뭄은 브라질 농산물 생산에 영향을 줄 수 있는가?', options: ['O', 'X'], answer: 0, type: 'ox' },
  { q: '사우디의 에너지 정책 변화는 국제 유가에 영향을 줄 수 있는가?', options: ['O', 'X'], answer: 0, type: 'ox' },
  { q: '미국 금리 인상은 글로벌 금융시장에 영향을 줄 수 있는가?', options: ['O', 'X'], answer: 0, type: 'ox' },
  { q: '중국 제조업 부진은 글로벌 공급망에 영향을 줄 수 있는가?', options: ['O', 'X'], answer: 0, type: 'ox' },
  { q: '유럽의 친환경 규제는 자동차·화학 산업에 영향을 줄 수 있는가?', options: ['O', 'X'], answer: 0, type: 'ox' },
  { q: '인도의 IT·의약품 산업 성장은 글로벌 시장에 기회를 제공할 수 있는가?', options: ['O', 'X'], answer: 0, type: 'ox' },
  { q: '중동의 건설·관광 프로젝트는 관련 기업에 기회를 줄 수 있는가?', options: ['O', 'X'], answer: 0, type: 'ox' },
  { q: '비트코인 변동성은 일반 주식보다 클 수 있는가?', options: ['O', 'X'], answer: 0, type: 'ox' },
  { q: '공급망 다각화는 리스크 관리에 도움이 될 수 있는가?', options: ['O', 'X'], answer: 0, type: 'ox' },
  { q: '식량 가격 상승은 식품 관련 기업 수익성에 영향을 줄 수 있는가?', options: ['O', 'X'], answer: 0, type: 'ox' },
  { q: '항공 연료비 상승은 항공사 수익에 부담이 될 수 있는가?', options: ['O', 'X'], answer: 0, type: 'ox' },
  { q: '콘텐츠 수출 증가는 관련 국가의 소프트파워와 수익에 긍정적일 수 있는가?', options: ['O', 'X'], answer: 0, type: 'ox' },
  { q: '정밀기계 산업은 고기술·고부가가치 산업으로 분류될 수 있는가?', options: ['O', 'X'], answer: 0, type: 'ox' },
  { q: '플랫폼 기업은 네트워크 효과의 영향을 받을 수 있는가?', options: ['O', 'X'], answer: 0, type: 'ox' },
  { q: '광업 생산 차질은 원자재 가격에 영향을 줄 수 있는가?', options: ['O', 'X'], answer: 0, type: 'ox' },
  { q: '물류 허브 국가의 항만 효율은 국제 무역에 중요한가?', options: ['O', 'X'], answer: 0, type: 'ox' },
  { q: '금융 허브의 규제 변화는 자본 흐름에 영향을 줄 수 있는가?', options: ['O', 'X'], answer: 0, type: 'ox' },
  { q: '바이오 기술 발전은 의약품·헬스케어 산업에 기회를 줄 수 있는가?', options: ['O', 'X'], answer: 0, type: 'ox' },
  { q: '친환경 산업 성장은 장기적으로 관련 기업에 기회를 제공할 수 있는가?', options: ['O', 'X'], answer: 0, type: 'ox' },
  { q: '명품·화장품은 소비 심리와 환율에 민감할 수 있는가?', options: ['O', 'X'], answer: 0, type: 'ox' },
  { q: '에너지 전환 정책은 석유·신재생 에너지 관련 종목에 영향을 줄 수 있는가?', options: ['O', 'X'], answer: 0, type: 'ox' }
];

// ==================== NEWS TEMPLATES (detailed, country-specific) ====================
function generateNewsForTurn(turn) {
  const month = MONTHS[turn - 1];
  const newsList = [];

  // 1. World news
  const worldNews = [
    { title: `[세계] ${month} 글로벌 공급망 재편 가속`, content: '주요국 간 무역 갈등과 기후 이슈로 공급망 다각화 움직임이 강해지고 있다. 운송비와 원자재 가격 변동성이 커질 전망이다.', effects: { global: 0.1 } },
    { title: `[세계] ${month} 국제 유가와 금리 동반 변동`, content: '주요 산유국 생산 조정과 주요국 금리 정책이 겹치며 금융·에너지 시장 변동성이 확대되고 있다.', effects: { oil: 0.2, finance: -0.1 } },
    { title: `[세계] ${month} 기후 이상기후 빈발`, content: '폭염·가뭄·홍수가 여러 대륙에서 동시 발생하며 농산물·에너지·보험 산업에 영향을 미치고 있다.', effects: { agri: -0.15, energy: 0.1 } },
    { title: `[세계] ${month} 글로벌 관광 수요 회복세`, content: '국제 여행 재개와 문화 행사 증가로 관광·항공·소비 관련 산업이 활기를 띠고 있다.', effects: { tour: 0.2, air: 0.15 } },
    { title: `[세계] ${month} 반도체·배터리 공급망 긴장`, content: '핵심 원자재와 첨단 부품 공급 병목으로 IT·자동차·배터리 산업 전반에 파급 효과가 나타나고 있다.', effects: { chip: -0.1, battery: -0.1 } }
  ];
  newsList.push({ id: 1, category: 'world', ...worldNews[turn % worldNews.length], relatedStocks: ['K-CHIP', 'K-BATTERY', 'US-IT', 'CN-BATTERY', 'SA-OIL'] });

  // 2-11. Country news
  const countryNewsTemplates = {
    KR: [
      { title: `[대한민국] 반도체 수출 호조와 공급망 안정`, content: '주요 반도체 기업의 첨단 공정 양산이 본격화되며 수출이 증가하고 있다. 항만 물류도 원활해 배터리·자동차 부품 수출에 긍정적이다.', effects: { 'K-CHIP': 0.4, 'K-BATTERY': 0.25, 'K-MOTOR': 0.15 }, related: ['K-CHIP', 'K-BATTERY', 'K-MOTOR'] },
      { title: `[대한민국] 배터리 원자재 가격 상승 부담`, content: '리튬·니켈 가격 급등으로 배터리 기업 원가 부담이 커지고 있다. 다만 콘텐츠 수출은 호조를 이어가고 있다.', effects: { 'K-BATTERY': -0.35, 'K-CONTENT': 0.2 }, related: ['K-BATTERY', 'K-CONTENT'] },
      { title: `[대한민국] 자동차·배터리 동반 성장`, content: '전기차 수요 증가와 배터리 기술 경쟁력으로 관련 수출이 확대되고 있다. 식품 수출도 안정적이다.', effects: { 'K-MOTOR': 0.3, 'K-BATTERY': 0.35, 'K-FOOD': 0.1 }, related: ['K-MOTOR', 'K-BATTERY', 'K-FOOD'] },
      { title: `[대한민국] 항만 물류 차질 우려`, content: '일부 항만  Congestion과 기상 이슈로 수출입 일정이 지연될 가능성이 제기되고 있다. 반도체 공급망 모니터링이 필요하다.', effects: { 'K-CHIP': -0.2, 'K-MOTOR': -0.15 }, related: ['K-CHIP', 'K-MOTOR'] }
    ],
    JP: [
      { title: `[일본] 지진 여파로 제조·물류 일부 차질`, content: '일부 지역 지진으로 정밀기계·전자 생산라인에 일시 차질이 발생했다. 자동차 부품 공급에도 영향이 우려된다.', effects: { 'J-PRECISE': -0.4, 'J-ELEC': -0.3, 'J-AUTO': -0.25 }, related: ['J-PRECISE', 'J-ELEC', 'J-AUTO'] },
      { title: `[일본] 자동차·게임 산업 호조`, content: '신차 출시와 게임 콘텐츠 글로벌 흥행으로 관련 기업 실적 기대가 커지고 있다. 식품 수출도 안정적이다.', effects: { 'J-AUTO': 0.3, 'J-GAME': 0.45, 'J-FOOD': 0.1 }, related: ['J-AUTO', 'J-GAME', 'J-FOOD'] },
      { title: `[일본] 관광 수요 회복과 전자 수출`, content: '외국인 관광객 증가로 소비가 살아나고, 전자 부품 수출도 견조하다. 정밀기계 수요도 회복세다.', effects: { 'J-ELEC': 0.25, 'J-PRECISE': 0.2 }, related: ['J-ELEC', 'J-PRECISE'] },
      { title: `[일본] 쓰나미 경보로 해안 산업 경계`, content: '태평양 연안 쓰나미 경보로 일부 항만·공장 가동이 일시 중단됐다. 자동차·전자 물류에 단기 영향이 예상된다.', effects: { 'J-AUTO': -0.3, 'J-ELEC': -0.25 }, related: ['J-AUTO', 'J-ELEC'] }
    ],
    US: [
      { title: `[미국] IT·바이오 기술 투자 확대`, content: '주요 빅테크와 바이오 기업의 R&D 투자가 늘며 성장 기대가 커지고 있다. 금융시장 변동성은 지속되고 있다.', effects: { 'US-IT': 0.4, 'US-BIO': 0.35, 'US-FIN': -0.1 }, related: ['US-IT', 'US-BIO', 'US-FIN'] },
      { title: `[미국] 금리 인상 압력과 금융 시장`, content: '인플레이션 우려로 금리 인상 가능성이 제기되며 금융주와 성장주에 부담이 되고 있다. 자동차 수요는 견조하다.', effects: { 'US-FIN': -0.3, 'US-IT': -0.15, 'US-AUTO': 0.1 }, related: ['US-FIN', 'US-IT', 'US-AUTO'] },
      { title: `[미국] 허리케인으로 일부 지역 피해`, content: '강력한 허리케인이 남부 해안을 강타하며 물류·에너지 인프라에 피해가 발생했다. 콘텐츠·IT는 상대적으로 영향이 적다.', effects: { 'US-AUTO': -0.2 }, related: ['US-AUTO'] },
      { title: `[미국] 콘텐츠·자동차 동반 성장`, content: '스트리밍·엔터테인먼트 수요와 전기차 판매 호조로 관련 기업 실적이 개선되고 있다.', effects: { 'US-CONTENT': 0.35, 'US-AUTO': 0.25 }, related: ['US-CONTENT', 'US-AUTO'] }
    ],
    CN: [
      { title: `[중국] 전자·배터리 생산 확대`, content: '전자제품과 배터리 생산능력이 확대되며 수출이 증가하고 있다. 플랫폼 규제는 다소 완화되는 분위기다.', effects: { 'CN-ELEC': 0.3, 'CN-BATTERY': 0.4, 'CN-PLATFORM': 0.15 }, related: ['CN-ELEC', 'CN-BATTERY', 'CN-PLATFORM'] },
      { title: `[중국] 제조업 부진과 식품 가격`, content: '일부 제조업 지표 부진이 나타나고 있으며, 식품 물가 상승 압력이 지속되고 있다.', effects: { 'CN-MANU': -0.3, 'CN-FOOD': -0.15 }, related: ['CN-MANU', 'CN-FOOD'] },
      { title: `[중국] 플랫폼·전자 규제 완화 기대`, content: '디지털 플랫폼과 전자산업에 대한 정책 지원 기대가 커지며 투자 심리가 개선되고 있다.', effects: { 'CN-PLATFORM': 0.4, 'CN-ELEC': 0.25 }, related: ['CN-PLATFORM', 'CN-ELEC'] },
      { title: `[중국] 배터리 원자재 확보 경쟁`, content: '배터리 핵심 광물 확보 경쟁이 치열해지며 관련 기업 비용 부담이 커지고 있다.', effects: { 'CN-BATTERY': -0.35 }, related: ['CN-BATTERY'] }
    ],
    DE: [
      { title: `[독일] 자동차·친환경 산업 전환 가속`, content: '전기차와 친환경 기술 투자가 늘며 관련 기업 성장 기대가 커지고 있다. 화학·기계 산업도 회복세다.', effects: { 'DE-AUTO': 0.3, 'DE-GREEN': 0.45, 'DE-CHEM': 0.15 }, related: ['DE-AUTO', 'DE-GREEN', 'DE-CHEM'] },
      { title: `[독일] 에너지 비용 상승 부담`, content: '에너지 가격 상승으로 화학·기계 산업 원가 부담이 커지고 있다. 식품 물가도 영향을 받고 있다.', effects: { 'DE-CHEM': -0.3, 'DE-MACH': -0.2, 'DE-FOOD': -0.1 }, related: ['DE-CHEM', 'DE-MACH', 'DE-FOOD'] },
      { title: `[독일] 정밀기계·자동차 수출 호조`, content: '글로벌 수요 회복으로 기계·자동차 수출이 증가하고 있다. 친환경 정책 지원도 이어지고 있다.', effects: { 'DE-MACH': 0.35, 'DE-AUTO': 0.25, 'DE-GREEN': 0.2 }, related: ['DE-MACH', 'DE-AUTO', 'DE-GREEN'] },
      { title: `[독일] 화학 산업 공급망 이슈`, content: '일부 원자재 공급 차질로 화학 제품 생산에 영향을 미치고 있다.', effects: { 'DE-CHEM': -0.35 }, related: ['DE-CHEM'] }
    ],
    FR: [
      { title: `[프랑스] 명품·화장품 수요 회복`, content: '글로벌 소비 회복과 관광객 증가로 명품·화장품 판매가 호조를 보이고 있다. 항공 수요도 증가세다.', effects: { 'FR-LUX': 0.4, 'FR-COSME': 0.35, 'FR-AIR': 0.2 }, related: ['FR-LUX', 'FR-COSME', 'FR-AIR'] },
      { title: `[프랑스] 관광 시즌 본격화`, content: '주요 문화·관광 행사로 관광 수요가 급증하며 관련 산업이 활기를 띠고 있다. 식품 소비도 증가한다.', effects: { 'FR-TOUR': 0.5, 'FR-FOOD': 0.2 }, related: ['FR-TOUR', 'FR-FOOD'] },
      { title: `[프랑스] 항공·관광 동반 성장`, content: '국제선 운항 확대와 관광 수요로 항공·관광 기업 실적 기대가 커지고 있다.', effects: { 'FR-AIR': 0.35, 'FR-TOUR': 0.3 }, related: ['FR-AIR', 'FR-TOUR'] },
      { title: `[프랑스] 식품 물가와 소비 심리`, content: '식품 가격 상승으로 일부 소비 심리가 위축될 가능성이 제기되고 있다.', effects: { 'FR-FOOD': -0.2 }, related: ['FR-FOOD'] }
    ],
    IN: [
      { title: `[인도] IT·의약품 수출 확대`, content: '글로벌 IT 서비스와 제네릭 의약품 수요 증가로 관련 수출이 호조를 보이고 있다. 에너지 인프라 투자도 늘어나고 있다.', effects: { 'IN-IT': 0.4, 'IN-PHARMA': 0.35, 'IN-ENERGY': 0.15 }, related: ['IN-IT', 'IN-PHARMA', 'IN-ENERGY'] },
      { title: `[인도] 자동차·식품 내수 성장`, content: '중산층 확대와 내수 소비 증가로 자동차·식품 산업이 성장하고 있다.', effects: { 'IN-AUTO': 0.3, 'IN-FOOD': 0.25 }, related: ['IN-AUTO', 'IN-FOOD'] },
      { title: `[인도] 에너지 전환 투자 확대`, content: '신재생 에너지와 전력 인프라 투자가 늘며 관련 기업 기회가 확대되고 있다.', effects: { 'IN-ENERGY': 0.4 }, related: ['IN-ENERGY'] },
      { title: `[인도] 의약품 규제·공급 이슈`, content: '일부 의약품 규제 강화와 원자재 수급 이슈로 단기 부담이 나타나고 있다.', effects: { 'IN-PHARMA': -0.25 }, related: ['IN-PHARMA'] }
    ],
    SA: [
      { title: `[사우디] 석유 생산 조정과 유가`, content: '생산량 조정으로 국제 유가에 상승 압력이 가해지고 있다. 석유화학·에너지 관련 기업에 긍정적이다.', effects: { 'SA-OIL': 0.5, 'SA-PETRO': 0.35, 'SA-ENERGY': 0.3 }, related: ['SA-OIL', 'SA-PETRO', 'SA-ENERGY'] },
      { title: `[사우디] 사막 이상기후와 물 부족 우려`, content: '이상 고온과 물 부족 이슈로 일부 건설·관광 프로젝트에 차질이 우려된다. 에너지 정책은 안정적이다.', effects: { 'SA-CONST': -0.3, 'SA-TOUR': -0.25 }, related: ['SA-CONST', 'SA-TOUR'] },
      { title: `[사우디] 대형 건설·관광 프로젝트 추진`, content: '비전 관련 대형 건설과 관광 인프라 투자가 본격화되며 관련 기업 수주 기대가 커지고 있다.', effects: { 'SA-CONST': 0.45, 'SA-TOUR': 0.4 }, related: ['SA-CONST', 'SA-TOUR'] },
      { title: `[사우디] 석유화학 설비 확장`, content: '석유화학 단지 확장으로 생산능력이 늘어나며 수출 증가가 기대된다.', effects: { 'SA-PETRO': 0.4, 'SA-OIL': 0.15 }, related: ['SA-PETRO', 'SA-OIL'] }
    ],
    AE: [
      { title: `[UAE] 물류 허브 역할 강화`, content: '항만·항공 물류 인프라 확충으로 중동 물류 허브 지위가 강화되고 있다. 금융·관광도 동반 성장 중이다.', effects: { 'AE-LOGIS': 0.45, 'AE-FIN': 0.25, 'AE-TOUR': 0.3 }, related: ['AE-LOGIS', 'AE-FIN', 'AE-TOUR'] },
      { title: `[UAE] 석유·건설 동반 호조`, content: '유가 안정과 대형 건설 프로젝트로 관련 산업이 활기를 띠고 있다.', effects: { 'AE-OIL': 0.3, 'AE-CONST': 0.4 }, related: ['AE-OIL', 'AE-CONST'] },
      { title: `[UAE] 관광·금융 중심지 위상`, content: '국제 행사와 금융 허브 정책으로 관광·금융 수요가 증가하고 있다.', effects: { 'AE-TOUR': 0.4, 'AE-FIN': 0.35 }, related: ['AE-TOUR', 'AE-FIN'] },
      { title: `[UAE] 물류 비용 상승 압력`, content: '글로벌 운송비 상승으로 물류 기업 비용 부담이 커지고 있다.', effects: { 'AE-LOGIS': -0.25 }, related: ['AE-LOGIS'] }
    ],
    BR: [
      { title: `[브라질] 가뭄으로 농산물 생산 감소`, content: '주요 농업 지역 가뭄으로 대두·옥수수 등 생산량이 감소하며 식량 가격 상승 압력이 커지고 있다. 식품·농산물 관련 종목에 영향이 예상된다.', effects: { 'BR-AGRI': -0.45, 'BR-FOOD': -0.3 }, related: ['BR-AGRI', 'BR-FOOD'] },
      { title: `[브라질] 아마존·광업 이슈`, content: '환경 규제와 광업 생산 차질로 원자재 공급에 변동성이 커지고 있다. 에너지·항공은 상대적으로 안정적이다.', effects: { 'BR-MINING': -0.35, 'BR-ENERGY': 0.1 }, related: ['BR-MINING', 'BR-ENERGY'] },
      { title: `[브라질] 농산물 수출 호조 회복`, content: '작황 개선과 글로벌 수요로 농산물 수출이 회복되며 관련 산업이 개선되고 있다.', effects: { 'BR-AGRI': 0.4, 'BR-FOOD': 0.25 }, related: ['BR-AGRI', 'BR-FOOD'] },
      { title: `[브라질] 홍수 피해와 인프라`, content: '일부 지역 홍수로 물류·농업에 피해가 발생했다. 항공·에너지 수요는 유지되고 있다.', effects: { 'BR-AGRI': -0.3, 'BR-AIR': -0.15 }, related: ['BR-AGRI', 'BR-AIR'] }
    ]
  };

  const countryCodes = ['KR', 'JP', 'US', 'CN', 'DE', 'FR', 'IN', 'SA', 'AE', 'BR'];
  countryCodes.forEach((code, idx) => {
    const templates = countryNewsTemplates[code];
    const t = templates[turn % templates.length];
    newsList.push({
      id: idx + 2,
      category: code,
      title: t.title,
      content: t.content,
      effects: t.effects,
      relatedStocks: t.related
    });
  });

  // 12. Supply chain / regional
  const supplyNews = [
    { title: `[공급망] 주요 해상 항로 운임 상승`, content: '일부 운하·항로 혼잡으로 컨테이너 운임이 상승하며 수출입 기업 비용 부담이 커지고 있다. 물류·제조 관련 종목에 영향이 예상된다.', effects: { 'AE-LOGIS': 0.2, 'K-CHIP': -0.1 }, related: ['AE-LOGIS', 'K-CHIP', 'CN-MANU'] },
    { title: `[공급망] 반도체 장비·부품 공급 지연`, content: '첨단 장비 공급 지연으로 일부 반도체·전자 생산 일정이 조정되고 있다.', effects: { 'K-CHIP': -0.25, 'J-ELEC': -0.2, 'US-IT': -0.15 }, related: ['K-CHIP', 'J-ELEC', 'US-IT'] },
    { title: `[공급망] 원자재 운송 차질`, content: '광물·에너지 원자재 운송에 차질이 발생하며 관련 산업 원가 변동성이 커지고 있다.', effects: { 'BR-MINING': -0.2, 'SA-OIL': 0.15 }, related: ['BR-MINING', 'SA-OIL'] },
    { title: `[공급망] 글로벌 물류 정상화 기대`, content: '항만 적체 해소와 운송 능력 확대로 공급망이 점차 안정되고 있다.', effects: { 'AE-LOGIS': 0.3, 'K-MOTOR': 0.1 }, related: ['AE-LOGIS', 'K-MOTOR'] }
  ];
  newsList.push({ id: 12, category: 'supply', ...supplyNews[turn % supplyNews.length], relatedStocks: supplyNews[turn % supplyNews.length].related });

  // 13. Additional global
  const extraNews = [
    { title: `[글로벌] 식량 안보와 농산물 가격`, content: '주요 생산국 작황 변동으로 국제 식량 가격 변동성이 확대되고 있다. 식품·농업 관련 산업에 주의가 필요하다.', effects: { 'BR-AGRI': -0.2, 'K-FOOD': 0.15, 'CN-FOOD': 0.1 }, related: ['BR-AGRI', 'K-FOOD', 'CN-FOOD'] },
    { title: `[글로벌] 에너지 전환과 투자`, content: '신재생 에너지 투자가 늘며 관련 인프라·장비 수요가 증가하고 있다. 전통 에너지와의 균형이 관건이다.', effects: { 'DE-GREEN': 0.3, 'IN-ENERGY': 0.25, 'SA-ENERGY': 0.1 }, related: ['DE-GREEN', 'IN-ENERGY', 'SA-ENERGY'] },
    { title: `[글로벌] 무역 갈등과 관세 이슈`, content: '주요국 간 관세·무역 제한 조치로 수출 기업 불확실성이 커지고 있다.', effects: { 'CN-MANU': -0.2, 'US-AUTO': -0.15 }, related: ['CN-MANU', 'US-AUTO'] },
    { title: `[글로벌] 문화·관광 소비 회복`, content: '국제 문화 행사와 관광 재개로 관련 소비·서비스 산업이 살아나고 있다.', effects: { 'FR-TOUR': 0.25, 'AE-TOUR': 0.2, 'K-CONTENT': 0.15 }, related: ['FR-TOUR', 'AE-TOUR', 'K-CONTENT'] }
  ];
  newsList.push({ id: 13, category: 'global', ...extraNews[turn % extraNews.length], relatedStocks: extraNews[turn % extraNews.length].related });

  // 14. Bitcoin news
  const btcNews = [
    { title: `[비트코인] 기관 투자 유입 증가`, content: '주요 기관의 암호화폐 관련 상품 관심이 늘며 비트코인 가격 변동성이 커지고 있다. 규제 이슈도 함께 주목된다.', effects: { 'BITCOIN': 0.6 }, related: ['BITCOIN'] },
    { title: `[비트코인] 규제 강화 우려`, content: '일부 국가의 규제 강화 움직임으로 단기 조정 압력이 나타나고 있다.', effects: { 'BITCOIN': -0.55 }, related: ['BITCOIN'] },
    { title: `[비트코인] 네트워크 업그레이드 기대`, content: '기술적 업그레이드와 채택 확대 기대가 가격에 긍정적 요인으로 작용하고 있다.', effects: { 'BITCOIN': 0.7 }, related: ['BITCOIN'] },
    { title: `[비트코인] 매크로 불확실성과 변동성`, content: '금리·유동성 환경 변화로 비트코인 변동성이 확대되고 있다. 고위험 자산 성격이 부각된다.', effects: { 'BITCOIN': -0.65 }, related: ['BITCOIN'] },
    { title: `[비트코인] 채굴 난이도·해시레이트 변동`, content: '채굴 환경 변화와 에너지 비용이 비트코인 공급 측면에 영향을 미치고 있다.', effects: { 'BITCOIN': 0.4 }, related: ['BITCOIN'] }
  ];
  newsList.push({ id: 14, category: 'btc', ...btcNews[turn % btcNews.length], relatedStocks: ['BITCOIN'] });

  // Ensure exactly 14
  return newsList.slice(0, 14);
}

// ==================== GAME STATE ====================
let gameState = {
  turn: 0, // 0 = not started, 1-12 = months
  status: 'waiting', // waiting, running, paused, finished
  turnStartTime: null,
  remainingMs: TURN_DURATION_MS,
  pauseRemainingMs: null,
  prices: { ...INITIAL_PRICES },
  priceHistory: {}, // stockName -> [price0, price1, ...]
  players: {}, // playerId -> player data
  sessions: {}, // sessionToken -> playerId
  nicknames: new Set(),
  news: [], // current turn news (14)
  quizzes: [], // current turn quizzes (14) matched 1:1
  unlockedNews: {}, // playerId -> Set of newsIds
  events: {
    socialLastTurn: 0,
    riskLastTurn: 0
  },
  adminSockets: new Set()
};

// Initialize price history
ALL_STOCKS.forEach(s => {
  gameState.priceHistory[s.name] = [INITIAL_PRICES[s.name]];
});

function createPlayer(socketId, nickname, sessionToken) {
  return {
    id: 'p_' + sessionToken.slice(0, 12),
    socketId,
    sessionToken,
    nickname,
    cash: START_CASH,
    holdings: {}, // stockName -> qty
    socialPoints: 0,
    failedNews: new Set(),
    attemptedNews: new Set(),
    assetHistory: [{ turn: 0, month: '시작', assets: START_CASH, cash: START_CASH }],
    transactions: [],
    disconnectedAt: null,
    eventUsed: {},
    unlockedNews: new Set(),
    joinedAt: Date.now()
  };
}

function getPlayerTotalAsset(player) {
  let total = player.cash;
  for (const [stock, qty] of Object.entries(player.holdings)) {
    if (qty > 0 && gameState.prices[stock]) {
      total += qty * gameState.prices[stock];
    }
  }
  return Math.floor(total);
}

function getRanking() {
  const list = Object.values(gameState.players).map(p => ({
    nickname: p.nickname,
    total: getPlayerTotalAsset(p),
    socialPoints: p.socialPoints || 0
  }));
  list.sort((a, b) => b.total - a.total);
  return list;
}

function applyNewsEffects(newsItem) {
  if (!newsItem.effects) return;
  for (const [key, change] of Object.entries(newsItem.effects)) {
    if (key === 'global' || key === 'oil' || key === 'finance' || key === 'agri' || key === 'energy' || key === 'tour' || key === 'air' || key === 'chip' || key === 'battery') {
      // broad effects - apply mild to related
      continue;
    }
    if (gameState.prices[key] !== undefined) {
      let factor = 1 + change;
      // add some randomness ±10%
      factor += (Math.random() - 0.5) * 0.2;
      let newPrice = Math.floor(gameState.prices[key] * factor);
      if (newPrice < 1000) newPrice = 1000; // floor
      gameState.prices[key] = newPrice;
    }
  }
  // Apply related stocks with extra volatility
  if (newsItem.relatedStocks) {
    newsItem.relatedStocks.forEach(stock => {
      if (gameState.prices[stock] !== undefined) {
        const baseChange = newsItem.effects[stock] || (Math.random() > 0.5 ? 0.2 : -0.2);
        let factor = 1 + baseChange + (Math.random() - 0.5) * 0.3;
        // Bitcoin higher vol
        if (stock === 'BITCOIN') {
          factor = 1 + (baseChange * 1.2) + (Math.random() - 0.5) * 0.5;
        }
        let newPrice = Math.floor(gameState.prices[stock] * Math.max(0.1, Math.min(3, factor)));
        if (newPrice < 1000) newPrice = 1000;
        gameState.prices[stock] = newPrice;
      }
    });
  }
}

function startTurn(turnNum) {
  gameState.turn = turnNum;
  gameState.status = 'running';
  gameState.turnStartTime = Date.now();
  gameState.remainingMs = TURN_DURATION_MS;
  gameState.pauseRemainingMs = null;

  // Each month has a fresh set of 14 news/quizzes. Previous-month quiz status must not leak into the new month.
  Object.values(gameState.players).forEach(player => {
    player.unlockedNews.clear();
    player.failedNews.clear();
    player.attemptedNews.clear();
    player.eventUsed = {};
  });

  // Generate exactly 14 news
  gameState.news = generateNewsForTurn(turnNum);

  // Assign 14 random unique quizzes 1:1
  const shuffled = [...QUIZ_POOL].sort(() => Math.random() - 0.5);
  gameState.quizzes = shuffled.slice(0, 14).map((q, i) => ({
    newsId: i + 1,
    ...q
  }));

  // Apply price changes based on news (big moves)
  gameState.news.forEach(n => applyNewsEffects(n));

  // Record price history
  ALL_STOCKS.forEach(s => {
    if (!gameState.priceHistory[s.name]) gameState.priceHistory[s.name] = [];
    gameState.priceHistory[s.name].push(gameState.prices[s.name]);
  });

  // Server-authoritative player asset history: one snapshot per month.
  Object.values(gameState.players).forEach(player => {
    player.assetHistory.push({
      turn: turnNum,
      month,
      assets: getPlayerTotalAsset(player),
      cash: Math.floor(player.cash)
    });
  });

  // Random events check
  maybeTriggerEvents(turnNum);

  broadcastState();
  startTimer();
}

let timerInterval = null;

function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (gameState.status !== 'running') return;
    const elapsed = Date.now() - gameState.turnStartTime;
    gameState.remainingMs = Math.max(0, TURN_DURATION_MS - elapsed);
    if (gameState.remainingMs <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      if (gameState.turn < TOTAL_TURNS) {
        // Auto next turn? Or wait for admin? Spec says 5 min then end turn. Admin can force next.
        // For simplicity, auto advance if running
        nextTurn();
      } else {
        endGame();
      }
    }
    // Broadcast timer every few seconds
    if (Math.floor(gameState.remainingMs / 1000) % 5 === 0 || gameState.remainingMs < 10000) {
      io.emit('timer', { remainingMs: gameState.remainingMs, turn: gameState.turn, status: gameState.status });
    }
  }, 1000);
}

function nextTurn() {
  if (gameState.turn >= TOTAL_TURNS) {
    endGame();
    return;
  }
  startTurn(gameState.turn + 1);
}

function endGame() {
  gameState.status = 'finished';
  if (timerInterval) clearInterval(timerInterval);
  io.emit('gameEnd', { ranking: getRanking(), turn: gameState.turn });
  broadcastState();
}

function pauseGame() {
  if (gameState.status !== 'running') return;
  gameState.status = 'paused';
  gameState.pauseRemainingMs = gameState.remainingMs;
  if (timerInterval) clearInterval(timerInterval);
  broadcastState();
}

function resumeGame() {
  if (gameState.status !== 'paused') return;
  gameState.status = 'running';
  gameState.turnStartTime = Date.now() - (TURN_DURATION_MS - gameState.pauseRemainingMs);
  gameState.remainingMs = gameState.pauseRemainingMs;
  startTimer();
  broadcastState();
}

function resetGame() {
  if (timerInterval) clearInterval(timerInterval);
  gameState = {
    turn: 0,
    status: 'waiting',
    turnStartTime: null,
    remainingMs: TURN_DURATION_MS,
    pauseRemainingMs: null,
    prices: { ...INITIAL_PRICES },
    priceHistory: {},
    players: {},
    sessions: {},
    nicknames: new Set(),
    news: [],
    quizzes: [],
    unlockedNews: {},
    events: { socialLastTurn: 0, riskLastTurn: 0 },
    adminSockets: new Set()
  };
  ALL_STOCKS.forEach(s => {
    gameState.priceHistory[s.name] = [INITIAL_PRICES[s.name]];
  });
  io.emit('reset');
  broadcastState();
}

function maybeTriggerEvents(turn) {
  // Events are offered per player so one student's choice never consumes another student's event.
  const socialDue = turn >= 3 && turn % 3 === 0;
  const riskDue = turn >= 4 && turn % 4 === 0;
  Object.values(gameState.players).forEach(player => {
    if (socialDue) player.eventUsed[`${turn}:social`] = false;
    if (riskDue) player.eventUsed[`${turn}:risk`] = false;
    if (player.socketId) {
      const sock = io.sockets.sockets.get(player.socketId);
      if (sock) {
        if (socialDue) sock.emit('specialEvent', {
          type: 'social', turn,
          title: '도움이 필요한 사람에게 지원을 선택하는 이벤트',
          description: '교육용 사회 선택 이벤트입니다. 실제 사람이나 실제 돈과 관련이 없습니다.',
          choices: [
            { id: 'help', text: '적극적으로 돕는다', cash: -200000, social: 50 },
            { id: 'small', text: '소액만 지원한다', cash: -50000, social: 20 },
            { id: 'pass', text: '지원하지 않는다', cash: 0, social: 0 }
          ]
        });
        if (riskDue) sock.emit('specialEvent', {
          type: 'risk', turn,
          title: '가상 리스크 선택 이벤트',
          description: '실제 도박이 아닌 게임 속 가상 선택입니다. 참여하지 않아도 됩니다.',
          choices: [
            { id: 'high', text: '고위험 선택 (±100만원)', risk: true },
            { id: 'skip', text: '참여하지 않는다', risk: false }
          ]
        });
      }
    }
  });
}
function broadcastState() {
  const publicState = {
    turn: gameState.turn,
    month: gameState.turn > 0 ? MONTHS[gameState.turn - 1] : '-',
    status: gameState.status,
    remainingMs: gameState.remainingMs,
    prices: gameState.prices,
    priceHistory: gameState.priceHistory,
    playerCount: Object.keys(gameState.players).length,
    ranking: getRanking(),
    newsCount: gameState.news.length
  };
  io.emit('state', publicState);

  // Admin gets more
  gameState.adminSockets.forEach(sid => {
    const sock = io.sockets.sockets.get(sid);
    if (sock) {
      sock.emit('adminState', {
        ...publicState,
        news: gameState.news,
        quizzes: gameState.quizzes.map(q => ({ newsId: q.newsId, q: q.q })),
        players: Object.values(gameState.players).map(p => ({
          id: p.id,
          nickname: p.nickname,
          cash: p.cash,
          total: getPlayerTotalAsset(p),
          socialPoints: p.socialPoints,
          holdings: p.holdings,
          unlockedNews: [...p.unlockedNews],
          failedNews: [...p.failedNews],
          assetHistory: p.assetHistory
        }))
      });
    }
  });
}

// ==================== SOCKET HANDLERS ====================
io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  socket.on('join', (data) => {
    const nickname = (data.nickname || '').trim();
    const suppliedToken = String(data.sessionToken || '').trim();
    if (suppliedToken && gameState.sessions[suppliedToken]) {
      const player = gameState.players[gameState.sessions[suppliedToken]];
      if (player && player.nickname === nickname) {
        player.socketId = socket.id;
        socket.data.playerId = player.id;
        player.disconnectedAt = null;
        socket.emit('joined', {
          nickname: player.nickname,
          sessionToken: player.sessionToken,
          cash: player.cash,
          total: getPlayerTotalAsset(player),
          turn: gameState.turn,
          month: gameState.turn > 0 ? MONTHS[gameState.turn - 1] : '-',
          status: gameState.status,
          holdings: player.holdings,
          failedNews: [...player.failedNews]
        });
        broadcastState();
        return;
      }
    }
    if (!nickname || nickname.length < 2 || nickname.length > 16) {
      socket.emit('error', { message: '닉네임은 2~16자로 입력해주세요.' });
      return;
    }
    if (gameState.nicknames.has(nickname)) {
      socket.emit('error', { message: '이미 사용 중인 닉네임입니다.' });
      return;
    }
    if (Object.keys(gameState.players).length >= MAX_PLAYERS) {
      socket.emit('error', { message: '최대 참가 인원(30명)을 초과했습니다.' });
      return;
    }
    if (gameState.status === 'finished') {
      socket.emit('error', { message: '게임이 이미 종료되었습니다.' });
      return;
    }
    const sessionToken = require('crypto').randomBytes(24).toString('hex');
    const player = createPlayer(socket.id, nickname, sessionToken);
    gameState.nicknames.add(nickname);
    gameState.players[player.id] = player;
    gameState.sessions[sessionToken] = player.id;
    socket.data.playerId = player.id;
    socket.emit('joined', {
      nickname,
      sessionToken,
      cash: START_CASH,
      total: START_CASH,
      turn: gameState.turn,
      month: gameState.turn > 0 ? MONTHS[gameState.turn - 1] : '-',
      status: gameState.status,
      holdings: {},
      failedNews: []
    });
    broadcastState();
  });

  socket.on('adminLogin', (data) => {
    if (data.code === ADMIN_CODE) {
      gameState.adminSockets.add(socket.id);
      socket.emit('adminAuth', { success: true });
      broadcastState();
    } else {
      socket.emit('adminAuth', { success: false, message: '코드가 올바르지 않습니다.' });
    }
  });

  socket.on('adminAction', (data) => {
    if (!gameState.adminSockets.has(socket.id)) {
      socket.emit('error', { message: '관리자 권한이 없습니다.' });
      return;
    }
    switch (data.action) {
      case 'nextTurn':
        if (gameState.turn === 0) startTurn(1);
        else nextTurn();
        break;
      case 'pause':
        pauseGame();
        break;
      case 'resume':
        resumeGame();
        break;
      case 'reset':
        resetGame();
        break;
    }
  });

  socket.on('getNewsList', () => {
    const player = gameState.players[gameState.sessions[socket.handshake.auth?.sessionToken] || socket.data.playerId];
    if (!player) return;
    const list = gameState.news.map(n => ({
      id: n.id,
      title: n.title,
      category: n.category,
      unlocked: player.unlockedNews.has(n.id),
      failed: player.failedNews.has(n.id),
      relatedStocks: n.relatedStocks || []
    }));
    socket.emit('newsList', list);
  });

  socket.on('getQuiz', (data) => {
    const player = gameState.players[socket.data.playerId];
    if (!player) return;
    const quiz = gameState.quizzes.find(q => q.newsId === Number(data.newsId));
    if (!quiz) return socket.emit('error', { message: '퀴즈를 찾을 수 없습니다.' });
    const newsId = quiz.newsId;
    if (player.failedNews.has(newsId)) {
      return socket.emit('quizResult', { correct: false, failed: true, message: '이 문제는 오답 처리되어 다시 도전할 수 없습니다.' });
    }
    if (player.unlockedNews.has(newsId)) {
      const news = gameState.news.find(n => n.id === newsId);
      return socket.emit('newsDetail', news);
    }
    socket.emit('quiz', { newsId, q: quiz.q, options: quiz.options, type: quiz.type });
  });

  socket.on('submitQuiz', (data) => {
    const player = gameState.players[socket.data.playerId];
    if (!player) return;
    const newsId = Number(data.newsId);
    const quiz = gameState.quizzes.find(q => q.newsId === newsId);
    if (!quiz) return;
    if (player.failedNews.has(newsId)) {
      return socket.emit('quizResult', { correct: false, failed: true, message: '오답 처리된 퀴즈라 재도전할 수 없습니다.' });
    }
    if (player.unlockedNews.has(newsId)) {
      return socket.emit('quizResult', { correct: true, already: true });
    }
    player.attemptedNews.add(newsId);
    const correct = Number(data.answer) === Number(quiz.answer);
    if (correct) {
      player.unlockedNews.add(newsId);
      const news = gameState.news.find(n => n.id === newsId);
      socket.emit('quizResult', { correct: true, news });
      socket.emit('unlockedStocks', news.relatedStocks || []);
    } else {
      player.failedNews.add(newsId);
      socket.emit('quizResult', { correct: false, failed: true, newsId, message: '틀렸습니다. 이 퀴즈는 오답 처리되어 다시 도전할 수 없습니다.' });
    }
    broadcastState();
  });

  socket.on('trade', (data) => {
    const player = gameState.players[socket.data.playerId];
    if (!player) return;
    const { stock, action } = data;
    const quantity = Math.floor(Number(data.qty));
    if (!stock || !Number.isFinite(quantity) || quantity <= 0 || !gameState.prices[stock]) {
      return socket.emit('error', { message: '잘못된 거래 요청입니다.' });
    }
    if (gameState.turn === 0 || gameState.status !== 'running') {
      return socket.emit('error', { message: '게임이 진행 중일 때만 거래할 수 있습니다.' });
    }
    const unlocked = [...player.unlockedNews].some(nid => {
      const n = gameState.news.find(x => x.id === nid);
      return n && (n.relatedStocks || []).includes(stock);
    });
    if (!unlocked) {
      return socket.emit('error', { message: '먼저 이 종목과 연결된 뉴스의 퀴즈를 맞혀야 거래할 수 있습니다.' });
    }
    const price = gameState.prices[stock];
    if (action === 'buy') {
      const value = price * quantity;
      if (player.cash < value) return socket.emit('error', { message: '보유 현금이 부족합니다.' });
      player.cash -= value;
      player.holdings[stock] = (player.holdings[stock] || 0) + quantity;
    } else if (action === 'sell') {
      const held = player.holdings[stock] || 0;
      if (held < quantity) return socket.emit('error', { message: '보유 수량보다 많이 매도할 수 없습니다.' });
      player.cash += price * quantity;
      player.holdings[stock] = held - quantity;
      if (player.holdings[stock] <= 0) delete player.holdings[stock];
    } else return socket.emit('error', { message: '잘못된 거래 유형입니다.' });

    const meta = ALL_STOCKS.find(x => x.name === stock);
    const tx = {
      id: `tx_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
      timestamp: new Date().toISOString(), turn: gameState.turn, month: MONTHS[gameState.turn-1],
      playerId: player.id, nickname: player.nickname, country: meta ? meta.country : '글로벌',
      stock, action, quantity, price, value: price * quantity
    };
    player.transactions.push(tx);
    gameState.adminSockets.forEach(sid => io.sockets.sockets.get(sid)?.emit('newTransaction', tx));
    socket.emit('tradeResult', { success: true, cash: player.cash, holdings: player.holdings, total: getPlayerTotalAsset(player) });
    broadcastState();
  });

  socket.on('getPortfolio', () => {
    const player = gameState.players[socket.data.playerId];
    if (!player) return;
    socket.emit('portfolio', { cash: player.cash, holdings: player.holdings, total: getPlayerTotalAsset(player), socialPoints: player.socialPoints, prices: gameState.prices, failedNews: [...player.failedNews], unlockedNews: [...player.unlockedNews] });
  });

  socket.on('getPriceHistory', (data) => {
    const stock = String(data.stock || '');
    const hist = gameState.priceHistory[stock] || [];
    socket.emit('priceHistory', { stock, history: hist, months: ['시작', ...MONTHS.slice(0, Math.max(0, hist.length - 1))] });
  });

  socket.on('getCountryHistory', (data) => {
    const code = String(data.country || '');
    const country = COUNTRIES[code];
    if (!country) return socket.emit('error', { message: '국가를 찾을 수 없습니다.' });
    const stocks = country.stocks;
    const series = stocks.map(stock => {
      const h = gameState.priceHistory[stock] || [];
      const base = h[0] || 1;
      return { stock, values: h.map(v => Number(((v / base) * 100).toFixed(2))) };
    });
    socket.emit('countryHistory', { country: code, name: country.name, stocks: series, months: ['시작', ...MONTHS.slice(0, Math.max(0, (gameState.turn + 1) - 1))] });
  });

  socket.on('getPlayerHistory', (data) => {
    if (!gameState.adminSockets.has(socket.id)) return socket.emit('error', { message: '관리자 권한이 없습니다.' });
    const player = gameState.players[String(data.playerId)];
    if (!player) return socket.emit('error', { message: '플레이어를 찾을 수 없습니다.' });
    socket.emit('playerHistory', { player: { id: player.id, nickname: player.nickname, cash: player.cash, total: getPlayerTotalAsset(player), holdings: player.holdings, failedNews: [...player.failedNews], unlockedNews: [...player.unlockedNews] }, history: player.assetHistory, transactions: player.transactions });
  });

  socket.on('getTransactions', (data = {}) => {
    if (!gameState.adminSockets.has(socket.id)) return socket.emit('error', { message: '관리자 권한이 없습니다.' });
    let rows = Object.values(gameState.players).flatMap(p => p.transactions);
    if (data.nickname) rows = rows.filter(x => x.nickname === data.nickname);
    if (data.country) rows = rows.filter(x => x.country === data.country);
    if (data.stock) rows = rows.filter(x => x.stock === data.stock);
    if (data.action) rows = rows.filter(x => x.action === data.action);
    if (data.turn) rows = rows.filter(x => x.turn === Number(data.turn));
    rows.sort((a,b) => new Date(b.timestamp)-new Date(a.timestamp));
    socket.emit('transactions', rows.slice(0, 500));
  });

  socket.on('eventChoice', (data) => {
    const player = gameState.players[socket.data.playerId];
    if (!player) return;
    const turn = gameState.turn;
    const key = `${turn}:${data.type}`;
    if (player.eventUsed[key]) return socket.emit('eventResult', { message: '이미 선택한 이벤트입니다.', cash: player.cash, socialPoints: player.socialPoints });
    player.eventUsed[key] = true;
    if (data.type === 'social') {
      if (data.choice === 'help' && player.cash >= 200000) { player.cash -= 200000; player.socialPoints += 50; }
      else if (data.choice === 'small' && player.cash >= 50000) { player.cash -= 50000; player.socialPoints += 20; }
      socket.emit('eventResult', { message: '선택이 반영되었습니다.', cash: player.cash, socialPoints: player.socialPoints });
    } else if (data.type === 'risk') {
      if (data.choice === 'high') {
        const amount = 1000000;
        const win = Math.random() > 0.5;
        if (win) player.cash += amount; else player.cash = Math.max(0, player.cash - amount);
        socket.emit('eventResult', { message: win ? `+${amount.toLocaleString()}원` : `-${amount.toLocaleString()}원`, cash: player.cash });
      } else socket.emit('eventResult', { message: '참여하지 않았습니다.', cash: player.cash });
    }
    broadcastState();
  });

  socket.on('disconnect', () => {
    const player = gameState.players[socket.data.playerId];
    if (player && player.socketId === socket.id) {
      player.socketId = null;
      player.disconnectedAt = Date.now();
    }
    gameState.adminSockets.delete(socket.id);
    broadcastState();
    console.log('Disconnected:', socket.id);
  });
});
;

// Routes
app.get('/', (req, res) => {
  const indexPath = path.join(PUBLIC_DIR, 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.error('index.html not found at', indexPath);
    return res.status(500).send('index.html not found. Check that public/ folder is deployed.');
  }
  res.sendFile(indexPath);
});
app.get('/admin.html', (req, res) => {
  const adminPath = path.join(PUBLIC_DIR, 'admin.html');
  if (!fs.existsSync(adminPath)) {
    return res.status(500).send('admin.html not found.');
  }
  res.sendFile(adminPath);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`GLOBAL MARKET server running on port ${PORT}`);
  console.log('Public dir:', PUBLIC_DIR);
  console.log('index.html exists:', fs.existsSync(path.join(PUBLIC_DIR, 'index.html')));
});
