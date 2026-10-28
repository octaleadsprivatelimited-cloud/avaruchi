-- Client-approved copy revision only. Existing product range, images, pack sizes,

-- prices, tax rates, inventory and order records are intentionally preserved.

-- This runs once through Prisma; later admin edits remain authoritative.

UPDATE `Brand` SET `name` = 'Aavaruchi' WHERE LOWER(TRIM(`name`)) = 'avaruchi';

UPDATE `Product` SET `description` = REPLACE(`description`, 'Avaruchi', 'Aavaruchi'), `seoTitle` = REPLACE(`seoTitle`, 'Avaruchi', 'Aavaruchi'), `seoDescription` = REPLACE(`seoDescription`, 'Avaruchi', 'Aavaruchi') WHERE `description` LIKE '%Avaruchi%' OR `seoTitle` LIKE '%Avaruchi%' OR `seoDescription` LIKE '%Avaruchi%';

UPDATE `ProductMedia` SET `alt` = REPLACE(`alt`, 'Avaruchi', 'Aavaruchi') WHERE `alt` LIKE '%Avaruchi%';

UPDATE `Product` SET `description` = 'Tomato Pickle is a tangy accompaniment for rice, dosa or idli. Its familiar tomato flavour makes it an easy addition to everyday home-cooked meals.', `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `slug` = 'tomato-pickle' AND `description` = 'Tomato Pickle from the Aavaruchi veg pickle collection. Enjoy a little alongside rice, dal or your everyday meals. Choose the pack size that suits your table.';

UPDATE `Product` SET `description` = 'Karivepaku Karam Podi brings the aromatic character of curry leaves to the table. Pair it with idli, dosa or warm rice for an everyday Telugu accompaniment.', `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `slug` = 'karivepaku-karam-podi' AND `description` = 'Karivepaku Karam Podi from the Aavaruchi powder collection. A familiar Telugu pantry flavour for everyday cooking and meals. Available in 500 g and 1 kg packs.';

UPDATE `Product` SET `description` = 'Kakarakaya Karam Podi brings the distinctive character of bitter gourd to a Telugu accompaniment. Pair a little with warm rice and a simple dal.', `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `slug` = 'kakarakaya-karam-podi' AND `description` = 'Kakarakaya Karam Podi from the Aavaruchi powder collection. A familiar Telugu pantry flavour for everyday cooking and meals. Available in 500 g and 1 kg packs.';

UPDATE `Product` SET `description` = 'Bellam Avakaya pairs the character of mango pickle with a sweet-and-tangy finish. Try it with steamed rice, a comforting dal or a simple family meal.', `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `slug` = 'bellam-avakaya' AND `description` = 'Bellam Avakaya from the Aavaruchi veg pickle collection. Enjoy a little alongside rice, dal or your everyday meals. Choose the pack size that suits your table.';

UPDATE `Product` SET `description` = 'Sambar Podi is a pantry blend for preparing a comforting bowl of sambar. Follow the directions on your pack and adjust the amount for your recipe.', `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `slug` = 'sambar-podi' AND `description` = 'Sambar Podi from the Aavaruchi powder collection. A familiar Telugu pantry flavour for everyday cooking and meals. Available in 500 g and 1 kg packs.';

UPDATE `Product` SET `description` = 'Palli Karam Podi brings a nutty peanut character to a Telugu pantry favourite. Enjoy it as an accompaniment to idli or dosa, or mix a little into warm rice.', `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `slug` = 'palli-karam-podi' AND `description` = 'Palli Karam Podi from the Aavaruchi powder collection. A familiar Telugu pantry flavour for everyday cooking and meals. Available in 500 g and 1 kg packs.';

UPDATE `Product` SET `description` = 'Nuvvula Karam Podi has the familiar nutty character of sesame. Pair it with rice, idli or dosa as part of an everyday Andhra meal.', `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `slug` = 'nuvvula-karam-podi' AND `description` = 'Nuvvula Karam Podi from the Aavaruchi powder collection. A familiar Telugu pantry flavour for everyday cooking and meals. Available in 500 g and 1 kg packs.';

UPDATE `Product` SET `description` = 'Kura Podi is a savoury pantry blend for vegetable dishes and everyday cooking. Use it according to your pack directions and adjust the amount to your taste.', `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `slug` = 'kura-podi' AND `description` = 'Kura Podi from the Aavaruchi powder collection. A familiar Telugu pantry flavour for everyday cooking and meals. Available in 500 g and 1 kg packs.';

UPDATE `Product` SET `description` = 'Allam Avakaya brings the warming character of ginger to an Andhra pickle. Enjoy it in small servings with rice, dosa or your favourite savoury breakfast.', `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `slug` = 'ginger-pickle' AND `description` = 'Allam Avakaya (Ginger) from the Aavaruchi veg pickle collection. Enjoy a little alongside rice, dal or your everyday meals. Choose the pack size that suits your table.';

UPDATE `Product` SET `description` = 'Munagaku Karam Podi is a Telugu-style podi with the distinctive character of drumstick leaves. Enjoy a little with rice or a savoury breakfast.', `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `slug` = 'munagaku-karam-podi' AND `description` = 'Munagaku Karam Podi from the Aavaruchi powder collection. A familiar Telugu pantry flavour for everyday cooking and meals. Available in 500 g and 1 kg packs.';

UPDATE `Product` SET `description` = 'Nalla Karam Podi is a bold Telugu pantry accompaniment for rice and savoury breakfasts. Add a small serving to your plate for a full-flavoured finish.', `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `slug` = 'nalla-karam-podi' AND `description` = 'Nalla Karam Podi from the Aavaruchi powder collection. A familiar Telugu pantry flavour for everyday cooking and meals. Available in 500 g and 1 kg packs.';

UPDATE `Product` SET `description` = 'Usiri Karam Podi offers the tangy character of amla in a Telugu-style podi. Try a small serving alongside rice or your favourite savoury breakfast.', `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `slug` = 'usiri-karam-podi' AND `description` = 'Usiri Karam Podi from the Aavaruchi powder collection. A familiar Telugu pantry flavour for everyday cooking and meals. Available in 500 g and 1 kg packs.';

UPDATE `Product` SET `description` = 'Gummadi Vadiyalu are a traditional Andhra accompaniment to prepare and serve with rice and dal. Follow the cooking and storage directions on your pack.', `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `slug` = 'gummadi-vadiyalu' AND `description` = 'Gummadi Vadiyalu from the Aavaruchi fryums collection. A traditional accompaniment for your everyday table. Available in a 1 kg pack. Follow the preparation instructions on your pack.';

UPDATE `Product` SET `description` = 'Kandi Karam Podi is a familiar accompaniment for warm rice and a simple Andhra meal. Serve a small portion at the table and adjust the amount to your taste.', `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `slug` = 'kandi-karam-podi' AND `description` = 'Kandi Karam Podi from the Aavaruchi powder collection. A familiar Telugu pantry flavour for everyday cooking and meals. Available in 500 g and 1 kg packs.';

UPDATE `Product` SET `description` = 'Idli Karam Podi is made for a familiar South Indian breakfast pairing. Serve it alongside idli or dosa and use the amount that suits your taste.', `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `slug` = 'idli-karam-podi' AND `description` = 'Idli Karam Podi from the Aavaruchi powder collection. A familiar Telugu pantry flavour for everyday cooking and meals. Available in 500 g and 1 kg packs.';

UPDATE `Product` SET `description` = 'Gongura Pickle celebrates the distinctive leafy tang of an Andhra favourite. Serve it with warm rice, dal or a traditional family meal.', `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `slug` = 'gongura-pickle' AND `description` = 'Gongura Pickle from the Aavaruchi veg pickle collection. Enjoy a little alongside rice, dal or your everyday meals. Choose the pack size that suits your table.';

UPDATE `Product` SET `description` = 'Usirikaya pickle brings the distinctive tang of amla to your plate. Serve a little alongside rice and dal, or add it to a traditional Andhra meal.', `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `slug` = 'amla-pickle' AND `description` = 'Amla Pickle (Usirikaya) from the Aavaruchi veg pickle collection. Enjoy a little alongside rice, dal or your everyday meals. Choose the pack size that suits your table.';

UPDATE `Product` SET `description` = 'Mango Avakaya brings the familiar tang of mango to a traditional Andhra pickle. Enjoy a small serving with warm rice, dal or curd rice.', `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `slug` = 'classic-mango-pickle' AND `description` = 'Mango Avakaya from the Aavaruchi veg pickle collection. Enjoy a little alongside rice, dal or your everyday meals. Choose the pack size that suits your table.';

UPDATE `Product` SET `description` = 'Lemon Pickle has a bright, tangy character that pairs naturally with curd rice and dal. Keep a small serving at the table for a familiar citrus accompaniment.', `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `slug` = 'lemon-pickle' AND `description` = 'Lemon Pickle from the Aavaruchi veg pickle collection. Enjoy a little alongside rice, dal or your everyday meals. Choose the pack size that suits your table.';

UPDATE `Product` SET `description` = 'Pulihora Avakaya is a bold mango pickle variation for the Andhra table. Serve it alongside rice or your favourite everyday meal for a tangy accompaniment.', `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `slug` = 'pulihora-avakaya' AND `description` = 'Pulihora Avakaya from the Aavaruchi veg pickle collection. Enjoy a little alongside rice, dal or your everyday meals. Choose the pack size that suits your table.';

UPDATE `Product` SET `description` = 'Garlic Karam Podi brings a strong savoury garlic character to the table. Pair it with warm rice, idli or dosa for an easy everyday accompaniment.', `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `slug` = 'garlic-karam-podi' AND `description` = 'Garlic Karam Podi from the Aavaruchi powder collection. A familiar Telugu pantry flavour for everyday cooking and meals. Available in 500 g and 1 kg packs.';

UPDATE `Product` SET `description` = 'Pandumirapakaya is a red chilli pickle for those who enjoy a lively, spicy accompaniment. A small serving adds heat to rice, curd rice or a savoury breakfast.', `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `slug` = 'red-chilli-pickle' AND `description` = 'Red Chilli Pickle (Pandumirapakaya) from the Aavaruchi veg pickle collection. Enjoy a little alongside rice, dal or your everyday meals. Choose the pack size that suits your table.';

UPDATE `Product` SET `description` = 'Green Chilli Pickle is a lively, spicy accompaniment for those who enjoy extra heat. Serve a small amount with rice, dal or a savoury meal.', `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `slug` = 'green-chilli-pickle' AND `description` = 'A bold green chilli pickle with a lively, spicy flavour. Add a small serving alongside rice, dal or your favourite savoury meal.';

UPDATE `Product` SET `description` = 'Majjiga Vadiyalu are a traditional accompaniment for the everyday Andhra table. Prepare them as directed on your pack and enjoy with rice and a comforting dal.', `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `slug` = 'majjiga-vadiyalu' AND `description` = 'Majjiga Vadiyalu from the Aavaruchi fryums collection. A traditional accompaniment for your everyday table. Available in a 1 kg pack. Follow the preparation instructions on your pack.';

UPDATE `Product` SET `description` = 'Kobbari Karam Podi brings a coconut-style savoury accompaniment to your pantry. Serve it with idli or dosa, or add a small amount to warm rice.', `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `slug` = 'kobbari-karam-podi' AND `description` = 'Kobbari Karam Podi from the Aavaruchi powder collection. A familiar Telugu pantry flavour for everyday cooking and meals. Available in 500 g and 1 kg packs.';

UPDATE `Product` SET `description` = 'Minapa Vadiyalu are a familiar Telugu meal accompaniment. Follow the preparation directions on your pack and serve them alongside warm rice, dal or a family lunch.', `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `slug` = 'minapa-vadiyalu' AND `description` = 'Minapa Vadiyalu from the Aavaruchi fryums collection. A traditional accompaniment for your everyday table. Available in a 1 kg pack. Follow the preparation instructions on your pack.';

UPDATE `Product` SET `description` = 'Mamidillam Avakaya is another way to enjoy the familiar character of an Andhra Avakaya. Choose it as an accompaniment to warm rice and everyday home cooking.', `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `slug` = 'mamidillam-avakaya' AND `description` = 'Mamidillam Avakaya from the Aavaruchi veg pickle collection. Enjoy a little alongside rice, dal or your everyday meals. Choose the pack size that suits your table.';

UPDATE `Product` SET `description` = 'Garlic Avakaya offers a bold garlic character in a traditional mango-pickle style. Pair it with warm rice or dal when you want a stronger savoury accompaniment.', `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `slug` = 'garlic-pickle' AND `description` = 'Garlic Avakaya from the Aavaruchi veg pickle collection. Enjoy a little alongside rice, dal or your everyday meals. Choose the pack size that suits your table.';

UPDATE `Product` SET `description` = 'Chintakaya Pickle brings a distinct tamarind tang to a traditional Andhra meal. Enjoy a small portion with steamed rice, dal or a simple vegetable dish.', `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `slug` = 'chintakaya-pickle' AND `description` = 'Chintakaya Pickle from the Aavaruchi veg pickle collection. Enjoy a little alongside rice, dal or your everyday meals. Choose the pack size that suits your table.';

UPDATE `Product` SET `description` = 'Saggubiyyam Vadiyalu bring a familiar crisp accompaniment to a home-cooked meal. Prepare them according to the pack directions and serve alongside rice or dal.', `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `slug` = 'saggubiyyam-vadiyalu' AND `description` = 'Saggubiyyam Vadiyalu from the Aavaruchi fryums collection. A traditional accompaniment for your everyday table. Available in a 1 kg pack. Follow the preparation instructions on your pack.';

UPDATE `Product` SET `description` = 'Menti Avakaya has the distinctive character of a fenugreek-style Andhra pickle. Pair it with warm rice or a simple dal for a full-flavoured meal.', `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `slug` = 'menti-avakaya' AND `description` = 'Menti Avakaya from the Aavaruchi veg pickle collection. Enjoy a little alongside rice, dal or your everyday meals. Choose the pack size that suits your table.';

UPDATE `IntegrationConfig` SET `publicConfig` = JSON_SET(`publicConfig`, '$.fromName', 'Aavaruchi') WHERE JSON_UNQUOTE(JSON_EXTRACT(`publicConfig`, '$.fromName')) = 'Avaruchi';

UPDATE `Setting`
SET `value` = JSON_SET(`value`, '$.heroImageAlt', REPLACE(JSON_UNQUOTE(JSON_EXTRACT(`value`, '$.heroImageAlt')), 'Avaruchi', 'Aavaruchi')),
    `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `key` LIKE 'storefront:%' AND `encrypted` = false
  AND JSON_TYPE(JSON_EXTRACT(`value`, '$.heroImageAlt')) = 'STRING'
  AND JSON_UNQUOTE(JSON_EXTRACT(`value`, '$.heroImageAlt')) LIKE '%Avaruchi%';
