export type Variant = {
  id: string;
  weight: number;
  price: number;
  stock: number;
};
export type Product = {
  id: string;
  name: string;
  subtitle: string;
  category: string;
  heat: number;
  image: number;
  description: string;
  ingredients: string;
  pairing: string;
  variants: Variant[];
};
const base = [
  [
    "mango",
    "Classic Mango",
    "The tangy original",
    "Classics",
    3,
    "Firm mango pieces, red chilli and mustard come together in a bold, familiar pickle.",
    "Raw mango, chilli, mustard, salt, sesame oil, fenugreek",
    "Hot rice, a spoon of ghee, and a slow Sunday lunch.",
  ],
  [
    "gongura",
    "Gongura",
    "Leafy. Tangy. Unforgettable.",
    "Andhra favourites",
    3,
    "Sorrel leaves bring their distinctive sharpness to this deeply savoury Andhra favourite.",
    "Gongura leaves, chilli, garlic, salt, sesame oil, mustard",
    "Steamed rice, dal, or a warm jowar roti.",
  ],
  [
    "tomato",
    "Tomato",
    "A spoonful of comfort",
    "Andhra favourites",
    2,
    "A rich tomato relish with a mellow tang and the warmth of red chilli.",
    "Tomato, tamarind, chilli, salt, sesame oil, mustard",
    "Dosa, idli, and the last corner of your chapati.",
  ],
  [
    "lemon",
    "Lemon",
    "Bright from the first bite",
    "Classics",
    2,
    "Lemon pieces with a citrus tang, balanced by earthy spices and a little heat.",
    "Lemon, chilli, salt, sesame oil, mustard, fenugreek",
    "Curd rice, parathas, or a simple dal-chawal.",
  ],
  [
    "garlic",
    "Garlic",
    "Small cloves. Big flavour.",
    "Bold flavours",
    3,
    "Whole garlic cloves coated in a robust chilli and spice mix.",
    "Garlic, chilli, tamarind, salt, sesame oil, mustard",
    "Warm rotis, rice bowls, and your favourite dal.",
  ],
  [
    "chilli",
    "Red Chilli",
    "For the heat seekers",
    "Bold flavours",
    4,
    "Deep red chillies make a fiery, aromatic pickle for those who like an extra kick.",
    "Red chilli, salt, sesame oil, mustard, fenugreek",
    "A tiny spoon alongside a comforting rice meal.",
  ],
  [
    "amla",
    "Amla",
    "A beautifully sharp bite",
    "Classics",
    2,
    "Indian gooseberries with a brisk tang and an earthy spice finish.",
    "Amla, chilli, salt, sesame oil, mustard",
    "Curd rice, millet bowls, or a weekday lunch.",
  ],
  [
    "mixed",
    "Mixed Vegetable",
    "A little bit of everything",
    "Classics",
    2,
    "A colourful mix of vegetables with crunch, tang and a generous coating of spice.",
    "Mango, carrot, cauliflower, chilli, salt, sesame oil, mustard",
    "Parathas, lunch boxes, and meals made for sharing.",
  ],
] as const;
export const sampleProducts: Product[] = base.map((p, i) => ({
  id: p[0],
  name: p[1],
  subtitle: p[2],
  category: p[3],
  heat: p[4],
  image: i,
  description: p[5],
  ingredients: p[6],
  pairing: p[7],
  variants: [250, 500, 1000].map((weight, j) => ({
    id: `${p[0]}-${weight}`,
    weight,
    price: ([199, 349, 649][j] + (i === 1 ? 20 : 0)) * 100,
    stock: 40,
  })),
}));
export const rupees = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: paise % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(paise / 100);
export const weightLabel = (grams: number) =>
  grams === 1000 ? "1 kg" : `${grams} g`;
export type CartItem = { variantId: string; quantity: number };
