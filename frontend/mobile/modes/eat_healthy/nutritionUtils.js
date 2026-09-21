// Nutrition utility functions for Eat Healthy mode

export const estimateNutrition = (name) => {
  const n = (name || '').toLowerCase();

  // 1. Processed Snacks & Confectionery & Junk Food
  if (
    n.includes('chip') || n.includes('snack') || n.includes('biscuit') ||
    n.includes('cookie') || n.includes('wafer') || n.includes('candy') ||
    n.includes('chocolate') || n.includes('sweet') || n.includes('cake') ||
    n.includes('donut') || n.includes('ice cream') || n.includes('soda') ||
    n.includes('coke') || n.includes('pepsi') || n.includes('sprite') ||
    n.includes('burger') || n.includes('pizza') || n.includes('fries') ||
    n.includes('noodle') || n.includes('maggi') || n.includes('junk') ||
    n.includes('crisp') || n.includes('confectionery')
  ) {
    const isDrink = n.includes('soda') || n.includes('coke') || n.includes('pepsi') || n.includes('sprite');
    if (isDrink) {
      return { calories: 150, protein: 0, carbs: 38, fat: 0, fiber: 0, sugar: 38, is_processed: true, category: 'Soft Drink' };
    }
    return { calories: 420, protein: 4, carbs: 58, fat: 22, fiber: 1, sugar: 26, is_processed: true, category: 'Processed Snacks' };
  }

  // 2. Healthy Beverages
  if (n.includes('tea') || n.includes('chai')) {
    return { calories: 50, protein: 1.5, carbs: 8, fat: 1.5, fiber: 0, sugar: 7, is_processed: false, category: 'Beverage' };
  }
  if (n.includes('coffee')) {
    return { calories: 70, protein: 2.5, carbs: 9, fat: 2.5, fiber: 0, sugar: 8, is_processed: false, category: 'Beverage' };
  }
  if (n.includes('water')) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, is_processed: false, category: 'Beverage' };
  }

  // 3. South Indian / Breakfast Dishes
  if (n.includes('dosa') || n.includes('roast') || n.includes('idli') || n.includes('vada') || n.includes('uttapam')) {
    return { calories: 240, protein: 6, carbs: 40, fat: 7, fiber: 3, sugar: 2, is_processed: false, category: 'Main Dish' };
  }

  // 4. Rice & Main Dishes
  if (n.includes('biryani') || n.includes('pulao') || n.includes('fried rice')) {
    return { calories: 520, protein: 18, carbs: 75, fat: 16, fiber: 4, sugar: 3, is_processed: false, category: 'Main Dish' };
  }

  // 5. Meat, Poultry & Fish
  if (n.includes('chicken') || n.includes('mutton') || n.includes('fish') || n.includes('meat')) {
    return { calories: 380, protein: 45, carbs: 2, fat: 20, fiber: 0, sugar: 0, is_processed: false, category: 'Lean Meat' };
  }
  if (n.includes('egg')) {
    return { calories: 150, protein: 13, carbs: 1, fat: 10, fiber: 0, sugar: 1, is_processed: false, category: 'Dairy & Eggs' };
  }

  // 6. Dairy & Paneer
  if (n.includes('milk') || n.includes('curd') || n.includes('yogurt') || n.includes('paneer')) {
    return { calories: 180, protein: 12, carbs: 12, fat: 10, fiber: 0, sugar: 8, is_processed: false, category: 'Dairy' };
  }

  // 7. Grains & Bread
  if (n.includes('rice') || n.includes('roti') || n.includes('bread') || n.includes('wheat') || n.includes('oat')) {
    return { calories: 260, protein: 8, carbs: 54, fat: 3, fiber: 5, sugar: 2, is_processed: false, category: 'Whole Grains' };
  }

  // 8. Vegetables & Fruits
  if (n.includes('veg') || n.includes('salad') || n.includes('fruit') || n.includes('apple') || n.includes('banana')) {
    return { calories: 120, protein: 2, carbs: 28, fat: 1, fiber: 6, sugar: 16, is_processed: false, category: 'Fresh Produce' };
  }

  // Generic fallback
  return { calories: 180, protein: 5, carbs: 28, fat: 5, fiber: 2, sugar: 4, is_processed: false, category: 'Grocery Item' };
};

export const calculateMetricsFromReceipt = (data) => {
  const items = data?.receipt_info?.items || data?.items || [];
  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let fiber = 0;
  let sugar = 0;
  let processedCount = 0;
  let healthyCount = 0;

  const parsedItems = items.map((it) => {
    const nut = it.nutrition || {};
    const h = it.health || {};
    const est = estimateNutrition(it.name || it.display_name || it.matched_name);

    const itemCal = parseFloat(nut.calories_kcal ?? it.calories ?? est.calories);
    const itemProt = parseFloat(nut.protein_g ?? (it.protein ? parseFloat(it.protein) : null) ?? est.protein);
    const itemCarbs = parseFloat(nut.carbohydrates_g ?? est.carbs);
    const itemFat = parseFloat(nut.fat_g ?? est.fat);
    const itemFiber = parseFloat(nut.fiber_g ?? est.fiber);
    const itemSugar = parseFloat(nut.sugar_g ?? est.sugar);
    const qty = parseFloat(it.quantity || it.qty || 1) || 1;

    calories += itemCal * qty;
    protein += itemProt * qty;
    carbs += itemCarbs * qty;
    fat += itemFat * qty;
    fiber += itemFiber * qty;
    sugar += itemSugar * qty;

    const isProc = (h.is_processed !== undefined && h.is_processed !== null)
      ? Boolean(h.is_processed)
      : (h.processed_level ? (h.processed_level === 'MEDIUM' || h.processed_level === 'ULTRA') : Boolean(est.is_processed));
    if (isProc) {
      processedCount++;
    } else {
      healthyCount++;
    }

    return {
      name: it.matched_name || it.name || 'Food Item',
      category: it.category || est.category,
      calories: Math.round(itemCal * qty),
      protein: Math.round(itemProt * qty * 10) / 10,
      carbs: Math.round(itemCarbs * qty),
      fat: Math.round(itemFat * qty),
      is_processed: isProc,
    };
  });

  const totalItems = items.length || 1;
  const healthyPct = Math.round((healthyCount / totalItems) * 100);
  const processedPct = 100 - healthyPct;

  const carbCal = carbs * 4;
  const protCal = protein * 4;
  const fatCal = fat * 9;
  const fiberCal = fiber * 2;
  const totalMacroCal = carbCal + protCal + fatCal + fiberCal || 1;

  const carbsRatio = Math.round((carbCal / totalMacroCal) * 100);
  const proteinRatio = Math.round((protCal / totalMacroCal) * 100);
  const fatRatio = Math.round((fatCal / totalMacroCal) * 100);
  const fiberRatio = Math.max(0, 100 - (carbsRatio + proteinRatio + fatRatio));

  let score = 50 + healthyPct * 0.32 - processedPct * 0.25;
  if (protein >= 15 && protein <= 50) score += 6;
  else if (protein > 50) score += 3;

  if (fiber > 0 && sugar > 0) {
    if (fiber >= sugar) score += 5;
    else if (sugar > fiber * 2) score -= 7;
  } else if (fiber >= 8) {
    score += 4;
  }

  if (totalItems >= 3) score += 3;

  const calculatedScore = Math.min(96, Math.max(42, Math.round(score)));

  const proteinRdiPct = Math.min(100, Math.round((protein / 50) * 100));
  const fiberRdiPct = Math.min(100, Math.round((fiber / 28) * 100));
  const carbsRdiPct = Math.min(100, Math.round((carbs / 275) * 100));
  const fatRdiPct = Math.min(100, Math.round((fat / 70) * 100));
  const sugarRdiPct = Math.min(100, Math.round((sugar / 36) * 100));

  return {
    calories: Math.round(calories),
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
    fiber: Math.round(fiber * 10) / 10,
    sugar: Math.round(sugar * 10) / 10,
    healthyPct,
    processedPct,
    basketScore: calculatedScore,
    carbsRatio,
    proteinRatio,
    fatRatio,
    fiberRatio,
    totalItems,
    proteinRdiPct,
    fiberRdiPct,
    carbsRdiPct,
    fatRdiPct,
    sugarRdiPct,
    protCal: Math.round(protCal),
    carbCal: Math.round(carbCal),
    fatCal: Math.round(fatCal),
    parsedItems,
  };
};

export const getDefaultNutritionData = () => ({
  calories: 620,
  protein: 38.5,
  carbs: 78.5,
  fat: 18.2,
  fiber: 12.4,
  sugar: 14.2,
  healthyPct: 82,
  processedPct: 18,
  basketScore: 86,
  carbsRatio: 45,
  proteinRatio: 30,
  fatRatio: 15,
  fiberRatio: 10,
  totalItems: 3,
  proteinRdiPct: 77,
  fiberRdiPct: 44,
  carbsRdiPct: 28,
  fatRdiPct: 26,
  sugarRdiPct: 39,
  protCal: 154,
  carbCal: 314,
  fatCal: 164,
  parsedItems: [
    { name: 'Zaffrani Veg Biryani', category: 'Main Dish', calories: 420, protein: 14.5, carbs: 62, fat: 12, is_processed: false },
    { name: 'Water Bottle (1L)', category: 'Beverage', calories: 0, protein: 0, carbs: 0, fat: 0, is_processed: false },
    { name: 'Fresh Fruit Cup', category: 'Fresh Produce', calories: 120, protein: 2.0, carbs: 28, fat: 0.5, is_processed: false },
  ],
});
