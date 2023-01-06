import { existsSync } from "node:fs"
import { mkdir, rm } from "fs/promises"
import { envs } from "./configs"
import { BrowserInitializer, CategoryCrawler } from "./puppeteer"
import { CarUploadService, CategoryService, UploadedCarSyncService } from "./services"
import { AccountSheetClient, DynamoCarClient, DynamoCategoryClient, DynamoUploadedCarClient } from "./db"

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
const initializer = new BrowserInitializer(NODE_ENV)
const crawler = new CategoryCrawler(initializer)
const dynamoCarClient = new DynamoCarClient(DYNAMO_DB_REGION, BCAR_TABLE, BCAR_INDEX)
const dynamoCategoryClient = new DynamoCategoryClient(DYNAMO_DB_REGION, BCAR_CATEGORY_TABLE, BCAR_CATEGORY_INDEX)
const dynamoUploadedCarClient = new DynamoUploadedCarClient(DYNAMO_DB_REGION, BCAR_TABLE, BCAR_INDEX)

async function syncUpdatedCars() {
  const syncService = new UploadedCarSyncService(dynamoCarClient, dynamoUploadedCarClient, sheetClient, initializer)
  await syncService.execute()
}

async function testUpdateCars() {
  const carUploadService = new CarUploadService(
    sheetClient,
    dynamoCarClient,
    dynamoCategoryClient,
    dynamoUploadedCarClient,
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
  const carUploadService = new CarUploadService(
    sheetClient,
    dynamoCarClient,
    dynamoCategoryClient,
    dynamoUploadedCarClient,
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
  const categoryService = new CategoryService(sheetClient, crawler, dynamoCategoryClient)

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

(async ()=>{
  await rm('./images/*', { recursive: true, force: true })
  if(!existsSync("./images")) {
    await mkdir("./images")
  }
  await fc()
})()

