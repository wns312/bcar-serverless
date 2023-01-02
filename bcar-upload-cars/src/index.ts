import { envs } from "./configs"
import { BrowserInitializer, CarUploader, CategoryCrawler, CategoryService } from "./puppeteer"
import { CarUploadService } from "./puppeteer"
import { CategoryFormatter, CarObjectFormatter } from "./utils"
import { DynamoClient, DynamoCategoryClient } from "./db/dynamo"
import { AccountSheetClient } from "./sheet/index"
import { request } from "http"
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
    await carUploadService.uploadCars(BCAR_ANSAN_CROSS_LOGIN_URL, BCAR_ANSAN_CROSS_CAR_REGISTER_URL)
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

function checkIPAddress() {
  const options = {
    host: 'api.ipify.org',
    port: 80,
    path: '/?format=json'
  };

  const req = request(options, (res) => {
    res.setEncoding('utf8');

    let body = '';
    res.on('data', (chunk) => {
      body += chunk;
    });

    res.on('end', () => {
      const data = JSON.parse(body);
      console.log(data.ip);
    });
  });

  req.end();
}

const functionMap = new Map<string, Function>([
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
