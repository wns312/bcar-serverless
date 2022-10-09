const envs = {
    BCAR_TABLE: process.env.BCAR_TABLE!,
    BCAR_INDEX: process.env.BCAR_INDEX!,
    BCAR_BASE_URL: process.env.BCAR_BASE_URL!,
    BCAR_ADMIN_LOGIN_PAGE: process.env.BCAR_ADMIN_LOGIN_PAGE!,
    BCAR_ADMIN_MAIN_PAGE: process.env.BCAR_ADMIN_MAIN_PAGE!,
    ADMIN_ID: process.env.ADMIN_ID!,
    ADMIN_PW: process.env.ADMIN_PW!,
    DYNAMO_DB_REGION: process.env.DYNAMO_DB_REGION!,
    BCAR_DETAIL_PAGE_TEMPLATE: process.env.BCAR_DETAIL_PAGE_TEMPLATE!,
}
if (!Object.values(envs).every(env => env)) {
throw new Error('sddssds')
}

export { envs }