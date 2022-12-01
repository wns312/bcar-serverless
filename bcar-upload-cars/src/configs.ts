const envs = {
  NODE_ENV: process.env.NODE_ENV!,
  BCAR_ANSAN_CROSS_LOGIN_URL: process.env.BCAR_ANSAN_CROSS_LOGIN_URL!,
  BCAR_ANSAN_CROSS_CAR_REGISTER_URL: process.env.BCAR_ANSAN_CROSS_CAR_REGISTER_URL!,
  TMP_ID: process.env.TMP_ID!,
  TMP_PW: process.env.TMP_PW!,
  DYNAMO_DB_REGION: process.env.DYNAMO_DB_REGION!,
  BCAR_TABLE: process.env.BCAR_TABLE!,
  BCAR_INDEX: process.env.BCAR_INDEX!,
  BCAR_CATEGORY_TABLE: process.env.BCAR_CATEGORY_TABLE!,
  BCAR_CATEGORY_INDEX: process.env.BCAR_CATEGORY_INDEX!,
}

if (envs.NODE_ENV === 'prod') {
  console.table(process.env);
}

// 여기서 false
if (!Object.values(envs).every(env => env !== undefined)) {
  throw new Error('Importing required env failed')
}

export { envs }
