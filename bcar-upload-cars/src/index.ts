import { envs } from "./configs"
import { BrowserInitializer, CarUploader, CategoryCrawler, CategoryService } from "./puppeteer"
import { CategoryFormatter } from "./utils"
import { DynamoClient } from "./db/dynamo/DynamoClient"
import { AccountSheetClient } from "./sheet/index"

async function updateCars() {
  const {
    BCAR_ANSAN_CROSS_CAR_REGISTER_URL,
    BCAR_ANSAN_CROSS_LOGIN_URL,
    BCAR_INDEX,
    BCAR_TABLE,
    DYNAMO_DB_REGION,
    GOOGLE_CLIENT_EMAIL,
    GOOGLE_PRIVATE_KEY,
    NODE_ENV,
  } = envs

  // 추후 wrapping class가 생길 경우 그 내부로 옮겨질 수 있음.
  const sheetClient = new AccountSheetClient(GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY)
  const { id: testId, pw: testPw } = await sheetClient.getTestAccount()

  const initializer = new BrowserInitializer(NODE_ENV)
  const dynamoClient = new DynamoClient(DYNAMO_DB_REGION, BCAR_TABLE, BCAR_INDEX)
  const carUploader = new CarUploader(initializer, dynamoClient)

  try {
    await carUploader.execute(testId, testPw, BCAR_ANSAN_CROSS_LOGIN_URL, BCAR_ANSAN_CROSS_CAR_REGISTER_URL)
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.name);
      console.error(error.message);
      console.error(error.stack);
    }
  } finally {
    await initializer.closeBrowsers()
  }
}


async function crawlCategories() {
  const {
    BCAR_ANSAN_CROSS_CAR_REGISTER_URL,
    BCAR_ANSAN_CROSS_LOGIN_URL,
    BCAR_CATEGORY_INDEX,
    BCAR_CATEGORY_TABLE,
    DYNAMO_DB_REGION,
    GOOGLE_CLIENT_EMAIL,
    GOOGLE_PRIVATE_KEY,
    NODE_ENV,
  } = envs

  const sheetClient = new AccountSheetClient(GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY)
  const initializer = new BrowserInitializer(NODE_ENV)
  const crawler = new CategoryCrawler(initializer)
  const formatter = new CategoryFormatter()
  const dynamoClient = new DynamoClient(DYNAMO_DB_REGION, BCAR_CATEGORY_TABLE, BCAR_CATEGORY_INDEX)
  const categoryService = new CategoryService(sheetClient, crawler, formatter, dynamoClient)

  try {
    await categoryService.collectCategoryInfo(BCAR_ANSAN_CROSS_LOGIN_URL, BCAR_ANSAN_CROSS_CAR_REGISTER_URL)
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.name);
      console.error(error.message);
      console.error(error.stack);
    }
  } finally {
    await initializer.closeBrowsers()
  }
}

eval(`${process.argv[2]}()`)
