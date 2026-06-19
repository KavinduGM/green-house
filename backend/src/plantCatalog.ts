// Default agronomic models for the crops grown in this greenhouse.
// These are baseline estimates; the AI engine refines them and the grower's
// logged measurements continuously correct the model over time.
//
// form drives the 2D visualizer: bush | vine | herb | root | tree
// All day values are days-after-planting (transplant) unless noted.

export interface PlantModel {
  key: string;
  sinhala: string;     // Singlish name the grower uses
  english: string;     // common English name
  category: 'fruiting' | 'leafy' | 'herb' | 'root' | 'gourd' | 'tree';
  form: 'bush' | 'vine' | 'herb' | 'root' | 'tree';
  germinateDay: number;
  floweringDay: number;        // first flowers
  firstHarvestDay: number;     // first pickable produce
  maturityDay: number;         // full maturity / steady yield
  maxHeightCm: number;         // expected mature height/length
  spreadCm: number;            // canopy width for the visualizer
  // logistic growth: height(t) = maxHeight / (1 + e^(-k (t - midpoint)))
  growthK: number;
  growthMidpoint: number;
  // visualizer palette
  leafColor: string;
  fruitColor: string;
  notes: string;
}

export const PLANT_CATALOG: PlantModel[] = [
  {
    key: 'vambatu', sinhala: 'Vambatu', english: 'Brinjal / Eggplant', category: 'fruiting', form: 'bush',
    germinateDay: 7, floweringDay: 40, firstHarvestDay: 70, maturityDay: 85, maxHeightCm: 90, spreadCm: 70,
    growthK: 0.09, growthMidpoint: 38, leafColor: '#3f7d4e', fruitColor: '#6a3d8f',
    notes: 'Heavy feeder. Stake when fruit load increases.',
  },
  {
    key: 'miris', sinhala: 'Miris', english: 'Chilli', category: 'fruiting', form: 'bush',
    germinateDay: 8, floweringDay: 45, firstHarvestDay: 80, maturityDay: 95, maxHeightCm: 65, spreadCm: 45,
    growthK: 0.10, growthMidpoint: 40, leafColor: '#2f7d4a', fruitColor: '#d23b27',
    notes: 'Consistent moisture for even fruit set.',
  },
  {
    key: 'nay_miris', sinhala: 'Nay Miris', english: "Bird's-eye Chilli", category: 'fruiting', form: 'bush',
    germinateDay: 10, floweringDay: 50, firstHarvestDay: 90, maturityDay: 110, maxHeightCm: 80, spreadCm: 50,
    growthK: 0.09, growthMidpoint: 46, leafColor: '#2c6f43', fruitColor: '#e23b1e',
    notes: 'Slow starter, very productive once established.',
  },
  {
    key: 'maalu_miris', sinhala: 'Maalu Miris', english: 'Banana Pepper / Capsicum', category: 'fruiting', form: 'bush',
    germinateDay: 8, floweringDay: 45, firstHarvestDay: 72, maturityDay: 88, maxHeightCm: 70, spreadCm: 50,
    growthK: 0.10, growthMidpoint: 40, leafColor: '#358a52', fruitColor: '#e9c93a',
    notes: 'Large fruit; support stems to avoid breakage.',
  },
  {
    key: 'tomato', sinhala: 'Thakkali', english: 'Tomato', category: 'fruiting', form: 'vine',
    germinateDay: 6, floweringDay: 35, firstHarvestDay: 68, maturityDay: 85, maxHeightCm: 160, spreadCm: 60,
    growthK: 0.11, growthMidpoint: 35, leafColor: '#3a7d46', fruitColor: '#e3402d',
    notes: 'Indeterminate: train up strings, prune suckers weekly.',
  },
  {
    key: 'minchi', sinhala: 'Minchi', english: 'Mint', category: 'herb', form: 'herb',
    germinateDay: 10, floweringDay: 60, firstHarvestDay: 45, maturityDay: 60, maxHeightCm: 40, spreadCm: 40,
    growthK: 0.12, growthMidpoint: 25, leafColor: '#2f8a4f', fruitColor: '#7fae5a',
    notes: 'Harvest leaves often to keep it bushy. Spreads fast.',
  },
  {
    key: 'rosemary', sinhala: 'Rosemary', english: 'Rosemary', category: 'herb', form: 'herb',
    germinateDay: 18, floweringDay: 120, firstHarvestDay: 85, maturityDay: 150, maxHeightCm: 70, spreadCm: 50,
    growthK: 0.05, growthMidpoint: 70, leafColor: '#4f7d5e', fruitColor: '#6f8fb0',
    notes: 'Slow, woody perennial. Likes drier soil than the vegetables.',
  },
  {
    key: 'bandakka', sinhala: 'Bandakka', english: 'Okra / Ladies Finger', category: 'fruiting', form: 'bush',
    germinateDay: 6, floweringDay: 38, firstHarvestDay: 55, maturityDay: 70, maxHeightCm: 150, spreadCm: 45,
    growthK: 0.12, growthMidpoint: 32, leafColor: '#3f8a4e', fruitColor: '#5f9a3a',
    notes: 'Pick pods young (every 2 days) for tenderness.',
  },
  {
    key: 'goova', sinhala: 'Goova', english: 'Guava (dwarf)', category: 'tree', form: 'tree',
    germinateDay: 21, floweringDay: 150, firstHarvestDay: 240, maturityDay: 365, maxHeightCm: 200, spreadCm: 120,
    growthK: 0.03, growthMidpoint: 120, leafColor: '#3d7d49', fruitColor: '#b6c845',
    notes: 'Long timeline. Prune to keep compact in a grow bag.',
  },
  {
    key: 'raabu', sinhala: 'Raabu', english: 'Radish', category: 'root', form: 'root',
    germinateDay: 4, floweringDay: 999, firstHarvestDay: 35, maturityDay: 45, maxHeightCm: 30, spreadCm: 20,
    growthK: 0.18, growthMidpoint: 18, leafColor: '#4f9a52', fruitColor: '#e8e4df',
    notes: 'Fast root crop. Avoid over-nitrogen (all leaf, no root).',
  },
  {
    key: 'maa_karal', sinhala: 'Maa Karal', english: 'Beans (long bean)', category: 'gourd', form: 'vine',
    germinateDay: 5, floweringDay: 40, firstHarvestDay: 55, maturityDay: 70, maxHeightCm: 220, spreadCm: 40,
    growthK: 0.13, growthMidpoint: 30, leafColor: '#3f8a4e', fruitColor: '#5f9a3a',
    notes: 'Climbing legume. Provide a trellis; fixes its own nitrogen.',
  },
  {
    key: 'dabala', sinhala: 'Dabala', english: 'Bottle Gourd', category: 'gourd', form: 'vine',
    germinateDay: 6, floweringDay: 42, firstHarvestDay: 60, maturityDay: 80, maxHeightCm: 250, spreadCm: 60,
    growthK: 0.12, growthMidpoint: 34, leafColor: '#3a7d44', fruitColor: '#7fae55',
    notes: 'Vigorous vine. Needs strong overhead support.',
  },
  {
    key: 'pathola', sinhala: 'Pathola', english: 'Snake Gourd', category: 'gourd', form: 'vine',
    germinateDay: 6, floweringDay: 45, firstHarvestDay: 65, maturityDay: 80, maxHeightCm: 250, spreadCm: 60,
    growthK: 0.12, growthMidpoint: 36, leafColor: '#3a7d44', fruitColor: '#8fae55',
    notes: 'Train on overhead net; fruit hangs down straight.',
  },
  {
    key: 'vatakolu', sinhala: 'Vatakolu', english: 'Ridge Gourd / Luffa', category: 'gourd', form: 'vine',
    germinateDay: 6, floweringDay: 45, firstHarvestDay: 62, maturityDay: 80, maxHeightCm: 250, spreadCm: 60,
    growthK: 0.12, growthMidpoint: 35, leafColor: '#3a7d44', fruitColor: '#6f9a45',
    notes: 'Train overhead. Pick young and tender.',
  },
];

export const findPlant = (key: string) => PLANT_CATALOG.find((p) => p.key === key);
