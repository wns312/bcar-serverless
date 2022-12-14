import { promises as fs } from 'fs';
import { envs } from "./configs"
import { BrowserInitializer, CarUploader, CategoryCrawler, CategoryService } from "./puppeteer"
import { CarBase, CarCategory, CarManufacturer, CarModel, CarDetailModel } from "./types"
import { DynamoClient } from "./db/dynamo/DynamoClient"
import { CategoryFormatter } from "./utils"

async function updateCars() {
  const initializer = new BrowserInitializer(envs)
  const carUploader = new CarUploader(initializer, envs)
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
  const initializer = new BrowserInitializer(envs)
  const crawler = new CategoryCrawler(initializer, envs)
  const formatter = new CategoryFormatter()
  const dynamoClient = new DynamoClient(DYNAMO_DB_REGION, BCAR_CATEGORY_TABLE, BCAR_CATEGORY_INDEX)
  const categoryService = new CategoryService(envs, crawler, formatter, dynamoClient)


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




// 이렇게 처리해주는 경우 검증해주지는 못한다. 추후 변경
const argv = process.argv.slice(3).map(arg=>{
  if (!Number.isNaN(Number(arg))) {
    return Number(arg)
  }
  return arg === 'true' ? 'true' :
    arg === 'false' ? 'false' :
      arg === 'undefined' ? 'undefined' :
        arg === 'null' ? 'null' :
          `"${arg}"`
})


eval(`${process.argv[2]}(${argv})`)
