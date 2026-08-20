export type TarotCard = {
  id: string;
  name: string;
  fortune: string;
  motif: number;
};

export const TAROT_CARDS: TarotCard[] = [
  {
    id: "star-door",
    name: "별의 문",
    fortune: "오늘 무심코 지나친 것 중 하나가, 나중에 가장 크게 웃게 될 이야기가 됩니다.",
    motif: 0,
  },
  {
    id: "moon-door",
    name: "달의 문",
    fortune: "혼자라고 느낀 순간에도, 누군가는 이미 당신 쪽 문을 두드리고 있습니다.",
    motif: 1,
  },
  {
    id: "clock-door",
    name: "시계의 문",
    fortune: "서두르던 일을 잠깐 멈추면, 오히려 원하던 답이 먼저 도착합니다.",
    motif: 2,
  },
  {
    id: "key-door",
    name: "열쇠의 문",
    fortune: "지금 손에 쥔 열쇠는 생각보다 큰 문을 엽니다. 아직 시도하지 않았을 뿐.",
    motif: 3,
  },
  {
    id: "maze-door",
    name: "미로의 문",
    fortune: "돌아가는 길처럼 보여도, 그 길이 결국 가장 빠른 길이었음을 알게 됩니다.",
    motif: 4,
  },
  {
    id: "spark-door",
    name: "불꽃의 문",
    fortune: "망설이던 한마디를 오늘 꺼내보세요. 예상보다 반가운 대답이 돌아옵니다.",
    motif: 5,
  },
  {
    id: "mirror-door",
    name: "거울의 문",
    fortune: "남이 아니라 나 자신에게 놀랄 일이 생깁니다. 좋은 쪽으로.",
    motif: 6,
  },
  {
    id: "wind-door",
    name: "바람의 문",
    fortune: "억지로 붙잡지 않아도, 인연은 스스로 제 타이밍에 찾아옵니다.",
    motif: 7,
  },
  {
    id: "map-door",
    name: "지도의 문",
    fortune: "다음 목적지는 이미 정해져 있습니다. 다만 조금 낯선 방향일 뿐.",
    motif: 8,
  },
  {
    id: "dream-door",
    name: "꿈의 문",
    fortune: "오늘 꾼 짧은 꿈 하나가, 며칠 안에 현실에서 다시 마주치게 됩니다.",
    motif: 9,
  },
];
