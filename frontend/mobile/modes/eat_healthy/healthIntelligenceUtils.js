// Client-side fallback & helper utilities for Health Intelligence in Eat Healthy mode
import { ALLERGEN_TAXONOMY, NUTRITION_LOOKUP_TABLE } from './nutritionUtils';

export const REFERENCE_LIMITS = {
  daily_sodium_limit: 2000,
  daily_sodium_htn_limit: 1500,
  daily_fiber: 28,
  daily_protein: 50,
  daily_carbs: 275,
  daily_sugar_limit: 36,
};

const LOCAL_ALLERGENS = {
  dairy: ['milk', 'curd', 'dahi', 'yogurt', 'paneer', 'cheese', 'butter', 'ghee', 'cream', 'whey', 'lassi'],
  gluten: ['wheat', 'gluten', 'maida', 'atta', 'bread', 'roti', 'paratha', 'naan', 'pasta', 'noodle', 'noodles', 'biscuit', 'cookie', 'cake'],
  peanuts: ['peanut', 'peanuts', 'groundnut', 'groundnuts', 'chikki'],
  tree_nuts: ['almond', 'badam', 'cashew', 'kaju', 'walnut', 'pistachio', 'pista', 'nut', 'nuts'],
  soy: ['soy', 'soya', 'tofu', 'edamame', 'soy sauce'],
  eggs: ['egg', 'eggs', 'anda', 'omelette', 'mayo', 'mayonnaise'],
  fish: ['fish', 'salmon', 'tuna', 'mackerel'],
  shellfish: ['prawn', 'prawns', 'shrimp', 'crab', 'lobster'],
};

const LOCAL_NON_VEG = ['chicken', 'mutton', 'beef', 'pork', 'meat', 'egg', 'fish', 'prawn', 'shrimp', 'anda'];

export function estimateLocalItemNutrition(itemName = '') {
  const n = itemName.toLowerCase();

  // 1. Fried Rice / Biryani / South Indian
  if (n.includes('fried rice') || n.includes('rice half') || n.includes('chicken fried rice')) {
    return { calories: 480, protein: 22, carbs: 68, fat: 14, fiber: 2.5, sugar: 2, sodium: 680, gi: 72, category: 'Main Dish' };
  }
  if (n.includes('biryani') || n.includes('pulao')) {
    return { calories: 520, protein: 24, carbs: 65, fat: 18, fiber: 3, sugar: 2.5, sodium: 740, gi: 68, category: 'Main Dish' };
  }
  if (n.includes('dosa') || n.includes('roast')) {
    return { calories: 280, protein: 6.5, carbs: 42, fat: 9, fiber: 2.8, sugar: 1, sodium: 420, gi: 65, category: 'Breakfast' };
  }
  if (n.includes('idli')) {
    return { calories: 130, protein: 4, carbs: 26, fat: 0.8, fiber: 1.8, sugar: 0.4, sodium: 180, gi: 60, category: 'Breakfast' };
  }
  if (n.includes('rice') || n.includes('meals')) {
    return { calories: 240, protein: 4.5, carbs: 53, fat: 0.5, fiber: 0.8, sugar: 0.1, sodium: 5, gi: 73, category: 'Grains' };
  }

  // 2. Proteins
  if (n.includes('chicken') || n.includes('meat') || n.includes('mutton')) {
    return { calories: 220, protein: 31, carbs: 0, fat: 9, fiber: 0, sugar: 0, sodium: 180, gi: 0, category: 'Poultry' };
  }
  if (n.includes('egg') || n.includes('omelette')) {
    return { calories: 150, protein: 13, carbs: 1, fat: 10, fiber: 0, sugar: 0.5, sodium: 130, gi: 0, category: 'Dairy & Eggs' };
  }
  if (n.includes('paneer')) {
    return { calories: 265, protein: 18, carbs: 2.5, fat: 21, fiber: 0, sugar: 2, sodium: 25, gi: 15, category: 'Dairy' };
  }
  if (n.includes('dal') || n.includes('sambar') || n.includes('chana')) {
    return { calories: 180, protein: 10.5, carbs: 28, fat: 3, fiber: 7.5, sugar: 1.8, sodium: 320, gi: 35, category: 'Legumes' };
  }

  // 3. Dairy & Beverages
  if (n.includes('milk') || n.includes('curd') || n.includes('dahi')) {
    return { calories: 130, protein: 6.8, carbs: 9.6, fat: 6.5, fiber: 0, sugar: 9.6, sodium: 98, gi: 38, category: 'Dairy' };
  }
  if (n.includes('tea') || n.includes('chai') || n.includes('coffee')) {
    return { calories: 60, protein: 1.8, carbs: 8.5, fat: 1.8, fiber: 0, sugar: 7.5, sodium: 22, gi: 45, category: 'Beverage' };
  }
  if (n.includes('water')) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0, gi: 0, category: 'Beverage' };
  }
  if (n.includes('soda') || n.includes('coke') || n.includes('pepsi') || n.includes('sprite')) {
    return { calories: 150, protein: 0, carbs: 39, fat: 0, fiber: 0, sugar: 39, sodium: 45, gi: 85, category: 'Soft Drink' };
  }

  // 4. Snacks / Packaged
  if (n.includes('chip') || n.includes('snack') || n.includes('crisp')) {
    return { calories: 320, protein: 3.5, carbs: 35, fat: 19, fiber: 2.2, sugar: 1, sodium: 480, gi: 75, category: 'Snack' };
  }
  if (n.includes('biscuit') || n.includes('cookie') || n.includes('cake') || n.includes('sweet')) {
    return { calories: 280, protein: 3.8, carbs: 42, fat: 11.5, fiber: 1.2, sugar: 18, sodium: 240, gi: 70, category: 'Snack' };
  }

  // 5. Produce
  if (n.includes('banana') || n.includes('apple') || n.includes('fruit') || n.includes('salad')) {
    return { calories: 85, protein: 1.1, carbs: 22, fat: 0.3, fiber: 2.8, sugar: 13, sodium: 2, gi: 48, category: 'Produce' };
  }

  // Generic fallback
  return { calories: 180, protein: 5, carbs: 28, fat: 5, fiber: 2, sugar: 4, sodium: 150, gi: 55, category: 'General' };
}

export function computeLocalHealthIntelligence(rawItems = [], user = {}, onboarding = {}) {
  const items = Array.isArray(rawItems) ? rawItems : [];
  
  const userGoals = (onboarding.goals || user.goals || 'Eat Healthy').toLowerCase();
  const rawAllergies = (onboarding.allergies || user.allergies || '').toLowerCase();
  const rawConditions = (onboarding.medical_conditions || user.medical_conditions || '').toLowerCase();
  const rawDiet = (onboarding.food_preference || user.food_preference || 'Standard').toLowerCase();

  const declaredAllergies = rawAllergies
    .split(/[,;/|]/)
    .map((s) => s.trim())
    .filter((s) => s && !['none', 'no', 'n/a', 'nil'].includes(s));

  const isHypertensive = rawConditions.includes('hyper') || rawConditions.includes('bp') || rawConditions.includes('heart');
  const isDiabetic = rawConditions.includes('diabet') || rawConditions.includes('glucose') || rawConditions.includes('sugar');
  const isVegetarian = (rawDiet.includes('veg') || rawDiet.includes('vegan')) && !rawDiet.includes('non');

  let totalCal = 0;
  let totalProt = 0;
  let totalCarb = 0;
  let totalFat = 0;
  let totalFib = 0;
  let totalSug = 0;
  let totalSod = 0;
  let totalGL = 0;

  const enriched = items.map((it) => {
    const name = it.name || it.matched_name || it.display_name || 'Food Item';
    const qty = parseFloat(String(it.quantity || it.qty || 1).replace(/[^0-9.]/g, '')) || 1;
    const est = estimateLocalItemNutrition(name);

    const nut = it.nutrition || {};
    const cal = (parseFloat(nut.calories_kcal) || est.calories) * qty;
    const prot = (parseFloat(nut.protein_g) || est.protein) * qty;
    const carb = (parseFloat(nut.carbohydrates_g) || est.carbs) * qty;
    const fat = (parseFloat(nut.fat_g) || est.fat) * qty;
    const fib = (parseFloat(nut.fiber_g) || est.fiber) * qty;
    const sug = (parseFloat(nut.sugar_g) || est.sugar) * qty;
    const sod = (parseFloat(nut.sodium_mg) || est.sodium) * qty;
    const gl = Math.round((carb * est.gi) / 100);

    totalCal += cal;
    totalProt += prot;
    totalCarb += carb;
    totalFat += fat;
    totalFib += fib;
    totalSug += sug;
    totalSod += sod;
    totalGL += gl;

    return {
      name,
      quantity: qty,
      calories: Math.round(cal),
      protein: Math.round(prot * 10) / 10,
      carbs: Math.round(carb),
      fat: Math.round(fat),
      fiber: Math.round(fib * 10) / 10,
      sugar: Math.round(sug * 10) / 10,
      sodium: Math.round(sod),
      gi: est.gi,
      gl,
      category: it.category || est.category,
    };
  });

  // 1. Glycemic
  const fiberToCarbRatio = totalCarb > 0 ? Math.round((totalFib / totalCarb) * 100) / 100 : 0;
  let glycemicLevel = 'Low';
  let glycemicBadge = 'Stable Blood Sugar Control';
  let glycemicColor = '#2E7D32';
  let glycemicSummary = 'Complex carbohydrates and dietary fiber promote steady glucose response and prolonged satiety.';

  if (totalGL >= 35 || fiberToCarbRatio < 0.06) {
    glycemicLevel = 'Elevated';
    glycemicBadge = 'Rapid Glucose Impact';
    glycemicColor = '#D32F2F';
    glycemicSummary = 'Refined carbohydrates with low fiber detected. This profile can cause fast blood glucose spikes.';
  } else if (totalGL >= 18 || fiberToCarbRatio < 0.12) {
    glycemicLevel = 'Moderate';
    glycemicBadge = 'Moderate Glycemic Response';
    glycemicColor = '#FB8C00';
    glycemicSummary = 'Moderate carbohydrate load. Pairing with green vegetables or lean protein will further stabilize glucose release.';
  }

  // 2. Sodium
  const sodiumCeiling = isHypertensive ? REFERENCE_LIMITS.daily_sodium_htn_limit : REFERENCE_LIMITS.daily_sodium_limit;
  const sodiumPct = Math.min(200, Math.round((totalSod / sodiumCeiling) * 100));
  let sodiumLevel = 'Optimal';
  let sodiumBadge = 'Heart-Healthy Sodium';
  let sodiumColor = '#2E7D32';
  let sodiumSummary = `Sodium content is within healthy targets (${Math.round(totalSod)} mg, ${sodiumPct}% of daily limit).`;

  if (totalSod > sodiumCeiling) {
    sodiumLevel = 'High Risk';
    sodiumBadge = 'Exceeds Daily Sodium Limit';
    sodiumColor = '#D32F2F';
    sodiumSummary = `Estimated sodium (${Math.round(totalSod)} mg) exceeds recommended ceiling of ${sodiumCeiling} mg.`;
  } else if (totalSod >= sodiumCeiling * 0.7) {
    sodiumLevel = 'Elevated';
    sodiumBadge = 'Approaching Daily Limit';
    sodiumColor = '#FB8C00';
    sodiumSummary = `Sodium intake (${Math.round(totalSod)} mg) accounts for ${sodiumPct}% of daily ceiling.`;
  } else if (totalSod >= sodiumCeiling * 0.3) {
    sodiumLevel = 'Moderate';
    sodiumBadge = 'Moderate Sodium';
    sodiumColor = '#1976D2';
    sodiumSummary = `Moderate sodium content (${Math.round(totalSod)} mg, ${sodiumPct}% of daily ceiling).`;
  }

  // 3. Allergens
  const allergenWarnings = [];
  enriched.forEach((it) => {
    const nl = it.name.toLowerCase();
    Object.keys(LOCAL_ALLERGENS).forEach((alkey) => {
      const match = LOCAL_ALLERGENS[alkey].find((kw) => nl.includes(kw));
      if (match) {
        const isUserMatch = declaredAllergies.some((da) => da.includes(alkey) || alkey.includes(da) || da.includes(match));
        if (isUserMatch) {
          allergenWarnings.push({
            item_name: it.name,
            allergen_type: alkey.toUpperCase(),
            matched_trigger: match,
            confidence: 'Inferred from Food Name',
            severity: 'CRITICAL_TRIGGER',
            message: `Contains ${alkey.toUpperCase()} (${match}), which matches your declared allergy profile!`,
          });
        }
      }
    });

    if (isVegetarian) {
      const nvMatch = LOCAL_NON_VEG.find((nvk) => nl.includes(nvk));
      if (nvMatch) {
        allergenWarnings.push({
          item_name: it.name,
          allergen_type: 'Dietary Preference Conflict',
          matched_trigger: nvMatch,
          confidence: 'Name Classification',
          severity: 'PREFERENCE_MISMATCH',
          message: `Non-Vegetarian item ('${it.name}') detected, conflicting with your declared Vegetarian diet.`,
        });
      }
    }
  });

  // 4. Macro Distribution
  const carbCal = totalCarb * 4;
  const protCal = totalProt * 4;
  const fatCal = totalFat * 9;
  const macroSum = carbCal + protCal + fatCal || 1;
  const pRatio = Math.round((protCal / macroSum) * 100);
  const cRatio = Math.round((carbCal / macroSum) * 100);
  const fRatio = Math.max(0, 100 - (pRatio + cRatio));

  // 5. Recommendations
  const recommendations = [];
  if (userGoals.includes('muscle') || userGoals.includes('gain')) {
    recommendations.push({
      category: 'Protein & Muscle Synthesis',
      title: 'Target 25-35g Protein Per Feeding',
      description: `Current haul provides ${Math.round(totalProt)}g protein (${pRatio}% of macro calories). Distribute evenly across meals to maximize hypertrophy.`,
      impact: 'High Impact',
      action_tag: 'Muscle Goal',
      suggested_swap: isVegetarian ? 'Pair meals with Paneer Bhurji or Sprouted Dal' : 'Add 2 boiled eggs or grilled chicken to your plate',
    });
  }
  if (glycemicLevel !== 'Low') {
    recommendations.push({
      category: 'Glycemic & Energy Stability',
      title: 'Buffer Carbs with Fiber & Lean Protein',
      description: 'Refined starches digest quickly. Eat vegetables or dal before rice/bread to flatten postprandial glucose peaks.',
      impact: 'High Impact',
      action_tag: 'Blood Sugar Control',
      suggested_swap: 'Substitute white rice with brown rice, quinoa, or whole wheat roti',
    });
  }
  if (sodiumLevel !== 'Optimal') {
    recommendations.push({
      category: 'Cardiovascular Health',
      title: 'Flavor with Fresh Herbs & Aromatics',
      description: `Sodium contributes ${sodiumPct}% of your ceiling. Use lemon, roasted cumin, and black pepper to reduce added salt.`,
      impact: 'Preventative',
      action_tag: 'Heart Health',
      suggested_swap: 'Ask for sauce on the side or use fresh lemon juice',
    });
  }
  if (recommendations.length < 3) {
    recommendations.push({
      category: 'Dietary Balance',
      title: 'Adopt the Balanced Plate Blueprint',
      description: 'Strive for 50% colorful vegetables, 25% quality protein, and 25% complex whole grains in every meal.',
      impact: 'General Wellness',
      action_tag: 'Lifestyle Balance',
      suggested_swap: 'Add a fresh salad or cucumber slices to your meal',
    });
  }

  return {
    status: 'success',
    user_context: {
      name: user.name || 'User',
      goals: onboarding.goals || user.goals || 'Eat Healthy',
      food_preference: onboarding.food_preference || user.food_preference || 'Standard',
      allergies: onboarding.allergies || user.allergies || 'None declared',
      medical_conditions: onboarding.medical_conditions || user.medical_conditions || 'None declared',
    },
    glycemic_impact: {
      overall_level: glycemicLevel,
      status_badge: glycemicBadge,
      status_color: glycemicColor,
      total_carbs_g: Math.round(totalCarb * 10) / 10,
      total_sugar_g: Math.round(totalSug * 10) / 10,
      total_fiber_g: Math.round(totalFib * 10) / 10,
      fiber_to_carb_ratio: fiberToCarbRatio,
      glycemic_load_total: totalGL,
      high_impact_items: enriched.filter((i) => i.gi >= 70 || i.sugar >= 12),
      protective_items: enriched.filter((i) => i.fiber >= 2.5 || i.protein >= 15),
      summary: glycemicSummary,
      alternatives: [
        'Substitute white rice with brown rice, quinoa, or millet.',
        'Pair starches with high-fiber greens to buffer glucose response.',
      ],
      is_personalized_for_diabetes: isDiabetic,
    },
    sodium_cardiovascular: {
      overall_level: sodiumLevel,
      status_badge: sodiumBadge,
      status_color: sodiumColor,
      total_sodium_mg: Math.round(totalSod),
      daily_limit_mg: sodiumCeiling,
      sodium_percentage: sodiumPct,
      high_sodium_items: enriched.filter((i) => i.sodium >= 400),
      summary: sodiumSummary,
      alternatives: [
        'Use herbs, lemon juice, and roasted spices instead of excess salt.',
        'Choose low-sodium versions of sauces and broths.',
      ],
      is_personalized_for_hypertension: isHypertensive,
    },
    allergen_detection: {
      overall_status: allergenWarnings.length > 0 ? 'Allergen Notice' : 'Clean Screen',
      status_badge: allergenWarnings.length > 0 ? 'Potential Allergy / Dietary Triggers' : 'No Declared Allergens Flagged',
      status_color: allergenWarnings.length > 0 ? '#D32F2F' : '#2E7D32',
      declared_allergies: declaredAllergies.length > 0 ? declaredAllergies : ['None declared in profile'],
      declared_diet: rawDiet,
      warnings: allergenWarnings,
      item_breakdown: enriched.map((i) => ({
        name: i.name,
        detected_allergens: [i.category],
      })),
      summary:
        allergenWarnings.length > 0
          ? 'Identified ingredients matching your declared allergies or dietary preferences.'
          : 'No declared allergens flagged in scanned items. (Always verify physical packaging).',
      safety_disclaimer:
        'Always check product packaging. Pantrics performs algorithmic screening on receipt item names and database taxonomy.',
    },
    nutritional_balance: {
      balance_score: Math.min(95, Math.max(45, Math.round(50 + (pRatio >= 20 ? 15 : 5) + (totalFib >= 8 ? 15 : 0) - (totalSug > 30 ? 15 : 0)))),
      macronutrients: {
        calories: Math.round(totalCal),
        protein_g: Math.round(totalProt * 10) / 10,
        carbs_g: Math.round(totalCarb * 10) / 10,
        fat_g: Math.round(totalFat * 10) / 10,
        fiber_g: Math.round(totalFib * 10) / 10,
        sugar_g: Math.round(totalSug * 10) / 10,
      },
      macro_distribution_pct: {
        protein: pRatio,
        carbs: cRatio,
        fat: fRatio,
      },
      strengths: [
        pRatio >= 20 ? `Strong protein density (${pRatio}% of macro calories)` : 'Provides energy for daily activity',
        totalFib >= 8 ? `Good fiber content (${Math.round(totalFib)}g)` : 'Clear nutritional profile tracked',
      ],
      gaps: [
        totalFib < 8 ? `Fiber (${Math.round(totalFib)}g) below 28g recommendation` : 'Maintain current fiber intake',
        totalSod > sodiumCeiling * 0.7 ? 'Sodium is elevated' : 'Macronutrient split within typical ranges',
      ],
      missing_food_groups: ['Leafy Vegetables', 'Whole Grain Complex Carbs'],
      summary: `Your purchases provide a ${pRatio}% Protein / ${cRatio}% Carbs / ${fRatio}% Fat macronutrient distribution.`,
    },
    personalized_recommendations: recommendations,
    historical_summary: {
      has_trend: false,
      message: 'Upload additional receipts to unlock weekly and multi-haul nutrition trend tracking.',
    },
    disclaimer:
      'Nutritional and glycemic values are estimated using food composition reference models and OCR item mapping. For clinical allergy management or diabetes, verify physical packaging.',
  };
}
