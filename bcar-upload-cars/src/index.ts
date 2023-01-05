import { rm } from "fs/promises"
import { envs } from "./configs"
import { BrowserInitializer, CategoryCrawler, CategoryService, UploadedCarSyncService } from "./puppeteer"
import { CarUploadService } from "./puppeteer"
import { CategoryFormatter, CarObjectFormatter } from "./utils"
import { DynamoClient, DynamoCategoryClient, DynamoUploadedCarClient } from "./db/dynamo"
import { AccountSheetClient } from "./sheet/index"

async function syncUpdatedCars() {
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
  const dynamoUploadedCarClient = new DynamoUploadedCarClient(DYNAMO_DB_REGION, BCAR_TABLE, BCAR_INDEX)
  const initializer = new BrowserInitializer(NODE_ENV)
  const syncService = new UploadedCarSyncService(dynamoUploadedCarClient, initializer)
  await syncService.execute()
}

async function testUpdateCars() {
  await rm('./images/*', { recursive: true, force: true })
  const {
    BCAR_ANSAN_CROSS_CAR_REGISTER_URL,
    BCAR_ANSAN_CROSS_LOGIN_URL,
    BCAR_CATEGORY_INDEX,
    BCAR_CATEGORY_TABLE,
    BCAR_INDEX,
    BCAR_TABLE,
    DYNAMO_DB_REGION,
    GOOGLE_CLIENT_EMAIL,
    GOOGLE_PRIVATE_KEY,
    NODE_ENV,
  } = envs

  const sheetClient = new AccountSheetClient(GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY)
  const dynamoCarClient = new DynamoClient(DYNAMO_DB_REGION, BCAR_TABLE, BCAR_INDEX)
  const dynamoCategoryClient = new DynamoCategoryClient(DYNAMO_DB_REGION, BCAR_CATEGORY_TABLE, BCAR_CATEGORY_INDEX)
  const formatter = new CarObjectFormatter()
  const initializer = new BrowserInitializer(NODE_ENV)

  const carUploadService = new CarUploadService(
    sheetClient,
    dynamoCarClient,
    dynamoCategoryClient,
    formatter,
    initializer
  )

  try {
    await carUploadService.uploadCars(
      BCAR_ANSAN_CROSS_LOGIN_URL,
      BCAR_ANSAN_CROSS_CAR_REGISTER_URL,
      1,
      2,
    )
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.name);
      console.error(error.message);
      console.error(error.stack);
    }
  } finally {
    await initializer.closePages()
  }
  console.log("End execution");

}

async function updateCars() {
  const {
    BCAR_ANSAN_CROSS_CAR_REGISTER_URL,
    BCAR_ANSAN_CROSS_LOGIN_URL,
    BCAR_CATEGORY_INDEX,
    BCAR_CATEGORY_TABLE,
    BCAR_INDEX,
    BCAR_TABLE,
    DYNAMO_DB_REGION,
    GOOGLE_CLIENT_EMAIL,
    GOOGLE_PRIVATE_KEY,
    NODE_ENV,
  } = envs

  const sheetClient = new AccountSheetClient(GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY)
  const dynamoCarClient = new DynamoClient(DYNAMO_DB_REGION, BCAR_TABLE, BCAR_INDEX)
  const dynamoCategoryClient = new DynamoCategoryClient(DYNAMO_DB_REGION, BCAR_CATEGORY_TABLE, BCAR_CATEGORY_INDEX)
  const formatter = new CarObjectFormatter()
  const initializer = new BrowserInitializer(NODE_ENV)

  const carUploadService = new CarUploadService(
    sheetClient,
    dynamoCarClient,
    dynamoCategoryClient,
    formatter,
    initializer
  )

  try {
    await carUploadService.uploadCars(
      BCAR_ANSAN_CROSS_LOGIN_URL,
      BCAR_ANSAN_CROSS_CAR_REGISTER_URL,
      3,
      10000
    )
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.name);
      console.error(error.message);
      console.error(error.stack);
    }
  } finally {
    await initializer.closePages()
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
    await initializer.closePages()
  }
}

async function checkIPAddress() {
  const response = await fetch('http://api.ipify.org/?format=json')
  const body = await response.json()
  console.log(body.ip);
}

const functionMap = new Map<string, Function>([
  [syncUpdatedCars.name, syncUpdatedCars],
  [testUpdateCars.name, testUpdateCars],
  [updateCars.name, updateCars],
  [crawlCategories.name, crawlCategories],
  [checkIPAddress.name, checkIPAddress],
])

const fc = functionMap.get(process.argv[2])

if (!fc) {
  console.error("[Function list]");
  console.error("--------------------------------");
  console.error(Array.from(functionMap.keys()).join("\n"));
  console.error("--------------------------------\n");
  console.error();
  throw new Error("There is not matched function");
}

fc()
