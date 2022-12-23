import { envs } from "./configs"
import { BrowserInitializer, CarUploader, CategoryCrawler, CategoryService } from "./puppeteer"
import { CategoryFormatter } from "./utils"
import { DynamoClient } from "./db/dynamo/DynamoClient"
import { AccountSheetClient } from "./sheet/index"

async function updateCars() {
  const { DYNAMO_DB_REGION, BCAR_TABLE, BCAR_INDEX } = envs
  const sheetClient = new AccountSheetClient(envs.GOOGLE_CLIENT_EMAIL, envs.GOOGLE_PRIVATE_KEY)
  const initializer = new BrowserInitializer(envs)
  const dynamoClient = new DynamoClient(DYNAMO_DB_REGION, BCAR_TABLE, BCAR_INDEX)
  const carUploader = new CarUploader(sheetClient, initializer, dynamoClient, envs)
  const browser = await initializer.createBrowser()

  try {
    const page = await browser.newPage()
    await carUploader.execute(page)
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.name);
      console.error(error.message);
      console.error(error.stack);
    }
  } finally {
    await browser.close()
    console.info("Browser closed");
  }
}


async function crawlCategories() {
  const { DYNAMO_DB_REGION, BCAR_CATEGORY_TABLE, BCAR_CATEGORY_INDEX } = envs
  const sheetClient = new AccountSheetClient(envs.GOOGLE_CLIENT_EMAIL, envs.GOOGLE_PRIVATE_KEY)
  const initializer = new BrowserInitializer(envs)
  const crawler = new CategoryCrawler(initializer, envs)
  const formatter = new CategoryFormatter()
  const dynamoClient = new DynamoClient(DYNAMO_DB_REGION, BCAR_CATEGORY_TABLE, BCAR_CATEGORY_INDEX)
  const categoryService = new CategoryService(sheetClient, crawler, formatter, dynamoClient)


  try {
    await categoryService.collectCategoryInfo()
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.name);
      console.error(error.message);
      console.error(error.stack);
    }
  } finally {
    const promiseClosedBrowsers = crawler.browserList.map(browser => browser.close());
    await Promise.all(promiseClosedBrowsers)
    console.info(`Total ${promiseClosedBrowsers.length} browser(s) closed`);
  }
}



eval(`${process.argv[2]}()`)
