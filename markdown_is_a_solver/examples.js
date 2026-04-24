// Examples ordered easy → hard so a first-time user sees the simplest usage
// first. Each shows a different ergonomic:
//   easy       — Markdown-only; three unknowns, no JSON input.
//   budget     — JSON parameters + Markdown unknowns with inequality constraints.
//   physical   — clinical checkup validation: physiological range checks,
//                BMI consistency, BP coherence, label enumeration, smoker rule.
//   intake     — business-rule validation of an order record: arithmetic
//                reconciliation, enumeration checks, tier-based discount rules.
//   scheduling — JSON parameters + Markdown unknowns with ordering constraints.
//   compliance — JSON config under test; Markdown is the policy; no declare.
//   fhir       — FHIR Patient + MedicationRequest; pediatric dosing safety rule.
//   longitudinal — research-panel record: wave coherence, skip-logic, sentinel
//                rejection, Likert ranges, composite score reconciliation.
//   social     — account + post record for bot/abuse triage: engagement ratio,
//                timestamp ordering, verification rule, follow-asymmetry check.

export const EXAMPLES = {
  easy: {
    json: `{}`,
    rules: `# declare
* alice : Int
* bob : Int
* carol : Int

# assert
* =(+(alice, bob, carol), \`30\`)
* =(alice, *(\`2\`, bob))
* =(bob, +(carol, \`2\`))

# check
`,
  },

  budget: {
    json: `{
  "budget": 100,
  "minimum_each": 5
}`,
    rules: `# declare
* alice : Int
* bob : Int
* carol : Int

# assert
* =(+(alice, bob, carol), budget)
* =(alice, *(\`3\`, bob))
* =(bob, +(carol, \`10\`))
* >=(alice, minimum_each)
* >=(bob, minimum_each)
* >=(carol, minimum_each)

# check
`,
  },

  physical: {
    json: `{
  "observation": {
    "patient_id": "P-08421",
    "age_years": 34,
    "height_m": 1.78,
    "weight_kg": 72,
    "bmi": 22.7,
    "systolic_bp": 118,
    "diastolic_bp": 76,
    "resting_hr": 62,
    "temperature_c": 36.8,
    "smoker": false,
    "label": "healthy"
  }
}`,
    rules: `# assert
* >=(observation.age_years, \`0\`)
* <=(observation.age_years, \`120\`)
* >=(observation.height_m, \`0.5\`)
* <=(observation.height_m, \`2.5\`)
* >=(observation.weight_kg, \`2\`)
* <=(observation.weight_kg, \`300\`)
* <=(-(observation.bmi, /(observation.weight_kg, *(observation.height_m, observation.height_m))), \`0.1\`)
* <=(-(/(observation.weight_kg, *(observation.height_m, observation.height_m)), observation.bmi), \`0.1\`)
* >=(observation.systolic_bp, \`40\`)
* <=(observation.systolic_bp, \`250\`)
* >=(observation.diastolic_bp, \`20\`)
* <=(observation.diastolic_bp, \`150\`)
* >=(observation.systolic_bp, +(observation.diastolic_bp, \`10\`))
* >=(observation.resting_hr, \`20\`)
* <=(observation.resting_hr, \`220\`)
* >=(observation.temperature_c, \`25\`)
* <=(observation.temperature_c, \`45\`)
* or(=(observation.label, \`healthy\`), =(observation.label, \`at_risk\`), =(observation.label, \`chronic\`))
* implies(observation.smoker, not(=(observation.label, \`healthy\`)))

# check
`,
  },

  intake: {
    json: `{
  "order": {
    "order_id": "ORD-2026-4891",
    "customer_tier": "gold",
    "status": "shipped",
    "quantity": 10,
    "unit_price": 50,
    "subtotal": 500,
    "discount_rate": 0.1,
    "discount_amount": 50,
    "tax_rate": 0.1,
    "tax": 45,
    "total": 495
  }
}`,
    rules: `# assert
* >(order.quantity, \`0\`)
* >=(order.unit_price, \`0\`)
* >=(order.discount_rate, \`0\`)
* <=(order.discount_rate, \`1\`)
* =(order.subtotal, *(order.quantity, order.unit_price))
* =(order.discount_amount, *(order.subtotal, order.discount_rate))
* =(order.tax, *(-(order.subtotal, order.discount_amount), order.tax_rate))
* =(order.total, -(+(order.subtotal, order.tax), order.discount_amount))
* or(=(order.status, \`pending\`), =(order.status, \`shipped\`), =(order.status, \`delivered\`), =(order.status, \`cancelled\`))
* or(=(order.customer_tier, \`bronze\`), =(order.customer_tier, \`silver\`), =(order.customer_tier, \`gold\`), =(order.customer_tier, \`platinum\`))
* implies(=(order.customer_tier, \`gold\`), >=(order.discount_rate, \`0.1\`))

# check
`,
  },

  scheduling: {
    json: `{
  "workday_start": 9,
  "workday_end": 17
}`,
    rules: `# declare
* meeting_a : Int
* meeting_b : Int
* meeting_c : Int

# assert
* >=(meeting_a, workday_start)
* <=(meeting_a, \`11\`)
* >=(meeting_b, +(meeting_a, \`1\`))
* >=(meeting_c, +(meeting_b, \`2\`))
* <=(+(meeting_c, \`1\`), workday_end)

# check
`,
  },

  compliance: {
    json: `{
  "security_group": {
    "name": "web-prod",
    "ingress": {
      "port": 443,
      "protocol": "tcp",
      "cidr": "0.0.0.0/0"
    }
  }
}`,
    rules: `# assert
* not(and(=(security_group.ingress.port, \`22\`), =(security_group.ingress.cidr, \`0.0.0.0/0\`)))
* or(=(security_group.ingress.protocol, \`tcp\`), =(security_group.ingress.protocol, \`udp\`))

# check
`,
  },

  longitudinal: {
    json: `{
  "respondent": {
    "id": "HRS-00421",
    "sex": "F",
    "birth_year": 1962,
    "enrollment_year": 2010,
    "wave_year": 2022,
    "age": 60,
    "education_isced": 5,
    "marital_status": "married",
    "employment_status": "employed",
    "retirement_year": 0,
    "hours_main": 40,
    "hours_second": 0,
    "hours_total": 40,
    "wages_annual": 68000,
    "benefits_annual": 4000,
    "other_income": 1200,
    "income_total": 73200,
    "smoking_status": "former",
    "pack_years": 12,
    "self_rated_health": 4,
    "wellbeing_1": 4,
    "wellbeing_2": 5,
    "wellbeing_3": 3,
    "wellbeing_sum": 12
  }
}`,
    rules: `# assert
* =(respondent.age, -(respondent.wave_year, respondent.birth_year))
* =(respondent.hours_total, +(respondent.hours_main, respondent.hours_second))
* =(respondent.income_total, +(respondent.wages_annual, respondent.benefits_annual, respondent.other_income))
* =(respondent.wellbeing_sum, +(respondent.wellbeing_1, respondent.wellbeing_2, respondent.wellbeing_3))
* >=(respondent.age, \`18\`)
* <=(respondent.age, \`110\`)
* <=(respondent.hours_total, \`168\`)
* >=(respondent.education_isced, \`0\`)
* <=(respondent.education_isced, \`8\`)
* >=(respondent.self_rated_health, \`1\`)
* <=(respondent.self_rated_health, \`5\`)
* >=(respondent.wellbeing_1, \`1\`)
* <=(respondent.wellbeing_1, \`5\`)
* >=(respondent.wellbeing_2, \`1\`)
* <=(respondent.wellbeing_2, \`5\`)
* >=(respondent.wellbeing_3, \`1\`)
* <=(respondent.wellbeing_3, \`5\`)
* <=(respondent.birth_year, respondent.enrollment_year)
* <=(respondent.enrollment_year, respondent.wave_year)
* or(=(respondent.sex, \`F\`), =(respondent.sex, \`M\`), =(respondent.sex, \`X\`))
* or(=(respondent.marital_status, \`single\`), =(respondent.marital_status, \`married\`), =(respondent.marital_status, \`divorced\`), =(respondent.marital_status, \`widowed\`), =(respondent.marital_status, \`separated\`))
* or(=(respondent.employment_status, \`employed\`), =(respondent.employment_status, \`self_employed\`), =(respondent.employment_status, \`retired\`), =(respondent.employment_status, \`unemployed\`), =(respondent.employment_status, \`homemaker\`))
* or(=(respondent.smoking_status, \`never\`), =(respondent.smoking_status, \`former\`), =(respondent.smoking_status, \`current\`))
* implies(=(respondent.smoking_status, \`never\`), =(respondent.pack_years, \`0\`))
* implies(=(respondent.employment_status, \`retired\`), and(>(respondent.retirement_year, \`0\`), <=(respondent.retirement_year, respondent.wave_year)))
* distinct(respondent.age, \`-999\`, \`-8\`, \`-9\`)
* distinct(respondent.income_total, \`-999\`, \`-8\`, \`-9\`)
* distinct(respondent.self_rated_health, \`-999\`, \`-8\`, \`-9\`)

# check
`,
  },

  social: {
    json: `{
  "account": {
    "id": "@thalia_42",
    "verified": false,
    "created_at_days_ago": 180,
    "follower_count": 248,
    "following_count": 310,
    "post_count": 142,
    "language": "en"
  },
  "post": {
    "id": "p-8812345",
    "created_at_days_ago": 2,
    "likes": 12,
    "replies": 3,
    "reposts": 1,
    "impressions": 420,
    "contains_link": false,
    "flagged_spam": false
  }
}`,
    rules: `# declare
* total_engagement : Int

# assert
* =(total_engagement, +(post.likes, post.replies, post.reposts))
* >=(post.likes, \`0\`)
* >=(post.replies, \`0\`)
* >=(post.reposts, \`0\`)
* >=(post.impressions, \`0\`)
* <=(total_engagement, post.impressions)
* >=(account.created_at_days_ago, post.created_at_days_ago)
* >=(account.follower_count, \`0\`)
* >=(account.following_count, \`0\`)
* >=(account.post_count, \`0\`)
* or(=(account.language, \`en\`), =(account.language, \`es\`), =(account.language, \`fr\`), =(account.language, \`pt\`), =(account.language, \`de\`), =(account.language, \`ja\`))
* implies(account.verified, >=(account.created_at_days_ago, \`30\`))
* implies(<(account.created_at_days_ago, \`7\`), <=(account.post_count, \`50\`))
* implies(and(>=(account.following_count, \`1000\`), <=(account.follower_count, \`10\`)), <=(account.post_count, \`5\`))
* implies(post.flagged_spam, or(post.contains_link, >=(account.following_count, \`1000\`)))

# check
`,
  },

  fhir: {
    json: `{
  "patient": {
    "resourceType": "Patient",
    "id": "pt-00421",
    "active": true,
    "age_years": 7,
    "weight_kg": 24
  },
  "medicationRequest": {
    "resourceType": "MedicationRequest",
    "id": "rx-88172",
    "status": "active",
    "intent": "order",
    "medication_code": "acetaminophen",
    "dose_mg": 320,
    "frequency_per_day": 4
  }
}`,
    rules: `# declare
* total_daily_mg : Int

# assert
* =(patient.resourceType, \`Patient\`)
* =(medicationRequest.resourceType, \`MedicationRequest\`)
* =(total_daily_mg, *(medicationRequest.dose_mg, medicationRequest.frequency_per_day))
* >=(medicationRequest.dose_mg, \`0\`)
* >=(medicationRequest.frequency_per_day, \`0\`)
* <=(total_daily_mg, \`4000\`)
* implies(<(patient.age_years, \`12\`), <=(total_daily_mg, *(\`75\`, patient.weight_kg)))
* or(=(medicationRequest.status, \`active\`), =(medicationRequest.status, \`on-hold\`), =(medicationRequest.status, \`completed\`), =(medicationRequest.status, \`cancelled\`), =(medicationRequest.status, \`stopped\`))
* or(=(medicationRequest.intent, \`proposal\`), =(medicationRequest.intent, \`plan\`), =(medicationRequest.intent, \`order\`))
* implies(not(patient.active), not(=(medicationRequest.status, \`active\`)))

# check
`,
  },
};

export const DEFAULT_EXAMPLE = 'easy';
